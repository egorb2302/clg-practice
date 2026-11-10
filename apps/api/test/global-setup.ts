import { createDb } from "../src/db";
import { migrate } from "../src/migrate";

export const TEST_DB = process.env.DATABASE_URL_TEST ?? "postgres://armorix@127.0.0.1:3353/armorix_test";

export default async function setup() {
  const sql = createDb(TEST_DB);
  await sql`drop schema if exists app cascade`;
  await migrate(sql);
  await sql.end();
}
