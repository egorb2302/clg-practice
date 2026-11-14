import { useEffect, useId, useState } from "react";
import { data, Link, redirect, type ShouldRevalidateFunction, useNavigate, useRevalidator, useSearchParams } from "react-router";
import type { Route } from "./+types/account";
import { coverOf, offerState } from "../components/account/post";
import { ProfilePanel, TelegramLink } from "../components/account/ProfilePanel";
import type { Claimable, Lead, Loyalty, MyOffers, Profile, Purchase, Subscription } from "../components/account/types";
import { Collapse, Crumbs, Icon, Illustration } from "../components/site";
import { fmtDate, fmtTime, loginHref, maskedPhone, num, pointsLabel, send, setCsrf } from "../lib/account";
import { meGet, PRIVATE_CACHE, privateHeaders, sessionOf } from "../lib/account.server";
import { contact } from "../lib/contact";
import { plural, rubles } from "../lib/format";
import { rootOrigin, seo } from "../lib/seo";
import { useSite } from "../lib/site";
import { requireFeature } from "../lib/stub.server";
import css from "../styles/pages/account.css?url";
import codeCss from "../styles/pages/login.css?url";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: codeCss }, { rel: "stylesheet", href: css }];

const TABS = ["leads", "purchases", "bonus", "offers", "profile"] as const;
type Tab = (typeof TABS)[number];
const STAFF = new Set(["manager", "editor", "admin"]);

export async function loader({ request }: Route.LoaderArgs) {
  await requireFeature("account", PRIVATE_CACHE);
  const url = new URL(request.url);
  const s = await sessionOf(request);
  if (!s) throw redirect(loginHref(`${url.pathname}${url.search}`), { headers: privateHeaders() });
  if (s.user.roles.some((r) => STAFF.has(r))) return data({ staff: true as const, csrf: s.csrfToken }, { headers: privateHeaders() });
  const [me, leads, claim, buys, loy, offers, sub] = await Promise.all([
    meGet<{ profile: Profile }>(request, "/me"),
    meGet<{ items: Lead[] }>(request, "/me/leads"),
    meGet<{ items: Claimable[] }>(request, "/me/leads/claimable"),
    meGet<{ items: Purchase[] }>(request, "/me/purchases"),
    meGet<Loyalty>(request, "/me/loyalty"),
    meGet<MyOffers>(request, "/me/offers"),
    meGet<{ subscription: Subscription }>(request, "/me/subscription"),
  ]);
  if (me.status === 401) throw redirect(loginHref(`${url.pathname}${url.search}`), { headers: privateHeaders() });
  if (!me.body) throw data(null, { status: me.status === 403 ? 403 : 502, headers: privateHeaders() });
  return data({
    staff: false as const,
    csrf: s.csrfToken,
    profile: me.body.profile,
    leads: leads.body?.items ?? [],
    leadsFailed: !leads.body,
    claimable: claim.body?.items ?? [],
    purchases: buys.body?.items ?? [],
    purchasesFailed: !buys.body,
    loyalty: loy.status === 404 ? null : loy.body,
    offers: offers.status === 404 ? null : offers.body,
    subscription: sub.status === 404 || !sub.body ? undefined : sub.body.subscription,
  }, { headers: privateHeaders() });
}

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl, formMethod, defaultShouldRevalidate }) => {
  if (!formMethod && currentUrl.pathname === nextUrl.pathname) {
    const a = new URLSearchParams(currentUrl.search), b = new URLSearchParams(nextUrl.search);
    if (a.get("tab") !== b.get("tab")) {
      a.delete("tab");
      b.delete("tab");
      if (a.toString() === b.toString()) return false;
    }
  }
  return defaultShouldRevalidate;
};

export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ title: "Личный кабинет", description: "Личный кабинет ARMORIX: заявки, покупки, баллы и подписка", path: "/account", origin: rootOrigin(matches), noindex: true });

const TYPE: Record<Lead["type"], string> = { catalog: "Из каталога", custom: "На изготовление", general: "Вопрос" };
const STEPS = ["Принята", "В работе", "Завершена покупкой"];
const PILL: Record<string, string> = { "Принята": "is-new", "В работе": "is-work", "Завершена покупкой": "is-done", "Закрыта": "is-closed" };
const BUY: Record<Purchase["status"], string> = { confirmed: "Подтверждена", partially_refunded: "Частичный возврат", refunded: "Возврат" };
const OP: Record<string, string> = { earn: "Начисление", redeem: "Списание", reverse: "Отмена", expire: "Сгорание", adjust: "Корректировка" };


function Empty({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="ac-empty ol" role="status" data-in="">
      <h3 className="ac-empty__t">{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}

function PanelHead({ title, sub, aside }: { title: string; sub?: string; aside?: React.ReactNode }) {
  return (
    <div className="ac-head" data-in="">
      <h2 className="ac-head__t">{title}</h2>
      {sub ? <span className="ac-head__s">{sub}</span> : null}
      {aside}
    </div>
  );
}

export default function Account({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  useEffect(() => { setCsrf(loaderData.csrf); }, [loaderData.csrf]);

  async function logout() {
    await send("POST", "/auth/logout");
    setCsrf(null);
    navigate("/", { replace: true });
  }

  if (loaderData.staff) {
    return (
      <section className="ac-hd dark2">
        <div className="wrap">
          <Crumbs items={[{ label: "Главная", to: "/" }, { label: "Кабинет" }]} />
          <h1 className="ac-hd__t" data-in="">Кабинет</h1>
          <p className="ac-hd__lead" data-in="">Вы вошли как сотрудник. Кабинет клиента недоступен для учетных записей сотрудников, работа с заявками в панели</p>
          <div className="ac-hd__acts" data-in="">
            <span className="lift"><a className="btn btn--light" href="/admin/">Панель сотрудника</a></span>
            <button type="button" className="btn btn--line ol" onClick={() => void logout()}>Выйти</button>
          </div>
        </div>
      </section>
    );
  }
  return <Cabinet d={loaderData} onLogout={() => void logout()} />;
}

type D = Exclude<Route.ComponentProps["loaderData"], { staff: true }>;

function Cabinet({ d, onLogout }: { d: D; onLogout: () => void }) {
  const { meta } = useSite();
  const [params] = useSearchParams();
  const raw = params.get("tab");
  const enabled = TABS.filter((t) => (t === "bonus" ? !!d.loyalty : t === "offers" ? !!d.offers : true));
  const tab: Tab = enabled.includes(raw as Tab) ? (raw as Tab) : "leads";
  const shown = tab;
  const rv = useRevalidator();
  const refresh = () => void rv.revalidate();
  const p = d.profile;
  useEffect(() => { contact.fromProfile(p); }, [p]);
  const bal = d.loyalty?.balance ?? 0;
  const pending = d.loyalty?.pending ?? [];
  const pendingPts = pending.reduce((s, x) => s + x.points, 0);
  const earn = d.loyalty?.history.find((h) => h.type === "earn" && h.expiresAt && new Date(h.expiresAt) > new Date());

  const tabs: { id: Tab; label: string; n: string }[] = [
    { id: "leads", label: "Заявки", n: num(d.leads.length) },
    { id: "purchases", label: "Покупки", n: num(d.purchases.length) },
    ...(d.loyalty ? [{ id: "bonus" as Tab, label: "Бонусы", n: num(bal) }] : []),
    ...(d.offers ? [{ id: "offers" as Tab, label: "Акции", n: num(d.offers.items.length) }] : []),
    { id: "profile", label: "Профиль", n: "" },
  ];

  return (
    <>
      <section className="ac-hd dark2">
        <div className="wrap">
          <Crumbs items={[{ label: "Главная", to: "/" }, { label: "Кабинет" }]} />
          <div className="ac-hd__row">
            <div>
              <h1 className="ac-hd__t" data-in="">Кабинет</h1>
              <p className="ac-who" data-in="">
                <span>{p.name || "Имя не указано"}</span>
                {p.email ? <span>{p.email} <i>· {p.emailVerified ? "подтверждена" : "не подтверждена"}</i></span> : null}
                {p.phone && p.phoneVerified ? <span>{maskedPhone(p.phone)} <i>· через Telegram</i></span> : null}
              </p>
            </div>
            {d.loyalty ? (
              <Link className="ac-bal ol" to="?tab=bonus" preventScrollReset data-in="">
                <b className="D"><span data-count={bal}>{num(bal)}</span> {plural(bal, ["балл", "балла", "баллов"])}</b>
                <span>{bal > 0 && earn ? `до ${fmtDate(earn.expiresAt)}, до 20% покупки` : pendingPts > 0 ? "ждут подтверждения контакта" : bal > 0 ? "до 20% покупки" : "получите 1 000 за первую заявку"}</span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="ac-sec light">
        <div className="wrap ac-grid">
          <nav className="ac-nav" aria-label="Разделы кабинета">
            <ul className="ac-tabs">
              {tabs.map((t) => (
                <li key={t.id}>
                  <Link className="ac-tab ol" to={`?tab=${t.id}`} preventScrollReset aria-current={tab === t.id ? "page" : undefined}>
                    <span>{t.label}</span>{t.n ? <span className="ac-tab__n num">{t.n}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="ac-nav__out">
              <Link className="lnk lnk--sm" to="/catalog"><span className="lnk__t">В каталог</span></Link>
              <button type="button" className="lnk lnk--sm" onClick={onLogout}><span className="lnk__t">Выйти</span></button>
            </div>
          </nav>

          <div className="ac-panel" key={shown}>
            {shown === "leads" ? <LeadsPanel d={d} loyaltyOn={!!d.loyalty} onChanged={refresh} /> : null}
            {shown === "purchases" ? <PurchasesPanel d={d} /> : null}
            {shown === "bonus" && d.loyalty ? <BonusPanel l={d.loyalty} onChanged={refresh} /> : null}
            {shown === "offers" && d.offers ? <OffersPanel o={d.offers} /> : null}
            {shown === "profile" ? <ProfilePanel profile={p} subscription={meta.features.campaigns ? d.subscription : undefined} onChanged={refresh} onLogout={onLogout} /> : null}
          </div>
        </div>
      </section>
    </>
  );
}

function LeadsPanel({ d, loyaltyOn, onChanged }: { d: D; loyaltyOn: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState<string | null>(d.leads[0]?.reference ?? null);
  const uid = useId().replace(/:/g, "");
  return (
    <>
      <PanelHead title="Заявки" sub="Статус меняет менеджер, обычно в течение дня" />
      {d.claimable.length ? <ClaimBlock items={d.claimable} p={d.profile} loyaltyOn={loyaltyOn} onChanged={onChanged} /> : null}
      {d.leadsFailed ? <p className="ferr" role="alert">Не удалось загрузить заявки, обновите страницу</p> : null}
      {d.leads.length ? (
        <ul className="ac-rows" data-stagger="">
          {d.leads.map((l) => {
            const on = open === l.reference;
            const id = `${uid}-${l.reference}`;
            const closed = l.status === "Закрыта";
            const reached = closed ? 0 : Math.max(0, STEPS.indexOf(l.status));
            return (
              <li key={l.reference} className={`ac-row ol${on ? " is-open" : ""}`} data-in="">
                <button type="button" className="ac-row__h" aria-expanded={on} aria-controls={id} onClick={() => setOpen(on ? null : l.reference)}>
                  <span className="ac-row__ref D">{l.reference}</span>
                  <span className="ac-row__date">{fmtDate(l.createdAt)}</span>
                  <span className="ac-row__what">{TYPE[l.type]}<small>{l.items ? `${l.items} ${plural(l.items, ["позиция", "позиции", "позиций"])}` : l.type === "general" ? "сообщение менеджеру" : "без позиций каталога"}</small></span>
                  <span className={`ac-pill cut ${PILL[l.status] ?? "is-new"}`}>{l.status}</span>
                  <span className="ac-row__chev ar ol" aria-hidden="true"><Icon name="chev" /></span>
                </button>
                <Collapse open={on} id={id}>
                  <div className="ac-row__b">
                    <dl className="ac-dl">
                      <div><dt>Номер</dt><dd className="D">{l.reference}</dd></div>
                      <div><dt>Отправлена</dt><dd>{fmtDate(l.createdAt)} в {fmtTime(l.createdAt)} по Москве</dd></div>
                      <div><dt>Тип</dt><dd>{TYPE[l.type]}</dd></div>
                      {l.items ? <div><dt>В заявке</dt><dd>{l.items} {plural(l.items, ["позиция", "позиции", "позиций"])}</dd></div> : null}
                    </dl>
                    <div>
                      <span className="ac-cap">Статус</span>
                      {closed ? (
                        <p className="ac-closed">Заявка закрыта. Если вопрос остался, отправьте новую заявку или позвоните менеджеру</p>
                      ) : (
                        <ol className="ac-steps">
                          {STEPS.map((s, i) => <li key={s} className={i < reached ? "is-past" : i === reached ? "is-now" : ""}><i className="cut" aria-hidden="true" /><span>{s}</span></li>)}
                        </ol>
                      )}
                      <p className="ac-dim">Назовите номер менеджеру, если будете звонить по этой заявке</p>
                    </div>
                  </div>
                </Collapse>
              </li>
            );
          })}
        </ul>
      ) : !d.leadsFailed ? (
        <Empty title="Заявок пока нет" text={`Здесь появятся заявки из каталога и на изготовление со статусом${loyaltyOn ? ". За первую заявку начислим 1 000 приветственных баллов" : ""}`}>
          <span className="lift lift--ink"><Link className="btn btn--dark" to="/catalog">Подобрать комплект<Icon name="arrow" className="ico--go" /></Link></span>
        </Empty>
      ) : null}
    </>
  );
}

function ClaimBlock({ items, p, loyaltyOn, onChanged }: { items: Claimable[]; p: Profile; loyaltyOn: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const by = p.phoneVerified && p.emailVerified ? "Почта или телефон" : p.phoneVerified ? "Телефон" : "Почта";

  async function claim(refs: string[]) {
    setBusy(refs.length > 1 ? "all" : refs[0]!);
    setErr("");
    setMsg("");
    const r = await send<{ items: { reference: string; claimed: boolean; loyaltyStatus?: string }[] }>("POST", "/me/leads/claim", { references: refs });
    setBusy(null);
    if (!r.body) { setErr("Не удалось привязать, попробуйте еще раз"); return; }
    const ok = r.body.items.filter((x) => x.claimed);
    const credited = ok.some((x) => x.loyaltyStatus === "credited");
    if (!ok.length) { setErr("Эти заявки уже нельзя привязать: их привязали раньше или прошло больше 180 дней"); onChanged(); return; }
    setMsg(`${ok.length === 1 ? `Заявка ${ok[0]!.reference} привязана` : `Привязали заявок: ${ok.length}`}${credited ? ". Приветственные баллы начислены" : loyaltyOn ? ". Приветственный бонус дается один раз, за эти заявки он не начисляется" : ""}`);
    onChanged();
  }

  return (
    <div className="ac-claim ol" role="region" aria-label="Заявки, отправленные без входа" data-in="">
      <div className="ac-claim__t">
        <strong>{items.length === 1 ? "Нашли заявку, отправленную без входа" : "Нашли заявки, отправленные без входа"}</strong>
        <span>{by} в {items.length === 1 ? "ней" : "них"} совпадает с подтвержденным контактом кабинета. Привяжите, и заявка появится в истории со статусом</span>
      </div>
      <ul className="ac-claim__l">
        {items.map((c) => (
          <li key={c.reference}>
            <span><b className="D">{c.reference}</b> · {fmtDate(c.createdAt)} · {TYPE[c.type]}</span>
            <button type="button" className="btn btn--dark btn--sm" aria-busy={busy === c.reference} disabled={!!busy} onClick={() => void claim([c.reference])}>
              {busy === c.reference ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}Привязать
            </button>
          </li>
        ))}
      </ul>
      {items.length > 1 ? <button type="button" className="flink ac-claim__all" disabled={!!busy} onClick={() => void claim(items.map((c) => c.reference))}>Привязать все</button> : null}
      {msg ? <p className="ac-ok" role="status">{msg}</p> : null}
      {err ? <small className="ferr" role="alert">{err}</small> : null}
    </div>
  );
}

function PurchasesPanel({ d }: { d: D }) {
  return (
    <>
      <PanelHead title="Покупки" sub="Появляются, когда менеджер подтверждает сделку" />
      {d.purchasesFailed ? <p className="ferr" role="alert">Не удалось загрузить покупки, обновите страницу</p> : null}
      {d.purchases.length ? (
        <ul className="ac-buys" data-stagger="">
          {d.purchases.map((b) => (
            <li key={b.id} className="ac-buy ol" data-in="">
              <span className="ac-buy__d">{fmtDate(b.soldOn)}<small>{BUY[b.status] ?? b.status}</small></span>
              <span className="ac-buy__w">
                {b.items.length ? b.items.map((it, i) => <strong key={i}>{it.title} × {it.quantity}</strong>) : <strong>Покупка без списка позиций</strong>}
              </span>
              <span className="ac-buy__s">
                <b className="D">{rubles(b.amount)}</b>
                {b.refunded > 0 ? <small>возвращено {rubles(b.refunded)}</small> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : !d.purchasesFailed ? (
        <Empty title="Покупок пока нет" text="Когда менеджер подтвердит сделку по вашей заявке, здесь появятся состав, сумма и дата. На сайте ничего не оплачивается" />
      ) : null}
    </>
  );
}

function BonusPanel({ l, onChanged }: { l: Loyalty; onChanged: () => void }) {
  const earn = l.history.find((h) => h.type === "earn");
  const live = l.history.find((h) => h.type === "earn" && h.expiresAt && new Date(h.expiresAt) > new Date());
  const welcome = earn?.points ?? 1000;
  const pendingPts = l.pending.reduce((s, x) => s + x.points, 0);
  const showPending = l.balance <= 0 && pendingPts > 0;
  const big = showPending ? pendingPts : l.balance;
  return (
    <>
      <PanelHead title="Бонусы" sub="1 балл = 1 ₽" />
      <div className="ac-pts" data-stagger="">
        <div className="ac-ptc ol" data-in="">
          <span className="ac-cap">{showPending ? "Ожидают подтверждения" : "Доступно"}</span>
          <span className="ac-ptc__n D"><span data-count={big}>{num(big)}</span></span>
          <span className="ac-ptc__u">{plural(big, ["балл", "балла", "баллов"])}</span>
          <p>
            {l.balance > 0
              ? `${live ? `Действуют до ${fmtDate(live.expiresAt)}. ` : ""}Чтобы списать, скажите менеджеру при подтверждении покупки`
              : pendingPts > 0
                ? "Заявку отправили без подтвержденного контакта. Подтвердите телефон через Telegram, и баллы станут доступны"
                : "Отправьте первую заявку из каталога или на изготовление, и начислим приветственные баллы"}
          </p>
        </div>
        <div className="ac-rule ol" data-in="">
          <span className="ac-cap">Правила</span>
          <dl>
            <div><dt>Приветственный бонус</dt><dd>{pointsLabel(welcome)}, один раз</dd></div>
            <div><dt>За что</dt><dd>первая заявка из каталога или на изготовление</dd></div>
            <div><dt>Срок</dt><dd>180 дней с начисления</dd></div>
            <div><dt>Списание</dt><dd>до 20% покупки, у менеджера</dd></div>
          </dl>
        </div>
      </div>
      {pendingPts > 0 ? (
        <div className="ac-pend ol" role="region" aria-label="Баллы ждут подтверждения" data-in="">
          <div>
            <strong>Баллы ждут подтверждения контакта</strong>
            <ul>{l.pending.map((x) => <li key={x.reference}>{pointsLabel(x.points)} за заявку <b className="D">{x.reference}</b>, подтвердить до {fmtDate(x.confirmDeadline)}</li>)}</ul>
          </div>
          <TelegramLink label="Подтвердить телефон через Telegram" onLinked={onChanged} />
        </div>
      ) : null}
      <div className="ac-jour" data-in="">
        <h3 className="ac-jour__t">Операции</h3>
        {l.history.length ? (
          <table className="ac-tbl">
            <thead><tr><th scope="col">Дата</th><th scope="col">Операция</th><th scope="col">Основание</th><th scope="col" className="r">Баллы</th></tr></thead>
            <tbody>
              {l.history.map((h, i) => (
                <tr key={i}>
                  <td data-k="Дата">{fmtDate(h.createdAt)}</td>
                  <td data-k="Операция">{OP[h.type] ?? h.type}</td>
                  <td data-k="Основание">{h.reason ?? ""}{h.type === "earn" && h.expiresAt ? <small>сгорят {fmtDate(h.expiresAt)}</small> : null}</td>
                  <td data-k="Баллы" className="r D">{h.points > 0 ? `+${num(h.points)}` : `−${num(Math.abs(h.points))}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="ac-dim">Операций пока нет. Первая появится после заявки</p>
        )}
      </div>
    </>
  );
}

function OffersPanel({ o }: { o: MyOffers }) {
  return (
    <>
      <PanelHead title="Акции для вас" aside={<Link className="lnk lnk--sm" to="/offers"><span className="lnk__t">Все акции</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>} />
      {o.items.length ? (
        <ul className="ac-offs" data-stagger="">
          {o.items.map((x) => {
            const cv = coverOf(x);
            const st = offerState(x);
            return (
              <li key={x.slug} data-in="">
                <Link className="ac-off ol" to={`/offers/${x.slug}`} prefetch="intent">
                  <Illustration src={cv.src} alt="" caption={cv.caption} ratio="4 / 3" sizes="(max-width: 767px) 100vw, 220px" />
                  <span className="ac-off__b">
                    <span className="ac-cap">{x.minPurchases ? (x.eligible ? "Вам подходит" : `После ${x.minPurchases} ${plural(x.minPurchases, ["покупки", "покупок", "покупок"])}`) : "Для всех"}</span>
                    <span className="ac-off__t D">{x.title}</span>
                    {x.summary ? <span className="ac-off__d">{x.summary}</span> : null}
                    <span className="ac-off__e">{st === "soon" && x.startsAt ? `с ${fmtDate(x.startsAt)}` : x.endsAt ? `до ${fmtDate(x.endsAt)}` : "без срока"}{x.combinable === false ? " · не суммируется" : ""}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty title="Сейчас акций нет" text={`Когда начнется новая акция, она появится здесь и в разделе «Акции». Подтвержденных покупок в кабинете: ${o.purchases}`} />
      )}
    </>
  );
}
