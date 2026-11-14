import { data } from "react-router";
import type { Route } from "./+types/not-found";
import { fetchAllCards, popularCards } from "../components/catalog/catalog.server";
import { kitDiscounts } from "../components/catalog/model";
import { NotFound } from "../components/catalog/NotFound";
import { rootOrigin } from "../lib/seo";
export { pageHeaders as headers } from "../lib/headers";

export async function loader() {
  const all = await fetchAllCards().catch(() => []);
  const popular = popularCards(all);
  const disc = kitDiscounts(all);
  return data({ popular, discounts: disc }, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const img = `${rootOrigin(matches)}/og/armorix-default-v1.jpg`;
  return [
    { title: "Страница не найдена | ARMORIX" },
    { name: "description", content: "Такой страницы нет. Подберите защиту бампера в каталоге или позвоните, подскажем по телефону" },
    { property: "og:title", content: "Страница не найдена | ARMORIX" },
    { property: "og:description", content: "Такой страницы нет. Подберите защиту бампера в каталоге или позвоните, подскажем по телефону" },
    { property: "og:image", content: img },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: img },
    { name: "robots", content: "noindex" },
  ];
};

export default function NotFoundRoute({ loaderData }: Route.ComponentProps) {
  return <NotFound kind="page" popular={loaderData.popular} discounts={loaderData.discounts} />;
}
