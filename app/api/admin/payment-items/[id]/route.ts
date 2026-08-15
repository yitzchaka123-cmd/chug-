import { requireAdminSession } from "@/lib/admin-auth";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

type PaymentRow = { id: string; school_year_id: string; registration_id: string | null; amount_due_agorot: number; status: string; period_key: string };

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const { id } = await context.params;
    const body = await request.json() as { paid?: unknown };
    if (typeof body.paid !== "boolean") return Response.json({ error: "Paid status is required." }, { status: 400 });
    const payment = await runtime.DB.prepare(`SELECT id, school_year_id, registration_id, amount_due_agorot, status, period_key FROM payment_items WHERE id = ? LIMIT 1`).bind(id).first<PaymentRow>();
    if (!payment) return Response.json({ error: "Payment item not found." }, { status: 404 });
    const now = new Date().toISOString();
    const nextStatus = body.paid ? "paid" : "unpaid";
    await runtime.DB.batch([
      runtime.DB.prepare(`UPDATE payment_items SET status = ?, amount_paid_agorot = ?, marked_paid_at = ?, marked_paid_by = ?, updated_at = ? WHERE id = ?`).bind(nextStatus, body.paid ? payment.amount_due_agorot : 0, body.paid ? now : null, admin.id, now, id),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'payment.status_changed', 'payment_item', ?, ?, ?, ?)`).bind(payment.school_year_id, admin.id, id, body.paid ? "Payment marked paid" : "Paid status removed", JSON.stringify({ from: payment.status, to: nextStatus, period: payment.period_key }), now),
    ]);
    return Response.json({ id, paid: body.paid, status: nextStatus }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Payment status could not be changed." }, { status: 500 });
  }
}

