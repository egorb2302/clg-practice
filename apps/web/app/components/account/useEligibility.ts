import { useEffect, useState } from "react";
import { call } from "../../lib/account";

type Me = { purchases: number; items: { slug: string; eligible: boolean }[] };

export function useEligibility(enabled: boolean) {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"unknown" | "guest" | "known">("unknown");
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void call<Me>("GET", "/me/offers").then((r) => {
      if (!live) return;
      if (r.body) { setMe(r.body); setState("known"); }
      else if (r.status === 401 || r.status === 403) setState("guest");
    });
    return () => { live = false; };
  }, [enabled]);
  return {
    state,
    purchases: me?.purchases ?? 0,
    of: (slug: string): boolean | null => me?.items.find((x) => x.slug === slug)?.eligible ?? null,
  };
}
