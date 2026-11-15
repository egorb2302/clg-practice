import { Link } from "react-router";
import { Icon, Illustration } from "../site";
import { plural } from "../../lib/format";
import { photo } from "../../lib/photos";

export function Workshop({ models, items }: { models: number; items: number }) {
  return (
    <section id="workshop" className="home-shop dark" aria-labelledby="home-shop-t">
      <div className="home-shop__l">
        <div className="home-shop__fit">
          <ul className="home-shop__nums" data-stagger="">
            <li data-in=""><b className="D"><span data-count={String(models)}>{models}</span></b>{plural(models, ["модель", "модели", "моделей"])} с готовым комплектом</li>
            <li data-in=""><b className="D"><span data-count={String(items)}>{items}</span></b>{plural(items, ["позиция", "позиции", "позиций"])} в каталоге</li>
            <li data-in=""><b className="D"><span data-count="2.5">2,5</span><small> ч</small></b>установка у нас</li>
          </ul>
          <div className="home-shop__pics" data-in="">
            <Illustration src={photo("shop-weld")} alt="Мастер сваривает трубу защиты" ratio="auto" sizes="(max-width: 767px) 100vw, 40vw" dark className="home-shop__wide" />
            <Illustration src={photo("weld-seam")} alt="Сварной шов на нержавеющей трубе крупно" ratio="1 / 1" sizes="170px" dark className="home-shop__sq" />
          </div>
        </div>
      </div>
      <div className="home-shop__r" data-stagger="">
        <h2 id="home-shop-t" data-in="">О мастерской</h2>
        <p data-in="">ARMORIX делает стальную защиту для китайских внедорожников и пикапов в своей мастерской: гибка, сварка и полировка в одном цеху, поэтому мы отвечаем за каждый шов</p>
        <Link to="/about" className="lnk" data-in=""><span className="lnk__t">Как мы работаем</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
      </div>
    </section>
  );
}
