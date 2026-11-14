import type { ProductCard as Card } from "@armorix/contracts";
import { Link } from "react-router";
import { Icon, ProductCard } from "../site";
import { telHref, useSite } from "../../lib/site";
import css from "../../styles/pages/notfound.css?url";

const TEXT = {
  product: { t: "Такой защиты нет в каталоге", p: "Возможно, ее сняли с продажи или в ссылке ошибка. Подберите по машине или позвоните, подскажем по телефону" },
  page: { t: "Такой страницы нет", p: "Возможно, адрес изменился или в ссылке ошибка. Защиту можно подобрать в каталоге или по телефону" },
};

export function NotFound({ kind = "page", popular = [], discounts = {} }: { kind?: "product" | "page"; popular?: Card[]; discounts?: Record<string, number> }) {
  const { meta } = useSite();
  const phone = meta.contacts.phone;
  const tel = telHref(phone);
  const tx = TEXT[kind];
  return (
    <section className="light nf" aria-labelledby="nf-t">
      <link rel="stylesheet" href={css} precedence="default" />
      <div className="wrap">
        <div className="nf-box">
          <span className="nf-code" aria-hidden="true">404</span>
          <h1 id="nf-t" className="nf-t">{tx.t}</h1>
          <p className="nf-p">{tx.p}</p>
          <div className="nf-acts">
            <span className="lift lift--ink"><Link className="btn btn--dark btn--lg" to="/catalog">В каталог<Icon name="arrow" className="ico--go" /></Link></span>
            {tel ? <a className="lnk" href={tel}><span className="lnk__t">Позвонить {phone}</span><span className="ar ol" aria-hidden="true"><Icon name="phone" /></span></a> : null}
          </div>
        </div>
        {popular.length ? (
          <div className="nf-pop">
            <h2 className="nf-pop__t">Популярные комплекты</h2>
            <div className="nf-grid" data-stagger="">
              {popular.map((p) => (
                <ProductCard key={`${p.slug}|${p.vehicle.slug}`} p={p} kitDiscountPct={discounts[`${p.slug}|${p.vehicle.slug}`]} sizes="(max-width: 599px) 100vw, (max-width: 1023px) 50vw, 33vw" />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
