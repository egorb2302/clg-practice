import { createDb } from "../db.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = createDb(url);
const [r] = await sql<{ search_path: string; port: string }[]>`
  select current_setting('search_path') as search_path, current_setting('port') as port`;
const [m] = await sql<{ n: number }[]>`select count(*)::int as n from app.schema_migrations`.catch(() => [{ n: -1 }]);
console.log(JSON.stringify({ ...r, migrations: m?.n ?? null }));
await sql.end();
