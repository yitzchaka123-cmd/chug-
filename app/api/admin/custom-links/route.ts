import { requireAdminSession } from "@/lib/admin-auth";
import { createPrivateLinkToken, revealPrivateLinkToken } from "@/lib/private-links";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { encryptJson } from "@/lib/security";

export const dynamic = "force-dynamic";

function value(input: unknown, max = 600) { return typeof input === "string" ? input.trim().slice(0, max) : ""; }
function agorot(input: unknown) { if (input === null || input === undefined || (typeof input === "string" && !input.trim())) return null; const parsed = Number(input); return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null; }

type LinkRow = {
  id: string; school_year_id: string; group_id: string | null; label: string; token_ciphertext: string;
  registration_fee_agorot: number | null; monthly_fee_agorot: number | null; june_fee_agorot: number | null;
  security_check_agorot: number | null; one_time_amount_agorot: number | null; month_overrides_json: string;
  allowed_payment_method: string | null; proof_policy: string | null; status: string; max_uses: number | null; use_count: number;
  expires_at: string | null; disabled_at: string | null; created_at: string; group_name: string | null; year_name: string;
};

async function expose(row: LinkRow, origin: string, runtime: ReturnType<typeof getRuntimeEnv>) {
  let token = "";
  try { token = await revealPrivateLinkToken(row.token_ciphertext, runtime); } catch { token = ""; }
  return {
    id: row.id, yearId: row.school_year_id, yearName: row.year_name, groupId: row.group_id, groupName: row.group_name,
    label: row.label, registrationFee: row.registration_fee_agorot === null ? null : row.registration_fee_agorot / 100,
    monthlyFee: row.monthly_fee_agorot === null ? null : row.monthly_fee_agorot / 100,
    juneFee: row.june_fee_agorot === null ? null : row.june_fee_agorot / 100,
    securityCheck: row.security_check_agorot === null ? null : row.security_check_agorot / 100,
    oneTimeAmount: row.one_time_amount_agorot === null ? null : row.one_time_amount_agorot / 100,
    monthOverrides: JSON.parse(row.month_overrides_json || "{}"), allowedPaymentMethod: row.allowed_payment_method,
    proofPolicy: row.proof_policy, status: row.status, maxUses: row.max_uses, useCount: row.use_count,
    expiresAt: row.expires_at, disabledAt: row.disabled_at, createdAt: row.created_at,
    url: token ? `${origin}/register?offer=${encodeURIComponent(token)}` : "",
  };
}

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const url = new URL(request.url);
    const yearId = value(url.searchParams.get("yearId"), 80);
    const rows = await runtime.DB.prepare(`
      SELECT crl.*, g.name AS group_name, sy.name AS year_name
      FROM custom_registration_links crl JOIN school_years sy ON sy.id = crl.school_year_id
      LEFT JOIN groups g ON g.id = crl.group_id
      WHERE (? = '' OR crl.school_year_id = ?) ORDER BY crl.created_at DESC
    `).bind(yearId, yearId).all<LinkRow>();
    return Response.json({ links: await Promise.all(rows.results.map((row) => expose(row, url.origin, runtime))) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Custom links could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const yearId = value(body.yearId, 80);
    const label = value(body.label, 120);
    if (!yearId || !label) return Response.json({ error: "School year and link name are required." }, { status: 400 });
    const link = await createPrivateLinkToken(runtime);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const overrides = body.monthOverrides && typeof body.monthOverrides === "object" ? body.monthOverrides : {};
    const privateNote = value(body.privateNote, 2000);
    const privateNoteCiphertext = privateNote ? await encryptJson({ note: privateNote }, runtime.CHOIR_DATA_KEY) : null;
    const expiresAt = value(body.expiresAt, 40) || null;
    await runtime.DB.batch([
      runtime.DB.prepare(`
        INSERT INTO custom_registration_links (id, school_year_id, group_id, label, token_hash, token_ciphertext, registration_fee_agorot, monthly_fee_agorot, june_fee_agorot, security_check_agorot, one_time_amount_agorot, month_overrides_json, allowed_payment_method, proof_policy, private_note_ciphertext, status, max_uses, use_count, expires_at, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 0, ?, ?, ?, ?)
      `).bind(id, yearId, value(body.groupId, 80) || null, label, link.tokenHash, link.tokenCiphertext, agorot(body.registrationFee), agorot(body.monthlyFee), agorot(body.juneFee), agorot(body.securityCheck), agorot(body.oneTimeAmount), JSON.stringify(overrides), value(body.allowedPaymentMethod, 100) || null, ["required", "optional", "none"].includes(value(body.proofPolicy, 20)) ? value(body.proofPolicy, 20) : null, privateNoteCiphertext, Number.isFinite(Number(body.maxUses)) && Number(body.maxUses) > 0 ? Math.round(Number(body.maxUses)) : null, expiresAt, admin.id, now, now),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'custom_link.created', 'custom_registration_link', ?, 'Custom registration link created', ?, ?)`).bind(yearId, admin.id, id, JSON.stringify({ label, groupId: body.groupId || null }), now),
    ]);
    return Response.json({ id, url: `${new URL(request.url).origin}/register?offer=${encodeURIComponent(link.token)}` }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Custom link could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const id = value(body.id, 80);
    const action = value(body.action, 30);
    const row = await runtime.DB.prepare(`SELECT id, school_year_id, status FROM custom_registration_links WHERE id = ? LIMIT 1`).bind(id).first<{ id: string; school_year_id: string; status: string }>();
    if (!row) return Response.json({ error: "Custom link not found." }, { status: 404 });
    const now = new Date().toISOString();
    if (action === "rotate") {
      const link = await createPrivateLinkToken(runtime);
      await runtime.DB.prepare(`UPDATE custom_registration_links SET token_hash = ?, token_ciphertext = ?, updated_at = ? WHERE id = ?`).bind(link.tokenHash, link.tokenCiphertext, now, id).run();
      return Response.json({ url: `${new URL(request.url).origin}/register?offer=${encodeURIComponent(link.token)}` }, { headers: { "Cache-Control": "no-store" } });
    }
    const status = action === "disable" ? "disabled" : action === "enable" ? "active" : row.status;
    await runtime.DB.batch([
      runtime.DB.prepare(`UPDATE custom_registration_links SET status = ?, disabled_at = ?, updated_at = ? WHERE id = ?`).bind(status, status === "disabled" ? now : null, now, id),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, ?, 'custom_registration_link', ?, ?, ?, ?)`).bind(row.school_year_id, admin.id, `custom_link.${status}`, id, status === "disabled" ? "Custom registration link disabled" : "Custom registration link enabled", JSON.stringify({ status }), now),
    ]);
    return Response.json({ saved: true, status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Custom link could not be changed." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const id = value(new URL(request.url).searchParams.get("id"), 80);
    const row = await runtime.DB.prepare(`SELECT id, school_year_id, label, use_count FROM custom_registration_links WHERE id = ? LIMIT 1`).bind(id).first<{ id: string; school_year_id: string; label: string; use_count: number }>();
    if (!row) return Response.json({ error: "Custom link not found." }, { status: 404 });
    const used = await runtime.DB.prepare(`SELECT COUNT(*) AS count FROM registrations WHERE custom_registration_link_id = ?`).bind(id).first<{ count: number }>();
    if ((row.use_count || 0) > 0 || (used?.count || 0) > 0) {
      return Response.json({ error: "This link has already been used by registrations, so it is kept for the records. Disable it instead of deleting it." }, { status: 409 });
    }
    const now = new Date().toISOString();
    await runtime.DB.batch([
      runtime.DB.prepare(`DELETE FROM custom_registration_links WHERE id = ?`).bind(id),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'custom_link.deleted', 'custom_registration_link', ?, 'Custom registration link deleted', ?, ?)`).bind(row.school_year_id, admin.id, id, JSON.stringify({ label: row.label }), now),
    ]);
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Custom link could not be deleted." }, { status: 500 });
  }
}

