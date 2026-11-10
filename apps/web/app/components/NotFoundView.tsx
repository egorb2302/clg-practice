import { Link } from "react-router";
import { Img, Sbtn } from "./ui";

export function NotFoundView() {
  return (
    <section className="nf frame">
      <div className="frame__bg"><Img src="/img/road-fog.webp" alt="" w={1600} h={1200} eager /></div>
      <div className="nf__in">
        <span className="nf__code num" aria-hidden="true">404</span>
        <h1 className="tt"><span>Здесь дорога кончается</span><span className="mute">Такой страницы нет</span></h1>
        <p className="t-lead">Возможно, адрес изменился или комплект сняли с витрины</p>
        <div className="nf__go">
          <Sbtn to="/catalog" className="sbtn--lg">Открыть каталог</Sbtn>
          <Link className="tlink" to="/">На главную</Link>
        </div>
      </div>
    </section>
  );
}
