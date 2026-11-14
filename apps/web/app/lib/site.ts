import type { MetaResponse, Vehicle as KitVehicle } from "@armorix/contracts";
import { useRouteLoaderData } from "react-router";

export const FALLBACK_META: MetaResponse = {
  features: { account: false, loyalty: false, offers: false, news: false, campaigns: false },
  deliveryMethods: [],
  contacts: {},
};

type RootData = { meta: MetaResponse; vehicles: KitVehicle[]; origin: string };

export function useSite(): RootData {
  const d = useRouteLoaderData("root") as RootData | undefined;
  return { meta: d?.meta ?? FALLBACK_META, vehicles: d?.vehicles ?? [], origin: d?.origin ?? "" };
}

export function telHref(phone: string | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 10) d = "7" + d;
  return d.length >= 10 ? `tel:+${d}` : null;
}

export function vkLink(value: string | undefined): { href: string; label: string } | null {
  const v = value?.trim();
  if (!v) return null;
  if (/^https:\/\//i.test(v)) return { href: v, label: v.replace(/^https:\/\/(www\.)?/i, "").replace(/\/+$/, "") };
  if (/^[a-z0-9_.]{2,64}$/i.test(v)) return { href: `https://vk.ru/${v}`, label: `vk.ru/${v}` };
  return null;
}
