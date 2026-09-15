import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
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

// The baseline alone is not what a live database runs. A deployed database has
// already recorded 0001_initial and only ever applies the files added after it,
// so those have to be exercised too - a column that exists only in the
// regenerated baseline reaches new databases and never reaches production.
test("every checked-in PostgreSQL migration applies in order and completes the schema", async () => {
  const directory = new URL("../database/postgres/", import.meta.url);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  assert.ok(files.length > 1, "incremental migrations live beside the baseline");

  const db = new PGlite();
  try {
    for (const file of files) {
      const source = await readFile(new URL(file, directory), "utf8");
      const statements = source
        .split(/;?\s*-- statement-breakpoint\s*;?/)
        .map((item) => item.trim().replace(/;$/, ""))
        .filter(Boolean)
        .filter((item) => !item.startsWith("-- The Choir Chug"));
      for (const statement of statements) {
        try {
          await db.exec(statement);
        } catch (error) {
          assert.fail(`${file} failed: ${error instanceof Error ? error.message : error}\n${statement}`);
        }
      }
    }

    // Each column the application writes but the baseline did not originally
    // create. Every entry here must come from an incremental file.
    const addedLater = [
      { table: "payment_methods", column: "cash_handling" },
      { table: "registrations", column: "available_weekdays" },
    ];
    for (const { table, column } of addedLater) {
      const found = await db.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
        [table, column],
      );
      assert.equal(found.rows.length, 1, `${table}.${column} is missing after every migration ran`);
      const incremental = files.filter((file) => file !== "0001_initial.sql");
      const sources = await Promise.all(incremental.map((file) => readFile(new URL(file, directory), "utf8")));
      assert.ok(
        sources.some((source) => source.includes(`"${table}"`) && source.includes(`"${column}"`)),
        `${table}.${column} exists only in the baseline, so an already-deployed database will never get it - add database/postgres/000N_*.sql with the ALTER TABLE`,
      );
    }
  } finally {
    await db.close();
  }
});
