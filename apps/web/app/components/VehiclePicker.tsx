import type { Vehicle } from "@armorix/contracts";
import { useId, useState } from "react";
import { Form, Link } from "react-router";
import { Sbtn } from "./ui";

/** make → model, then the catalog filtered by the vehicle. Without JS the model list
   shows every make in groups and the form still submits. */
export function VehiclePicker({ vehicles, className = "", title = "Подберите защиту под свой автомобиль", initial }: { vehicles: Vehicle[]; className?: string; title?: string; initial?: string }) {
  const makes = [...new Set(vehicles.map((v) => v.make))];
  const start = vehicles.find((v) => v.slug === initial);
  const [make, setMake] = useState(start?.make ?? makes[0] ?? "");
  const [slug, setSlug] = useState(start?.slug ?? vehicles.find((v) => v.make === (makes[0] ?? ""))?.slug ?? "");
  const id = useId();
  const models = vehicles.filter((v) => v.make === make);

  return (
    <Form className={`picker ${className}`} method="get" action="/catalog">
      <p className="picker__t">{title}</p>
      <div className="picker__row">
        <div className="field">
          <label htmlFor={`${id}-make`}>Марка</label>
          <select id={`${id}-make`} value={make} onChange={(e) => { setMake(e.target.value); setSlug(vehicles.find((v) => v.make === e.target.value)?.slug ?? ""); }}>
            {makes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-model`}>Модель</label>
          <select id={`${id}-model`} name="vehicle" value={slug} onChange={(e) => setSlug(e.target.value)}>
            {models.map((v) => <option key={v.slug} value={v.slug}>{v.model}</option>)}
          </select>
        </div>
        <Sbtn type="submit" className="sbtn--lg picker__go">Показать комплекты</Sbtn>
      </div>
      <p className="picker__alt">Нет вашей модели? <Link to="/contacts?type=custom">Изготовим под заказ</Link></p>
    </Form>
  );
}
