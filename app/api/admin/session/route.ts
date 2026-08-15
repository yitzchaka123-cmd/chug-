import { adminSessionCookie, clearAdminSessionCookie, createAdminSession, requireAdminSession, revokeAdminSession } from "@/lib/admin-auth";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const runtime = getRuntimeEnv();
    const admin = await requireAdminSession(request, runtime);
    if (!admin) return Response.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
    return Response.json({ authenticated: true, admin }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Administrator access is unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return Response.json({ error: "Invalid request." }, { status: 415 });
    const body = await request.json() as { passcode?: unknown };
    const passcode = typeof body.passcode === "string" ? body.passcode : "";
    if (!passcode || passcode.length > 128) return Response.json({ error: "Enter the administrator passcode." }, { status: 400 });
    const runtime = getRuntimeEnv();
    const result = await createAdminSession(request, runtime, passcode);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } });
    return Response.json({ authenticated: true }, {
      headers: { "Set-Cookie": adminSessionCookie(result.token), "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Administrator sign-in failed." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await revokeAdminSession(request, getRuntimeEnv());
  } catch {
    // Clear the browser cookie even if the server record was already unavailable.
  }
  return Response.json({ authenticated: false }, { headers: { "Set-Cookie": clearAdminSessionCookie(), "Cache-Control": "no-store" } });
}

