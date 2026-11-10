import type { MetaResponse } from "@armorix/contracts";
import type { ReactNode } from "react";
import { Route } from "react-router";
import type { capsOf } from "../auth";
import { useAuth } from "../auth";
import "../extra.css";
import { Catalog, ProductEditor, Vehicles } from "./Catalog";
import { Campaigns, Loyalty, Posts } from "./Content";
import { Audit, Jobs, Settings, Users } from "./System";

type Caps = ReturnType<typeof capsOf>;

export function extraNav(caps: Caps, meta: MetaResponse | null): { to: string; label: string; show: boolean }[] {
  const f = meta?.features;
  return [
    { to: "/catalog", label: "Каталог", show: caps.catalog },
    { to: "/vehicles", label: "Модели авто", show: caps.catalog },
    { to: "/posts", label: "Публикации", show: caps.catalog && !!(f?.offers || f?.news) },
    { to: "/campaigns", label: "Рассылки", show: caps.catalog && !!f?.campaigns },
    { to: "/loyalty", label: "Бонусы", show: caps.admin && !!f?.loyalty },
    { to: "/users", label: "Сотрудники", show: caps.admin },
    { to: "/jobs", label: "Уведомления", show: caps.admin },
    { to: "/audit", label: "Журнал", show: caps.admin },
    { to: "/settings", label: "Настройки", show: true },
  ];
}

function Flagged({ flag, children }: { flag: (f: NonNullable<ReturnType<typeof useAuth>["meta"]>["features"]) => boolean; children: ReactNode }) {
  const { meta } = useAuth();
  if (!meta) return null;
  if (!flag(meta.features)) return <p className="muted">Раздел выключен</p>;
  return <>{children}</>;
}

export function extraRoutes(caps: Caps): ReactNode {
  return (
    <>
      {caps.catalog && <Route path="/catalog" element={<Catalog />} />}
      {caps.catalog && <Route path="/catalog/:id" element={<ProductEditor />} />}
      {caps.catalog && <Route path="/vehicles" element={<Vehicles />} />}
      {caps.catalog && (
        <Route
          path="/posts"
          element={
            <Flagged flag={(f) => f.offers || f.news}>
              <Posts />
            </Flagged>
          }
        />
      )}
      {caps.catalog && (
        <Route
          path="/campaigns"
          element={
            <Flagged flag={(f) => f.campaigns}>
              <Campaigns />
            </Flagged>
          }
        />
      )}
      {caps.admin && (
        <Route
          path="/loyalty"
          element={
            <Flagged flag={(f) => f.loyalty}>
              <Loyalty />
            </Flagged>
          }
        />
      )}
      {caps.admin && <Route path="/users" element={<Users />} />}
      {caps.admin && <Route path="/jobs" element={<Jobs />} />}
      {caps.admin && <Route path="/audit" element={<Audit />} />}
      <Route path="/settings" element={<Settings />} />
    </>
  );
}
