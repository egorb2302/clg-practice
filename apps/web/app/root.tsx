import type { MetaResponse } from "@armorix/contracts";
import { useEffect } from "react";
import { data, isRouteErrorResponse, Link, Links, Meta, Outlet, Scripts, ScrollRestoration, useLocation } from "react-router";
import type { Route } from "./+types/root";
import { ContactFab, Footer, Header, Icon, LegalModal, MobileBar, SelectionDrawer, Toast } from "./components/site";
import { MARK_IN, MARK_OUT } from "./components/site/Icon";
import { NotFound } from "./components/catalog/NotFound";
import { SPRITE } from "./components/sprite";
import { api, PUBLIC_CACHE, siteOrigin } from "./lib/api.server";
import { initMotion } from "./lib/motion";
import { useTypography } from "./lib/typo";
import { FALLBACK_META } from "./lib/site";
import tokens from "./styles/tokens.css?url";
import base from "./styles/base.css?url";
import ui from "./styles/ui.css?url";
import shell from "./styles/shell.css?url";

export const links: Route.LinksFunction = () => [
  { rel: "preload", href: "/fonts/tektur-cyrillic-500-normal.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  { rel: "preload", href: "/fonts/golos-text-cyrillic-400-normal.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: tokens },
  { rel: "stylesheet", href: base },
  { rel: "stylesheet", href: ui },
  { rel: "stylesheet", href: shell },
  { rel: "icon", href: "/logo/favicon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/logo/apple-touch-icon.png", sizes: "180x180" },
];

export async function loader({ request }: Route.LoaderArgs) {
  let fresh = true;
  const [meta, vehicles] = await Promise.all([
    api.meta().catch((): MetaResponse => {
      fresh = false;
      return FALLBACK_META;
    }),
    api.vehicles().then((r) => r.items).catch(() => []),
  ]);
  return data({ meta, vehicles, origin: siteOrigin(request) }, { headers: { "Cache-Control": fresh ? PUBLIC_CACHE : "no-store" } });
}

export const headers: Route.HeadersFunction = ({ loaderHeaders, errorHeaders }) =>
  errorHeaders ? new Headers({ "Cache-Control": errorHeaders.get("Cache-Control") ?? "no-store" }) : loaderHeaders;

const INTRO_GATE = `try{if(sessionStorage.getItem('armorix-intro')||matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('no-intro')}catch(e){document.documentElement.classList.add('no-intro')}document.documentElement.classList.remove('no-js');setTimeout(function(){var h=document.documentElement;if(!h.classList.contains('is-ready'))h.classList.add('no-js')},8000)`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="no-js" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0e0e0e" />
        <script dangerouslySetInnerHTML={{ __html: INTRO_GATE }} />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="sprite" aria-hidden="true" dangerouslySetInnerHTML={{ __html: `<svg>${SPRITE}</svg>` }} />
        <a className="skip" href="#main">К содержанию</a>
        <Intro />
        <Header />
        <main id="main" tabIndex={-1}>{children}</main>
        <Footer />
        <SelectionDrawer />
        <Toast />
        <ContactFab />
        <LegalModal />
        <MobileBar />
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
    const hero = document.querySelector<HTMLImageElement>("main img");
    const bar = document.querySelector<HTMLElement>(".intro__bar i");
    let done = 0;
    let finished = false;
    const step = <T,>(p: Promise<T> | undefined) => Promise.resolve(p).finally(() => { done += 1; if (!finished) bar?.style.setProperty("--p", String(Math.min(0.9, done / 3))); });
    const ready = Promise.all([step(document.fonts?.ready), step(hero?.decode?.().catch(() => undefined))]);
    const min = step(new Promise((r) => setTimeout(r, 1400)));
    Promise.race([Promise.all([ready, min]), new Promise((r) => setTimeout(r, 4000))]).then(() => {
      finished = true;
      bar?.style.setProperty("--p", "1");
      h.classList.add("intro-done");
      setTimeout(() => window.dispatchEvent(new Event("app:ready")), 900);
      try { sessionStorage.setItem("armorix-intro", "1"); } catch { /* fine */ }
    });
  }, []);
  return (
    <div className="intro" aria-hidden="true">
      <div className="intro__mark">
        <svg viewBox="0 0 100 94.5">
          <path className="intro__line" d={MARK_OUT + MARK_IN} />
          <path className="intro__fill" fillRule="evenodd" d={MARK_OUT + MARK_IN} />
        </svg>
      </div>
      <span className="intro__bar"><i /></span>
      <span className="intro__name">Armorix</span>
    </div>
  );
}

export default function App() {
  const { pathname, search } = useLocation();
  useEffect(() => initMotion(), [pathname, search]);
  useTypography();
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const title = notFound ? "Страница не найдена" : "Что-то пошло не так";
  const text = notFound
    ? "Такой страницы нет. Посмотрите каталог защиты или вернитесь на главную"
    : "Попробуйте обновить страницу. Если не помогло, вернитесь на главную или позвоните нам";
  const head = (
    <>
      <title>{`${title} | ARMORIX`}</title>
      <meta name="description" content={text} />
      <meta property="og:title" content={`${title} | ARMORIX`} />
      <meta property="og:description" content={text} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={`${title} | ARMORIX`} />
      <meta name="twitter:description" content={text} />
      <meta name="robots" content="noindex" />
    </>
  );
  if (notFound) return <>{head}<NotFound kind="page" /></>;
  return (
    <section className="ph dark2">
      {head}
      <div className="wrap">
        <h1 className="ph__t">{title}</h1>
        <p className="ph__sub">{text}</p>
        <div className="err__acts">
          <span className="lift"><button type="button" className="btn btn--light btn--lg" onClick={() => window.location.reload()}>Повторить</button></span>
          <Link className="lnk" to="/"><span className="lnk__t">На главную</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
        </div>
      </div>
    </section>
  );
}
