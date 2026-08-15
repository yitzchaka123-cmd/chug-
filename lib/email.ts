import { decryptJson } from "@/lib/security";
import type { ChoirRuntimeEnv } from "@/lib/runtime-env";

type OutboxRow = { id: string; recipient_ciphertext: string; message_ciphertext: string; attempts: number };

export async function deliverOutboxEmail(runtime: ChoirRuntimeEnv, id: string) {
  if (!runtime.RESEND_API_KEY || !runtime.CHOIR_FROM_EMAIL) return { ok: false as const, error: "Email delivery is not configured yet." };
  const row = await runtime.DB.prepare(`SELECT id, recipient_ciphertext, message_ciphertext, attempts FROM email_outbox WHERE id = ? AND status IN ('pending','failed') LIMIT 1`).bind(id).first<OutboxRow>();
  if (!row) return { ok: false as const, error: "Email item not found or already sent." };
  const recipient = await decryptJson<{ email?: unknown }>(row.recipient_ciphertext, runtime.CHOIR_DATA_KEY);
  const message = await decryptJson<{ subject?: unknown; body?: unknown; downloadUrl?: unknown; scheduleUrl?: unknown; resumeUrl?: unknown; recoveryUrl?: unknown }>(row.message_ciphertext, runtime.CHOIR_DATA_KEY);
  if (typeof recipient.email !== "string" || typeof message.subject !== "string" || typeof message.body !== "string") return { ok: false as const, error: "Email data is invalid." };
  const links = [typeof message.downloadUrl === "string" ? `Agreement: ${message.downloadUrl}` : "", typeof message.scheduleUrl === "string" ? `Private schedule: ${message.scheduleUrl}` : "", typeof message.resumeUrl === "string" ? `Continue registration: ${message.resumeUrl}` : "", typeof message.recoveryUrl === "string" ? `Reset administrator access: ${message.recoveryUrl}` : ""].filter(Boolean).join("\n\n");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${runtime.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: runtime.CHOIR_FROM_EMAIL, to: [recipient.email], subject: message.subject, text: `${message.body}${links ? `\n\n${links}` : ""}` }),
  });
  const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
  const now = new Date().toISOString();
  if (!response.ok) {
    const error = result.message || "Email provider rejected the message.";
    await runtime.DB.prepare(`UPDATE email_outbox SET status = 'failed', attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ?`).bind(error.slice(0, 1000), now, id).run();
    return { ok: false as const, error };
  }
  await runtime.DB.prepare(`UPDATE email_outbox SET status = 'sent', attempts = attempts + 1, provider_message_id = ?, last_error = NULL, sent_at = ?, updated_at = ? WHERE id = ?`).bind(result.id || null, now, now, id).run();
  return { ok: true as const, providerMessageId: result.id || null };
}
