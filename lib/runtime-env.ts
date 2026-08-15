import { createVercelRuntime } from "@/lib/vercel-runtime";

export type ChoirRuntimeEnv = {
  ASSETS?: Fetcher;
  DB: D1Database;
  BUCKET: R2Bucket;
  CHOIR_DATA_KEY: string;
  CHOIR_TOKEN_SECRET: string;
  CHOIR_ADMIN_PASSCODE: string;
  RESEND_API_KEY?: string;
  CHOIR_FROM_EMAIL?: string;
};

const RUNTIME_ENV_KEY = "__CHOIR_CHUG_RUNTIME_ENV__";

export function setRuntimeEnv(runtime: ChoirRuntimeEnv) {
  (globalThis as typeof globalThis & { [RUNTIME_ENV_KEY]?: ChoirRuntimeEnv })[RUNTIME_ENV_KEY] = runtime;
}

export function getRuntimeEnv(): ChoirRuntimeEnv {
  const runtime = (globalThis as typeof globalThis & { [RUNTIME_ENV_KEY]?: Partial<ChoirRuntimeEnv> })[RUNTIME_ENV_KEY];
  if (!runtime && typeof process !== "undefined") {
    return createVercelRuntime();
  }
  if (!runtime) throw new Error("The application runtime is unavailable.");
  if (!runtime.DB) throw new Error("The DB binding is unavailable.");
  if (!runtime.BUCKET) throw new Error("The BUCKET binding is unavailable.");
  if (!runtime.CHOIR_DATA_KEY || !runtime.CHOIR_TOKEN_SECRET) {
    throw new Error("Registration security keys are unavailable.");
  }
  if (!runtime.CHOIR_ADMIN_PASSCODE) throw new Error("Administrator access is not configured.");
  return runtime as ChoirRuntimeEnv;
}
