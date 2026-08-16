import type { ChoirRuntimeEnv } from "@/lib/runtime-env";

type NeonClient = {
  query: (query: string, params?: unknown[], options?: Record<string, unknown>) => Promise<unknown>;
  transaction: (queries: unknown[]) => Promise<unknown[]>;
};

let neonClientPromise: Promise<NeonClient> | null = null;

// Standard SQL (SQLite and PostgreSQL alike) escapes a quote inside a quoted
// region by doubling it; backslash has no special meaning. Track quoted
// regions accordingly so placeholders inside literals are never rewritten and
// literals containing backslashes never desync the scan.
export function translatePlaceholders(query: string) {
  let output = "";
  let index = 0;

  for (let cursor = 0; cursor < query.length; cursor += 1) {
    const character = query[cursor];
    if (character === "'" || character === '"') {
      const quote = character;
      output += character;
      cursor += 1;
      while (cursor < query.length) {
        const inner = query[cursor];
        output += inner;
        if (inner === quote) {
          if (query[cursor + 1] === quote) { output += quote; cursor += 2; continue; }
          break;
        }
        cursor += 1;
      }
      continue;
    }
    if (character === "?") {
      index += 1;
      output += `$${index}`;
    } else {
      output += character;
    }
  }
  return output;
}

export function postgresQuery(query: string) {
  const trimmed = query.trim().replace(/;\s*$/, "");
  const ignoreConflicts = /^INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(trimmed);
  const normalized = ignoreConflicts
    ? trimmed.replace(/^INSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO")
    : trimmed;
  return `${translatePlaceholders(normalized)}${ignoreConflicts ? " ON CONFLICT DO NOTHING" : ""}`;
}

async function getNeonClient() {
  if (!neonClientPromise) {
    neonClientPromise = import("@neondatabase/serverless").then(({ neon }) => {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) throw new Error("DATABASE_URL is not configured.");
      return neon(connectionString) as unknown as NeonClient;
    });
  }
  return neonClientPromise;
}

class NeonPreparedStatement implements D1PreparedStatement {
  constructor(
    readonly sourceQuery: string,
    readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new NeonPreparedStatement(this.sourceQuery, values);
  }

  private async execute(options?: Record<string, unknown>) {
    const client = await getNeonClient();
    return client.query(postgresQuery(this.sourceQuery), this.values, options);
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const rows = await this.execute() as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const rows = await this.execute() as T[];
    return { results: rows, success: true };
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const result = await this.execute({ fullResults: true }) as { rows?: T[]; rowCount?: number };
    return { results: result.rows || [], success: true, meta: { changes: result.rowCount || 0 } };
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    return await this.execute({ arrayMode: true }) as T[];
  }
}

class NeonD1Database implements D1Database {
  prepare(query: string) {
    return new NeonPreparedStatement(query);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]> {
    const client = await getNeonClient();
    const queries = statements.map((statement) => {
      if (!(statement instanceof NeonPreparedStatement)) throw new Error("A database batch contained an incompatible statement.");
      return client.query(postgresQuery(statement.sourceQuery), statement.values);
    });
    const results = await client.transaction(queries);
    return results.map((rows) => ({ results: rows, success: true })) as T[];
  }

  async exec(query: string) {
    const client = await getNeonClient();
    return client.query(postgresQuery(query));
  }
}

function toBlobBody(value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob): ReadableStream | string | Blob {
  if (value instanceof ArrayBuffer) return new Blob([new Uint8Array(value)]);
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.byteLength);
    bytes.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    return new Blob([bytes]);
  }
  return value;
}

class VercelPrivateBlobBucket implements R2Bucket {
  async get(key: string): Promise<R2ObjectBody | null> {
    const { get } = await import("@vercel/blob");
    const object = await get(key, { access: "private", useCache: false });
    if (!object || object.statusCode !== 200 || !object.stream) return null;
    const bytes = await new Response(object.stream).arrayBuffer();
    return {
      body: new Response(bytes).body as ReadableStream,
      arrayBuffer: async () => bytes.slice(0),
      httpMetadata: {
        contentType: object.blob.contentType,
        contentDisposition: object.blob.contentDisposition,
      },
    };
  }

  async put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob, options?: R2PutOptions) {
    const { put } = await import("@vercel/blob");
    return put(key, toBlobBody(value), {
      access: "private",
      addRandomSuffix: false,
      contentType: options?.httpMetadata?.contentType,
    });
  }

  async delete(key: string | string[]) {
    const { del } = await import("@vercel/blob");
    await del(key);
  }
}

let vercelRuntime: ChoirRuntimeEnv | null = null;

export function createVercelRuntime(): ChoirRuntimeEnv {
  if (vercelRuntime) return vercelRuntime;
  const dataKey = process.env.CHOIR_DATA_KEY || "";
  const tokenSecret = process.env.CHOIR_TOKEN_SECRET || "";
  const administratorPasscode = process.env.CHOIR_ADMIN_PASSCODE || "";
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured. Connect Neon Postgres in Vercel Storage.");
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not configured. Connect a private Vercel Blob store.");
  if (!dataKey || !tokenSecret) throw new Error("Registration security keys are not configured.");
  if (!administratorPasscode) throw new Error("Administrator access is not configured.");

  vercelRuntime = {
    DB: new NeonD1Database(),
    BUCKET: new VercelPrivateBlobBucket(),
    CHOIR_DATA_KEY: dataKey,
    CHOIR_TOKEN_SECRET: tokenSecret,
    CHOIR_ADMIN_PASSCODE: administratorPasscode,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CHOIR_FROM_EMAIL: process.env.CHOIR_FROM_EMAIL,
  };
  return vercelRuntime;
}
