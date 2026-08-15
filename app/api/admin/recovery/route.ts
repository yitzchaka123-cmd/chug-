import { createStoredPasscode } from "@/lib/admin-auth";
import { deliverOutboxEmail } from "@/lib/email";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { encryptJson, hashOpaqueToken, randomOpaqueToken, sha256Hex } from "@/lib/security";

export const dynamic = "force-dynamic";

function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

export async function POST(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const body = await request.json() as { action?: unknown; email?: unknown; token?: unknown; newPasscode?: unknown };
    const action = typeof body.action === "string" ? body.action : "request";
    if (action === "confirm") {
      const token = typeof body.token === "string" ? body.token.trim().slice(0, 400) : "";
      const newPasscode = typeof body.newPasscode === "string" ? body.newPasscode : "";
      if (!token) return Response.json({ error: "The recovery link is missing." }, { status: 400 });
      const tokenHash = await hashOpaqueToken(token, runtime.CHOIR_TOKEN_SECRET);
      const record = await runtime.DB.prepare(`SELECT id, admin_user_id, expires_at, consumed_at FROM admin_recovery_tokens WHERE token_hash = ? LIMIT 1`).bind(tokenHash).first<{ id: string; admin_user_id: string; expires_at: string; consumed_at: string | null }>();
      if (!record || record.consumed_at || new Date(record.expires_at).getTime() <= Date.now()) return Response.json({ error: "This recovery link is invalid or has expired." }, { status: 400 });
      const stored = await createStoredPasscode(newPasscode);
      const now = new Date().toISOString();
      await runtime.DB.batch([
        runtime.DB.prepare(`UPDATE admin_users SET passcode_hash = ?, passcode_salt = ?, passcode_updated_at = ?, updated_at = ? WHERE id = ?`).bind(stored.passcodeHash, stored.passcodeSalt, now, now, record.admin_user_id),
        runtime.DB.prepare(`UPDATE admin_recovery_tokens SET consumed_at = ? WHERE id = ?`).bind(now, record.id),
        runtime.DB.prepare(`UPDATE admin_sessions SET revoked_at = ? WHERE admin_user_id = ? AND revoked_at IS NULL`).bind(now, record.admin_user_id),
        runtime.DB.prepare(`INSERT INTO audit_log (actor_type, actor_id, action, entity_type, entity_id, summary, created_at) VALUES ('recovery', ?, 'admin.passcode_recovered', 'admin_user', ?, 'Administrator passcode reset through verified recovery email', ?)`).bind(record.admin_user_id, record.admin_user_id, now),
      ]);
      return Response.json({ reset: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
    if (!validEmail(email)) return Response.json({ error: "Enter the configured recovery email." }, { status: 400 });
    const administrator = await runtime.DB.prepare(`SELECT id, recovery_email FROM admin_users WHERE status = 'active' AND LOWER(COALESCE(recovery_email, email, '')) = ? LIMIT 1`).bind(email).first<{ id: string; recovery_email: string | null }>();
    const configured = Boolean(runtime.RESEND_API_KEY && runtime.CHOIR_FROM_EMAIL);
    if (administrator) {
      const token = randomOpaqueToken(32);
      const id = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
      const recipientCiphertext = await encryptJson({ email }, runtime.CHOIR_DATA_KEY);
      const messageCiphertext = await encryptJson({ subject: "Choir Chug administrator passcode reset", body: "Use the private link below within 30 minutes to choose a new administrator passcode.", recoveryUrl: `${new URL(request.url).origin}/admin/recover?token=${encodeURIComponent(token)}` }, runtime.CHOIR_DATA_KEY);
      const emailId = crypto.randomUUID();
      await runtime.DB.batch([
        runtime.DB.prepare(`UPDATE admin_recovery_tokens SET consumed_at = ? WHERE admin_user_id = ? AND consumed_at IS NULL`).bind(now.toISOString(), administrator.id),
        runtime.DB.prepare(`INSERT INTO admin_recovery_tokens (id, admin_user_id, token_hash, purpose, expires_at, attempts, created_at) VALUES (?, ?, ?, 'passcode_reset', ?, 0, ?)`).bind(id, administrator.id, await hashOpaqueToken(token, runtime.CHOIR_TOKEN_SECRET), expiresAt, now.toISOString()),
        runtime.DB.prepare(`INSERT INTO email_outbox (id, registration_id, recipient_hash, recipient_ciphertext, message_ciphertext, template, dedupe_key, status, attempts, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, 'administrator-recovery', ?, 'pending', 0, ?, ?)`).bind(emailId, await sha256Hex(email), recipientCiphertext, messageCiphertext, `${id}:administrator-recovery`, now.toISOString(), now.toISOString()),
      ]);
      if (configured) await deliverOutboxEmail(runtime, emailId);
    }
    return Response.json({ requested: true, deliveryConfigured: configured }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Recovery could not be completed." }, { status: 500 });
  }
}
