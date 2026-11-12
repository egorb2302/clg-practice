import type { MetaResponse } from "@armorix/contracts";
import { useEffect } from "react";
import { data, isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useLocation, useNavigation, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/root";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { NotFoundView } from "./components/NotFoundView";
import { SPRITE } from "./components/sprite";
import { api, PUBLIC_CACHE, siteOrigin } from "./lib/api.server";
import { initMotion } from "./lib/motion";
import tokens from "./styles/tokens.css?url";
import base from "./styles/base.css?url";
import site from "./styles/site.css?url";
import pages from "./styles/pages.css?url";

export const links: Route.LinksFunction = () => [
  { rel: "preload", href: "/fonts/ibm-plex-sans-700.woff", as: "font", type: "font/woff", crossOrigin: "anonymous" },
  { rel: "preload", href: "/fonts/ibm-plex-sans-400.woff", as: "font", type: "font/woff", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: tokens },
  { rel: "stylesheet", href: base },
  { rel: "stylesheet", href: site },
  { rel: "stylesheet", href: pages },
  { rel: "icon", href: "/logo/favicon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/logo/apple-touch-icon.png", sizes: "180x180" },
];

const FALLBACK_META: MetaResponse = {
  features: { account: false, loyalty: false, offers: false, news: false, campaigns: false },
  deliveryMethods: [],
  contacts: {},
};

export async function loader({ request }: Route.LoaderArgs) {
  let fresh = true;
  const [meta, vehicles] = await Promise.all([
    api.meta().catch(() => {
      fresh = false;
      return FALLBACK_META;
    }),
    // the header's catalog menu lists the models; an empty list just hides the menu
    api.vehicles().then((r) => r.items).catch(() => []),
  ]);
  return data({ meta, vehicles, origin: siteOrigin(request) }, { headers: { "Cache-Control": fresh ? PUBLIC_CACHE : "no-store" } });
}

export const headers: Route.HeadersFunction = ({ loaderHeaders }) => loaderHeaders;

/* preloader once per session, skipped before first paint when already seen or motion is off */
const INTRO_GATE = `try{if(sessionStorage.getItem('armorix-intro')||matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('no-intro')}catch(e){document.documentElement.classList.add('no-intro')}document.documentElement.classList.remove('no-js');setTimeout(function(){var h=document.documentElement;if(!h.classList.contains('is-ready'))h.classList.add('no-js')},6000)`;

export function Layout({ children }: { children: React.ReactNode }) {
  const root = useRouteLoaderData<typeof loader>("root");
  const meta = root?.meta ?? FALLBACK_META;
  return (
    <html lang="ru" className="no-js" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0b0d0c" />
        <script dangerouslySetInnerHTML={{ __html: INTRO_GATE }} />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="sprite" aria-hidden="true" dangerouslySetInnerHTML={{ __html: `<svg>${SPRITE}</svg>` }} />
        <a className="skip" href="#main">К содержанию</a>
        <Intro />
        <NavProgress />
        <Header features={meta.features} vehicles={root?.vehicles ?? []} />
        <main id="main">{children}</main>
        <Footer meta={meta} />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function Intro() {
  useEffect(() => {
    const h = document.documentElement;
    if (h.classList.contains("no-intro")) return;
    // tied to real work: the fonts and the first screen's image
    const hero = document.querySelector<HTMLImageElement>("main img");
    const bar = document.querySelector<HTMLElement>(".intro__bar i");
    let done = 0;
    const step = <T,>(p: Promise<T> | undefined) => Promise.resolve(p).finally(() => { done += 1; bar?.style.setProperty("--p", String(Math.min(0.9, done / 3))); });
    const ready = Promise.all([step(document.fonts?.ready), step(hero?.decode?.().catch(() => undefined))]);
    const min = step(new Promise((r) => setTimeout(r, 1400)));
    Promise.race([Promise.all([ready, min]), new Promise((r) => setTimeout(r, 4000))]).then(() => {
      bar?.style.setProperty("--p", "1");
      h.classList.add("intro-done");
      window.dispatchEvent(new Event("app:ready"));
      try { sessionStorage.setItem("armorix-intro", "1"); } catch { /* fine */ }
    });
  }, []);
  return (
    <div className="intro" aria-hidden="true">
      <svg viewBox="0 0 100 94.5"><use className="intro__line" href="#mono" /><use className="intro__fill" href="#mono" /></svg>
      <span className="intro__bar"><i /></span>
    </div>
  );
}

function NavProgress() {
  const nav = useNavigation();
  return <div className={`navp${nav.state !== "idle" ? " is-on" : ""}`} aria-hidden="true" />;
}

export default function App() {
  const { pathname, search } = useLocation();
  useEffect(() => initMotion(), [pathname, search]);
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <>
        <title>Страница не найдена | ARMORIX</title>
        <meta name="description" content="Такой страницы нет, перейдите в каталог защиты бамперов ARMORIX или на главную" />
        <meta property="og:title" content="Страница не найдена | ARMORIX" />
        <meta property="og:description" content="Такой страницы нет, перейдите в каталог защиты бамперов ARMORIX или на главную" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Страница не найдена | ARMORIX" />
        <meta name="twitter:description" content="Такой страницы нет, перейдите в каталог защиты бамперов ARMORIX или на главную" />
        <meta name="robots" content="noindex" />
        <NotFoundView />
      </>
    );
  }
  const msg = isRouteErrorResponse(error) ? `${error.status}` : "Ошибка";
  return (
    <section className="sec wrap err">
      <title>Ошибка | ARMORIX</title>
      <meta name="robots" content="noindex" />
      <h1 className="tt"><span>Что-то пошло не так</span><span className="mute">{msg}</span></h1>
      <p className="t-lead">Попробуйте еще раз или вернитесь на главную</p>
      <p className="err__acts"><button className="btn-line" type="button" onClick={() => window.location.reload()}>Повторить</button><a className="tlink" href="/">На главную</a></p>
    </section>
  );
}
