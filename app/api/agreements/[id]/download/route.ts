import { getRuntimeEnv } from "@/lib/runtime-env";
import { hashOpaqueToken } from "@/lib/security";

export const dynamic = "force-dynamic";

type DownloadRow = {
  participant_full_name: string;
  download_token_hash: string;
  storage_key: string;
};

function safeDownloadName(value: string) {
  const stem = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 -]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
  return `choir-chug-agreement-${stem || "registration"}.pdf`;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const runtime = getRuntimeEnv();
    const { id } = await context.params;
    const token = new URL(request.url).searchParams.get("token") || "";
    if (!id || !token) return Response.json({ error: "Agreement link is invalid." }, { status: 404 });
    const tokenHash = await hashOpaqueToken(token, runtime.CHOIR_TOKEN_SECRET);
    const row = await runtime.DB.prepare(`
      SELECT r.participant_full_name, r.download_token_hash, sf.storage_key
      FROM registrations r
      JOIN signed_agreements sa ON sa.registration_id = r.id
      JOIN stored_files sf ON sf.id = sa.pdf_file_id
      WHERE r.id = ? AND r.download_token_hash = ? AND sf.status = 'active'
      LIMIT 1
    `).bind(id, tokenHash).first<DownloadRow>();
    if (!row) return Response.json({ error: "Agreement link is invalid." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const object = await runtime.BUCKET.get(row.storage_key);
    if (!object) return Response.json({ error: "Agreement file is unavailable." }, { status: 404 });
    return new Response(object.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeDownloadName(row.participant_full_name)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Agreement could not be downloaded." }, { status: 500 });
  }
}

