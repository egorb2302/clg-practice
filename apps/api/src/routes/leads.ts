import { Router, type Request } from "express";
import type { Deps } from "../deps";
import type { AuthContext } from "../security/session";
import { afterLead, submitLead } from "../services/leads";

export function clientIp(req: Request) {
  const h = req.headers["x-vercel-forwarded-for"] ?? req.headers["x-forwarded-for"];
  const first = (Array.isArray(h) ? h[0] : h)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}

export function leadRoutes(deps: Deps) {
  const r = Router();
  r.post("/leads", async (req, res) => {
    const result = await submitLead(deps, {
      body: req.body,
      key: req.header("idempotency-key"),
      ip: clientIp(req),
      auth: res.locals.auth as AuthContext | null,
    });
    afterLead(deps, result.jobIds);
    res.set("Cache-Control", "no-store").status(result.status).json(result.body);
  });
  return r;
}
