import { requireAdminSession } from "@/lib/admin-auth";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { sha256Hex } from "@/lib/security";
import { validatePaymentProofImage } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    if (!await requireAdminSession(request, runtime)) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const row = await runtime.DB.prepare(`SELECT ba.id, ba.name, sf.original_filename, sf.mime_type, sf.byte_size, ba.updated_at FROM brand_assets ba JOIN stored_files sf ON sf.id = ba.stored_file_id WHERE ba.kind = 'logo' AND ba.is_current = 1 AND ba.status = 'active' ORDER BY ba.updated_at DESC LIMIT 1`).first<{ id: string; name: string; original_filename: string | null; mime_type: string; byte_size: number; updated_at: string }>();
    return Response.json({ logo: row ? { id: row.id, name: row.name, fileName: row.original_filename, mimeType: row.mime_type, byteSize: row.byte_size, updatedAt: row.updated_at } : { bundled: true, name: "Choir Chug transparent logo" } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Brand settings could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let storageKey = "";
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const form = await request.formData();
    const entry = form.get("logo");
    if (!(entry instanceof File) || entry.size === 0) return Response.json({ error: "Choose a logo image." }, { status: 400 });
    const image = await validatePaymentProofImage(entry, entry.name);
    if (!image.mimeType.includes("png")) return Response.json({ error: "Upload the transparent logo as a PNG file." }, { status: 400 });
    const id = crypto.randomUUID();
    const fileId = crypto.randomUUID();
    storageKey = `brand/${id}/logo.png`;
    const now = new Date().toISOString();
    const digest = await sha256Hex(image.bytes);
    await runtime.BUCKET.put(storageKey, image.bytes, { httpMetadata: { contentType: image.mimeType }, customMetadata: { kind: "official-logo" } });
    try {
      await runtime.DB.batch([
        runtime.DB.prepare(`UPDATE brand_assets SET is_current = 0, updated_at = ? WHERE kind = 'logo' AND is_current = 1`).bind(now),
        runtime.DB.prepare(`INSERT INTO stored_files (id, registration_id, kind, storage_key, original_filename, mime_type, byte_size, sha256, status, metadata_json, uploaded_at) VALUES (?, NULL, 'brand_logo', ?, ?, ?, ?, ?, 'active', ?, ?)`).bind(fileId, storageKey, image.fileName, image.mimeType, image.size, digest, JSON.stringify(image.metadata), now),
        runtime.DB.prepare(`INSERT INTO brand_assets (id, kind, name, stored_file_id, is_current, status, created_by, created_at, updated_at) VALUES (?, 'logo', 'Official Choir Chug logo', ?, 1, 'active', ?, ?, ?)`).bind(id, fileId, admin.id, now, now),
        runtime.DB.prepare(`INSERT INTO audit_log (actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES ('admin', ?, 'brand.logo_updated', 'brand_asset', ?, 'Official document logo updated', ?, ?)`).bind(admin.id, id, JSON.stringify({ fileName: image.fileName, byteSize: image.size }), now),
      ]);
    } catch (error) {
      await runtime.BUCKET.delete(storageKey);
      throw error;
    }
    return Response.json({ id, saved: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Logo could not be saved." }, { status: 500 });
  }
}

