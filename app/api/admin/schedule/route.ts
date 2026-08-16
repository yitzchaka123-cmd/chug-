import { requireAdminSession } from "@/lib/admin-auth";
import { combineLocalDateTime, holidayForDate, recurringDates } from "@/lib/calendar";
import { ensureCurrentRegistrationConfig } from "@/lib/registration-defaults";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

function value(input: unknown, max = 1000) { return typeof input === "string" ? input.trim().slice(0, max) : ""; }

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const url = new URL(request.url);
    const yearId = value(url.searchParams.get("yearId"), 80);
    const groupId = value(url.searchParams.get("groupId"), 80);
    if (!yearId) return Response.json({ error: "School year is required." }, { status: 400 });
    const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") || "") ? url.searchParams.get("month")! : "";
    const start = month ? `${month}-01T00:00` : "0000";
    const endDate = month ? new Date(`${month}-01T12:00:00Z`) : null;
    if (endDate) endDate.setUTCMonth(endDate.getUTCMonth() + 1);
    const end = endDate ? endDate.toISOString().slice(0, 10) + "T00:00" : "9999";
    const events = await runtime.DB.prepare(`
      SELECT se.*, g.name AS group_name FROM schedule_events se
      LEFT JOIN groups g ON g.id = se.group_id
      WHERE se.school_year_id = ? AND (? = '' OR se.group_id = ?) AND se.starts_at >= ? AND se.starts_at < ?
      ORDER BY se.starts_at, g.name
    `).bind(yearId, groupId, groupId, start, end).all<Record<string, unknown>>();
    const versions = await runtime.DB.prepare(`SELECT id, version, name, status, finalized_at FROM schedule_versions WHERE school_year_id = ? ORDER BY version DESC`).bind(yearId).all<{ id: string; version: number; name: string; status: string; finalized_at: string }>();
    return Response.json({ events: events.results, versions: versions.results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Schedule could not be loaded." }, { status: 500 });
  }
}

async function generationPlan(runtime: ReturnType<typeof getRuntimeEnv>, yearId: string, groupIds?: string[]) {
  const settings = await ensureCurrentRegistrationConfig(runtime.DB, yearId);
  const groups = await runtime.DB.prepare(`SELECT id, name, weekday, start_time, end_time, session_length_minutes, location FROM groups WHERE school_year_id = ? AND status = 'active' ORDER BY start_time, name`).bind(yearId).all<{ id: string; name: string; weekday: number; start_time: string | null; end_time: string | null; session_length_minutes: number; location: string | null }>();
  const selected = groupIds?.length ? groups.results.filter((group) => groupIds.includes(group.id)) : groups.results;
  const plan: Array<{ groupId: string; groupName: string; date: string; startsAt: string; endsAt: string; location: string; holiday: ReturnType<typeof holidayForDate> }> = [];
  for (const group of selected) {
    for (const date of recurringDates(settings.startsOn, settings.endsOn, group.weekday ?? settings.scheduleWeekday)) {
      const holiday = holidayForDate(date);
      if (holiday) continue;
      const startTime = group.start_time || settings.scheduleStartTime;
      let endTime = group.end_time || "";
      if (!endTime) {
        const [hour, minute] = startTime.split(":").map(Number);
        const endMinutes = hour * 60 + minute + group.session_length_minutes;
        endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
      }
      plan.push({ groupId: group.id, groupName: group.name, date, startsAt: combineLocalDateTime(date, startTime), endsAt: combineLocalDateTime(date, endTime), location: group.location || settings.location, holiday });
    }
  }
  return plan;
}

export async function POST(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const action = value(body.action, 40) || "create";
    const yearId = value(body.yearId, 80);
    if (!yearId) return Response.json({ error: "School year is required." }, { status: 400 });
    const now = new Date().toISOString();
    if (action === "preview" || action === "generate") {
      const groupIds = Array.isArray(body.groupIds) ? body.groupIds.filter((item): item is string => typeof item === "string").slice(0, 100) : undefined;
      const plan = await generationPlan(runtime, yearId, groupIds);
      if (action === "preview") return Response.json({ count: plan.length, sessions: plan.slice(0, 500) }, { headers: { "Cache-Control": "no-store" } });
      const statements: D1PreparedStatement[] = [];
      for (const session of plan) {
        statements.push(runtime.DB.prepare(`
          INSERT OR IGNORE INTO schedule_events (id, school_year_id, group_id, kind, title_en, starts_at, ends_at, location, status, source, source_key, created_by, created_at, updated_at)
          VALUES (?, ?, ?, 'session', 'Choir session', ?, ?, ?, 'scheduled', 'recurring', ?, ?, ?, ?)
        `).bind(crypto.randomUUID(), yearId, session.groupId, session.startsAt, session.endsAt, session.location, `${session.groupId}:${session.date}`, admin.id, now, now));
      }
      statements.push(runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'schedule.generated', 'school_year', ?, 'Recurring schedule generated', ?, ?)`).bind(yearId, admin.id, yearId, JSON.stringify({ requested: plan.length, groups: groupIds || "all" }), now));
      for (let offset = 0; offset < statements.length; offset += 80) await runtime.DB.batch(statements.slice(offset, offset + 80));
      return Response.json({ saved: true, generated: plan.length }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "finalize") {
      const events = await runtime.DB.prepare(`SELECT se.*, g.name AS group_name FROM schedule_events se LEFT JOIN groups g ON g.id = se.group_id WHERE se.school_year_id = ? ORDER BY se.starts_at, g.name`).bind(yearId).all<Record<string, unknown>>();
      const last = await runtime.DB.prepare(`SELECT MAX(version) AS version FROM schedule_versions WHERE school_year_id = ?`).bind(yearId).first<{ version: number | null }>();
      const version = (last?.version || 0) + 1;
      const id = crypto.randomUUID();
      const name = value(body.name, 100) || `Schedule v${version}`;
      await runtime.DB.batch([
        runtime.DB.prepare(`UPDATE schedule_versions SET status = 'superseded' WHERE school_year_id = ? AND status = 'finalized'`).bind(yearId),
        runtime.DB.prepare(`INSERT INTO schedule_versions (id, school_year_id, version, name, scope_json, snapshot_json, status, finalized_by, finalized_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 'finalized', ?, ?, ?)`).bind(id, yearId, version, name, JSON.stringify({ groupIds: body.groupIds || "all" }), JSON.stringify(events.results), admin.id, now, now),
        runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'schedule.finalized', 'schedule_version', ?, 'Schedule finalized', ?, ?)`).bind(yearId, admin.id, id, JSON.stringify({ version, eventCount: events.results.length }), now),
      ]);
      return Response.json({ id, version }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    const groupId = value(body.groupId, 80) || null;
    const date = value(body.date, 10);
    const startTime = value(body.startTime, 5) || "17:00";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Enter a valid event date." }, { status: 400 });
    const id = crypto.randomUUID();
    await runtime.DB.batch([
      runtime.DB.prepare(`INSERT INTO schedule_events (id, school_year_id, group_id, kind, title_en, title_he, starts_at, ends_at, location, note, status, source, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?)`).bind(id, yearId, groupId, value(body.kind, 30) || "session", value(body.titleEn, 140) || "Choir session", value(body.titleHe, 140) || null, combineLocalDateTime(date, startTime), value(body.endTime, 5) ? combineLocalDateTime(date, value(body.endTime, 5)) : null, value(body.location, 160) || null, value(body.note, 1500) || null, value(body.status, 30) || "scheduled", admin.id, now, now),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'schedule_event.created', 'schedule_event', ?, 'Schedule event created', ?, ?)`).bind(yearId, admin.id, id, JSON.stringify({ date, groupId, kind: body.kind }), now),
    ]);
    return Response.json({ id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Schedule could not be saved." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const id = value(body.id, 80);
    const row = await runtime.DB.prepare(`SELECT * FROM schedule_events WHERE id = ? LIMIT 1`).bind(id).first<Record<string, unknown>>();
    if (!row) return Response.json({ error: "Schedule event not found." }, { status: 404 });
    const now = new Date().toISOString();
    const date = value(body.date, 10) || String(row.starts_at).slice(0, 10);
    const startTime = value(body.startTime, 5) || String(row.starts_at).slice(11, 16);
    const endTime = body.endTime === undefined ? (row.ends_at ? String(row.ends_at).slice(11, 16) : "") : value(body.endTime, 5);
    await runtime.DB.batch([
      runtime.DB.prepare(`UPDATE schedule_events SET group_id = ?, kind = ?, title_en = ?, title_he = ?, starts_at = ?, ends_at = ?, location = ?, note = ?, status = ?, source = 'manual', source_key = NULL, updated_at = ? WHERE id = ?`).bind(body.groupId === undefined ? row.group_id : value(body.groupId, 80) || null, value(body.kind, 30) || String(row.kind), value(body.titleEn, 140) || String(row.title_en), body.titleHe === undefined ? row.title_he : value(body.titleHe, 140) || null, combineLocalDateTime(date, startTime), endTime ? combineLocalDateTime(date, endTime) : null, body.location === undefined ? row.location : value(body.location, 160) || null, body.note === undefined ? row.note : value(body.note, 1500) || null, value(body.status, 30) || String(row.status), now, id),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'schedule_event.updated', 'schedule_event', ?, 'Schedule event updated', ?, ?)`).bind(String(row.school_year_id), admin.id, id, JSON.stringify({ fields: Object.keys(body).filter((key) => key !== "id") }), now),
    ]);
    return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Schedule event could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const id = value(new URL(request.url).searchParams.get("id"), 80);
    const row = await runtime.DB.prepare(`SELECT id, school_year_id, title_en, starts_at FROM schedule_events WHERE id = ? LIMIT 1`).bind(id).first<{ id: string; school_year_id: string; title_en: string; starts_at: string }>();
    if (!row) return Response.json({ error: "Schedule event not found." }, { status: 404 });
    const now = new Date().toISOString();
    await runtime.DB.batch([
      runtime.DB.prepare(`DELETE FROM schedule_events WHERE id = ?`).bind(id),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'schedule_event.deleted', 'schedule_event', ?, 'Schedule event deleted', ?, ?)`).bind(row.school_year_id, admin.id, id, JSON.stringify({ title: row.title_en, startsAt: row.starts_at }), now),
    ]);
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Schedule event could not be deleted." }, { status: 500 });
  }
}

