import type { CatalogChange, LeadCreatedResponse, ProductCard as Card } from "@armorix/contracts";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Icon, Illustration, LeadForm, type LeadItem } from "../site";
import { plural, POSITION_LABEL, priceFrom, rubles } from "../../lib/format";
import { selection, useDelivery, useSelection } from "../../lib/selection";
import { telHref, useSite } from "../../lib/site";
import type { Vehicle } from "../../lib/vehicle";
import { photo } from "../../lib/photos";
import { coatShort, type Kit, priced, splitCar } from "./data";

type CarAns =
  | { kind: "kit"; slug: string; label: string }
  | { kind: "custom"; make: string; model: string; label: string }
  | { kind: "other" };
type Opt = { key: string; label: string; sub: string };
type Ans = { car?: CarAns; what?: string; coat?: string };

const STEP_NAMES = ["car", "what", "coat", "contact"] as const;
const COATS: Opt[] = [
  { key: "aisi304", label: "Нержавейка, полировка", sub: "блестит как хром" },
  { key: "powder", label: "Черная порошковая", sub: "под цвет решетки" },
  { key: "unknown", label: "Не знаю", sub: "посоветуем под машину" },
  { key: "both", label: "Покажите обе", sub: "пришлем фото работ" },
];
const CUSTOM_WHAT: Opt[] = [
  { key: "front", label: "Передняя защита", sub: "сделаем по месту" },
  { key: "rear", label: "Задняя защита", sub: "сделаем по месту" },
  { key: "both", label: "Перед и зад", sub: "одним заказом" },
  { key: "unknown", label: "Пока не знаю", sub: "подскажем по телефону" },
];

const carOfVehicle = (v: Vehicle): CarAns | undefined =>
  !v ? undefined : v.mode === "kit" ? { kind: "kit", slug: v.slug, label: v.label } : { kind: "custom", make: v.brand, model: v.model, label: v.label };
const carKey = (c?: CarAns) => (!c ? "" : c.kind === "other" ? "other" : c.kind === "kit" ? c.slug : c.label);

function cheapestOption(p: Card) {
  const live = p.options.filter((o) => o.available);
  return [...(live.length ? live : p.options)].sort((a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity))[0];
}

export function Quiz({ kits, car, req }: { kits: Kit[]; car: Vehicle; req: number }) {
  const { meta } = useSite();
  const sel = useSelection();
  const dlv = useDelivery();
  const [free, setFree] = useState(false);
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState<Ans>({});
  const [other, setOther] = useState("");
  const [seen, setSeen] = useState<Record<string, number | null>>({});
  const [done, setDone] = useState<{ ref: string; count: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const selMode = sel.length > 0 && !free && !done;
  const sent = !!done;
  const selNow = useRef(sel);
  selNow.current = sel;

  useEffect(() => {
    if (!req) return;
    setFree(false);
    setDone(null);
    if (selNow.current.length) return;
    const c = carOfVehicle(car);
    if (c) { setAns({ car: c }); setStep(1); } else setStep(0);
  }, [req]); // eslint-disable-line react-hooks/exhaustive-deps

  const followKey = carKey(carOfVehicle(car));
  const doneNow = useRef(done);
  doneNow.current = done;
  const ansNow = useRef(ans);
  ansNow.current = ans;
  const followed = useRef("");
  useEffect(() => {
    const prev = followed.current;
    followed.current = followKey;
    if (doneNow.current) return;
    const own = ansNow.current.car;
    if (!followKey && own && carKey(own) !== prev) return;
    const c = carOfVehicle(car);
    setOther("");
    setAns(c ? { car: c } : {});
    setStep(c ? 1 : 0);
  }, [followKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    stage.current?.querySelector<HTMLElement>("h3")?.focus();
  }, [step, selMode]);
  const goStep = (s: number) => { moved.current = true; setStep(s); };

  const kit = ans.car?.kind === "kit" ? kits.find((k) => k.vehicle.slug === (ans.car as { slug: string }).slug) : undefined;
  const carLabel = ans.car ? (ans.car.kind === "other" ? other.trim() : ans.car.label) : "";

  const carOpts: (Opt & { val: CarAns })[] = [
    ...kits.map((k) => ({ key: k.vehicle.slug, label: k.vehicle.label, sub: "есть готовый комплект", val: { kind: "kit", slug: k.vehicle.slug, label: k.vehicle.label } as CarAns })),
    { key: "Tank 300", label: "Tank 300", sub: "сделаем по месту", val: { kind: "custom", make: "Tank", model: "300", label: "Tank 300" } },
    { key: "other", label: "Другая", sub: "напишите марку и модель", val: { kind: "other" } },
  ];
  const mine = carOfVehicle(car);
  if (mine) {
    const k = carKey(mine);
    const hit = carOpts.find((o) => o.key === k);
    const rest = carOpts.filter((o) => o.key !== k && (hit || o.key !== "Tank 300"));
    carOpts.splice(0, carOpts.length, { key: k, label: car!.label, sub: hit ? `вы выбрали выше, ${hit.sub}` : "вы выбрали выше, сделаем по месту", val: mine }, ...rest);
  }

  const positions = kit ? [...new Set(priced(kit.products).map((p) => p.position))] : [];
  const whatOpts: Opt[] = kit
    ? [
        ...positions.map((pos) => {
          const ps = priced(kit.products.filter((p) => p.position === pos));
          return { key: pos, label: POSITION_LABEL[pos], sub: priceFrom(ps[0]?.priceFrom) };
        }),
        { key: "unknown", label: "Пока не знаю", sub: "подскажем по телефону" },
      ]
    : CUSTOM_WHAT;
  const posProducts = kit && ans.what && ans.what !== "unknown" ? priced(kit.products.filter((p) => p.position === ans.what)) : [];
  const coatOpts: Opt[] = posProducts.length
    ? [
        ...[...new Set(posProducts.map((p) => p.coating?.code ?? "none"))].map((code) => ({
          key: code,
          label: coatShort(code === "none" ? undefined : code),
          sub: priceFrom(posProducts.find((p) => (p.coating?.code ?? "none") === code)?.priceFrom),
        })),
        { key: "unknown", label: "Не знаю", sub: "посоветуем под машину" },
      ]
    : COATS;

  const product = posProducts.length
    ? (ans.coat && ans.coat !== "unknown" ? posProducts.find((p) => (p.coating?.code ?? "none") === ans.coat) : undefined) ?? posProducts[0]
    : undefined;
  const option = product ? cheapestOption(product) : undefined;
  const whatLabel = whatOpts.find((o) => o.key === ans.what)?.label ?? "";
  const coatLabel = coatOpts.find((o) => o.key === ans.coat)?.label ?? "";
  const vehicleFields = kit
    ? { make: kit.vehicle.make, model: kit.vehicle.model }
    : ans.car?.kind === "custom"
      ? { make: ans.car.make, model: ans.car.model }
      : splitCar(other);
  const request = [ans.what === "unknown" ? "Подобрать защиту" : whatLabel, coatLabel && ans.coat !== "unknown" ? coatLabel.toLowerCase() : ""].filter(Boolean).join(", ");

  const selItems: LeadItem[] = sel.map((i) => ({ variantId: i.variantId, quantity: i.quantity, seenPriceFrom: i.snapshot.priceFrom }));
  const oneItem: LeadItem[] = option ? [{ variantId: option.id, quantity: 1, seenPriceFrom: option.id in seen ? seen[option.id]! : option.priceFrom }] : [];
  const delivery = meta.deliveryMethods.length === 1 ? meta.deliveryMethods[0]!.code : meta.deliveryMethods.find((m) => m.code === dlv)?.code;

  const canNext = step === 0 ? !!ans.car && (ans.car.kind !== "other" || other.trim().length > 1) : step === 1 ? !!ans.what : step === 2 ? !!ans.coat : false;
  const cur = STEP_NAMES[Math.min(step, 3)]!;
  const onChanged = (changes: CatalogChange[]) => {
    for (const c of changes) {
      if (!c.available) selection.remove(c.variantId);
      else selection.setPrice(c.variantId, c.priceFrom);
    }
    setSeen((o) => ({ ...o, ...Object.fromEntries(changes.map((c) => [c.variantId, c.priceFrom])) }));
  };
  const onSuccess = (r: LeadCreatedResponse, items: LeadItem[]) => {
    if (selMode) selection.removeSubmitted(items);
    moved.current = true;
    setDone({ ref: r.reference, count: selMode ? items.length : 0 });
  };
  const restart = () => {
    const c = carOfVehicle(car);
    setDone(null);
    setFree(false);
    setAns(c ? { car: c } : {});
    setOther("");
    moved.current = true;
    setStep(c ? 1 : 0);
  };

  const head = selMode ? ["Почти готово,", "контакты и проверка"] : ["Подберем защиту", "за 4 вопроса"];
  const lead = selMode
    ? "Подборка и покрытие уже в заявке, скажите, куда ответить, и проверьте справа перед отправкой"
    : "Ответьте, и менеджер перезвонит с ценой под вашу машину, это бесплатно";
  const bars = selMode ? 1 : 4;
  const label = selMode ? "Контакты и проверка" : `Шаг ${Math.min(step, 3) + 1} из 4`;

  const total = sel.reduce((t, i) => t + (i.snapshot.priceFrom ?? 0) * i.quantity, 0);
  const noPrice = sel.some((i) => i.snapshot.priceFrom == null);
  const rows: [string, string][] = selMode
    ? [
        ...sel.map((i): [string, string] => [i.snapshot.vehicleLabel ?? "Позиция", `${i.snapshot.title}${i.snapshot.variantTitle ? `, ${i.snapshot.variantTitle.toLowerCase()}` : ""}${i.quantity > 1 ? `, ${i.quantity} шт` : ""}, ${priceFrom(i.snapshot.priceFrom)}`]),
        ["Ориентир", total ? `от ${rubles(total)}${noPrice ? " и позиции по запросу" : ""}` : "уточнит менеджер"],
        ...(meta.deliveryMethods.length ? [["Получение", meta.deliveryMethods.find((m) => m.code === delivery)?.label ?? "обсудим по телефону"] as [string, string]] : []),
      ]
    : [
        ["Машина", carLabel || "не выбрана"],
        ["Защита", whatLabel || "не выбрана"],
        ["Покрытие", coatLabel || "не выбрано"],
        ...(product ? [["Позиция", `${product.title}, ${priceFrom(option?.priceFrom ?? product.priceFrom)}`] as [string, string]] : []),
      ];
  const tel = telHref(meta.contacts.phone);

  return (
    <section id="quiz" className="home-quiz dark" aria-labelledby="home-quiz-t">
      <div className="home-quiz__l">
        <h2 id="home-quiz-t">{head[0]}<br />{head[1]}</h2>
        <p className="home-quiz__lead">{lead}</p>
        <div className="home-quiz__bars" aria-hidden="true">
          {Array.from({ length: bars }, (_, i) => <i key={i} className={selMode || i <= step ? "is-on" : ""} />)}
        </div>
        <p className="home-quiz__step D" aria-live="polite">{sent ? "Готово" : label}</p>
        {selMode ? (
          <button type="button" className="flink home-quiz__nosel" onClick={() => { setFree(true); moved.current = true; setStep(0); }}>Оформить без подборки</button>
        ) : null}
      </div>

      <div className="home-quiz__c" ref={stage}>
        {done ? (
          <div className="home-quiz__pane home-quiz__done" key="done" role="status">
            <span className="home-quiz__ok cut" aria-hidden="true"><Icon name="check" size={30} /></span>
            <h3 tabIndex={-1}>Заявка {done.ref} принята</h3>
            <p>Менеджер свяжется с вами в рабочее время{meta.contacts.hours ? ` (${meta.contacts.hours})` : ""}{done.count ? `, подборка (${done.count}) ушла вместе с заявкой` : ", цену назовем под вашу машину"}</p>
            <ol className="home-quiz__next">
              <li><span className="D num">01</span>Звонок менеджера: уточним комплектацию и цену</li>
              <li><span className="D num">02</span>{ans.car?.kind === "kit" || done.count ? "Подтверждение заказа, на сайте ничего не платите" : "Фото машины, эскиз и согласование"}</li>
              <li><span className="D num">03</span>Установка у нас или доставка по России</li>
            </ol>
            <p className="home-quiz__ref">Назовите номер {done.ref} менеджеру, если позвоните сами</p>
            <button type="button" className="lnk" onClick={restart}><span className="ar ol" aria-hidden="true"><Icon name="back" /></span><span className="lnk__t">Отправить еще одну заявку</span></button>
          </div>
        ) : selMode || cur === "contact" ? (
          <div className="home-quiz__pane" key={selMode ? "sel" : "contact"}>
            <h3 tabIndex={-1}>Как с вами связаться?</h3>
            {selMode ? (
              <LeadForm
                key="sel"
                type="catalog"
                items={selItems}
                submitLabel={`Отправить подборку (${sel.length})`}
                onSuccess={onSuccess}
                onCatalogChanged={onChanged}
              />
            ) : product && option ? (
              <LeadForm
                key={`one-${option.id}`}
                type="catalog"
                items={oneItem}
                submitLabel="Отправить заявку"
                onSuccess={onSuccess}
                onCatalogChanged={onChanged}
              />
            ) : (
              <LeadForm
                key={`c-${vehicleFields.make}-${vehicleFields.model}-${request}`}
                type="custom"
                vehicle={vehicleFields}
                request={request}
                submitLabel="Отправить заявку"
                onSuccess={onSuccess}
              />
            )}
            {!selMode && !sent ? (
              <div className="home-quiz__nav">
                <button type="button" className="btn btn--line ol home-quiz__back" onClick={() => goStep(2)}><Icon name="back" />Назад</button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="home-quiz__pane" key={cur}>
            <h3 tabIndex={-1}>{cur === "car" ? "Какая у вас машина?" : cur === "what" ? "Что защищаем?" : "Какое покрытие?"}</h3>
            <div className="home-quiz__opts" role="radiogroup" aria-label={cur === "car" ? "Машина" : cur === "what" ? "Что защищаем" : "Покрытие"}>
              {(cur === "car" ? carOpts : cur === "what" ? whatOpts : coatOpts).map((o) => {
                const on = cur === "car" ? carKey(ans.car) === o.key : ans[cur] === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`home-qopt ol${on ? " is-on" : ""}`}
                    onClick={() => {
                      if (cur === "car") setAns({ car: (o as Opt & { val: CarAns }).val });
                      else if (cur === "what") setAns((a) => ({ car: a.car, what: o.key }));
                      else setAns((a) => ({ ...a, coat: o.key }));
                    }}
                  >
                    <span className="home-qopt__box" aria-hidden="true" />
                    <span><b>{o.label}</b><small>{o.sub}</small></span>
                  </button>
                );
              })}
            </div>
            {cur === "car" && ans.car?.kind === "other" ? (
              <div className="fld home-quiz__other">
                <label className="fld__l" htmlFor="home-q-other">Марка и модель</label>
                <input id="home-q-other" className="in" value={other} onChange={(e) => setOther(e.target.value)} placeholder="Например, Lixiang L7" autoComplete="off" />
              </div>
            ) : null}
            <div className="home-quiz__nav">
              <button type="button" className="btn btn--line ol home-quiz__back" disabled={step === 0} onClick={() => goStep(step - 1)}><Icon name="back" />Назад</button>
              <span className="lift">
                <button type="button" className="btn btn--light" aria-disabled={!canNext || undefined} onClick={() => { if (canNext) goStep(step + 1); }}>
                  {step === 2 ? "К контактам" : "Далее"}<Icon name="arrow" className="ico--go" />
                </button>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="home-quiz__r">
        <Illustration src={photo("quiz-master")} alt="Мастер снимает размеры бампера на машине клиента" ratio="auto" sizes="(max-width: 1023px) 100vw, 50vw" dark className="home-quiz__img" />
        <div className="home-quiz__plates">
          <div className="home-quiz__sum">
            <p className="home-quiz__sumt D">Ваша заявка{selMode ? <span> · {sel.length} {plural(sel.length, ["позиция", "позиции", "позиций"])}</span> : null}</p>
            <dl>
              {rows.map(([k, v]) => (
                <div key={`${k}-${v}`} className={/^не выбран/.test(v) ? "is-empty" : ""}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          </div>
          {tel && meta.contacts.phone ? (
            <a className="home-quiz__call ol" href={tel}>
              <small>Или позвоните сами{meta.contacts.hours ? `, ${meta.contacts.hours}` : ""}</small>
              <b className="D">{meta.contacts.phone}</b>
            </a>
          ) : null}
          {meta.contacts.address ? (
            <Link className="home-quiz__map ol" to="/contacts">
              <span><b className="D">Как добраться<br />до мастерской</b><small>{meta.contacts.address}, карта и маршрут</small></span>
              <span className="home-quiz__arr cut" aria-hidden="true"><Icon name="arrow" /></span>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
