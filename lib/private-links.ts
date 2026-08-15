import { decryptJson, encryptJson, hashOpaqueToken, randomOpaqueToken } from "@/lib/security";
import type { ChoirRuntimeEnv } from "@/lib/runtime-env";

export async function createPrivateLinkToken(runtime: ChoirRuntimeEnv) {
  const token = randomOpaqueToken(32);
  const [tokenHash, tokenCiphertext] = await Promise.all([
    hashOpaqueToken(token, runtime.CHOIR_TOKEN_SECRET),
    encryptJson({ token }, runtime.CHOIR_DATA_KEY),
  ]);
  return { token, tokenHash, tokenCiphertext };
}

export async function revealPrivateLinkToken(ciphertext: string, runtime: ChoirRuntimeEnv) {
  const value = await decryptJson<{ token?: unknown }>(ciphertext, runtime.CHOIR_DATA_KEY);
  if (typeof value.token !== "string" || value.token.length < 20) throw new Error("The private link is unavailable.");
  return value.token;
}

