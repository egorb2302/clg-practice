import { useSyncExternalStore } from "react";

export type Vehicle =
  | { mode: "kit"; slug: string; label: string }
  | { mode: "custom"; brand: string; model: string; label: string }
  | null;

const KEY = "armorix.vehicle.v1";
let cache: Vehicle | undefined;
let memory: Vehicle = null;
const subs = new Set<() => void>();

function valid(v: unknown): Vehicle {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.mode === "kit" && typeof o.slug === "string" && typeof o.label === "string") return { mode: "kit", slug: o.slug, label: o.label };
  if (o.mode === "custom" && typeof o.brand === "string" && typeof o.model === "string" && typeof o.label === "string") {
    return { mode: "custom", brand: o.brand, model: o.model, label: o.label };
  }
  return null;
}

function read(): Vehicle {
  if (cache !== undefined) return cache;
  try {
    const raw = sessionStorage.getItem(KEY);
    cache = raw ? valid(JSON.parse(raw)) : null;
  } catch {
    cache = memory;
  }
  return cache;
}

function write(next: Vehicle) {
  cache = next;
  memory = next;
  try {
    if (next) sessionStorage.setItem(KEY, JSON.stringify(next));
    else sessionStorage.removeItem(KEY);
  } catch { /* storage off: memory only */ }
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => { subs.delete(f); };
}

export function useVehicle(): Vehicle {
  return useSyncExternalStore(subscribe, read, () => null);
}

export const vehicle = {
  get: read,
  set: (v: Exclude<Vehicle, null>) => write(valid(v)),
  clear: () => write(null),
};
