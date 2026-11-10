import { createDb } from "../db";
import { migrate } from "../migrate";

const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = createDb(url);
await migrate(sql, console.log);
console.log("migrations up to date");
await sql.end();
