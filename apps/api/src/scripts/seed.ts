import { createDb } from "../db";
import { seed } from "../seed";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = createDb(url);
await seed(sql);
console.log("seed done");
await sql.end();
