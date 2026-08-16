import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sources = [
  "drizzle/0000_fat_wilson_fisk.sql",
  "drizzle/0001_calm_scarecrow.sql",
  "drizzle/0002_sharp_skaar.sql",
  "drizzle/0003_crazy_cammi.sql",
];

const createTables = [];
const alterColumns = [];
const indexes = [];
const foreignKeys = [];

function quote(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function normalize(statement) {
  return statement
    .replaceAll("`", '"')
    .replace(/integer PRIMARY KEY AUTOINCREMENT/gi, "bigserial PRIMARY KEY")
    .replace(/integer DEFAULT false/gi, "integer DEFAULT 0")
    .replace(/integer DEFAULT true/gi, "integer DEFAULT 1")
    .replace(/ON UPDATE no action/gi, "ON UPDATE NO ACTION")
    .replace(/ON DELETE no action/gi, "ON DELETE NO ACTION")
    .trim()
    .replace(/;$/, "");
}

function addForeignKey(table, column, referencedTable, referencedColumn, updateAction, deleteAction) {
  const name = `${table}_${column}_fk`;
  foreignKeys.push(
    `ALTER TABLE ${quote(table)} ADD CONSTRAINT ${quote(name)} FOREIGN KEY (${quote(column)}) REFERENCES ${quote(referencedTable)}(${quote(referencedColumn)}) ON UPDATE ${updateAction.toUpperCase()} ON DELETE ${deleteAction.toUpperCase()}`,
  );
}

for (const source of sources) {
  const sql = await readFile(join(root, source), "utf8");
  for (const raw of sql.split("--> statement-breakpoint")) {
    const statement = raw.trim().replace(/;$/, "");
    if (!statement) continue;
    const createMatch = statement.match(/^CREATE TABLE `([^`]+)` \(([\s\S]+)\)$/i);
    if (createMatch) {
      const [, table, body] = createMatch;
      const lines = body.split("\n");
      const columns = [];
      for (const line of lines) {
        const cleaned = line.trim().replace(/,$/, "");
        const foreignKey = cleaned.match(/^FOREIGN KEY \(`([^`]+)`\) REFERENCES `([^`]+)`\(`([^`]+)`\) ON UPDATE ([a-z ]+) ON DELETE ([a-z ]+)$/i);
        if (foreignKey) {
          addForeignKey(table, foreignKey[1], foreignKey[2], foreignKey[3], foreignKey[4], foreignKey[5]);
          continue;
        }
        if (cleaned) columns.push(`  ${normalize(cleaned)}`);
      }
      createTables.push(`CREATE TABLE IF NOT EXISTS ${quote(table)} (\n${columns.join(",\n")}\n)`);
      continue;
    }

    const alterReference = statement.match(/^ALTER TABLE `([^`]+)` ADD `([^`]+)` ([^;]+?) REFERENCES ([^(]+)\(([^)]+)\)$/i);
    if (alterReference) {
      const [, table, column, type, referencedTable, referencedColumn] = alterReference;
      alterColumns.push(`ALTER TABLE ${quote(table)} ADD COLUMN IF NOT EXISTS ${quote(column)} ${normalize(type)}`);
      addForeignKey(table, column, referencedTable.replaceAll("`", "").trim(), referencedColumn.replaceAll("`", "").trim(), "NO ACTION", "NO ACTION");
      continue;
    }

    if (/^ALTER TABLE/i.test(statement)) {
      alterColumns.push(normalize(statement).replace(/\sADD\s"/i, ' ADD COLUMN IF NOT EXISTS "'));
      continue;
    }
    if (/^CREATE (UNIQUE )?INDEX/i.test(statement)) {
      indexes.push(normalize(statement).replace(/^CREATE (UNIQUE )?INDEX /i, (_, unique = "") => `CREATE ${unique || ""}INDEX IF NOT EXISTS `));
    }
  }
}

const output = [
  "-- The Choir Chug PostgreSQL schema",
  "-- Generated from the checked-in Cloudflare/SQLite migrations.",
  "-- statement-breakpoint",
  ...createTables.flatMap((statement) => [statement, "-- statement-breakpoint"]),
  ...alterColumns.flatMap((statement) => [statement, "-- statement-breakpoint"]),
  ...foreignKeys.flatMap((statement) => [statement, "-- statement-breakpoint"]),
  ...indexes.flatMap((statement) => [statement, "-- statement-breakpoint"]),
].join(";\n\n") + ";\n";

const destination = join(root, "database/postgres/0001_initial.sql");
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, output, "utf8");
console.log(`Generated ${destination}`);

