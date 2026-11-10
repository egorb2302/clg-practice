import { createDb } from "../db.js";
import { normalizeEmail } from "../util.js";

const email = process.argv[2];
const name = process.argv[3] ?? "Администратор";
if (!email || !email.includes("@")) {
  console.error("usage: pnpm --filter @armorix/api create-admin <email> [name]");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = createDb(url);
await sql.begin(async (tx) => {
  const [u] = await tx<{ id: string }[]>`
    insert into users (email, name, is_staff) values (${normalizeEmail(email)}, ${name}, true)
    on conflict (email) do update set is_staff = true, status = 'active'
    returning id`;
  await tx`insert into user_roles (user_id, role) values (${u!.id}, 'admin') on conflict do nothing`;
});
console.log("admin ready; sign in with an email code, then enroll TOTP");
await sql.end();
