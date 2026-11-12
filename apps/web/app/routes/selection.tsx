import type { CatalogChange } from "@armorix/contracts";
import { useEffect, useState } from "react";
import { data, Link, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/selection";
import { LeadForm } from "../components/LeadForm";
import { Chip, Icon, Sbtn, thumbUrl } from "../components/ui";
import { PUBLIC_CACHE } from "../lib/api.server";
import { PRICE_NOTE, priceFrom } from "../lib/format";
import { selection, useSelection } from "../lib/selection";
import { rootOrigin, seo } from "../lib/seo";
import type { loader as rootLoader } from "../root";

export const loader = () => data({}, { headers: { "Cache-Control": PUBLIC_CACHE } });
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ title: "Подборка", description: "Выбранные комплекты защиты и заявка менеджеру", path: "/selection", origin: rootOrigin(matches), noindex: true });

export default function Selection() {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const items = useSelection();
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [changes, setChanges] = useState<CatalogChange[]>([]);
  useEffect(() => setReady(true), []);

  const change = (id: string) => changes.find((c) => c.variantId === id);
  const resolve = (id: string) => setChanges((cs) => cs.filter((c) => c.variantId !== id));
  const open = changes.filter((c) => items.some((i) => i.variantId === c.variantId));

  return (
    <section className="sec wrap selp">
      <div className="head" data-in="">
        <div>
          <p className="crumbs"><Link to="/" className="chip"><span>Главная</span></Link><span className="chip"><span>Подборка</span></span></p>
          <h1 className="tt"><span>Подборка</span><span className="mute">{done ? "Заявка отправлена" : "Одна заявка на все позиции"}</span></h1>
        </div>
        <Link className="tlink" to="/catalog">Продолжить выбор <Icon name="arrow" vb="0 0 20 20" /></Link>
      </div>

      {!ready ? <div className="selp__wait" aria-busy="true">Загружаем подборку</div> : null}

      {ready && !items.length && !done ? (
        <div className="empty">
          <Chip>Пока пусто</Chip>
          <h2 className="tt"><span>В подборке ничего нет</span><span className="mute">Добавьте комплекты из каталога</span></h2>
          <div className="empty__go"><Sbtn to="/catalog" className="sbtn--lg">Открыть каталог</Sbtn><Link className="tlink" to="/contacts?type=custom">Нет вашей модели</Link></div>
        </div>
      ) : null}

      {ready && (items.length || done) ? (
        <div className="selp__grid">
          <div className="selp__list">
            {open.length ? (
              <p className="note note--warn" role="alert"><Icon name="clock" />Пока вы выбирали, в подборке изменились позиции ({open.length}): проверьте и подтвердите</p>
            ) : null}
            <ul className="sl">
              {items.map((i) => {
                const ch = change(i.variantId);
                return (
                  <li key={i.variantId} className={`sl__i${ch ? " is-changed" : ""}`}>
                    <Link className="sl__img" to={`/catalog/${i.productSlug}?vehicle=${encodeURIComponent(i.vehicleSlug)}`} tabIndex={-1} aria-hidden="true">
                      {i.snapshot.imageUrl ? <img src={thumbUrl(i.snapshot.imageUrl)} alt="" loading="lazy" onError={(e) => { e.currentTarget.hidden = true; }} /> : null}
                    </Link>
                    <div className="sl__t">
                      <Link to={`/catalog/${i.productSlug}?vehicle=${encodeURIComponent(i.vehicleSlug)}`}><b>{i.snapshot.title}</b></Link>
                      <span>{i.snapshot.vehicleLabel ?? i.vehicleSlug}{i.snapshot.variantTitle ? `, ${i.snapshot.variantTitle}` : ""}</span>
                      <span className="sl__p num">{priceFrom(i.snapshot.priceFrom)}</span>
                      {ch ? (
                        <div className="sl__ch">
                          {ch.available ? (
                            <>
                              <span>Новая цена: <b className="num">{priceFrom(ch.priceFrom)}</b></span>
                              <button type="button" className="btn-mini" onClick={() => { selection.setPrice(i.variantId, ch.priceFrom); resolve(i.variantId); }}>Принять</button>
                            </>
                          ) : <span>Эта позиция больше недоступна</span>}
                          <button type="button" className="btn-mini btn-mini--line" onClick={() => { selection.remove(i.variantId); resolve(i.variantId); }}>Убрать</button>
                        </div>
                      ) : null}
                    </div>
                    <div className="qty" role="group" aria-label={`Количество: ${i.snapshot.title}`}>
                      <button type="button" aria-label="Меньше" disabled={i.quantity <= 1} onClick={() => selection.setQuantity(i.variantId, i.quantity - 1)}><Icon name="minus" /></button>
                      <output className="num" aria-live="polite">{i.quantity}</output>
                      <button type="button" aria-label="Больше" disabled={i.quantity >= 20} onClick={() => selection.setQuantity(i.variantId, i.quantity + 1)}><Icon name="plus" /></button>
                    </div>
                    <button type="button" className="sl__x" aria-label={`Убрать: ${i.snapshot.title}`} onClick={() => selection.remove(i.variantId)}><Icon name="close" /></button>
                  </li>
                );
              })}
            </ul>
            {items.length ? <p className="t-small selp__note">{PRICE_NOTE}</p> : null}
            {done && !items.length ? (
              <div className="selp__done">
                <Chip>Подборка отправлена</Chip>
                <p>{`Все позиции ушли менеджеру в заявке ${done}, подборка очищена`}</p>
                <div className="empty__go"><Sbtn to="/catalog">Вернуться в каталог</Sbtn><Link className="tlink" to="/">На главную</Link></div>
              </div>
            ) : null}
          </div>
          <aside className="selp__form" aria-label="Заявка">
            <h2 className="selp__h">Заявка менеджеру</h2>
            <p className="t-small">Онлайн-оплаты нет: менеджер подтвердит цену и способ получения</p>
            <LeadForm
              type="catalog"
              items={items}
              deliveryMethods={root?.meta.deliveryMethods ?? []}
              onSuccess={(ref, sent) => { setDone(ref); selection.removeSubmitted(sent); }}
              onCatalogChanged={setChanges}
            />
          </aside>
        </div>
      ) : null}
    </section>
  );
}
