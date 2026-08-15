import { requireAdminSession } from "@/lib/admin-auth";
import { buildCreativePrompt, type PromptFacts, type PromptKind } from "@/lib/prompt-builder";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";
function value(input: unknown, max = 20000) { return typeof input === "string" ? input.trim().slice(0, max) : ""; }

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    if (!await requireAdminSession(request, runtime)) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const yearId = value(new URL(request.url).searchParams.get("yearId"), 80);
    const rows = await runtime.DB.prepare(`SELECT id, school_year_id, name, kind, style, facts_json, prompt_text, created_at, updated_at FROM creative_prompts WHERE (? = '' OR school_year_id = ?) ORDER BY updated_at DESC LIMIT 100`).bind(yearId, yearId).all<{ id: string; school_year_id: string | null; name: string; kind: string; style: string | null; facts_json: string; prompt_text: string; created_at: string; updated_at: string }>();
    return Response.json({ prompts: rows.results.map((row) => ({ id: row.id, yearId: row.school_year_id, name: row.name, kind: row.kind, style: row.style, facts: JSON.parse(row.facts_json || "{}"), prompt: row.prompt_text, createdAt: row.created_at, updatedAt: row.updated_at })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Prompts could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const kind = ["detail-sheet", "flyer", "custom"].includes(value(body.kind, 30)) ? value(body.kind, 30) as PromptKind : "detail-sheet";
    const facts = body.facts && typeof body.facts === "object" ? body.facts as PromptFacts : {} as PromptFacts;
    if (!facts.brandName || !facts.schoolYear) return Response.json({ error: "Brand name and school year are required." }, { status: 400 });
    const variation = Number.isFinite(Number(body.variation)) ? Math.round(Number(body.variation)) : Math.floor(Math.random() * 1000);
    const prompt = buildCreativePrompt(kind, facts, variation, value(body.style, 160));
    if (body.save !== true) return Response.json({ prompt, variation }, { headers: { "Cache-Control": "no-store" } });
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await runtime.DB.batch([
      runtime.DB.prepare(`INSERT INTO creative_prompts (id, school_year_id, name, kind, style, facts_json, prompt_text, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, value(body.yearId, 80) || null, value(body.name, 120) || `${kind} ${new Date().toLocaleDateString("en-GB")}`, kind, value(body.style, 160) || null, JSON.stringify(facts), prompt, admin.id, now, now),
      runtime.DB.prepare(`INSERT INTO audit_log (school_year_id, actor_type, actor_id, action, entity_type, entity_id, summary, changes_json, created_at) VALUES (?, 'admin', ?, 'creative_prompt.saved', 'creative_prompt', ?, 'Creative prompt saved', ?, ?)`).bind(value(body.yearId, 80) || null, admin.id, id, JSON.stringify({ kind, variation }), now),
    ]);
    return Response.json({ id, prompt, variation }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Prompt could not be created." }, { status: 500 });
  }
}

