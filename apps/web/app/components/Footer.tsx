import type { MetaResponse } from "@armorix/contracts";
import { Link } from "react-router";

export function Footer({ meta }: { meta: MetaResponse }) {
  const c = meta.contacts;
  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="ftr__cols">
          <div>
            {c.email ? <><small>Почта</small><a className="big" href={`mailto:${c.email}`}>{c.email}</a></> : null}
            {c.address ? <><small className="sub">Мастерская</small><p className="big">{c.address}</p></> : null}
          </div>
          <div>
            {c.phone ? <><small>Телефон</small><a className="big num" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a></> : null}
            {c.telegram ? <><small className="sub">Телеграм</small><a className="big" href={`https://t.me/${c.telegram}`} rel="noopener">@{c.telegram}</a></> : null}
            {c.hours ? <><small className="sub">Часы работы</small><p className="big">{c.hours}</p></> : null}
          </div>
          <div>
            <b>Каталог</b>
            <Link to="/catalog?vehicle=jac-t9">JAC T9</Link>
            <Link to="/catalog?vehicle=haval-h3">Haval H3</Link>
            <Link to="/contacts?type=custom">Под вашу модель</Link>
          </div>
          <div>
            <b>Компания</b>
            <Link to="/about">О компании</Link>
            <Link to="/about#flow">Производство</Link>
            <Link to="/about#delivery">Установка и доставка</Link>
          </div>
          <div>
            <b>Помощь</b>
            <Link to="/#faq">Вопросы</Link>
            <Link to="/selection">Подборка</Link>
            <Link to="/contacts">Контакты</Link>
            <Link to="/privacy">Обработка данных</Link>
          </div>
        </div>
        {meta.features.campaigns ? <div className="ftr__sub" data-slot="subscription" /> : null}
        <div className="ftr__base">
          <div className="ftr__word" aria-hidden="true">Armorix<sup>®</sup></div>
          <p><span>© {new Date().getFullYear()} ARMORIX</span><Link to="/privacy">Политика обработки данных</Link></p>
        </div>
      </div>
    </footer>
  );
}
