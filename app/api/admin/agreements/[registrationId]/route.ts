import { requireAdminSession } from "@/lib/admin-auth";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

type AgreementRow = { participant_full_name: string; storage_key: string };

function filename(name: string) {
  const stem = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 -]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
  return `choir-chug-agreement-${stem || "registration"}.pdf`;
}

export async function GET(request: Request, context: { params: Promise<{ registrationId: string }> }) {
  try {
    const runtime = getRuntimeEnv();
    if (!await requireAdminSession(request, runtime)) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const { registrationId } = await context.params;
    const row = await runtime.DB.prepare(`
      SELECT r.participant_full_name, sf.storage_key
      FROM registrations r
      JOIN signed_agreements sa ON sa.registration_id = r.id
      JOIN stored_files sf ON sf.id = sa.pdf_file_id
      WHERE r.id = ? AND sf.status = 'active'
      LIMIT 1
    `).bind(registrationId).first<AgreementRow>();
    if (!row) return Response.json({ error: "Agreement not found." }, { status: 404 });
    const object = await runtime.BUCKET.get(row.storage_key);
    if (!object) return Response.json({ error: "Agreement file not found." }, { status: 404 });
    await runtime.DB.prepare(`INSERT INTO audit_log (actor_type, action, entity_type, entity_id, summary, created_at) VALUES ('admin', 'agreement.downloaded', 'registration', ?, 'Signed agreement downloaded', ?)`).bind(registrationId, new Date().toISOString()).run();
    return new Response(object.body, { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename(row.participant_full_name)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Agreement could not be downloaded." }, { status: 500 });
  }
}

