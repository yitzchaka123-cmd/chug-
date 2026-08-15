import { createStoredPasscode, requireAdminSession } from "@/lib/admin-auth";
import { ensureCurrentRegistrationConfig } from "@/lib/registration-defaults";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const settings = await ensureCurrentRegistrationConfig(runtime.DB);
    return Response.json({
      year: settings.schoolYearName,
      proofUploadRequired: settings.proofUploadRequired,
      cashReminderText: settings.cashReminderText,
      administratorEmail: admin.email || "",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Settings could not be loaded." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as { proofUploadRequired?: unknown; cashReminderText?: unknown; administratorEmail?: unknown; newPasscode?: unknown };
    if (typeof body.proofUploadRequired !== "boolean") return Response.json({ error: "Payment proof setting is required." }, { status: 400 });
    const current = await ensureCurrentRegistrationConfig(runtime.DB);
    const row = await runtime.DB.prepare(`SELECT settings_json FROM school_years WHERE id = ?`).bind(current.schoolYearId).first<{ settings_json: string }>();
    const settings = row ? JSON.parse(row.settings_json) as Record<string, unknown> : {};
    if (typeof body.cashReminderText === "string" && body.cashReminderText.trim()) settings.cashReminderText = body.cashReminderText.trim().slice(0, 600);
    const administratorEmail = typeof body.administratorEmail === "string" ? body.administratorEmail.trim().toLowerCase().slice(0, 254) : "";
    if (administratorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(administratorEmail)) return Response.json({ error: "Enter a valid administrator email." }, { status: 400 });
    const newPasscode = typeof body.newPasscode === "string" ? body.newPasscode : "";
    const storedPasscode = newPasscode ? await createStoredPasscode(newPasscode) : null;
    const now = new Date().toISOString();
    const statements = [
      runtime.DB.prepare(`UPDATE school_years SET payment_proof_required = ?, settings_json = ?, updated_at = ? WHERE id = ?`).bind(body.proofUploadRequired ? 1 : 0, JSON.stringify(settings), now, current.schoolYearId),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'settings.updated', 'school_year', ?, 'Registration payment-proof setting changed', ?, ?)`).bind(current.schoolYearId, admin.id, current.schoolYearId, JSON.stringify({ paymentProofRequired: body.proofUploadRequired }), now),
      runtime.DB.prepare(`UPDATE admin_users SET email = ?, recovery_email = ?, updated_at = ? WHERE id = ?`).bind(administratorEmail || null, administratorEmail || null, now, admin.id),
    ];
    if (storedPasscode) statements.push(runtime.DB.prepare(`UPDATE admin_users SET passcode_hash = ?, passcode_salt = ?, passcode_updated_at = ?, updated_at = ? WHERE id = ?`).bind(storedPasscode.passcodeHash, storedPasscode.passcodeSalt, now, now, admin.id));
    await runtime.DB.batch(statements);
    return Response.json({ saved: true, proofUploadRequired: body.proofUploadRequired }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Settings could not be saved." }, { status: 500 });
  }
}
