import { requireAdminSession } from "@/lib/admin-auth";
import { ensureSystemSeed } from "@/lib/registration-defaults";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

function value(input: unknown, max = 1200) { return typeof input === "string" ? input.trim().slice(0, max) : ""; }

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    if (!await requireAdminSession(request, runtime)) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    await ensureSystemSeed(runtime.DB);
    const yearId = value(new URL(request.url).searchParams.get("yearId"), 80);
    const rows = await runtime.DB.prepare(`SELECT id, school_year_id, code, label, instructions, proof_policy, enabled, is_default, sort_order FROM payment_methods WHERE (? = '' OR school_year_id = ?) ORDER BY school_year_id DESC, sort_order, label`).bind(yearId, yearId).all<{ id: string; school_year_id: string; code: string; label: string; instructions: string; proof_policy: string; enabled: number; is_default: number; sort_order: number }>();
    return Response.json({ methods: rows.results.map((row) => ({ id: row.id, yearId: row.school_year_id, code: row.code, label: row.label, instructions: row.instructions, proofPolicy: row.proof_policy, enabled: Boolean(row.enabled), isDefault: Boolean(row.is_default), sortOrder: row.sort_order })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Payment methods could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const yearId = value(body.yearId, 80);
    const label = value(body.label, 100);
    if (!yearId || !label) return Response.json({ error: "School year and payment-method name are required." }, { status: 400 });
    const code = value(body.code, 80).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const proofPolicy = ["required", "optional", "none"].includes(value(body.proofPolicy, 20)) ? value(body.proofPolicy, 20) : "optional";
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await runtime.DB.batch([
      runtime.DB.prepare(`INSERT INTO payment_methods (id, school_year_id, code, label, instructions, proof_policy, enabled, is_default, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`).bind(id, yearId, code, label, value(body.instructions, 1200), proofPolicy, Number.isFinite(Number(body.sortOrder)) ? Math.round(Number(body.sortOrder)) : 100, now, now),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'payment_method.created', 'payment_method', ?, 'Payment method created', ?, ?)`).bind(yearId, admin.id, id, JSON.stringify({ label, proofPolicy }), now),
    ]);
    return Response.json({ id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment method could not be created.";
    return Response.json({ error: message.includes("UNIQUE") ? "That payment method already exists for this year." : message }, { status: message.includes("UNIQUE") ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const id = value(body.id, 80);
    const current = await runtime.DB.prepare(`SELECT * FROM payment_methods WHERE id = ? LIMIT 1`).bind(id).first<{ id: string; school_year_id: string; label: string; instructions: string; proof_policy: string; enabled: number; is_default: number; sort_order: number }>();
    if (!current) return Response.json({ error: "Payment method not found." }, { status: 404 });
    const proofPolicy = ["required", "optional", "none"].includes(value(body.proofPolicy, 20)) ? value(body.proofPolicy, 20) : current.proof_policy;
    const isDefault = body.isDefault === undefined ? current.is_default : body.isDefault ? 1 : 0;
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];
    if (isDefault) statements.push(runtime.DB.prepare(`UPDATE payment_methods SET is_default = 0, updated_at = ? WHERE school_year_id = ?`).bind(now, current.school_year_id));
    statements.push(runtime.DB.prepare(`UPDATE payment_methods SET label = ?, instructions = ?, proof_policy = ?, enabled = ?, is_default = ?, sort_order = ?, updated_at = ? WHERE id = ?`).bind(value(body.label, 100) || current.label, body.instructions === undefined ? current.instructions : value(body.instructions, 1200), proofPolicy, body.enabled === undefined ? current.enabled : body.enabled ? 1 : 0, isDefault, Number.isFinite(Number(body.sortOrder)) ? Math.round(Number(body.sortOrder)) : current.sort_order, now, id));
    statements.push(runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'payment_method.updated', 'payment_method', ?, 'Payment method updated', ?, ?)`).bind(current.school_year_id, admin.id, id, JSON.stringify({ fields: Object.keys(body).filter((key) => key !== "id") }), now));
    await runtime.DB.batch(statements);
    return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Payment method could not be saved." }, { status: 500 });
  }
}

