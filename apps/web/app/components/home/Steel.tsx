import type { ProductCard as Card } from "@armorix/contracts";
import { Link } from "react-router";
import { addCard, Icon, Illustration, Logo } from "../site";
import { priceFrom } from "../../lib/format";
import { useSelection } from "../../lib/selection";
import { ui } from "../../lib/ui";
import type { Vehicle } from "../../lib/vehicle";
import { Sketch } from "./Road";

const PAIRS = [
  { k: "Труба", t: "Ø 63 и 76 мм", p: "Гнутая труба по форме штатного бампера" },
  { k: "Кронштейны", t: "Штатные точки", p: "Без сверления, кузов остается целым" },
  { k: "Сварной шов", t: "Каждый проверяем", p: "Геометрию и сварку смотрим на каждой детали" },
];

export function Steel({ car, product, onQuiz }: { car: Vehicle; product: Card | undefined; onQuiz: () => void }) {
  const sel = useSelection();
  const custom = car?.mode === "custom";
  const added = product ? sel.some((i) => i.productSlug === product.slug) : false;
  const add = () => {
    if (!product) return;
    if (added) { ui.openDrawer(); return; }
    addCard(product);
    ui.toast(`${product.title}, ${product.vehicle.label}`);
  };

  return (
    <section id="steel" className="home-steel dark2" aria-label="Сталь">
      <div className="home-steel__one">
        <div className="home-steel__intro" data-stagger="">
          <h2 className="home-steel__word" data-in="">Сталь</h2>
          <p data-in="">Нержавеющая сталь AISI 304 или черная сталь с порошковой краской, каждую деталь режут, гнут и варят под конкретную модель</p>
          <ul className="home-steel__nums" data-in="">
            <li><b className="D"><span data-count="76">76</span><small> мм</small></b>диаметр трубы</li>
            <li><b className="D"><span data-count="2">2</span><small> мм</small></b>стенка трубы</li>
            <li><b className="D"><span data-count="0">0</span></b>отверстий в кузове</li>
          </ul>
        </div>

        <div className="home-plate" data-in="fade">
          <span className="home-plate__back ol" aria-hidden="true" />
          <div className="home-plate__pic">
            {custom ? (
              <div className="home-plate__draw"><Sketch small /></div>
            ) : (
              <Illustration src={product?.image?.url ?? "/img/x.webp"} alt={product?.image?.alt ?? ""} caption={`передняя защита ${product ? product.vehicle.label : "на машину"}, вырезанная, стоит вертикально и выходит за пластину сверху`} ratio="380 / 520" dark />
            )}
          </div>
          <div className="home-plate__buy">
            <p className="home-plate__row"><span className="D">Цена</span><b className={`D num${custom || product?.priceFrom == null ? " is-ask" : ""}`}>{custom ? "после фото, бесплатно" : priceFrom(product?.priceFrom)}</b></p>
            {custom ? (
              <span className="lift lift--block"><a href="#quiz" className="btn btn--white btn--block" onClick={(e) => { e.preventDefault(); onQuiz(); }}>Рассчитать под {car?.label}</a></span>
            ) : product ? (
              <span className="lift lift--block"><button type="button" className="btn btn--white btn--block" onClick={add} aria-label={added ? `В подборке: ${product.title}, открыть подборку` : undefined}>{added ? <><Icon name="check" />В подборке</> : "В подборку"}</button></span>
            ) : (
              <span className="lift lift--block"><Link to="/catalog" className="btn btn--white btn--block">Смотреть каталог</Link></span>
            )}
            <p className="home-plate__note">{custom ? "Та же сталь, что у готовых комплектов" : product ? (car?.mode === "kit" ? `${product.title} для ${car.label}` : `Пример: ${product.title.toLowerCase()}, ${product.vehicle.label}`) : "Готовые комплекты в каталоге"}</p>
          </div>
        </div>

        <ul className="home-pairs">
          {PAIRS.map((x) => (
            <li key={x.k} className="home-pair" tabIndex={0}>
              <span className="home-pair__b ol"><span>{x.k}</span></span>
              <span className="home-pair__f ol"><b className="D">{x.t}</b><span>{x.p}</span></span>
            </li>
          ))}
        </ul>

        <a href="#why" className="lnk home-steel__down"><span className="ar ol" aria-hidden="true"><Icon name="chev" /></span><span className="lnk__t">Почему сталь</span></a>
      </div>

      <div id="why" className="home-why">
        <Logo mark className="home-why__mark" />
        <div className="home-why__head" data-in="">
          <h2>Почему сталь</h2>
          <p>и почему ARMORIX</p>
        </div>
        <Logo className="home-why__logo" />
        <p className="home-why__note">{custom ? `Под ${car?.label} берем ту же сталь и тех же мастеров, что для готовых комплектов` : "Делаем под конкретную модель и проверяем каждый шов"}</p>
        <div className="home-why__side home-why__side--l cut" data-in="left">
          <b className="D">2. Уход без хлопот</b>
          <p>Мойка высоким давлением и реагенты не страшны, полировать и подкрашивать не нужно</p>
        </div>
        <div className="home-why__side home-why__side--r cut" data-in="">
          <b className="D">3. Если зацепили</b>
          <p>Выправим или заменим одну деталь, а не всю защиту целиком</p>
        </div>
        <div className="home-why__glass cut" data-in="">
          <b className="D">1. Не дуга<br />с маркетплейса</b>
          <p>Толстостенная труба вместо тонкой, крепление под конкретную модель, каждый шов проверяет мастер</p>
          <div className="home-why__foot">
            <p className="home-why__fact">Сталь AISI 304<br />труба Ø 76 мм<br />стенка 2 мм</p>
            <Link to="/about" className="lnk"><span className="lnk__t">О мастерской</span><span className="ar ol" aria-hidden="true"><Icon name="ext" /></span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
