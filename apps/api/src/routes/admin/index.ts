import { Router } from "express";
import type { Deps } from "../../deps";
import { adminCatalogRoutes } from "./catalog";
import { adminLeadRoutes } from "./leads";
import { adminRelease2Routes } from "./release2";
import { adminSaleRoutes } from "./sales";
import { adminSystemRoutes } from "./system";

export function adminRoutes(deps: Deps) {
  const r = Router();
  r.use(adminLeadRoutes(deps));
  r.use(adminSaleRoutes(deps));
  r.use(adminCatalogRoutes(deps));
  r.use(adminSystemRoutes(deps));
  r.use(adminRelease2Routes(deps));
  return r;
}
