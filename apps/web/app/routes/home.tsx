import { useCallback, useState } from "react";
import { data } from "react-router";
import type { Route } from "./+types/home";
import { Hero } from "../components/home/Hero";
import { Offer } from "../components/home/Offer";
import { Process } from "../components/home/Process";
import { Questions } from "../components/home/Questions";
import { Quiz } from "../components/home/Quiz";
import { Road, ShortTrust, Trust } from "../components/home/Road";
import { Showcase } from "../components/home/Showcase";
import { Steel } from "../components/home/Steel";
import { Workshop } from "../components/home/Workshop";
import { Works } from "../components/home/Works";
import { type Kit, leadProduct, type Offer as OfferT, scrollToId } from "../components/home/data";
import { api, apiRaw, PUBLIC_CACHE } from "../lib/api.server";
import { rootOrigin, seo } from "../lib/seo";
import { useVehicle } from "../lib/vehicle";
import css from "../styles/pages/home.css?url";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: css }];

async function loadOffer(): Promise<OfferT | null> {
  try {
    const r = await apiRaw("GET", "/offers");
    const items = r.status === 200 ? (r.body as { items?: OfferT[] } | null)?.items : undefined;
    return items?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function loader() {
  const vehicles = await api.vehicles().then((r) => r.items).catch(() => []);
  const [lists, offer] = await Promise.all([
    Promise.all(vehicles.map((v) => api.catalog(new URLSearchParams({ vehicle: v.slug })).then((c) => c.items).catch(() => []))),
    loadOffer(),
  ]);
  const kits: Kit[] = vehicles.map((v, i) => ({ vehicle: v, products: lists[i] ?? [] }));
  return data({ kits, offer }, { headers: { "Cache-Control": PUBLIC_CACHE } });
}
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({
    title: "Защита бамперов для внедорожников и пикапов | ARMORIX",
    description: "Стальная защита бамперов для JAC T9 и Haval H3 из AISI 304, установка без сверления, доставка по России и изготовление под вашу модель",
    path: "/",
    origin: rootOrigin(matches),
  });

export default function Home({ loaderData }: Route.ComponentProps) {
  const { kits, offer } = loaderData;
  const car = useVehicle();
  const [req, setReq] = useState(0);
  const toQuiz = useCallback(() => {
    setReq((n) => n + 1);
    window.setTimeout(() => scrollToId("quiz"), 30);
  }, []);
  const kit = car?.mode === "kit" ? kits.find((k) => k.vehicle.slug === car.slug) : kits[0];
  const items = new Set(kits.flatMap((k) => k.products.map((p) => p.slug))).size;

  return (
    <div className="home">
      <Hero kits={kits} onQuiz={toQuiz} />
      <Road car={car} />
      {car?.mode === "custom" ? <Trust label={car.label} onQuiz={toQuiz} /> : null}
      <Steel car={car} product={leadProduct(kit)} onQuiz={toQuiz} />
      <Workshop models={kits.length} items={items} />
      <Showcase kits={kits} car={car} onQuiz={toQuiz} />
      {offer ? <Offer offer={offer} /> : null}
      {!car ? <ShortTrust onQuiz={toQuiz} /> : null}
      <Process car={car} onQuiz={toQuiz} />
      <Works car={car} onQuiz={toQuiz} />
      <Questions car={car} />
      <Quiz kits={kits} car={car} req={req} />
    </div>
  );
}
