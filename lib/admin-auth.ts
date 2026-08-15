import { constantTimeEqual, hashOpaqueToken, randomOpaqueToken, sha256Hex } from "@/lib/security";
import type { ChoirRuntimeEnv } from "@/lib/runtime-env";

const COOKIE_NAME = "choir_admin_session";
const PBKDF2_ITERATIONS = 180_000;
const INACTIVITY_MS = 30 * 60 * 1000;
const ABSOLUTE_SESSION_MS = 8 * 60 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

type AdminRow = {
  id: string;
  passcode_hash: string;
  passcode_salt: string;
};

type AttemptRow = {
  failures: number;
  blocked_until: string | null;
};

type SessionRow = {
  id: string;
  admin_user_id: string;
  display_name: string;
  email: string | null;
  last_seen_at: string;
  expires_at: string;
};

export type AdminIdentity = {
  id: string;
  displayName: string;
  email: string | null;
};

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePasscode(passcode: string, saltBase64Url: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passcode),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", iterations: PBKDF2_ITERATIONS, salt: base64UrlToBytes(saltBase64Url) },
    key,
    256,
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

export async function createStoredPasscode(passcode: string) {
  if (passcode.length < 4 || passcode.length > 128) throw new Error("The new passcode must be at least 4 characters.");
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const passcodeSalt = bytesToBase64Url(salt);
  return { passcodeSalt, passcodeHash: await derivePasscode(passcode, passcodeSalt) };
}

async function requestFingerprint(request: Request, runtime: ChoirRuntimeEnv) {
  const ip = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  const agent = request.headers.get("user-agent") || "unknown";
  return {
    identifierHash: await hashOpaqueToken(`${ip}\n${agent}`, runtime.CHOIR_TOKEN_SECRET),
    ipHash: await hashOpaqueToken(ip, runtime.CHOIR_TOKEN_SECRET),
    userAgentHash: await sha256Hex(agent),
  };
}

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function adminSessionCookie(token: string) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(ABSOLUTE_SESSION_MS / 1000)}`;
}

export function clearAdminSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

async function recordFailure(runtime: ChoirRuntimeEnv, identifierHash: string, existing: AttemptRow | null) {
  const now = new Date();
  const failures = (existing?.failures ?? 0) + 1;
  const blockedUntil = failures >= MAX_FAILURES ? new Date(now.getTime() + LOCKOUT_MS).toISOString() : null;
  await runtime.DB.prepare(`
    INSERT INTO auth_attempts (identifier_hash, failures, first_failure_at, last_failure_at, blocked_until, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(identifier_hash) DO UPDATE SET
      failures = excluded.failures,
      last_failure_at = excluded.last_failure_at,
      blocked_until = excluded.blocked_until,
      updated_at = excluded.updated_at
  `).bind(identifierHash, failures, now.toISOString(), now.toISOString(), blockedUntil, now.toISOString()).run();
}

export async function createAdminSession(request: Request, runtime: ChoirRuntimeEnv, passcode: string) {
  const fingerprint = await requestFingerprint(request, runtime);
  const attempt = await runtime.DB.prepare(`
    SELECT failures, blocked_until FROM auth_attempts WHERE identifier_hash = ? LIMIT 1
  `).bind(fingerprint.identifierHash).first<AttemptRow>();
  if (attempt?.blocked_until && new Date(attempt.blocked_until).getTime() > Date.now()) {
    return { ok: false as const, status: 429, error: "Too many attempts. Please wait 15 minutes and try again." };
  }

  let admin = await runtime.DB.prepare(`
    SELECT id, passcode_hash, passcode_salt FROM admin_users WHERE status = 'active' ORDER BY created_at LIMIT 1
  `).first<AdminRow>();
  let valid = false;

  if (!admin) {
    valid = constantTimeEqual(passcode, runtime.CHOIR_ADMIN_PASSCODE);
    if (valid) {
      const salt = new Uint8Array(16);
      crypto.getRandomValues(salt);
      const saltText = bytesToBase64Url(salt);
      const passcodeHash = await derivePasscode(passcode, saltText);
      const now = new Date().toISOString();
      const adminId = crypto.randomUUID();
      await runtime.DB.prepare(`
        INSERT INTO admin_users (id, display_name, passcode_hash, passcode_salt, passcode_updated_at, status, created_at, updated_at)
        VALUES (?, 'Nechama', ?, ?, ?, 'active', ?, ?)
      `).bind(adminId, passcodeHash, saltText, now, now, now).run();
      admin = { id: adminId, passcode_hash: passcodeHash, passcode_salt: saltText };
    }
  } else {
    const candidate = await derivePasscode(passcode, admin.passcode_salt);
    valid = constantTimeEqual(candidate, admin.passcode_hash);
  }

  if (!valid || !admin) {
    await recordFailure(runtime, fingerprint.identifierHash, attempt ?? null);
    return { ok: false as const, status: 401, error: "That passcode is not correct." };
  }

  await runtime.DB.prepare(`DELETE FROM auth_attempts WHERE identifier_hash = ?`).bind(fingerprint.identifierHash).run();
  const token = randomOpaqueToken();
  const tokenHash = await hashOpaqueToken(token, runtime.CHOIR_TOKEN_SECRET);
  const now = new Date();
  const expires = new Date(now.getTime() + ABSOLUTE_SESSION_MS);
  await runtime.DB.prepare(`
    INSERT INTO admin_sessions (id, admin_user_id, token_hash, ip_hash, user_agent_hash, last_seen_at, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), admin.id, tokenHash, fingerprint.ipHash, fingerprint.userAgentHash, now.toISOString(), expires.toISOString(), now.toISOString()).run();

  return { ok: true as const, token };
}

export async function requireAdminSession(request: Request, runtime: ChoirRuntimeEnv): Promise<AdminIdentity | null> {
  const token = cookieValue(request, COOKIE_NAME);
  if (!token) return null;
  const tokenHash = await hashOpaqueToken(token, runtime.CHOIR_TOKEN_SECRET);
  const session = await runtime.DB.prepare(`
    SELECT s.id, s.admin_user_id, s.last_seen_at, s.expires_at, u.display_name, u.email
    FROM admin_sessions s
    JOIN admin_users u ON u.id = s.admin_user_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND u.status = 'active'
    LIMIT 1
  `).bind(tokenHash).first<SessionRow>();
  if (!session) return null;

  const now = Date.now();
  const inactive = now - new Date(session.last_seen_at).getTime() > INACTIVITY_MS;
  const expired = new Date(session.expires_at).getTime() <= now;
  if (inactive || expired) {
    await runtime.DB.prepare(`UPDATE admin_sessions SET revoked_at = ? WHERE id = ?`).bind(new Date().toISOString(), session.id).run();
    return null;
  }

  await runtime.DB.prepare(`UPDATE admin_sessions SET last_seen_at = ? WHERE id = ?`).bind(new Date().toISOString(), session.id).run();
  return { id: session.admin_user_id, displayName: session.display_name, email: session.email };
}

export async function revokeAdminSession(request: Request, runtime: ChoirRuntimeEnv) {
  const token = cookieValue(request, COOKIE_NAME);
  if (!token) return;
  const tokenHash = await hashOpaqueToken(token, runtime.CHOIR_TOKEN_SECRET);
  await runtime.DB.prepare(`UPDATE admin_sessions SET revoked_at = ? WHERE token_hash = ?`).bind(new Date().toISOString(), tokenHash).run();
}
