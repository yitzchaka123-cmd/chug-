import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("the generated PostgreSQL migration creates the complete schema", async () => {
  const source = await readFile(new URL("../database/postgres/0001_initial.sql", import.meta.url), "utf8");
  const statements = source
    .split(/;?\s*-- statement-breakpoint\s*;?/)
    .map((item) => item.trim().replace(/;$/, ""))
    .filter(Boolean)
    .filter((item) => !item.startsWith("-- The Choir Chug"));

  const db = new PGlite();
  try {
    for (const statement of statements) await db.exec(statement);
    const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    const names = tables.rows.map((row) => row.table_name);
    assert.equal(names.length, 25);
    for (const required of ["school_years", "agreement_versions", "registrations", "students", "groups", "group_announcements", "schedule_events", "payment_items", "backup_snapshots", "email_outbox"]) {
      assert.ok(names.includes(required), `missing ${required}`);
    }
    const constraints = await db.query("SELECT count(*)::integer AS count FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY'");
    assert.equal(constraints.rows[0].count, 35);
  } finally {
    await db.close();
  }
});
