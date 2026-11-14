import { Link } from "react-router";
import { Icon } from "../site";
import type { Offer as OfferT } from "./data";

const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

export function Offer({ offer }: { offer: OfferT }) {
  const ends = offer.endsAt ? new Date(offer.endsAt) : null;
  return (
    <section className="home-offer" aria-labelledby="home-offer-t">
      <span className="tag tag--plate">Акция{ends && !Number.isNaN(ends.getTime()) ? ` до ${day.format(ends)}` : ""}</span>
      <div className="home-offer__b">
        <h2 id="home-offer-t">{offer.title}</h2>
        {offer.summary ? <p>{offer.summary}</p> : null}
      </div>
      <Link to={`/offers/${encodeURIComponent(offer.slug)}`} className="lnk"><span className="lnk__t">Условия акции</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
    </section>
  );
}
