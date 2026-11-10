import type { NextFunction, Request, Response } from "express";
import type { Config } from "../config";
import { notFound } from "./errors";

export type Feature = "FEATURE_ACCOUNT" | "FEATURE_LOYALTY" | "FEATURE_OFFERS" | "FEATURE_NEWS" | "FEATURE_CAMPAIGNS";

export const feature = (cfg: Config, flag: Feature) => (_req: Request, _res: Response, next: NextFunction) => {
  if (!cfg[flag]) throw notFound();
  next();
};
