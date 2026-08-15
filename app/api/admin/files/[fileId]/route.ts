import { requireAdminSession } from "@/lib/admin-auth";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

type FileRow = { storage_key: string; mime_type: string; original_filename: string | null; kind: string };

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const { fileId } = await context.params;
    const row = await runtime.DB.prepare(`SELECT storage_key, mime_type, original_filename, kind FROM stored_files WHERE id = ? AND status = 'active' LIMIT 1`).bind(fileId).first<FileRow>();
    if (!row || row.kind !== "payment_proof") return Response.json({ error: "File not found." }, { status: 404 });
    const object = await runtime.BUCKET.get(row.storage_key);
    if (!object) return Response.json({ error: "File not found." }, { status: 404 });
    await runtime.DB.prepare(`INSERT INTO audit_log (actor_type, actor_id, action, entity_type, entity_id, summary, created_at) VALUES ('admin', ?, 'file.viewed', 'stored_file', ?, 'Payment proof viewed', ?)`).bind(admin.id, fileId, new Date().toISOString()).run();
    const inlineName = (row.original_filename || "payment-proof").replace(/["\r\n]/g, "");
    return new Response(object.body, { headers: {
      "Content-Type": row.mime_type,
      "Content-Disposition": `inline; filename="${inlineName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "File could not be opened." }, { status: 500 });
  }
}

