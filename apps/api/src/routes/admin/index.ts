import { Router } from "express";
import type { Deps } from "../../deps.js";
import { adminCatalogRoutes } from "./catalog.js";
import { adminLeadRoutes } from "./leads.js";
import { adminRelease2Routes } from "./release2.js";
import { adminSaleRoutes } from "./sales.js";
import { adminSystemRoutes } from "./system.js";

export function adminRoutes(deps: Deps) {
  const r = Router();
  r.use(adminLeadRoutes(deps));
  r.use(adminSaleRoutes(deps));
  r.use(adminCatalogRoutes(deps));
  r.use(adminSystemRoutes(deps));
  r.use(adminRelease2Routes(deps));
  return r;
}
