import { neon } from "@neondatabase/serverless";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const sql = neon(connectionString);
await sql.query(`CREATE TABLE IF NOT EXISTS choir_schema_migrations (
  name text PRIMARY KEY,
  applied_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

const directory = new URL("../database/postgres/", import.meta.url);
const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
for (const file of files) {
  const applied = await sql.query("SELECT name FROM choir_schema_migrations WHERE name = $1 LIMIT 1", [file]);
  if (applied.length) continue;
  const source = await readFile(join(directory.pathname, file), "utf8");
  const statements = source.split(/;?\s*-- statement-breakpoint\s*;?/).map((item) => item.trim().replace(/;$/, "")).filter(Boolean).filter((item) => !item.startsWith("-- The Choir Chug"));
  for (const statement of statements) await sql.query(statement);
  await sql.query("INSERT INTO choir_schema_migrations (name, applied_at) VALUES ($1, $2)", [file, new Date().toISOString()]);
  console.log(`Applied ${file}`);
}

console.log("PostgreSQL schema is current.");

