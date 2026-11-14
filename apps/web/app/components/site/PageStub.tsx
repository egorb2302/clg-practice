import { Crumbs } from "./Crumbs";

export function PageStub({ title, sub }: { title: string; sub?: string }) {
  return (
    <section className="ph dark2">
      <div className="wrap">
        <Crumbs items={[{ label: "Главная", to: "/" }, { label: title }]} />
        <h1 className="ph__t" style={{ marginTop: 28 }} data-in="">{title}</h1>
        {sub ? <p className="ph__sub" data-in="">{sub}</p> : null}
      </div>
    </section>
  );
}
