import { Router } from "express";
import type { Deps } from "../../deps";
import { adminCatalogRoutes } from "./catalog";
import { adminLeadRoutes } from "./leads";
import { adminSaleRoutes } from "./sales";
import { adminSystemRoutes } from "./system";

export function adminRoutes(deps: Deps) {
  const r = Router();
  r.use(adminLeadRoutes(deps));
  r.use(adminSaleRoutes(deps));
  r.use(adminCatalogRoutes(deps));
  r.use(adminSystemRoutes(deps));
  return r;
}
