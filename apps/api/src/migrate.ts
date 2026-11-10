import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Sql } from "./db.js";

const dir = join(import.meta.dirname, "..", "migrations");

export async function migrate(sql: Sql, log: (m: string) => void = () => {}) {
  await sql`create schema if not exists app`;
  await sql`create table if not exists app.schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql<{ name: string }[]>`select name from app.schema_migrations`).map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const body = await readFile(join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into app.schema_migrations (name) values (${file})`;
    });
    log(`applied ${file}`);
  }
}
