import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hotp, totpStep } from "../src/security/totp";
import { as, cookieFrom, createStaff, loginStaff, makeDeps, resetData, type Ctx } from "./helpers";

let ctx: Ctx;
beforeAll(async () => {
  ctx = makeDeps();
});
beforeEach(async () => {
  await resetData(ctx);
  ctx.email.sent = [];
});
afterAll(async () => {
  await ctx.sql.end();
});

async function requestCode(email: string) {
  const r = await ctx.http().post("/api/v1/auth/email/request").send({ email });
  await ctx.settle();
  const code = ctx.email.sent.filter((m) => m.to === email).at(-1)?.text.match(/\b(\d{6})\b/)?.[1];
  return { challengeId: r.body.challengeId as string, code, status: r.status };
}

describe("staff auth", () => {
  it("answers the same way for unknown emails and sends nothing", async () => {
    const r = await requestCode("nobody@armorix.test");
    expect(r.status).toBe(202);
    expect(r.challengeId).toBeTruthy();
    expect(r.code).toBeUndefined();
  });

  it("logs in with email code, then requires TOTP before admin access", async () => {
    await createStaff(ctx, "manager@armorix.test", ["manager"]);
    const { challengeId, code } = await requestCode("manager@armorix.test");
    expect(code).toMatch(/^\d{6}$/);
    const v = await ctx.http().post("/api/v1/auth/email/verify").send({ challengeId, code });
    expect(v.status).toBe(200);
    expect(v.body.mfa).toEqual({ required: true, enrolled: false, passed: false });
    const cookie = cookieFrom(v);
    expect(cookie).toMatch(/^ax_session=/);
    const setCookie = String(v.headers["set-cookie"]);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");

    const blocked = await ctx.http().get("/api/v1/admin/leads").set("Cookie", cookie);
    expect(blocked.status).toBe(401);
    expect(blocked.body.code).toBe("MFA_REQUIRED");

    const again = await ctx.http().post("/api/v1/auth/email/verify").send({ challengeId, code });
    expect(again.status).toBe(400);
  });

  it("enrolls TOTP, rotates the session and opens admin routes", async () => {
    await createStaff(ctx, "boss@armorix.test", ["admin"]);
    const s = await loginStaff(ctx, "boss@armorix.test");
    expect(s.recoveryCodes).toHaveLength(8);
    const ok = await as(ctx, s).get("/api/v1/admin/leads");
    expect(ok.status).toBe(200);
    expect(ok.headers["cache-control"]).toBe("no-store");
    const session = await as(ctx, s).get("/api/v1/auth/session");
    expect(session.body.mfa).toEqual({ required: true, enrolled: true, passed: true });
  });

  it("rejects a replayed TOTP code and allows a recovery code once", async () => {
    await createStaff(ctx, "ops@armorix.test", ["manager"]);
    const s = await loginStaff(ctx, "ops@armorix.test");
    await ctx.sql`delete from app.rate_limits`;
    const { challengeId, code } = await requestCode("ops@armorix.test");
    const v = await ctx.http().post("/api/v1/auth/email/verify").send({ challengeId, code });
    const fresh = { cookie: cookieFrom(v), csrf: v.body.csrfToken as string };
    const replay = await as(ctx, fresh).post("/api/v1/auth/totp/verify").send({ code: hotp(s.secret, totpStep(Date.now())) });
    expect(replay.status).toBe(400);
    const rc = s.recoveryCodes[0]!;
    const rec = await as(ctx, fresh).post("/api/v1/auth/recovery").send({ code: rc });
    expect(rec.status).toBe(200);
    const s2 = { cookie: cookieFrom(rec), csrf: rec.body.csrfToken as string };
    const reuse = await as(ctx, s2).post("/api/v1/auth/recovery").send({ code: rc });
    expect(reuse.status).toBe(400);
  });

  it("locks a challenge after five wrong codes", async () => {
    await createStaff(ctx, "x@armorix.test", ["manager"]);
    const { challengeId, code } = await requestCode("x@armorix.test");
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      expect((await ctx.http().post("/api/v1/auth/email/verify").send({ challengeId, code: wrong })).status).toBe(400);
    }
    expect((await ctx.http().post("/api/v1/auth/email/verify").send({ challengeId, code })).status).toBe(400);
  });

  it("does not allow more than five guesses under concurrency", async () => {
    await createStaff(ctx, "burst@armorix.test", ["manager"]);
    const { challengeId, code } = await requestCode("burst@armorix.test");
    const wrong = Array.from({ length: 12 }, (_, i) => String(i).padStart(6, "9")).filter((c) => c !== code);
    await Promise.all(wrong.map((c) => ctx.http().post("/api/v1/auth/email/verify").send({ challengeId, code: c })));
    const [row] = await ctx.sql<{ attempts: number }[]>`select attempts from app.login_challenges where id = ${challengeId}`;
    expect(row!.attempts).toBe(5);
    expect((await ctx.http().post("/api/v1/auth/email/verify").send({ challengeId, code })).status).toBe(400);
  });

  it("throttles repeated code requests for one email", async () => {
    await createStaff(ctx, "y@armorix.test", ["manager"]);
    expect((await requestCode("y@armorix.test")).status).toBe(202);
    expect((await requestCode("y@armorix.test")).status).toBe(429);
  });

  it("requires the CSRF token for state changes with a session", async () => {
    await createStaff(ctx, "z@armorix.test", ["admin"]);
    const s = await loginStaff(ctx, "z@armorix.test");
    const noCsrf = await ctx.http().post("/api/v1/admin/users").set("Cookie", s.cookie).send({});
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.code).toBe("CSRF");
  });

  it("logs out and revokes the session", async () => {
    await createStaff(ctx, "w@armorix.test", ["manager"]);
    const s = await loginStaff(ctx, "w@armorix.test");
    expect((await as(ctx, s).post("/api/v1/auth/logout")).status).toBe(204);
    expect((await as(ctx, s).get("/api/v1/admin/leads")).status).toBe(401);
  });

  it("does not let disabled staff log in", async () => {
    const id = await createStaff(ctx, "gone@armorix.test", ["manager"]);
    await ctx.sql`update app.users set status = 'disabled' where id = ${id}`;
    const r = await requestCode("gone@armorix.test");
    expect(r.code).toBeUndefined();
  });
});
