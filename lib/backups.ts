import type { ChoirRuntimeEnv } from "@/lib/runtime-env";
import { decryptJson, encryptJson, sha256Hex } from "@/lib/security";

export const backupTables = [
  "school_years", "agreement_versions", "groups", "payment_methods", "custom_registration_links", "registrations",
  "registration_section_approvals", "stored_files", "students", "enrollments", "signed_agreements", "payment_items",
  "schedule_events", "schedule_versions", "saved_documents", "brand_assets", "creative_prompts", "audit_log", "email_outbox",
] as const;

export async function createDatabaseSnapshot(db: D1Database) {
  const tables: Record<string, unknown[]> = {};
  for (const table of backupTables) {
    const result = await db.prepare(`SELECT * FROM ${table}`).all<Record<string, unknown>>();
    tables[table] = result.results;
  }
  return {
    product: "The Choir Chug",
    schemaVersion: "2026-08-management-v1",
    createdAt: new Date().toISOString(),
    timezone: "Asia/Jerusalem",
    tables,
  };
}

export async function createEncryptedBackup(runtime: ChoirRuntimeEnv, reason: "automatic" | "manual" | "significant-change", createdBy: string | null) {
  if (reason !== "manual") {
    const minimumGap = reason === "automatic" ? 20 * 60 * 60 * 1000 : 5 * 60 * 1000;
    const latest = await runtime.DB.prepare(`SELECT id, created_at FROM backup_snapshots WHERE reason = ? AND status = 'ready' ORDER BY created_at DESC LIMIT 1`).bind(reason).first<{ id: string; created_at: string }>();
    if (latest && Date.now() - new Date(latest.created_at).getTime() < minimumGap) return { id: latest.id, createdAt: latest.created_at, skipped: true };
  }
  const snapshot = await createDatabaseSnapshot(runtime.DB);
  const encrypted = await encryptJson(snapshot, runtime.CHOIR_DATA_KEY);
  const bytes = new TextEncoder().encode(encrypted);
  const id = crypto.randomUUID();
  const key = `backups/${new Date().toISOString().slice(0, 10)}/${id}.json.enc`;
  const digest = await sha256Hex(bytes);
  await runtime.BUCKET.put(key, bytes, { httpMetadata: { contentType: "application/octet-stream" }, customMetadata: { schemaVersion: snapshot.schemaVersion, reason } });
  const now = new Date().toISOString();
  try {
    await runtime.DB.batch([
      runtime.DB.prepare(`INSERT INTO backup_snapshots (id, storage_key, sha256, byte_size, reason, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'ready', ?, ?)`).bind(id, key, digest, bytes.byteLength, reason, createdBy, now),
      runtime.DB.prepare(`INSERT INTO audit_log (actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, ?, 'backup.created', 'backup', ?, 'Protected backup created', ?, ?)`).bind(createdBy ? "admin" : "system", createdBy, id, JSON.stringify({ reason, byteSize: bytes.byteLength }), now),
    ]);
  } catch (error) {
    await runtime.BUCKET.delete(key);
    throw error;
  }
  return { id, createdAt: now, skipped: false };
}

type Snapshot = Awaited<ReturnType<typeof createDatabaseSnapshot>>;

function validateSnapshot(input: unknown): Snapshot {
  if (!input || typeof input !== "object") throw new Error("Backup content is invalid.");
  const source = input as { product?: unknown; schemaVersion?: unknown; createdAt?: unknown; timezone?: unknown; tables?: unknown };
  if (source.product !== "The Choir Chug" || typeof source.schemaVersion !== "string" || !source.tables || typeof source.tables !== "object") throw new Error("This is not a supported Choir Chug backup.");
  const tables = source.tables as Record<string, unknown>;
  for (const table of backupTables) if (!Array.isArray(tables[table])) throw new Error(`Backup table ${table} is missing.`);
  return source as Snapshot;
}

export async function readEncryptedBackup(runtime: ChoirRuntimeEnv, backupId: string) {
  const row = await runtime.DB.prepare(`SELECT storage_key, sha256 FROM backup_snapshots WHERE id = ? AND status = 'ready' LIMIT 1`).bind(backupId).first<{ storage_key: string; sha256: string }>();
  if (!row) throw new Error("Backup snapshot was not found.");
  const object = await runtime.BUCKET.get(row.storage_key);
  if (!object) throw new Error("Backup file is unavailable.");
  const bytes = new Uint8Array(await object.arrayBuffer());
  if (await sha256Hex(bytes) !== row.sha256) throw new Error("Backup integrity check failed.");
  return validateSnapshot(await decryptJson<unknown>(new TextDecoder().decode(bytes), runtime.CHOIR_DATA_KEY));
}

export async function restoreDatabaseSnapshot(runtime: ChoirRuntimeEnv, snapshot: Snapshot) {
  const safe = validateSnapshot(snapshot);
  const reverse = [...backupTables].reverse();
  for (let offset = 0; offset < reverse.length; offset += 50) {
    await runtime.DB.batch(reverse.slice(offset, offset + 50).map((table) => runtime.DB.prepare(`DELETE FROM ${table}`)));
  }
  for (const table of backupTables) {
    const rows = safe.tables[table] as Record<string, unknown>[];
    for (let offset = 0; offset < rows.length; offset += 50) {
      const statements = rows.slice(offset, offset + 50).map((row) => {
        const columns = Object.keys(row);
        if (!columns.length || columns.some((column) => !/^[a-z][a-z0-9_]*$/.test(column))) throw new Error(`Backup table ${table} contains invalid columns.`);
        return runtime.DB.prepare(`INSERT INTO ${table} (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).bind(...columns.map((column) => row[column]));
      });
      if (statements.length) await runtime.DB.batch(statements);
    }
  }
  return { restoredAt: new Date().toISOString(), sourceCreatedAt: safe.createdAt };
}
