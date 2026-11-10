import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PermanentError } from "../src/adapters/errors";
import { enqueue, runJobs } from "../src/services/outbox";
import { makeDeps, resetData, type Ctx } from "./helpers";

let ctx: Ctx;
beforeAll(async () => {
  ctx = makeDeps();
});
beforeEach(async () => {
  await resetData(ctx);
  ctx.telegram.calls = [];
  ctx.telegram.failWith = null;
  ctx.email.sent = [];
});
afterAll(async () => {
  await ctx.sql.end();
});

const tgJob = (k: string) => ({
  channel: "telegram" as const,
  topic: "test",
  dedupeKey: k,
  payload: { method: "sendMessage", params: { chat_id: 1, text: k } },
});

describe("outbox", () => {
  it("deduplicates jobs by key", async () => {
    expect(await enqueue(ctx.sql, [tgJob("a")])).toHaveLength(1);
    expect(await enqueue(ctx.sql, [tgJob("a")])).toHaveLength(0);
  });

  it("recovers a job whose lease expired after a crash", async () => {
    await enqueue(ctx.sql, [tgJob("crashed")]);
    await ctx.sql`update app.outbox set status = 'processing', attempts = 1, lease_until = now() - interval '1 minute'`;
    const r = await runJobs(ctx.deps);
    expect(r.sent).toBe(1);
    expect(ctx.telegram.calls).toHaveLength(1);
  });

  it("does not resend a sent job", async () => {
    await enqueue(ctx.sql, [tgJob("once")]);
    await runJobs(ctx.deps);
    await runJobs(ctx.deps);
    expect(ctx.telegram.calls).toHaveLength(1);
  });

  it("fails permanently on a permanent error and backs off on a temporary one", async () => {
    await enqueue(ctx.sql, [tgJob("perm")]);
    ctx.telegram.failWith = new PermanentError("telegram 403");
    await runJobs(ctx.deps);
    const [p] = await ctx.sql`select status from app.outbox where dedupe_key = 'perm'`;
    expect(p!.status).toBe("failed");
    await enqueue(ctx.sql, [tgJob("temp")]);
    ctx.telegram.failWith = new Error("network");
    await runJobs(ctx.deps);
    const [t] = await ctx.sql<{ status: string; later: boolean }[]>`
      select status, run_after > now() as later from app.outbox where dedupe_key = 'temp'`;
    expect(t).toEqual({ status: "pending", later: true });
  });

  it("defers email past the daily limit", async () => {
    const limited = makeDeps({ EMAIL_DAILY_LIMIT: "1" });
    await enqueue(limited.sql, [
      { channel: "email", topic: "t", dedupeKey: "e1", payload: { to: "a@x.test", subject: "1", text: "1" } },
      { channel: "email", topic: "t", dedupeKey: "e2", payload: { to: "b@x.test", subject: "2", text: "2" } },
    ]);
    const r = await runJobs(limited.deps);
    expect(r).toMatchObject({ sent: 1, deferred: 1 });
    await limited.sql.end();
  });

  it("protects the job runner with a bearer secret", async () => {
    expect((await ctx.http().post("/api/v1/internal/jobs/run")).status).toBe(404);
    const ok = await ctx.http().post("/api/v1/internal/jobs/run").set("Authorization", "Bearer jobs-secret-for-tests-0123456789");
    expect(ok.status).toBe(200);
  });
});

describe("telegram webhook", () => {
  const hook = (body: object, secret = "tg-secret-for-tests-0123") =>
    ctx.http().post("/api/v1/webhooks/telegram").set("X-Telegram-Bot-Api-Secret-Token", secret).send(body);

  it("rejects a wrong secret", async () => {
    expect((await hook({ update_id: 1 }, "nope")).status).toBe(404);
  });

  it("answers /start once per update with site buttons and product context", async () => {
    const update = { update_id: 77, message: { text: "/start p_jac-t9-front-tube", chat: { id: 555, type: "private" } } };
    expect((await hook(update)).status).toBe(200);
    expect((await hook(update)).status).toBe(200);
    await ctx.settle();
    expect(ctx.telegram.calls).toHaveLength(1);
    const kb = (ctx.telegram.calls[0]!.params.reply_markup as { inline_keyboard: { url: string }[][] }).inline_keyboard;
    expect(kb[0]![0]!.url).toBe("http://localhost:3351/catalog/jac-t9-front-tube");
    expect(kb.map((row) => row[0]!.url)).toContain("http://localhost:3351/contacts#form");
  });

  it("does not block the lead when Telegram is down", async () => {
    ctx.telegram.failWith = new Error("down");
    const [v] = await ctx.sql<{ id: string }[]>`select id from app.variants limit 1`;
    const [p] = await ctx.sql<{ slug: string }[]>`
      select p.slug from app.products p join app.variants x on x.product_id = p.id where x.id = ${v!.id}`;
    expect(p).toBeTruthy();
    const res = await ctx.http().post("/api/v1/leads").set("Idempotency-Key", "tg-down-key-1").send({
      type: "general",
      name: "Тест",
      contact: { preferred: "email", email: "t@example.test" },
      message: "Связь с Telegram пропала",
      website: "",
      formStartedAt: Date.now() - 5000,
    });
    expect(res.status).toBe(201);
    await ctx.settle();
    const [job] = await ctx.sql`select status from app.outbox where channel = 'telegram'`;
    expect(job!.status).toBe("pending");
  });
});
