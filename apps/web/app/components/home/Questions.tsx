import { useId, useState } from "react";
import { Link } from "react-router";
import { Icon } from "../site";
import { telHref, useSite } from "../../lib/site";
import type { Vehicle } from "../../lib/vehicle";

export function Questions({ car }: { car: Vehicle }) {
  const { meta } = useSite();
  const tel = telHref(meta.contacts.phone);
  const id = useId().replace(/:/g, "");
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });
  const kit = car?.mode === "kit" ? ` ${car.label}` : "";
  const items: [string, string][] = car?.mode === "custom"
    ? [
        ["А если защита получится не такой, как я жду?", "До изготовления вы согласуете эскиз с размерами, без согласования мы не начинаем работу"],
        [`Сколько ждать защиту под ${car.label}?`, "Изготовление под новую модель занимает от четырех недель после согласования эскиза"],
        ["Нужно ли приезжать на замер?", "Чаще хватает фото и размеров, которые подскажем снять, иначе замерим у нас в мастерской"],
        ["Сколько стоит, если готовой цены нет?", "Назовем после фото, бесплатно, итог зависит от материала и состава защиты"],
      ]
    : [
        [`Подойдет ли к моей комплектации${kit}?`, "Готовые комплекты сделаны по замерам JAC T9 и Haval H3, годы выпуска указаны в карточке товара, при сомнениях менеджер проверит по фото"],
        ["Нужно ли сверлить кузов?", "Нет, кронштейны встают в заводские отверстия на раме, кузов и лакокрасочное покрытие остаются целыми"],
        [`Не закроет ли датчики и камеру${kit}?`, "Фаркоп, парктроники и штатная камера остаются рабочими, если стоит нештатный бампер или лебедка, пришлите фото"],
        ["Сколько ждать и как доставляете?", "Готовые комплекты обычно есть на складе, отправляем транспортной компанией в любой регион России в жесткой коробке"],
      ];

  return (
    <section className="home-faq dark2" aria-labelledby="home-faq-t">
      <div className="home-faq__l" data-stagger="">
        <h2 id="home-faq-t" data-in="">Вопросы перед<br />покупкой</h2>
        <span className="home-faq__rule" data-in="" aria-hidden="true" />
        <p data-in="">
          Собрали то, что спрашивают владельцы перед установкой, а если не нашли свой вопрос, позвоните
          {tel && meta.contacts.phone ? <> <a href={tel} className="home-faq__ph">{meta.contacts.phone}</a></> : " нам"}, ответим по вашей машине
        </p>
      </div>
      <div className="home-faq__r" data-stagger="">
        {items.map(([q, a], i) => {
          const on = !!open[i];
          return (
            <article key={q} className={`home-faq__q ol${on ? " is-open" : ""}`} data-in="">
              <h3>
                <button type="button" aria-expanded={on} aria-controls={`${id}-${i}`} onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}>
                  <span>{q}</span>
                  <span className="home-faq__pm cut" aria-hidden="true"><i /><i /></span>
                </button>
              </h3>
              <p className="home-faq__a" id={`${id}-${i}`} hidden={!on}>{a}</p>
            </article>
          );
        })}
        <Link to="/faq" className="lnk home-faq__all"><span className="lnk__t">Все вопросы</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
      </div>
    </section>
  );
}
