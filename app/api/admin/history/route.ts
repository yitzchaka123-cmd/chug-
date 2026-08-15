import { requireAdminSession } from "@/lib/admin-auth";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    if (!await requireAdminSession(request, runtime)) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const url = new URL(request.url);
    const yearId = url.searchParams.get("yearId")?.trim().slice(0, 80) || "";
    const rows = await runtime.DB.prepare(`SELECT id, school_year_id, actor_type, action, entity_type, entity_id, summary, changes_json, created_at FROM audit_log WHERE (? = '' OR school_year_id = ?) ORDER BY created_at DESC LIMIT 500`).bind(yearId, yearId).all<{ id: number; school_year_id: string | null; actor_type: string; action: string; entity_type: string; entity_id: string; summary: string | null; changes_json: string; created_at: string }>();
    return Response.json({ history: rows.results.map((row) => ({ id: row.id, yearId: row.school_year_id, actorType: row.actor_type, action: row.action, entityType: row.entity_type, entityId: row.entity_id, summary: row.summary, changes: JSON.parse(row.changes_json || "{}"), createdAt: row.created_at })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Activity history could not be loaded." }, { status: 500 });
  }
}

