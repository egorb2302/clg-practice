import { data } from "react-router";
import type { Route } from "./+types/subscribe-confirm";
import { SubscriptionScreen } from "../components/account/SubscriptionScreen";
import { PRIVATE_CACHE, privateHeaders } from "../lib/account.server";
import { rootOrigin, seo } from "../lib/seo";
import { requireFeature } from "../lib/stub.server";
import css from "../styles/pages/subscription.css?url";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: css }];

export async function loader({ request }: Route.LoaderArgs) {
  await requireFeature("campaigns", PRIVATE_CACHE);
  const q = new URL(request.url).searchParams;
  return data({ id: (q.get("id") ?? "").slice(0, 64), token: (q.get("token") ?? "").slice(0, 120) }, { headers: privateHeaders() });
}
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ title: "Подтверждение подписки", description: "Подтверждение адреса для рассылки акций и новостей ARMORIX", path: "/subscribe/confirm", origin: rootOrigin(matches), noindex: true });

export default function SubscribeConfirm({ loaderData }: Route.ComponentProps) {
  return <SubscriptionScreen mode="confirm" id={loaderData.id} token={loaderData.token} />;
}
