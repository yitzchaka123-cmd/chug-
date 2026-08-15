import { agreementSections } from "@/app/agreement-2026-2027";
import { requireAdminSession } from "@/lib/admin-auth";
import { ensureSystemSeed } from "@/lib/registration-defaults";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { sha256Hex } from "@/lib/security";

export const dynamic = "force-dynamic";

type YearRow = {
  id: string; slug: string; name: string; status: string; starts_on: string; ends_on: string;
  registration_fee_agorot: number; monthly_fee_agorot: number; june_fee_agorot: number;
  security_check_required: number; schedule_mode: string; schedule_weekday: number;
  schedule_start_time: string | null; schedule_end_time: string | null; payment_proof_required: number;
  settings_json: string; created_at: string; updated_at: string;
};

function value(input: unknown, max = 160) { return typeof input === "string" ? input.trim().slice(0, max) : ""; }
function integer(input: unknown, fallback = 0) { const parsed = Number(input); return Number.isFinite(parsed) ? Math.round(parsed) : fallback; }
function agorot(input: unknown, fallback = 0) { return Math.max(0, integer(Number(input) * 100, fallback)); }
function validDate(input: string) { return /^\d{4}-\d{2}-\d{2}$/.test(input) && Number.isFinite(new Date(`${input}T12:00:00Z`).getTime()); }

function expose(row: YearRow) {
  let settings: Record<string, unknown> = {};
  try { settings = JSON.parse(row.settings_json) as Record<string, unknown>; } catch { settings = {}; }
  return {
    id: row.id, slug: row.slug, name: row.name, status: row.status, startsOn: row.starts_on, endsOn: row.ends_on,
    registrationFee: row.registration_fee_agorot / 100, monthlyFee: row.monthly_fee_agorot / 100, juneFee: row.june_fee_agorot / 100,
    securityCheckRequired: Boolean(row.security_check_required), scheduleMode: row.schedule_mode, weekday: row.schedule_weekday,
    startTime: row.schedule_start_time || "17:00", endTime: row.schedule_end_time || "19:00", proofRequired: Boolean(row.payment_proof_required),
    settings, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    await ensureSystemSeed(runtime.DB);
    const result = await runtime.DB.prepare(`SELECT * FROM school_years ORDER BY starts_on DESC`).all<YearRow>();
    return Response.json({ years: result.results.map(expose) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "School years could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    await ensureSystemSeed(runtime.DB);
    const body = await request.json() as Record<string, unknown>;
    const name = value(body.name, 60);
    const startsOn = value(body.startsOn, 10);
    const endsOn = value(body.endsOn, 10);
    if (!name || !validDate(startsOn) || !validDate(endsOn) || startsOn >= endsOn) return Response.json({ error: "Enter a valid school-year name and date range." }, { status: 400 });
    const slug = value(body.slug, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `${startsOn.slice(0, 4)}-${endsOn.slice(0, 4)}`;
    const exists = await runtime.DB.prepare(`SELECT id FROM school_years WHERE slug = ? LIMIT 1`).bind(slug).first<{ id: string }>();
    if (exists) return Response.json({ error: "A school year with this name already exists." }, { status: 409 });
    const sourceYearId = value(body.copyFromYearId, 80);
    const sourceYear = sourceYearId ? await runtime.DB.prepare(`SELECT * FROM school_years WHERE id = ? LIMIT 1`).bind(sourceYearId).first<YearRow>() : null;
    const registrationFeeAgorot = body.registrationFee === undefined && sourceYear ? sourceYear.registration_fee_agorot : agorot(body.registrationFee, 0);
    const monthlyFeeAgorot = body.monthlyFee === undefined && sourceYear ? sourceYear.monthly_fee_agorot : agorot(body.monthlyFee, 0);
    const juneFeeAgorot = body.juneFee === undefined && sourceYear ? sourceYear.june_fee_agorot : agorot(body.juneFee, 0);
    let sourceSettings: Record<string, unknown> = {};
    try { sourceSettings = sourceYear ? JSON.parse(sourceYear.settings_json) as Record<string, unknown> : {}; } catch { sourceSettings = {}; }
    const settings = {
      ...sourceSettings,
      agreementVersionCode: `${slug}-v1`,
      sessionLengthMinutes: Math.min(180, Math.max(15, integer(body.sessionLengthMinutes, Number(sourceSettings.sessionLengthMinutes) || 50))),
      location: value(body.location, 160) || String(sourceSettings.location || ""),
      paymentDueDay: Math.min(28, Math.max(1, integer(body.paymentDueDay, Number(sourceSettings.paymentDueDay) || 20))),
    };
    const yearId = crypto.randomUUID();
    const agreementId = crypto.randomUUID();
    const now = new Date().toISOString();
    const sectionsJson = sourceYearId
      ? (await runtime.DB.prepare(`SELECT sections_json FROM agreement_versions WHERE school_year_id = ? AND is_active = 1 ORDER BY version DESC LIMIT 1`).bind(sourceYearId).first<{ sections_json: string }>())?.sections_json || JSON.stringify(agreementSections)
      : JSON.stringify(agreementSections);
    const contentHash = await sha256Hex(sectionsJson);
    const statements: D1PreparedStatement[] = [
      runtime.DB.prepare(`
        INSERT INTO school_years (id, slug, name, status, starts_on, ends_on, currency, registration_fee_agorot, monthly_fee_agorot, june_fee_agorot, security_check_required, schedule_mode, schedule_weekday, schedule_start_time, schedule_end_time, payment_proof_required, settings_json, created_at, updated_at)
        VALUES (?, ?, ?, 'draft', ?, ?, 'ILS', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(yearId, slug, name, startsOn, endsOn, registrationFeeAgorot, monthlyFeeAgorot, juneFeeAgorot, body.securityCheckRequired === false ? 0 : 1, value(body.scheduleMode, 30) || sourceYear?.schedule_mode || "recurring", Math.min(6, Math.max(0, integer(body.weekday, sourceYear?.schedule_weekday ?? 3))), value(body.startTime, 5) || sourceYear?.schedule_start_time || "17:00", value(body.endTime, 5) || sourceYear?.schedule_end_time || "19:00", body.proofRequired === false ? 0 : 1, JSON.stringify(settings), now, now),
      runtime.DB.prepare(`INSERT INTO agreement_versions (id, school_year_id, version, title, sections_json, content_hash, is_active, effective_at, created_at) VALUES (?, ?, 1, ?, ?, ?, 1, ?, ?)`).bind(agreementId, yearId, `Choir Chug Registration Agreement ${name}`, sectionsJson, contentHash, now, now),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'school_year.created', 'school_year', ?, 'School year created', ?, ?)`).bind(yearId, admin.id, yearId, JSON.stringify({ name, startsOn, endsOn, copiedFrom: sourceYearId || null }), now),
    ];
    if (sourceYearId) {
      const methods = await runtime.DB.prepare(`SELECT code, label, instructions, proof_policy, enabled, is_default, sort_order FROM payment_methods WHERE school_year_id = ? ORDER BY sort_order`).bind(sourceYearId).all<{ code: string; label: string; instructions: string; proof_policy: string; enabled: number; is_default: number; sort_order: number }>();
      for (const method of methods.results) statements.push(runtime.DB.prepare(`INSERT INTO payment_methods (id, school_year_id, code, label, instructions, proof_policy, enabled, is_default, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), yearId, method.code, method.label, method.instructions, method.proof_policy, method.enabled, method.is_default, method.sort_order, now, now));
    }
    await runtime.DB.batch(statements);
    return Response.json({ yearId }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "School year could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const id = value(body.id, 80);
    if (!id) return Response.json({ error: "School year is required." }, { status: 400 });
    const current = await runtime.DB.prepare(`SELECT * FROM school_years WHERE id = ? LIMIT 1`).bind(id).first<YearRow>();
    if (!current) return Response.json({ error: "School year not found." }, { status: 404 });
    const now = new Date().toISOString();
    if (body.action === "activate") {
      await runtime.DB.batch([
        runtime.DB.prepare(`UPDATE school_years SET status = CASE WHEN id = ? THEN 'active' WHEN status = 'active' THEN 'prepared' ELSE status END, updated_at = ? WHERE status IN ('active','prepared','draft')`).bind(id, now),
        runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, created_at) VALUES (?, 'admin', ?, 'school_year.activated', 'school_year', ?, 'Active school year changed', ?)`).bind(id, admin.id, id, now),
      ]);
      return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
    }
    let settings: Record<string, unknown> = {};
    try { settings = JSON.parse(current.settings_json) as Record<string, unknown>; } catch { settings = {}; }
    if (body.sessionLengthMinutes !== undefined) settings.sessionLengthMinutes = Math.min(180, Math.max(15, integer(body.sessionLengthMinutes, 50)));
    if (body.location !== undefined) settings.location = value(body.location, 160);
    if (body.paymentDueDay !== undefined) settings.paymentDueDay = Math.min(28, Math.max(1, integer(body.paymentDueDay, 20)));
    if (body.securityCheck !== undefined) settings.securityCheckAgorot = agorot(body.securityCheck);
    await runtime.DB.batch([
      runtime.DB.prepare(`UPDATE school_years SET name = ?, starts_on = ?, ends_on = ?, registration_fee_agorot = ?, monthly_fee_agorot = ?, june_fee_agorot = ?, security_check_required = ?, schedule_mode = ?, schedule_weekday = ?, schedule_start_time = ?, schedule_end_time = ?, payment_proof_required = ?, settings_json = ?, updated_at = ? WHERE id = ?`).bind(value(body.name, 60) || current.name, value(body.startsOn, 10) || current.starts_on, value(body.endsOn, 10) || current.ends_on, body.registrationFee === undefined ? current.registration_fee_agorot : agorot(body.registrationFee), body.monthlyFee === undefined ? current.monthly_fee_agorot : agorot(body.monthlyFee), body.juneFee === undefined ? current.june_fee_agorot : agorot(body.juneFee), body.securityCheckRequired === undefined ? current.security_check_required : body.securityCheckRequired ? 1 : 0, value(body.scheduleMode, 30) || current.schedule_mode, body.weekday === undefined ? current.schedule_weekday : Math.min(6, Math.max(0, integer(body.weekday))), value(body.startTime, 5) || current.schedule_start_time, value(body.endTime, 5) || current.schedule_end_time, body.proofRequired === undefined ? current.payment_proof_required : body.proofRequired ? 1 : 0, JSON.stringify(settings), now, id),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'school_year.updated', 'school_year', ?, 'School year settings updated', ?, ?)`).bind(id, admin.id, id, JSON.stringify(body), now),
    ]);
    return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "School year could not be saved." }, { status: 500 });
  }
}

