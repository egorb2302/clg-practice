import type { MetaResponse, SessionResponse } from "@armorix/contracts";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiFailure, getMeta, getSession, setCsrf } from "./api";

type Caps = {
  leadsRead: boolean;
  leads: boolean;
  contacts: boolean;
  sales: boolean;
  catalog: boolean;
  admin: boolean;
  campaignsSend: boolean;
};

type AuthState = {
  session: SessionResponse | null;
  meta: MetaResponse | null;
  caps: Caps;
  loading: boolean;
  refresh: () => Promise<void>;
  accept: (s: SessionResponse) => void;
  logout: () => Promise<void>;
};

export function capsOf(roles: string[]): Caps {
  const has = (r: string) => roles.includes(r);
  const admin = has("admin");
  const leads = has("manager") || admin;
  const contacts = leads || has("contacts_view");
  const sales = leads || has("sales_confirm");
  return {
    leads,
    contacts,
    sales,
    leadsRead: leads || contacts || sales,
    catalog: has("editor") || admin,
    admin,
    campaignsSend: admin || has("campaigns_send"),
  };
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const accept = useCallback((s: SessionResponse) => {
    setCsrf(s.csrfToken);
    setSession(s);
  }, []);

  const refresh = useCallback(async () => {
    try {
      accept(await getSession());
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 401) {
        setCsrf("");
        setSession(null);
      }
    } finally {
      setLoading(false);
    }
  }, [accept]);

  useEffect(() => {
    void refresh();
    getMeta().then(setMeta, () => {});
    const onUnauthorized = () => {
      setCsrf("");
      setSession(null);
    };
    window.addEventListener("armorix:unauthorized", onUnauthorized);
    return () => window.removeEventListener("armorix:unauthorized", onUnauthorized);
  }, [refresh]);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setCsrf("");
    setSession(null);
  }, []);

  return (
    <Ctx.Provider value={{ session, meta, loading, refresh, accept, logout, caps: capsOf(session?.user.roles ?? []) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
