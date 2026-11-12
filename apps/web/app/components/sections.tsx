import type { MetaResponse } from "@armorix/contracts";
import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { nb, telegramLink } from "../lib/format";
import { LeadForm, type LeadType } from "./LeadForm";
import { Icon, Img, Sbtn, Tt } from "./ui";

/* ── The lit sentence: words light up as you read, photos open inside the line,
      steel words take the mirror gradient ── */
export type SayPart = string | { steel: string } | { pic: string; alt: string };
export function Say({ parts, className = "" }: { parts: SayPart[]; className?: string }) {
  const out: ReactNode[] = [];
  parts.forEach((p, i) => {
    if (typeof p === "string") nb(p).split(" ").forEach((w, j) => out.push(<span key={`${i}-${j}`} className="w">{w} </span>));
    else if ("steel" in p) nb(p.steel).split(" ").forEach((w, j) => out.push(<span key={`${i}-${j}`} className="w w--steel">{w} </span>));
    else out.push(<span key={i} className="say__pic"><img src={p.pic} alt={p.alt} loading="lazy" decoding="async" /></span>, " ");
  });
  return <p className={`say ${className}`}>{out}</p>;
}

/* ── Sticky workflow: photo + a cold glass panel that carries the same photo, blurred ── */
export type Step = { name: string; img: string; thumb: string; title: string; text: string };
export function Flow({ chip, title, steps, id = "flow" }: { chip: [string, string]; title: [string, string]; steps: Step[]; id?: string }) {
  const n = steps.length;
  return (
    <section className="flow" id={id} aria-label={chip[1]}>
      <div className="flow__pin">
        <div className="frame">
          {steps.map((s, i) => (
            <div key={s.name} className={`flow__img${i === 0 ? " is-on" : ""}`} data-i={i}><Img src={s.img} alt="" /></div>
          ))}
          <div className="panel">
            <div className="panel__bg" aria-hidden="true">
              {steps.map((s, i) => <img key={s.name} src={s.img.replace(/\.webp$/, "-s.webp")} alt="" data-i={i} className={i === 0 ? "is-on" : ""} loading="lazy" />)}
            </div>
            <div className="panel__top">
              <Tt a={title[0]} b={title[1]} />
              <span className="marks" aria-hidden="true"><i /><i /><i /><i /></span>
              <span className="ruler" aria-hidden="true" />
              <svg className="cross" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" /><path d="M12 0v24M0 12h24" /></svg>
            </div>
            <ol className="flow__steps">
              {steps.map((s, i) => <li key={s.name} className={i === 0 ? "is-on" : ""}>{s.name}</li>)}
            </ol>
            <div className="flow__foot">
              <div className="flow__thumb">
                {steps.map((s, i) => <img key={s.name} src={s.thumb} alt="" data-i={i} className={i === 0 ? "is-on" : ""} loading="lazy" />)}
              </div>
              <div className="flow__desc">
                {steps.map((s, i) => (
                  <div key={s.name} data-i={i} className={i === 0 ? "is-on" : ""}>
                    <small className="num">{String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</small>
                    <b>{nb(s.title)}</b>
                    <p>{nb(s.text)}</p>
                  </div>
                ))}
              </div>
              <div className={`flow__bar n${n}`}>{steps.map((s) => <i key={s.name} />)}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Advantage: full photo, glass cards in a staircase (kept as she approved) ── */
export function Adv({ chip, title, img, items }: { chip: [string, string]; title: string; img: string; items: [string, string, string][] }) {
  return (
    <section className="adv frame" aria-label={chip[1]}>
      <div className="frame__bg"><Img src={img} alt="" /></div>
      <div className="adv__title" data-in=""><h2 className="tt">{nb(title)}</h2></div>
      <div className="adv__cards" data-stagger="">
        {items.map(([ic, t, d]) => (
          <div key={t} className="glass" data-in="">
            <span className="card__i"><Icon name={ic} /></span>
            <div><b>{nb(t)}</b><p>{nb(d)}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Numbers: the whole viewport, steel numerals over the workshop ── */
export type Stat = { count: string; shown: string; unit?: string; title: string; text: string; tag: string; code: string; img: string };
export function Stats({ chip, title, lead, img, items }: { chip: [string, string]; title: [string, string]; lead: string; img: string; items: Stat[] }) {
  return (
    <section className="nums frame" aria-label={chip[1]}>
      <div className="frame__bg"><Img src={img} alt="" /></div>
      <div className="nums__in">
        <div className="nums__head" data-in="">
          <Tt a={title[0]} b={title[1]} />
          <p className="t-lead">{nb(lead)}</p>
        </div>
        <div className="nums__grid" data-stagger="">
          {items.map((s) => (
            <div key={s.title} className="nums__i" data-in="">
              <p className="nums__tag" aria-hidden="true"><span>{s.tag}</span><i /></p>
              <b className="num"><span data-count={s.count}>{s.shown}</span>{s.unit ? <small>{s.unit}</small> : null}</b>
              <span className="nums__pic" aria-hidden="true"><img src={s.img} alt="" loading="lazy" /></span>
              <div><h3>{nb(s.title)}</h3><p>{nb(s.text)}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── FAQ: question list beside a sticky intro with a way to ask more ── */
export type QA = { q: string; a: ReactNode };
export function Faq({ chip, items, phone }: { chip: [string, string]; items: QA[]; phone?: string }) {
  return (
    <section className="sec wrap faqs" id="faq" aria-label={chip[1]}>
      <div className="faqs__side" data-in="">
        <Tt a="Частые вопросы" b="перед заказом" />
        <div className="faqs__ask">
          <b>Не нашли свой вопрос?</b>
          <p>{nb("Ответим про вашу машину, комплектацию и сроки, менеджер перезвонит в течение рабочего дня")}</p>
          <div className="faqs__go">
            <Sbtn to="/contacts">Задать вопрос</Sbtn>
            {phone ? <a className="tlink num" href={`tel:${phone.replace(/[^\d+]/g, "")}`}><Icon name="phone" />{phone}</a> : null}
          </div>
        </div>
      </div>
      <FaqList items={items} />
    </section>
  );
}

/* accordion: one open at a time, the panel slides open (grid rows 0fr → 1fr), the number fills with steel */
function FaqList({ items }: { items: QA[] }) {
  const [open, setOpen] = useState(0);
  const uid = useId();
  return (
    <div className="faqs__list" data-stagger="">
      {items.map((x, i) => {
        const on = open === i;
        return (
          <div key={x.q} className={`fq${on ? " is-open" : ""}`} data-in="">
            <h3 className="fq__h">
              <button type="button" aria-expanded={on} aria-controls={`${uid}-${i}`} onClick={() => setOpen(on ? -1 : i)}>
                <span className="fq__n num">{String(i + 1).padStart(2, "0")}</span>
                <span className="fq__q">{nb(x.q)}</span>
                <span className="fq__x" aria-hidden="true"><i /><i /></span>
              </button>
            </h3>
            <div className="fq__p" id={`${uid}-${i}`} role="region" inert={!on}>
              <div className="fq__in"><div className="faqs__a">{x.a}</div></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Contacts and request: photo with a liquid-steel glass plate that blurs, not hides it ── */
export function ContactPlate({ meta, chip, title, img, type = "general", id = "contact" }: { meta: MetaResponse; chip: [string, string]; title: [string, string]; img: string; type?: LeadType; id?: string }) {
  const c = meta.contacts;
  return (
    <section className="cta frame" id={id} aria-label={chip[1]}>
      <div className="frame__bg"><Img src={img} alt="" /></div>
      <svg className="cta__logo" viewBox="0 0 407.2 94.5" aria-hidden="true"><use href="#lock-h" /></svg>
      <div className="cta__side" data-in="">
        <ul className="cta__ch">
          {c.phone ? <li><Icon name="phone" /><span>Телефон</span><a className="num" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a></li> : null}
          {c.telegram ? <li><Icon name="tg" /><span>Телеграм</span><a href={telegramLink(c.telegram).href} rel="noopener">{telegramLink(c.telegram).label}</a></li> : null}
          {c.email ? <li><Icon name="mail" /><span>Почта</span><a href={`mailto:${c.email}`}>{c.email}</a></li> : null}
          {c.hours ? <li><Icon name="clock" /><span>Часы</span><em>{c.hours}</em></li> : null}
          {c.address ? <li><Icon name="pin" /><span>Мастерская</span><em>{c.address}</em></li> : null}
        </ul>
      </div>
      <div className="lg" data-in="">
        <div className="lg__in">
          <Tt a={title[0]} b={title[1]} />
          <LeadForm type={type} switchable submitLabel="Отправить" />
        </div>
      </div>
    </section>
  );
}

/* ── Rail: cards that scroll sideways; the arrows hide when everything fits ── */
export type RailItem = { img: string; title: string; text: string; to: string };
export function Rail({ items, label }: { items: RailItem[]; label: string }) {
  return (
    <div className="rail" aria-label={label}>
      <div className="rail__track" data-stagger="">
        {items.map((r) => (
          <Link key={r.title} className="rail__item" to={r.to} data-in="">
            <Img src={r.img} alt="" sizes="(max-width: 599px) 78vw, 26vw" />
            <div className="glass"><b>{nb(r.title)}</b><span>{nb(r.text)}</span></div>
          </Link>
        ))}
      </div>
      <div className="rail__bar wrap">
        <div className="rail__progress"><i /></div>
        <button className="rail__btn rail__btn--prev" type="button" aria-label="Назад"><Icon name="arrow" vb="0 0 20 20" /></button>
        <button className="rail__btn rail__btn--next" type="button" aria-label="Вперед"><Icon name="arrow" vb="0 0 20 20" /></button>
      </div>
    </div>
  );
}
