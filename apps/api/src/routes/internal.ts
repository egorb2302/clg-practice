import { Router } from "express";
import type { Deps } from "../deps";
import { notFound } from "../http/errors";
import { safeEqual } from "../security/crypto";
import { runJobs } from "../services/outbox";

export function internalRoutes(deps: Deps) {
  const r = Router();

  r.post("/internal/jobs/run", async (req, res) => {
    const auth = req.header("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token || !safeEqual(token, deps.cfg.JOBS_SECRET)) throw notFound();
    const result = await runJobs(deps, { budgetMs: 50_000 });
    await deps.sql`delete from rate_limits where window_start < now() - interval '1 day'`;
    await deps.sql`delete from idempotency_keys where expires_at < now()`;
    await deps.sql`delete from login_challenges where expires_at < now() - interval '1 day'`;
    await deps.sql`delete from sessions where expires_at < now() - interval '7 days'`;
    res.json(result);
  });

  return r;
}
