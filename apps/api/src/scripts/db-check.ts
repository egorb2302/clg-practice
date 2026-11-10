import { createDb } from "../db";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = createDb(url);
const [r] = await sql<{ search_path: string; migrations: number; port: string }[]>`
  select current_setting('search_path') as search_path,
    (select count(*)::int from schema_migrations) as migrations,
    current_setting('port') as port`;
console.log(JSON.stringify(r));
await sql.end();
