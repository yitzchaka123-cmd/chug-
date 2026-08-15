import { createEncryptedBackup } from "@/lib/backups";
import { deliverOutboxEmail } from "@/lib/email";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const runtime = getRuntimeEnv();
    const backup = await createEncryptedBackup(runtime, "automatic", null);
    const pending = await runtime.DB.prepare(`SELECT id FROM email_outbox WHERE status IN ('pending','failed') AND attempts < 5 ORDER BY created_at LIMIT 25`).all<{ id: string }>();
    const emailResults = [];
    for (const row of pending.results) emailResults.push({ id: row.id, ...(await deliverOutboxEmail(runtime, row.id)) });
    const now = new Date().toISOString();
    await runtime.DB.batch([
      runtime.DB.prepare(`DELETE FROM admin_sessions WHERE expires_at < ? OR revoked_at IS NOT NULL`).bind(now),
      runtime.DB.prepare(`DELETE FROM admin_recovery_tokens WHERE expires_at < ? OR consumed_at IS NOT NULL`).bind(now),
      runtime.DB.prepare(`UPDATE registrations SET status = 'expired', updated_at = ? WHERE status = 'draft' AND draft_expires_at IS NOT NULL AND draft_expires_at < ?`).bind(now, now),
    ]);
    return Response.json({ ok: true, backup, emailResults, maintainedAt: now }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Maintenance failed." }, { status: 500 });
  }
}
