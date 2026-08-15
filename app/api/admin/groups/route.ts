import { requireAdminSession } from "@/lib/admin-auth";
import { createPrivateLinkToken, revealPrivateLinkToken } from "@/lib/private-links";
import { ensureSystemSeed } from "@/lib/registration-defaults";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

type GroupRow = {
  id: string; school_year_id: string; name: string; age_min: number | null; age_max: number | null;
  weekday: number; start_time: string | null; end_time: string | null; session_length_minutes: number;
  location: string | null; status: string; announcement_title: string | null; announcement_body: string | null;
  announcement_updated_at: string | null; share_token_ciphertext: string | null; member_count: number;
};

function value(input: unknown, max = 240) { return typeof input === "string" ? input.trim().slice(0, max) : ""; }
function number(input: unknown, fallback: number | null = null) { const parsed = Number(input); return Number.isFinite(parsed) ? Math.round(parsed) : fallback; }

async function expose(row: GroupRow, origin: string, runtime: ReturnType<typeof getRuntimeEnv>) {
  let scheduleUrl = "";
  if (row.share_token_ciphertext) {
    try { scheduleUrl = `${origin}/schedule/${encodeURIComponent(await revealPrivateLinkToken(row.share_token_ciphertext, runtime))}`; } catch { scheduleUrl = ""; }
  }
  return {
    id: row.id, yearId: row.school_year_id, name: row.name, ageMin: row.age_min, ageMax: row.age_max,
    weekday: row.weekday, startTime: row.start_time || "", endTime: row.end_time || "", sessionLengthMinutes: row.session_length_minutes,
    location: row.location || "", status: row.status, memberCount: row.member_count,
    announcementTitle: row.announcement_title || "", announcementBody: row.announcement_body || "", announcementUpdatedAt: row.announcement_updated_at,
    scheduleUrl,
  };
}

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    await ensureSystemSeed(runtime.DB);
    const url = new URL(request.url);
    const yearId = value(url.searchParams.get("yearId"), 80);
    const result = await runtime.DB.prepare(`
      SELECT g.*, (SELECT COUNT(*) FROM enrollments e WHERE e.group_id = g.id AND e.status = 'active') AS member_count
      FROM groups g WHERE (? = '' OR g.school_year_id = ?) ORDER BY g.school_year_id DESC, g.start_time, g.name
    `).bind(yearId, yearId).all<GroupRow>();
    const groups = await Promise.all(result.results.map((row) => expose(row, url.origin, runtime)));
    const unassigned = yearId ? await runtime.DB.prepare(`
      SELECT e.id AS enrollment_id, s.id AS student_id, s.full_name, s.birth_date
      FROM enrollments e JOIN students s ON s.id = e.student_id
      WHERE e.school_year_id = ? AND e.status = 'active' AND e.group_id IS NULL
      ORDER BY s.full_name
    `).bind(yearId).all<{ enrollment_id: string; student_id: string; full_name: string; birth_date: string | null }>() : { results: [] };
    return Response.json({ groups, unassigned: unassigned.results.map((row) => ({ enrollmentId: row.enrollment_id, studentId: row.student_id, name: row.full_name, birthDate: row.birth_date })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Groups could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const yearId = value(body.yearId, 80);
    const name = value(body.name, 100);
    if (!yearId || !name) return Response.json({ error: "School year and group name are required." }, { status: 400 });
    const year = await runtime.DB.prepare(`SELECT id FROM school_years WHERE id = ? LIMIT 1`).bind(yearId).first<{ id: string }>();
    if (!year) return Response.json({ error: "School year not found." }, { status: 404 });
    const link = await createPrivateLinkToken(runtime);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await runtime.DB.batch([
      runtime.DB.prepare(`
        INSERT INTO groups (id, school_year_id, name, age_min, age_max, weekday, start_time, end_time, session_length_minutes, location, status, share_token_hash, share_token_ciphertext, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
      `).bind(id, yearId, name, number(body.ageMin), number(body.ageMax), Math.min(6, Math.max(0, number(body.weekday, 3) || 3)), value(body.startTime, 5) || null, value(body.endTime, 5) || null, Math.min(180, Math.max(15, number(body.sessionLengthMinutes, 50) || 50)), value(body.location, 160) || null, link.tokenHash, link.tokenCiphertext, now, now),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'group.created', 'group', ?, 'Group created', ?, ?)`).bind(yearId, admin.id, id, JSON.stringify({ name }), now),
    ]);
    return Response.json({ id, scheduleUrl: `${new URL(request.url).origin}/schedule/${encodeURIComponent(link.token)}` }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Group could not be created.";
    return Response.json({ error: message.includes("UNIQUE") ? "A group with this name already exists for the selected year." : message }, { status: message.includes("UNIQUE") ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const action = value(body.action, 40) || "update";
    const now = new Date().toISOString();
    if (action === "assign") {
      const enrollmentId = value(body.enrollmentId, 80);
      const groupId = value(body.groupId, 80);
      const group = groupId ? await runtime.DB.prepare(`SELECT id, school_year_id, name FROM groups WHERE id = ? AND status = 'active' LIMIT 1`).bind(groupId).first<{ id: string; school_year_id: string; name: string }>() : null;
      const enrollment = await runtime.DB.prepare(`SELECT id, school_year_id, student_id, group_id FROM enrollments WHERE id = ? LIMIT 1`).bind(enrollmentId).first<{ id: string; school_year_id: string; student_id: string; group_id: string | null }>();
      if (!enrollment || (groupId && !group) || (group && group.school_year_id !== enrollment.school_year_id)) return Response.json({ error: "The student and group could not be matched." }, { status: 400 });
      await runtime.DB.batch([
        runtime.DB.prepare(`UPDATE enrollments SET group_id = ?, group_label = ?, updated_at = ? WHERE id = ?`).bind(group?.id || null, group?.name || null, now, enrollmentId),
        runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'enrollment.group_changed', 'enrollment', ?, 'Student group assignment changed', ?, ?)`).bind(enrollment.school_year_id, admin.id, enrollmentId, JSON.stringify({ from: enrollment.group_id, to: group?.id || null }), now),
      ]);
      return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
    }
    const id = value(body.id, 80);
    const group = await runtime.DB.prepare(`SELECT * FROM groups WHERE id = ? LIMIT 1`).bind(id).first<GroupRow>();
    if (!group) return Response.json({ error: "Group not found." }, { status: 404 });
    if (action === "rotate-link") {
      const link = await createPrivateLinkToken(runtime);
      await runtime.DB.batch([
        runtime.DB.prepare(`UPDATE groups SET share_token_hash = ?, share_token_ciphertext = ?, updated_at = ? WHERE id = ?`).bind(link.tokenHash, link.tokenCiphertext, now, id),
        runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, created_at) VALUES (?, 'admin', ?, 'group.link_rotated', 'group', ?, 'Private schedule link reset', ?)`).bind(group.school_year_id, admin.id, id, now),
      ]);
      return Response.json({ scheduleUrl: `${new URL(request.url).origin}/schedule/${encodeURIComponent(link.token)}` }, { headers: { "Cache-Control": "no-store" } });
    }
    const announcementChanged = body.announcementTitle !== undefined || body.announcementBody !== undefined;
    await runtime.DB.batch([
      runtime.DB.prepare(`UPDATE groups SET name = ?, age_min = ?, age_max = ?, weekday = ?, start_time = ?, end_time = ?, session_length_minutes = ?, location = ?, status = ?, announcement_title = ?, announcement_body = ?, announcement_updated_at = ?, updated_at = ? WHERE id = ?`).bind(value(body.name, 100) || group.name, body.ageMin === undefined ? group.age_min : number(body.ageMin), body.ageMax === undefined ? group.age_max : number(body.ageMax), body.weekday === undefined ? group.weekday : Math.min(6, Math.max(0, number(body.weekday, 3) || 3)), body.startTime === undefined ? group.start_time : value(body.startTime, 5) || null, body.endTime === undefined ? group.end_time : value(body.endTime, 5) || null, body.sessionLengthMinutes === undefined ? group.session_length_minutes : Math.min(180, Math.max(15, number(body.sessionLengthMinutes, 50) || 50)), body.location === undefined ? group.location : value(body.location, 160) || null, value(body.status, 30) || group.status, body.announcementTitle === undefined ? group.announcement_title : value(body.announcementTitle, 140) || null, body.announcementBody === undefined ? group.announcement_body : value(body.announcementBody, 1200) || null, announcementChanged ? now : group.announcement_updated_at, now, id),
      runtime.DB.prepare(`UPDATE enrollments SET group_label = ?, updated_at = ? WHERE group_id = ?`).bind(value(body.name, 100) || group.name, now, id),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'group.updated', 'group', ?, 'Group settings updated', ?, ?)`).bind(group.school_year_id, admin.id, id, JSON.stringify({ fields: Object.keys(body).filter((key) => key !== "id") }), now),
    ]);
    return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Group could not be saved." }, { status: 500 });
  }
}

