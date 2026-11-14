import type { ProductCard as Card } from "@armorix/contracts";
import { useMemo, useRef, useState } from "react";
import { data, Link, redirect, useLocation } from "react-router";
import type { Route } from "./+types/product";
import { CatIcon } from "../components/catalog/CatIcon";
import { fetchAllCards, popularCards } from "../components/catalog/catalog.server";
import { Gallery, type Shot } from "../components/catalog/Gallery";
import { LeadPanel } from "../components/catalog/LeadPanel";
import { cardKey, kitDiscounts, parseQuery, swatchOf } from "../components/catalog/model";
import { NotFound } from "../components/catalog/NotFound";
import { ProductFaq } from "../components/catalog/ProductFaq";
import { type SpecTab, SpecTabs } from "../components/catalog/SpecTabs";
import { Collapse, Crumbs, Icon, ProductCard } from "../components/site";
import { api } from "../lib/api.server";
import { plural, POSITION_LABEL, PRICE_NOTE, priceFrom } from "../lib/format";
import { selection, useSelection } from "../lib/selection";
import { rootOrigin, seo } from "../lib/seo";
import { useSite } from "../lib/site";
import { ui } from "../lib/ui";
import { useVehicle } from "../lib/vehicle";
import css from "../styles/pages/product.css?url";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: css }];

export async function loader({ params, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const vehicle = url.searchParams.get("vehicle") ?? undefined;
  const res = await api.product(params.slug, vehicle);
  if (!res) {
    const all = await fetchAllCards().catch((): Card[] => []);
    return data({ kind: "404" as const, popular: popularCards(all), discounts: kitDiscounts(all) }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if ("redirect" in res) {
    const to = res.redirect.startsWith("/") ? res.redirect : `/catalog/${encodeURIComponent(res.redirect)}`;
    const keep = new URLSearchParams();
    for (const k of ["vehicle", "back"]) { const v = url.searchParams.get(k); if (v) keep.set(k, v); }
    throw redirect(keep.size ? `${to}?${keep}` : to, 301);
  }
  const p = res.product;
  const all = await fetchAllCards().catch((): Card[] => []);
  const own = all.filter((c) => c.vehicle.slug === p.vehicle.slug && c.slug !== p.slug);
  const n = own.length >= 5 ? 5 : Math.min(own.length, 2);
  const related = own.slice(0, n);
  const alternatives: Record<string, { slug: string; title: string; label: string }> = {};
  for (const c of all) {
    if (c.slug === p.slug || alternatives[c.vehicle.slug] || p.compatibility.some((x) => x.vehicleSlug === c.vehicle.slug)) continue;
    if (c.position === p.position) alternatives[c.vehicle.slug] = { slug: c.slug, title: c.title, label: c.vehicle.label };
  }
  const disc = kitDiscounts(all);
  const discounts: Record<string, number> = {};
  for (const c of related) if (disc[cardKey(c)]) discounts[cardKey(c)] = disc[cardKey(c)]!;
  return data({ kind: "product" as const, product: p, related, alternatives, discounts, ownDiscount: disc[`${p.slug}|${p.vehicle.slug}`] ?? null }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
export { pageHeaders as headers } from "../lib/headers";

export const meta: Route.MetaFunction = ({ data: d, matches }) => {
  if (!d || d.kind === "404") {
    return [
      { title: "Товар не найден | ARMORIX" },
      { name: "description", content: "Такой защиты нет в каталоге. Подберите по машине или позвоните, подскажем по телефону" },
      { name: "robots", content: "noindex" },
    ];
  }
  const p = d.product;
  return seo({
    title: `${p.title}, ${p.vehicle.label}`,
    description: `${p.title} для ${p.vehicle.label}: ${p.coating?.label ?? "сталь"}, ${priceFrom(p.priceFrom).toLowerCase()}, код ${p.code}. На штатные точки, цену подтвердит менеджер`,
    path: `/catalog/${p.slug}`,
    origin: rootOrigin(matches),
    image: p.image?.url ?? "/og/armorix-product-v1.jpg",
  });
};

const clean = (s: string) => s.replace(/\s[—–]\s/g, ", ").replace(/\s*\.+\s*$/, "").trim();
const sentences = (s: string | null | undefined) => (s ?? "").split(/(?<=[.!?])\s+/).map(clean).filter(Boolean);

const ART: Record<Card["position"], string[]> = {
  front: ["на машине, три четверти спереди", "крупно: покрытие и сварной шов", "крепление на штатные точки, без сверления", "вид сбоку: клиренс и угол въезда", "комплект перед установкой: дуга, кронштейны, крепеж", "на машине после бездорожья"],
  rear: ["на машине, три четверти сзади", "крупно: покрытие и сварной шов", "крепление на штатные точки, без сверления", "вид сбоку: клиренс и угол съезда", "комплект перед установкой: дуга, кронштейны, крепеж", "на машине после бездорожья"],
  kit: ["на машине, перед и зад, два ракурса", "передняя дуга крупно", "задняя дуга крупно", "крепление на штатные точки", "комплект перед установкой: две дуги, кронштейны, крепеж", "на машине после бездорожья"],
};

export default function Product({ loaderData }: Route.ComponentProps) {
  if (loaderData.kind === "404") return <NotFound kind="product" popular={loaderData.popular} discounts={loaderData.discounts} />;
  return <ProductView key={`${loaderData.product.slug}|${loaderData.product.vehicle.slug}`} d={loaderData} />;
}

type ViewData = Extract<Route.ComponentProps["loaderData"], { kind: "product" }>;

function ProductView({ d }: { d: ViewData }) {
  const { product: p, related, alternatives, discounts } = d;
  const { meta, vehicles } = useSite();
  const loc = useLocation();
  const car = useVehicle();
  const sel = useSelection();
  const [tab, setTab] = useState("spec");
  const [leadOpen, setLeadOpen] = useState(false);
  const [breakOpen, setBreakOpen] = useState(false);
  const tabsRef = useRef<HTMLElement>(null);

  const cheapest = [...p.options].filter((o) => o.available).sort((a, b) => (a.priceFrom ?? Number.MAX_SAFE_INTEGER) - (b.priceFrom ?? Number.MAX_SAFE_INTEGER))[0] ?? p.options[0];
  const [optId, setOptId] = useState(cheapest?.id ?? "");
  const opt = p.options.find((o) => o.id === optId) ?? cheapest;
  const price = opt ? opt.priceFrom : p.priceFrom;
  const inSel = !!opt && sel.some((i) => i.variantId === opt.id);
  const selQty = sel.reduce((t, i) => t + i.quantity, 0);

  const sp = new URLSearchParams(loc.search);
  const stateBack = (loc.state as { back?: string } | null)?.back;
  const rawBack = stateBack ?? sp.get("back") ?? "";
  const back = rawBack.startsWith("/catalog") && !rawBack.startsWith("//") ? rawBack : `/catalog?vehicle=${encodeURIComponent(p.vehicle.slug)}`;
  const bq = parseQuery(new URLSearchParams(back.split("?")[1] ?? ""));
  const backWhat = [
    vehicles.find((v) => v.slug === bq.vehicle)?.label ?? (bq.vehicle ? p.vehicle.label : "все машины"),
    ...bq.position.map((x) => ({ front: "передняя", rear: "задняя", kit: "комплекты" })[x as Card["position"]] ?? x),
  ].join(", ");

  const shots: Shot[] = useMemo(() => {
    const own = p.gallery.length ? p.gallery : p.image ? [p.image] : [];
    if (own.length) return own.map((g) => ({ src: g.url, alt: g.alt || `${p.title}, ${p.vehicle.label}` }));
    return ART[p.position].map((what) => ({ src: "", alt: `${p.title.toLowerCase()} ${p.vehicle.label}${p.coating ? `, ${p.coating.label.toLowerCase()}` : ""}, ${what}` }));
  }, [p]);

  const compatLabels = p.compatibility.map((c) => c.label).join(", ") || p.vehicle.label;
  const fits = car?.mode === "kit" ? p.compatibility.some((c) => c.vehicleSlug === car.slug) || car.slug === p.vehicle.slug : null;
  const note = car?.mode === "kit" ? p.compatibility.find((c) => c.vehicleSlug === car.slug)?.note : undefined;
  const alt = car?.mode === "kit" ? alternatives[car.slug] : undefined;

  const openCompat = () => {
    setTab("compat");
    tabsRef.current?.scrollIntoView({ block: "start" });
  };

  function add() {
    if (!opt) return;
    selection.add({
      variantId: opt.id,
      productSlug: p.slug,
      vehicleSlug: p.vehicle.slug,
      snapshot: {
        title: p.title,
        priceFrom: opt.priceFrom,
        imageUrl: p.image?.url ?? null,
        variantTitle: p.options.length > 1 ? opt.title : undefined,
        vehicleLabel: p.vehicle.label,
        options: p.options.filter((o) => o.available).map((o) => ({ id: o.id, title: o.title, priceFrom: o.priceFrom })),
        position: p.position,
      },
    });
    ui.toast(`${p.title}, ${p.vehicle.label}`);
  }

  const status = p.status === "available" ? "В наличии" : "Под заказ";
  const install = sentences(p.installation);
  const hasInstall = meta.deliveryMethods.some((m) => m.code === "install");
  const hasShipping = meta.deliveryMethods.some((m) => m.code === "shipping");

  const tabs: SpecTab[] = [
    {
      id: "spec", label: "Характеристики", sub: `Код ${p.code}`,
      rows: [
        ["Код", p.code],
        ["Машина", compatLabels],
        ["Что защищает", POSITION_LABEL[p.position]],
        ["Покрытие", p.coating?.label ?? p.material ?? "Уточнит менеджер"],
        ["Наличие", p.status === "available" ? "В наличии" : "Под заказ, срок назовет менеджер"],
        ["Комплектация", p.options.map((o) => o.title).join(", ") || "Одна"],
        ...(install[0] ? [["Крепление", install[0]] as [string, string]] : []),
        ...(p.description ? [["Описание", sentences(p.description).join(". ")] as [string, string]] : []),
      ],
    },
    {
      id: "comp", label: "Комплектация", sub: "Что в коробке", numbered: true,
      rows: (p.composition.length ? p.composition : ["Состав назовет менеджер"]).map((c, i) => [String(i + 1).padStart(2, "0"), clean(c)]),
    },
    {
      id: "inst", label: "Установка", sub: hasInstall ? "Ставим у нас или сами по инструкции" : "Как ставится", numbered: true,
      rows: [
        ...(install.length ? install : ["Порядок установки расскажет менеджер"]).map((s, i) => [String(i + 1).padStart(2, "0"), s] as [string, string]),
        ...(hasInstall ? [[String(install.length + 1).padStart(2, "0"), "Можно поставить у нас: срок и цену назовет менеджер"] as [string, string]] : []),
      ],
    },
    {
      id: "compat", label: "Совместимость", sub: "Сомневаетесь? Проверим по фото до заявки",
      rows: [
        ...p.compatibility.map((c) => [c.label, c.note ? clean(c.note) : "Подходит"] as [string, string]),
        ["Год и комплектация", "Проверим по фото до заявки"],
        ["Лебедка или силовой бампер", "Сделаем под заказ"],
        ["Другая машина", "Сделаем под заказ"],
      ],
    },
  ];

  const faq = [
    { q: "Встанет ли на мою комплектацию?", a: `Защита сделана под ${compatLabels}. Если стоит лебедка, фаркоп или другой бампер, пришлите фото, проверим бесплатно до заявки` },
    { q: "Нужно ли сверлить бампер или раму?", a: install[0] ? `${install[0]}. Если сомневаетесь, менеджер покажет точки крепления на фото` : "Расскажем, как крепится, и покажем точки крепления на фото до заявки" },
    { q: "Сколько занимает установка?", a: hasInstall ? "Ставим у нас по записи, срок назовет менеджер вместе с ценой. Можно поставить и самим" : "Срок установки назовет менеджер вместе с ценой" },
    ...(hasShipping ? [{ q: "Доставите в другой город?", a: "Да, транспортной компанией по России. Срок и цену доставки назовет менеджер" }] : []),
  ];

  const breakRows: [string, string][] = [
    ["Защита", price == null ? "назовем по телефону" : priceFrom(price)],
    ...meta.deliveryMethods.map((m) => [m.label, m.code === "pickup" ? "бесплатно" : m.code === "shipping" ? "считаем по городу" : "назовем вместе с ценой защиты"] as [string, string]),
    ["Итог", "подтвердит менеджер, на сайте ничего не оплачивается"],
  ];

  return (
    <>
      <section className="dark2 prd-head">
        <div className="wrap prd-head__row">
          <Link className="prd-back" to={back}>
            <span className="ar ol" aria-hidden="true"><Icon name="back" className="ico--back" /></span>
            <span className="prd-back__t">Назад в каталог</span>
            <small>{backWhat}</small>
          </Link>
          <Crumbs items={[{ label: "Главная", to: "/" }, { label: "Каталог", to: "/catalog" }, { label: p.vehicle.label, to: `/catalog?vehicle=${encodeURIComponent(p.vehicle.slug)}` }, { label: p.title }]} />
        </div>
      </section>

      <section className="light prd-main" aria-labelledby="prd-h1">
        <div className="wrap prd-lay">
          <Gallery
            shots={shots}
            title={p.title}
            proofs={
              <ul className="prd-proof" data-stagger="">
                <li data-in=""><b>Без сверления</b><span>на штатные точки</span></li>
                <li data-in=""><b>{hasInstall ? "Ставим у нас" : "Подскажем по установке"}</b><span>{meta.contacts.address ? meta.contacts.address : hasShipping ? "или отправим по России" : "по телефону"}</span></li>
                <li data-in=""><b>Цену подтвердит менеджер</b><span>на сайте ничего не оплачивается</span></li>
              </ul>
            }
          />

          <div className="prd-buy">
            <div className="prd-buy__meta">
              <span className="prd-buy__code">{p.vehicle.label} · {p.code}</span>
              <span className={`tag${p.status === "available" ? "" : " tag--line"}`}>{status}</span>
            </div>
            <h1 id="prd-h1" className="prd-buy__t">{p.title}</h1>

            {car?.mode === "kit" && fits ? (
              <div className="prd-fit is-ok" role="status">
                <Icon name="check" />
                <div><b>Подходит для {car.label}</b>{note ? <span>{clean(note)}</span> : <span>Сомневаетесь в комплектации? Проверим по фото</span>}<button type="button" className="prd-fit__a" onClick={openCompat}>Вся совместимость</button></div>
              </div>
            ) : car && !fits ? (
              <div className="prd-fit is-bad" role="status">
                <CatIcon name="alert" />
                <div>
                  <b>{car.mode === "kit" && alt ? `На ваш ${car.label} встает другая` : `На ваш ${car.label} эта защита не встанет`}</b>
                  <span>Эта защита для {compatLabels}</span>
                  <span className="prd-fit__row">
                    {car.mode === "kit" && alt ? (
                      <Link className="prd-fit__a" to={`/catalog/${alt.slug}?vehicle=${encodeURIComponent(car.slug)}`}>{alt.title} для {alt.label}</Link>
                    ) : (
                      <Link className="prd-fit__a" to="/#quiz">Рассчитать под {car.label}</Link>
                    )}
                    <button type="button" className="prd-fit__a" onClick={openCompat}>Вся совместимость</button>
                  </span>
                </div>
              </div>
            ) : (
              <p className="prd-fit0"><CatIcon name="car" />Для {compatLabels}<button type="button" className="prd-fit__a" onClick={openCompat}>Вся совместимость</button></p>
            )}

            {p.options.length > 1 ? (
              <div className="prd-row">
                <span className="prd-lab" id="prd-opt-l">Комплектация</span>
                <div className="prd-opts" role="radiogroup" aria-labelledby="prd-opt-l">
                  {p.options.map((o) => (
                    <button key={o.id} type="button" role="radio" aria-checked={o.id === opt?.id} disabled={!o.available} className="prd-opt ol" onClick={() => setOptId(o.id)}>
                      <span>{o.title}</span>
                      <small>{o.available ? priceFrom(o.priceFrom) : "Нет в наличии"}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : opt ? (
              <div className="prd-row"><span className="prd-lab">Комплектация</span><span className="prd-one">{opt.title}</span></div>
            ) : null}

            {p.coating ? (
              <div className="prd-row">
                <span className="prd-lab">Покрытие</span>
                <span className="prd-coat"><i className={`prd-sw prd-sw--${swatchOf(p.coating.code)}`} aria-hidden="true" />{p.coating.label}</span>
              </div>
            ) : null}

            <div className="prd-row prd-price">
              <span className={`prd-price__v${price == null ? " is-ask" : ""}`} role="status" aria-live="polite" key={opt?.id}>{priceFrom(price)}</span>
              <p className="prd-price__n">{price == null ? "Назовем по телефону, бесплатно. " : ""}{PRICE_NOTE}</p>
              <div className="prd-acts">
                <span className="lift lift--block lift--ink">
                  {inSel ? (
                    <button type="button" className="btn btn--dark btn--lg btn--block" onClick={() => ui.openDrawer()} aria-label={`В подборке: ${p.title}, открыть подборку`}>В подборке<Icon name="check" /></button>
                  ) : (
                    <button type="button" className="btn btn--dark btn--lg btn--block" onClick={add} disabled={!opt || !opt.available}>В подборку</button>
                  )}
                </span>
                <span className="lift lift--block lift--ink">
                  <button type="button" className="btn btn--line ol btn--block prd-ask" onClick={() => setLeadOpen(true)} aria-haspopup="dialog">Уточнить комплектацию</button>
                </span>
              </div>
              <Collapse open={inSel}>
                <div className="prd-next" role="status">
                  <span>В подборке {selQty} {plural(selQty, ["позиция", "позиции", "позиций"])}</span>
                  <Link className="lnk lnk--sm" to="/selection"><span className="lnk__t">Оформить подборку</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
                </div>
              </Collapse>
              <div className={`prd-break${breakOpen ? " is-open" : ""}`}>
                <button type="button" className="prd-break__b" aria-expanded={breakOpen} aria-controls="prd-break" onClick={() => setBreakOpen((v) => !v)}>
                  Из чего складывается цена<i className="prd-faq__pm" aria-hidden="true" />
                </button>
                <Collapse open={breakOpen} id="prd-break">
                  <dl className="prd-break__dl">
                    {breakRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                  </dl>
                </Collapse>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section ref={tabsRef} className="light prd-sec prd-sec--tabs" aria-label="О товаре">
        <div className="wrap" data-in="">
          <SpecTabs tabs={tabs} value={tab} onChange={setTab} />
        </div>
      </section>

      <section className="light prd-sec" aria-labelledby="prd-rel-t">
        <div className="wrap">
          <h2 className="prd-h2" id="prd-rel-t" data-in="">Еще для {p.vehicle.label}</h2>
          <div className="prd-grid" data-stagger="">
            {related.map((r) => (
              <ProductCard key={cardKey(r)} p={r} back={back} kitDiscountPct={discounts[cardKey(r)]} sizes="(max-width: 599px) 100vw, (max-width: 1023px) 50vw, 33vw" />
            ))}
            <div className="prd-tile ol" data-in="">
              <b className="prd-tile__t">Нужна защита порогов или другая деталь на {p.vehicle.label}?</b>
              <span className="prd-tile__p">Сделаем под заказ: снимем размеры по фото, покажем эскиз до изготовления</span>
              <Link className="lnk" to="/#quiz"><span className="lnk__t">Рассчитать под заказ</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="light prd-sec" aria-label="Вопросы">
        <div className="wrap"><ProductFaq items={faq} /></div>
      </section>

      {opt ? (
        <LeadPanel
          open={leadOpen}
          onClose={() => setLeadOpen(false)}
          item={{ variantId: opt.id, priceFrom: opt.priceFrom, title: `${p.title}, ${p.vehicle.label}`, sub: [p.code, p.options.length > 1 ? opt.title : "", p.coating?.label ?? ""].filter(Boolean).join(" · ") }}
        />
      ) : null}
    </>
  );
}
