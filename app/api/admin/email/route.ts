import { requireAdminSession } from "@/lib/admin-auth";
import { deliverOutboxEmail } from "@/lib/email";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    if (!await requireAdminSession(request, runtime)) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const rows = await runtime.DB.prepare(`SELECT id, registration_id, template, status, attempts, last_error, sent_at, created_at FROM email_outbox ORDER BY created_at DESC LIMIT 200`).all<{ id: string; registration_id: string | null; template: string; status: string; attempts: number; last_error: string | null; sent_at: string | null; created_at: string }>();
    return Response.json({ configured: Boolean(runtime.RESEND_API_KEY && runtime.CHOIR_FROM_EMAIL), emails: rows.results.map((row) => ({ id: row.id, registrationId: row.registration_id, template: row.template, status: row.status, attempts: row.attempts, error: row.last_error, sentAt: row.sent_at, createdAt: row.created_at })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Email status could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    if (!await requireAdminSession(request, runtime)) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as { id?: unknown; all?: unknown };
    if (body.all === true) {
      const rows = await runtime.DB.prepare(`SELECT id FROM email_outbox WHERE status IN ('pending','failed') ORDER BY created_at LIMIT 25`).all<{ id: string }>();
      const results = [];
      for (const row of rows.results) results.push({ id: row.id, ...(await deliverOutboxEmail(runtime, row.id)) });
      return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
    }
    const id = typeof body.id === "string" ? body.id.slice(0, 80) : "";
    if (!id) return Response.json({ error: "Email item is required." }, { status: 400 });
    const result = await deliverOutboxEmail(runtime, id);
    return Response.json(result, { status: result.ok ? 200 : 409, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Email could not be sent." }, { status: 500 });
  }
}

