import { requireAdminSession } from "@/lib/admin-auth";
import { parseAgreementSections } from "@/lib/agreement-content";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { sha256Hex } from "@/lib/security";

export const dynamic = "force-dynamic";

function value(input: unknown, max = 200) {
  return typeof input === "string" ? input.trim().slice(0, max) : "";
}

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    if (!await requireAdminSession(request, runtime)) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const yearId = value(new URL(request.url).searchParams.get("yearId"), 80);
    if (!yearId) return Response.json({ error: "School year is required." }, { status: 400 });
    const rows = await runtime.DB.prepare(`SELECT id, version, title, sections_json, content_hash, is_active, effective_at, created_at FROM agreement_versions WHERE school_year_id = ? ORDER BY version DESC`).bind(yearId).all<{ id: string; version: number; title: string; sections_json: string; content_hash: string; is_active: number; effective_at: string | null; created_at: string }>();
    return Response.json({
      versions: rows.results.map((row) => ({ id: row.id, version: row.version, title: row.title, sections: parseAgreementSections(JSON.parse(row.sections_json)), contentHash: row.content_hash, active: Boolean(row.is_active), effectiveAt: row.effective_at, createdAt: row.created_at })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Agreement versions could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const yearId = value(body.yearId, 80);
    const sections = parseAgreementSections(body.sections);
    const year = await runtime.DB.prepare(`SELECT slug, name FROM school_years WHERE id = ? LIMIT 1`).bind(yearId).first<{ slug: string; name: string }>();
    if (!year) return Response.json({ error: "School year not found." }, { status: 404 });
    const latest = await runtime.DB.prepare(`SELECT version, content_hash FROM agreement_versions WHERE school_year_id = ? ORDER BY version DESC LIMIT 1`).bind(yearId).first<{ version: number; content_hash: string }>();
    const sectionsJson = JSON.stringify(sections);
    const contentHash = await sha256Hex(sectionsJson);
    if (latest?.content_hash === contentHash) return Response.json({ error: "No agreement wording changed." }, { status: 409 });
    const version = (latest?.version || 0) + 1;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const title = value(body.title, 200) || `Choir Chug Registration Agreement ${year.name}`;
    const schoolYear = await runtime.DB.prepare(`SELECT settings_json FROM school_years WHERE id = ? LIMIT 1`).bind(yearId).first<{ settings_json: string }>();
    let settings: Record<string, unknown> = {};
    try { settings = JSON.parse(schoolYear?.settings_json || "{}") as Record<string, unknown>; } catch { settings = {}; }
    settings.agreementVersionCode = `${year.slug}-v${version}`;
    await runtime.DB.batch([
      runtime.DB.prepare(`UPDATE agreement_versions SET is_active = 0 WHERE school_year_id = ? AND is_active = 1`).bind(yearId),
      runtime.DB.prepare(`INSERT INTO agreement_versions (id, school_year_id, version, title, sections_json, content_hash, is_active, effective_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`).bind(id, yearId, version, title, sectionsJson, contentHash, now, now),
      runtime.DB.prepare(`UPDATE school_years SET settings_json = ?, updated_at = ? WHERE id = ?`).bind(JSON.stringify(settings), now, yearId),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'agreement.published', 'agreement_version', ?, 'New agreement version published', ?, ?)`).bind(yearId, admin.id, id, JSON.stringify({ version, contentHash }), now),
    ]);
    return Response.json({ id, version, agreementVersion: settings.agreementVersionCode }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Agreement version could not be published." }, { status: 500 });
  }
}

type VersionRow = { id: string; school_year_id: string; version: number; title: string; sections_json: string; content_hash: string; is_active: number };

async function setActiveVersion(runtime: ReturnType<typeof getRuntimeEnv>, adminId: string, row: VersionRow) {
  const year = await runtime.DB.prepare(`SELECT slug, settings_json FROM school_years WHERE id = ? LIMIT 1`).bind(row.school_year_id).first<{ slug: string; settings_json: string }>();
  let settings: Record<string, unknown> = {};
  try { settings = JSON.parse(year?.settings_json || "{}") as Record<string, unknown>; } catch { settings = {}; }
  settings.agreementVersionCode = `${year?.slug || row.school_year_id}-v${row.version}`;
  const now = new Date().toISOString();
  await runtime.DB.batch([
    runtime.DB.prepare(`UPDATE agreement_versions SET is_active = 0 WHERE school_year_id = ? AND is_active = 1`).bind(row.school_year_id),
    runtime.DB.prepare(`UPDATE agreement_versions SET is_active = 1, effective_at = ? WHERE id = ?`).bind(now, row.id),
    runtime.DB.prepare(`UPDATE school_years SET settings_json = ?, updated_at = ? WHERE id = ?`).bind(JSON.stringify(settings), now, row.school_year_id),
    runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'agreement.activated', 'agreement_version', ?, 'Agreement version set active for new registrations', ?, ?)`).bind(row.school_year_id, adminId, row.id, JSON.stringify({ version: row.version }), now),
  ]);
  return settings.agreementVersionCode;
}

export async function PATCH(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const id = value(body.id, 80);
    const row = await runtime.DB.prepare(`SELECT id, school_year_id, version, title, sections_json, content_hash, is_active FROM agreement_versions WHERE id = ? LIMIT 1`).bind(id).first<VersionRow>();
    if (!row) return Response.json({ error: "Agreement version not found." }, { status: 404 });
    const action = value(body.action, 40);
    if (action === "activate") {
      if (row.is_active) return Response.json({ saved: true, alreadyActive: true }, { headers: { "Cache-Control": "no-store" } });
      const agreementVersion = await setActiveVersion(runtime, admin.id, row);
      return Response.json({ saved: true, agreementVersion }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "duplicate") {
      const targetYearId = value(body.targetYearId, 80) || row.school_year_id;
      const targetYear = await runtime.DB.prepare(`SELECT id, name FROM school_years WHERE id = ? LIMIT 1`).bind(targetYearId).first<{ id: string; name: string }>();
      if (!targetYear) return Response.json({ error: "Target school year not found." }, { status: 404 });
      const latest = await runtime.DB.prepare(`SELECT version FROM agreement_versions WHERE school_year_id = ? ORDER BY version DESC LIMIT 1`).bind(targetYearId).first<{ version: number | null }>();
      const version = (latest?.version || 0) + 1;
      const firstInYear = !latest;
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      await runtime.DB.batch([
        runtime.DB.prepare(`INSERT INTO agreement_versions (id, school_year_id, version, title, sections_json, content_hash, is_active, effective_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?)`).bind(newId, targetYearId, version, `Choir Chug Registration Agreement ${targetYear.name}`, row.sections_json, row.content_hash, now),
        runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'agreement.duplicated', 'agreement_version', ?, 'Agreement version duplicated', ?, ?)`).bind(targetYearId, admin.id, newId, JSON.stringify({ fromVersion: row.version, fromYearId: row.school_year_id, version }), now),
      ]);
      const created = await runtime.DB.prepare(`SELECT id, school_year_id, version, title, sections_json, content_hash, is_active FROM agreement_versions WHERE id = ? LIMIT 1`).bind(newId).first<VersionRow>();
      if (firstInYear && created) await setActiveVersion(runtime, admin.id, created);
      return Response.json({ id: newId, version, yearId: targetYearId, activated: firstInYear }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ error: "Choose a valid agreement action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Agreement version could not be changed." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const id = value(new URL(request.url).searchParams.get("id"), 80);
    const row = await runtime.DB.prepare(`SELECT id, school_year_id, version, is_active FROM agreement_versions WHERE id = ? LIMIT 1`).bind(id).first<{ id: string; school_year_id: string; version: number; is_active: number }>();
    if (!row) return Response.json({ error: "Agreement version not found." }, { status: 404 });
    if (row.is_active) return Response.json({ error: "The active agreement cannot be deleted. Activate another version first." }, { status: 409 });
    const used = await runtime.DB.prepare(`SELECT (SELECT COUNT(*) FROM registrations WHERE agreement_version_id = ?) + (SELECT COUNT(*) FROM signed_agreements WHERE agreement_version_id = ?) AS count`).bind(id, id).first<{ count: number }>();
    if ((used?.count || 0) > 0) return Response.json({ error: "This version is referenced by signed registrations and is kept for the records." }, { status: 409 });
    const now = new Date().toISOString();
    await runtime.DB.batch([
      runtime.DB.prepare(`DELETE FROM agreement_versions WHERE id = ?`).bind(id),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'agreement.deleted', 'agreement_version', ?, 'Unused agreement version deleted', ?, ?)`).bind(row.school_year_id, admin.id, id, JSON.stringify({ version: row.version }), now),
    ]);
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Agreement version could not be deleted." }, { status: 500 });
  }
}
