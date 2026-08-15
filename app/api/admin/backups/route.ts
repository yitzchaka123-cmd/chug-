import { requireAdminSession } from "@/lib/admin-auth";
import { createDatabaseSnapshot, createEncryptedBackup, readEncryptedBackup, restoreDatabaseSnapshot } from "@/lib/backups";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    if (!await requireAdminSession(request, runtime)) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const url = new URL(request.url);
    if (url.searchParams.get("download") === "1") {
      const snapshot = await createDatabaseSnapshot(runtime.DB);
      return new Response(JSON.stringify(snapshot, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="choir-chug-backup-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
    const rows = await runtime.DB.prepare(`SELECT id, reason, status, byte_size, sha256, created_by, created_at FROM backup_snapshots ORDER BY created_at DESC LIMIT 100`).all<{ id: string; reason: string; status: string; byte_size: number; sha256: string; created_by: string | null; created_at: string }>();
    return Response.json({ backups: rows.results.map((row) => ({ id: row.id, reason: row.reason, status: row.status, byteSize: row.byte_size, sha256: row.sha256, createdBy: row.created_by, createdAt: row.created_at })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Backups could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json().catch(() => ({})) as { reason?: unknown };
    const reason: "automatic" | "manual" | "significant-change" = body.reason === "automatic" || body.reason === "significant-change" ? body.reason : "manual";
    const result = await createEncryptedBackup(runtime, reason, admin.id);
    return Response.json(result, { status: result.skipped ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Backup could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as { id?: unknown; confirmation?: unknown };
    const id = typeof body.id === "string" ? body.id.trim().slice(0, 100) : "";
    if (!id || body.confirmation !== "RESTORE") return Response.json({ error: "Type RESTORE to confirm this protected recovery." }, { status: 400 });
    await createEncryptedBackup(runtime, "manual", admin.id);
    const snapshot = await readEncryptedBackup(runtime, id);
    const result = await restoreDatabaseSnapshot(runtime, snapshot);
    await runtime.DB.prepare(`INSERT INTO audit_log (actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES ('admin', ?, 'backup.restored', 'backup', ?, 'Database restored from protected backup', ?, ?)`).bind(admin.id, id, JSON.stringify(result), result.restoredAt).run();
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Backup could not be restored." }, { status: 500 });
  }
}
