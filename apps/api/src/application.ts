import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { API_PREFIX } from "@armorix/contracts";
import express, { type NextFunction, type Request, type Response } from "express";
import { LocalStorage } from "./adapters/storage.js";
import type { Deps } from "./deps.js";
import { errorHandler, notFound } from "./http/errors.js";
import { adminRoutes } from "./routes/admin/index.js";
import { accountRoutes } from "./routes/account.js";
import { authRoutes } from "./routes/auth.js";
import { contentRoutes } from "./routes/content.js";
import { internalRoutes } from "./routes/internal.js";
import { leadRoutes } from "./routes/leads.js";
import { publicRoutes } from "./routes/public.js";
import { telegramRoutes } from "./routes/telegram.js";
import { safeEqual } from "./security/crypto.js";
import { originGuard, sessionMiddleware } from "./security/session.js";

export function createApp(deps: Deps) {
  const app = express();
  app.disable("x-powered-by");
  app.set("etag", false);
  app.set("query parser", "simple");

  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header("x-request-id");
    res.locals.requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    res.set("X-Request-Id", res.locals.requestId);
    const proxySecret = deps.cfg.SITE_PROXY_SECRET;
    const sentSecret = req.header("x-armorix-proxy-secret");
    const proxiedIp = req.header("x-armorix-client-ip");
    if (proxySecret && sentSecret && proxiedIp && safeEqual(sentSecret, proxySecret) && /^[0-9a-fA-F.:]{3,45}$/.test(proxiedIp)) {
      res.locals.trustedClientIp = proxiedIp;
    }
    res.set("X-Content-Type-Options", "nosniff");
    const started = Date.now();
    res.on("finish", () => {
      console.log(
        JSON.stringify({
          level: "info",
          requestId: res.locals.requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ms: Date.now() - started,
        }),
      );
    });
    next();
  });

  app.get("/health", async (_req, res) => {
    await deps.sql`select 1`;
    res.json({ ok: true });
  });

  const adminDir = join(import.meta.dirname, "..", "public", "admin");
  if (existsSync(join(adminDir, "index.html"))) {
    app.use("/admin", express.static(adminDir, { index: false, maxAge: "1h" }));
    app.get(/^\/admin(\/.*)?$/, (req, res) => {
      if (/\.[a-z0-9]+$/i.test(req.path)) {
        res.status(404).end();
        return;
      }
      res.set("Cache-Control", "no-store").sendFile(join(adminDir, "index.html"));
    });
  } else if (process.env.VERCEL) {
    console.error(JSON.stringify({ level: "error", event: "admin.missing", dir: adminDir }));
  }

  if (deps.storage instanceof LocalStorage) {
    app.use("/media", express.static(deps.storage.publicDir(), { maxAge: "1d", fallthrough: false }));
    app.use(`${API_PREFIX}/admin/media/local-upload`, express.raw({ type: () => true, limit: "25mb" }));
  }

  app.use(express.json({ limit: "256kb" }));
  app.use(sessionMiddleware(deps));
  app.use(originGuard(deps));

  const api = express.Router();
  api.use(publicRoutes(deps));
  api.use(leadRoutes(deps));
  api.use(authRoutes(deps));
  api.use(accountRoutes(deps));
  api.use(contentRoutes(deps));
  api.use(telegramRoutes(deps));
  api.use(internalRoutes(deps));
  api.use("/admin", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  api.use(adminRoutes(deps));
  app.use(API_PREFIX, api);

  app.use(() => {
    throw notFound();
  });
  app.use(errorHandler);
  return app;
}
