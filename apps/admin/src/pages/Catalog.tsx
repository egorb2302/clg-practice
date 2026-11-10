import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api, ApiFailure, dateTime, rub, toKopecks, uploadFile } from "../api";
import { Badge, Done, Empty, ErrorBox, Field, Loading, PageHead, useAction, useLoad } from "../ui";
import { errorMessage, fieldsOf, Problems, useConflictReload } from "./kit";

export const productStatusLabels: Record<string, string> = {
  draft: "Черновик",
  published: "Опубликован",
  hidden: "Скрыт",
  archived: "Архив",
};
export const positionLabels: Record<string, string> = {
  front: "Передняя защита",
  rear: "Задняя защита",
  kit: "Комплект",
};
const variantStatusLabels: Record<string, string> = { active: "Активен", hidden: "Скрыт", archived: "Архив" };
const statusKind = (s: string) => (s === "published" ? "ok" : s === "draft" ? "new" : "bad");

type Material = { code: string; label: string };
type Vehicle = { id: string; slug: string; make: string; model: string; sort: number; published: boolean; version: number };
type ProductRow = {
  id: string;
  slug: string;
  code: string;
  title: string;
  position: string;
  status: string;
  version: number;
  updatedAt: string;
  activeVariants: number;
  minPrice: number | null;
  photos: number;
};

function ProductCreate() {
  const navigate = useNavigate();
  const act = useAction();
  const materials = useLoad((signal) => api<{ items: Material[] }>("/admin/materials", { signal }), []);
  const [f, setF] = useState({ slug: "", code: "", title: "", position: "front", description: "", composition: "", material: "", installation: "" });
  const fe = fieldsOf(act.error);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await act.run(() =>
      api<{ id: string }>("/admin/catalog", {
        body: {
          slug: f.slug.trim(),
          code: f.code.trim(),
          title: f.title.trim(),
          position: f.position,
          description: f.description,
          composition: f.composition.split("\n").map((x) => x.trim()).filter(Boolean),
          material: f.material || null,
          installation: f.installation.trim() || null,
        },
      }),
    );
    if (r) navigate(`/catalog/${r.id}`);
  };
  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>Новый товар</h2>
      <div className="grid-2">
        <Field label="Адрес (slug)" error={fe.slug} hint="Латиница, цифры и дефис">
          {(p) => <input {...p} value={f.slug} onChange={set("slug")} maxLength={80} required />}
        </Field>
        <Field label="Код" error={fe.code}>
          {(p) => <input {...p} value={f.code} onChange={set("code")} maxLength={40} required />}
        </Field>
        <Field label="Название" error={fe.title}>
          {(p) => <input {...p} value={f.title} onChange={set("title")} maxLength={200} required />}
        </Field>
        <Field label="Расположение" error={fe.position}>
          {(p) => (
            <select {...p} value={f.position} onChange={set("position")}>
              {Object.entries(positionLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Материал" error={fe.material}>
          {(p) => (
            <select {...p} value={f.material} onChange={set("material")}>
              <option value="">Не указан</option>
              {materials.data?.items.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field label="Описание" error={fe.description}>
        {(p) => <textarea {...p} value={f.description} onChange={set("description")} maxLength={5000} />}
      </Field>
      <Field label="Состав" hint="Один пункт на строку" error={fe.composition}>
        {(p) => <textarea {...p} value={f.composition} onChange={set("composition")} />}
      </Field>
      <Field label="Установка" error={fe.installation}>
        {(p) => <textarea {...p} value={f.installation} onChange={set("installation")} maxLength={2000} />}
      </Field>
      <ErrorBox error={act.error} />
      <button className="btn primary" type="submit" disabled={act.busy}>
        {act.busy ? "Создаём…" : "Создать товар"}
      </button>
    </form>
  );
}

export function Catalog() {
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const list = useLoad((signal) => api<{ items: ProductRow[] }>(`/admin/catalog${status ? `?status=${status}` : ""}`, { signal }), [status]);
  return (
    <>
      <PageHead title="Каталог">
        <button className="btn primary" type="button" onClick={() => setCreating((v) => !v)} aria-expanded={creating}>
          Новый товар
        </button>
      </PageHead>
      {creating && <ProductCreate />}
      <div className="panel">
        <Field label="Статус">
          {(p) => (
            <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Все</option>
              {Object.entries(productStatusLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      {list.loading && !list.data && <Loading />}
      <ErrorBox error={list.error} onRetry={list.reload} />
      {list.data?.items.length === 0 && <Empty>Товаров с таким статусом нет</Empty>}
      {!!list.data?.items.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Товар</th>
                <th>Расположение</th>
                <th>Статус</th>
                <th>Активных вариантов</th>
                <th>Цена от</th>
                <th>Фото</th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/catalog/${p.id}`}>{p.title}</Link>
                    <div className="muted mono">{p.code}</div>
                  </td>
                  <td>{positionLabels[p.position] ?? p.position}</td>
                  <td>
                    <Badge kind={statusKind(p.status)}>{productStatusLabels[p.status] ?? p.status}</Badge>
                  </td>
                  <td>{p.activeVariants}</td>
                  <td>{p.minPrice === null ? <span className="muted">нет</span> : rub(p.minPrice)}</td>
                  <td>{p.photos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type Detail = {
  product: {
    id: string;
    slug: string;
    code: string;
    title: string;
    position: string;
    description: string;
    composition: string[];
    material: string | null;
    installation: string | null;
    status: string;
    version: number;
    publishedAt: string | null;
  };
  compatibilities: { vehicleModelId: string; slug: string; make: string; model: string; note: string | null; active: boolean }[];
  variants: { id: string; vehicleModelId: string; title: string; priceKopecks: number | null; available: boolean; status: string; sort: number; version: number }[];
  media: { id: string; status: string; url: string | null; alt: string; width: number | null; height: number | null; sort: number }[];
};

type Reload = { reload: () => void };

function MainForm({ d, reload }: { d: Detail; reload: () => void }) {
  const p = d.product;
  const materials = useLoad((signal) => api<{ items: Material[] }>("/admin/materials", { signal }), []);
  const act = useAction();
  useConflictReload(act.error, reload);
  const [f, setF] = useState({
    slug: p.slug,
    code: p.code,
    title: p.title,
    position: p.position,
    description: p.description,
    composition: p.composition.join("\n"),
    material: p.material ?? "",
    installation: p.installation ?? "",
  });
  const fe = fieldsOf(act.error);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const comp = f.composition.split("\n").map((x) => x.trim()).filter(Boolean);
    const body: Record<string, unknown> = {};
    if (f.slug.trim() !== p.slug) body.slug = f.slug.trim();
    if (f.code.trim() !== p.code) body.code = f.code.trim();
    if (f.title.trim() !== p.title) body.title = f.title.trim();
    if (f.position !== p.position) body.position = f.position;
    if (f.description.trim() !== p.description) body.description = f.description;
    if (comp.join("\n") !== p.composition.join("\n")) body.composition = comp;
    if ((f.material || null) !== p.material) body.material = f.material || null;
    if ((f.installation.trim() || null) !== p.installation) body.installation = f.installation.trim() || null;
    if (!Object.keys(body).length) {
      act.setError(new ApiFailure(422, { code: "VALIDATION", message: "Нет изменений", requestId: "" }));
      return;
    }
    const r = await act.run(() => api(`/admin/catalog/${p.id}`, { method: "PATCH", body: { version: p.version, ...body } }), "Сохранено");
    if (r) reload();
  };
  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>Основное</h2>
      <div className="grid-2">
        <Field label="Адрес (slug)" error={fe.slug} hint={p.publishedAt ? "У опубликованного товара старый адрес станет переадресацией" : undefined}>
          {(q) => <input {...q} value={f.slug} onChange={set("slug")} maxLength={80} />}
        </Field>
        <Field label="Код" error={fe.code}>
          {(q) => <input {...q} value={f.code} onChange={set("code")} maxLength={40} />}
        </Field>
        <Field label="Название" error={fe.title}>
          {(q) => <input {...q} value={f.title} onChange={set("title")} maxLength={200} />}
        </Field>
        <Field label="Расположение" error={fe.position}>
          {(q) => (
            <select {...q} value={f.position} onChange={set("position")}>
              {Object.entries(positionLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Материал" error={fe.material}>
          {(q) => (
            <select {...q} value={f.material} onChange={set("material")}>
              <option value="">Не указан</option>
              {materials.data?.items.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field label="Описание" error={fe.description}>
        {(q) => <textarea {...q} value={f.description} onChange={set("description")} maxLength={5000} />}
      </Field>
      <Field label="Состав" hint="Один пункт на строку" error={fe.composition}>
        {(q) => <textarea {...q} value={f.composition} onChange={set("composition")} />}
      </Field>
      <Field label="Установка" error={fe.installation}>
        {(q) => <textarea {...q} value={f.installation} onChange={set("installation")} maxLength={2000} />}
      </Field>
      <ErrorBox error={act.error} />
      <Done message={act.done} />
      <button className="btn primary" type="submit" disabled={act.busy}>
        {act.busy ? "Сохраняем…" : "Сохранить"}
      </button>
    </form>
  );
}

function Compat({ d, reload }: { d: Detail; reload: () => void }) {
  const vehicles = useLoad((signal) => api<{ items: Vehicle[] }>("/admin/vehicles", { signal }), []);
  const act = useAction();
  useConflictReload(act.error, reload);
  const [sel, setSel] = useState<Record<string, { on: boolean; note: string }>>(() =>
    Object.fromEntries(d.compatibilities.map((c) => [c.vehicleModelId, { on: c.active, note: c.note ?? "" }])),
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const items = Object.entries(sel)
      .filter(([, v]) => v.on)
      .map(([vehicleModelId, v]) => ({ vehicleModelId, note: v.note.trim() || null }));
    const r = await act.run(() => api(`/admin/catalog/${d.product.id}/compatibilities`, { method: "PUT", body: { version: d.product.version, items } }), "Совместимость сохранена");
    if (r) reload();
  };
  return (
    <form className="panel" onSubmit={submit}>
      <h2>Совместимость</h2>
      {vehicles.loading && !vehicles.data && <Loading />}
      <ErrorBox error={vehicles.error} onRetry={vehicles.reload} />
      {vehicles.data?.items.length === 0 && <Empty>Моделей авто пока нет. Добавьте их в разделе «Модели авто»</Empty>}
      <div className="compat-list">
        {vehicles.data?.items.map((v) => {
          const cur = sel[v.id] ?? { on: false, note: "" };
          return (
            <div className="compat-row" key={v.id}>
              <label className="check">
                <input type="checkbox" checked={cur.on} onChange={(e) => setSel((s) => ({ ...s, [v.id]: { ...cur, on: e.target.checked } }))} />
                <span>
                  {v.make} {v.model}
                  {!v.published && <span className="muted"> (не опубликована)</span>}
                </span>
              </label>
              <input
                aria-label={`Примечание: ${v.make} ${v.model}`}
                placeholder="Примечание"
                value={cur.note}
                disabled={!cur.on}
                maxLength={300}
                onChange={(e) => setSel((s) => ({ ...s, [v.id]: { ...cur, note: e.target.value } }))}
              />
            </div>
          );
        })}
      </div>
      <ErrorBox error={act.error} />
      <Done message={act.done} />
      <button className="btn primary" type="submit" disabled={act.busy || !vehicles.data}>
        {act.busy ? "Сохраняем…" : "Сохранить совместимость"}
      </button>
    </form>
  );
}

type VariantRow = Detail["variants"][number];

function VariantEdit({ v, vehicleName, reload }: { v: VariantRow; vehicleName: string; reload: () => void }) {
  const act = useAction();
  useConflictReload(act.error, reload);
  const initialPrice = v.priceKopecks === null ? "" : String(v.priceKopecks / 100);
  const [title, setTitle] = useState(v.title);
  const [price, setPrice] = useState(initialPrice);
  const [available, setAvailable] = useState(v.available);
  const [status, setStatus] = useState(v.status);
  const save = async () => {
    const body: Record<string, unknown> = {};
    if (title.trim() !== v.title) body.title = title.trim();
    if (price.trim() !== initialPrice) {
      const k = price.trim() ? toKopecks(price) : null;
      if (price.trim() && k === null) {
        act.setError(new ApiFailure(422, errorMessage("Проверьте цену", "priceKopecks")));
        return;
      }
      body.priceKopecks = k;
    }
    if (available !== v.available) body.available = available;
    if (status !== v.status) body.status = status;
    if (!Object.keys(body).length) return;
    const r = await act.run(() => api(`/admin/variants/${v.id}`, { method: "PATCH", body: { version: v.version, ...body } }), "Сохранено");
    if (r) reload();
  };
  const fe = fieldsOf(act.error);
  return (
    <tr>
      <td>{vehicleName}</td>
      <td>
        <input aria-label="Название варианта" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-invalid={fe.title ? true : undefined} />
        {fe.title && <div className="err">{fe.title}</div>}
      </td>
      <td>
        <input aria-label="Цена в рублях" inputMode="decimal" placeholder="Уточнить цену" value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={fe.priceKopecks ? true : undefined} />
        {fe.priceKopecks && <div className="err">{fe.priceKopecks}</div>}
      </td>
      <td>
        <label className="check">
          <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
          <span>В наличии</span>
        </label>
      </td>
      <td>
        <select aria-label="Статус варианта" value={status} onChange={(e) => setStatus(e.target.value)}>
          {Object.entries(variantStatusLabels).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </td>
      <td>
        <button className="btn small" type="button" disabled={act.busy} onClick={() => void save()}>
          {act.busy ? "Сохраняем…" : "Сохранить"}
        </button>
        {act.error && !Object.keys(fe).length && <div className="err">{act.error.message}</div>}
        {act.done && <div className="muted">{act.done}</div>}
      </td>
    </tr>
  );
}

function Variants({ d, reload }: { d: Detail; reload: () => void }) {
  const active = d.compatibilities.filter((c) => c.active);
  const nameOf = (id: string) => {
    const c = d.compatibilities.find((x) => x.vehicleModelId === id);
    return c ? `${c.make} ${c.model}` : "Модель удалена из совместимости";
  };
  const act = useAction();
  const [vehicle, setVehicle] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [available, setAvailable] = useState(true);
  const fe = fieldsOf(act.error);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const vid = vehicle || active[0]?.vehicleModelId;
    if (!vid) return;
    const k = price.trim() ? toKopecks(price) : null;
    if (price.trim() && k === null) {
      act.setError(new ApiFailure(422, errorMessage("Проверьте цену", "priceKopecks")));
      return;
    }
    const r = await act.run(
      () => api(`/admin/catalog/${d.product.id}/variants`, { body: { vehicleModelId: vid, title: title.trim(), priceKopecks: k, available } }),
      "Вариант добавлен",
    );
    if (r) {
      setTitle("");
      setPrice("");
      reload();
    }
  };
  return (
    <div className="panel">
      <h2>Варианты</h2>
      {d.variants.length === 0 && <Empty>Вариантов пока нет</Empty>}
      {!!d.variants.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Модель</th>
                <th>Название</th>
                <th>Цена, ₽</th>
                <th>Наличие</th>
                <th>Статус</th>
                <th>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {d.variants.map((v) => (
                <VariantEdit key={`${v.id}-${v.version}`} v={v} vehicleName={nameOf(v.vehicleModelId)} reload={reload} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={submit} noValidate className="add-variant">
        <h3>Добавить вариант</h3>
        {active.length === 0 ? (
          <Empty>Сначала сохраните совместимость хотя бы с одной моделью</Empty>
        ) : (
          <>
            <div className="grid-2">
              <Field label="Модель" error={fe.vehicleModelId}>
                {(p) => (
                  <select {...p} value={vehicle || active[0]!.vehicleModelId} onChange={(e) => setVehicle(e.target.value)}>
                    {active.map((c) => (
                      <option key={c.vehicleModelId} value={c.vehicleModelId}>
                        {c.make} {c.model}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Название" error={fe.title}>
                {(p) => <input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />}
              </Field>
              <Field label="Цена, ₽" hint="Пусто: «Уточнить цену»" error={fe.priceKopecks}>
                {(p) => <input {...p} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />}
              </Field>
              <label className="check">
                <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
                <span>В наличии</span>
              </label>
            </div>
            <ErrorBox error={act.error} />
            <Done message={act.done} />
            <button className="btn primary" type="submit" disabled={act.busy}>
              {act.busy ? "Добавляем…" : "Добавить вариант"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

type MediaRow = Detail["media"][number];

function MediaCard({ m, reload }: { m: MediaRow; reload: () => void }) {
  const act = useAction();
  const [alt, setAlt] = useState(m.alt);
  const [sort, setSort] = useState(String(m.sort));
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const r = await act.run(() => api(`/admin/media/${m.id}`, { method: "PATCH", body: { alt: alt.trim(), sort: Number(sort) || 0 } }), "Сохранено");
    if (r) reload();
  };
  const remove = async () => {
    if (!confirm("Удалить фото? Действие нельзя отменить")) return;
    const r = await act.run(async () => {
      await api(`/admin/media/${m.id}`, { method: "DELETE" });
      return true;
    });
    if (r) reload();
  };
  return (
    <form className="media-card" onSubmit={save}>
      {m.url ? <img src={m.url} alt={m.alt} width={m.width ?? undefined} height={m.height ?? undefined} loading="lazy" /> : <div className="media-ph muted">Ожидает обработки</div>}
      <Field label="Описание фото (alt)">{(p) => <input {...p} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} />}</Field>
      <Field label="Порядок">{(p) => <input {...p} type="number" value={sort} onChange={(e) => setSort(e.target.value)} />}</Field>
      <ErrorBox error={act.error} />
      <Done message={act.done} />
      <div className="row">
        <button className="btn small primary" type="submit" disabled={act.busy}>
          {act.busy ? "Сохраняем…" : "Сохранить"}
        </button>
        <button className="btn small danger" type="button" disabled={act.busy} onClick={() => void remove()}>
          Удалить
        </button>
      </div>
    </form>
  );
}

const MAX_BYTES = 25 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

function Photos({ d, reload }: { d: Detail; reload: () => void }) {
  const act = useAction();
  const [inputKey, setInputKey] = useState(0);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      act.setError(new ApiFailure(422, errorMessage("Нужен JPEG, PNG или WebP", "file")));
      return;
    }
    if (file.size > MAX_BYTES) {
      act.setError(new ApiFailure(422, errorMessage("Файл больше 25 МБ", "file")));
      return;
    }
    const r = await act.run(async () => {
      const up = await api<{ mediaId: string; uploadUrl: string }>("/admin/media/upload-url", { body: { productId: d.product.id, contentType: file.type } });
      await uploadFile(up.uploadUrl, file);
      await api(`/admin/media/${up.mediaId}/process`, { method: "POST", body: {} });
      return true;
    }, "Фото загружено");
    setInputKey((k) => k + 1);
    reload();
    return r;
  };
  return (
    <div className="panel">
      <h2>Фото</h2>
      {d.media.length === 0 && <Empty>Фото пока нет. Для публикации нужно хотя бы одно, с описанием</Empty>}
      <div className="media-grid">
        {d.media.map((m) => (
          <MediaCard key={`${m.id}-${m.alt}-${m.sort}-${m.status}`} m={m} reload={reload} />
        ))}
      </div>
      <Field label="Добавить фото" hint="JPEG, PNG или WebP, до 25 МБ, от 600×400" error={fieldsOf(act.error).file}>
        {(p) => <input {...p} key={inputKey} type="file" accept="image/jpeg,image/png,image/webp" disabled={act.busy} onChange={(e) => void onFile(e.target.files?.[0])} />}
      </Field>
      {act.busy && <Loading label="Загружаем фото" />}
      {!fieldsOf(act.error).file && <ErrorBox error={act.error} />}
      <Done message={act.done} />
    </div>
  );
}

function Actions({ d, reload }: { d: Detail; reload: () => void }) {
  const p = d.product;
  const act = useAction();
  useConflictReload(act.error, reload);
  const publish = async () => {
    const r = await act.run(() => api(`/admin/catalog/${p.id}/publish`, { body: { version: p.version } }), "Опубликовано, на сайте в течение минуты");
    if (r) reload();
  };
  const setStatus = async (status: string, label: string, ask?: string) => {
    if (ask && !confirm(ask)) return;
    const r = await act.run(() => api(`/admin/catalog/${p.id}/status`, { body: { version: p.version, status } }), label);
    if (r) reload();
  };
  return (
    <div className="panel">
      <h2>Публикация</h2>
      <p>
        Статус: <Badge kind={statusKind(p.status)}>{productStatusLabels[p.status] ?? p.status}</Badge>
      </p>
      <div className="row">
        {p.status !== "published" && (
          <button className="btn primary" type="button" disabled={act.busy} onClick={() => void publish()}>
            {act.busy ? "Выполняем…" : "Опубликовать"}
          </button>
        )}
        {p.status !== "hidden" && (
          <button className="btn" type="button" disabled={act.busy} onClick={() => void setStatus("hidden", "Товар скрыт", "Скрыть товар с сайта?")}>
            Скрыть
          </button>
        )}
        {p.status !== "archived" && (
          <button className="btn danger" type="button" disabled={act.busy} onClick={() => void setStatus("archived", "Товар в архиве", "Отправить товар в архив?")}>
            В архив
          </button>
        )}
        {p.status !== "draft" && (
          <button className="btn" type="button" disabled={act.busy} onClick={() => void setStatus("draft", "Товар в черновиках", "Вернуть товар в черновик? Он пропадёт с сайта")}>
            В черновик
          </button>
        )}
      </div>
      {act.error && (
        <div className="notice error" role="alert">
          {act.error.message}
          <Problems error={act.error} />
        </div>
      )}
      <Done message={act.done} />
    </div>
  );
}

export function ProductEditor() {
  const { id = "" } = useParams();
  const data = useLoad((signal) => api<Detail>(`/admin/catalog/${id}`, { signal }), [id]);
  if (data.loading && !data.data) return <Loading />;
  if (data.error && !data.data) return <ErrorBox error={data.error} onRetry={data.reload} />;
  if (!data.data) return null;
  const d = data.data;
  const { reload } = data as Reload;
  return (
    <>
      <PageHead title={d.product.title}>
        <Link className="btn" to="/catalog">
          К списку
        </Link>
      </PageHead>
      {data.error && <ErrorBox error={data.error} onRetry={reload} />}
      <Actions key={`a-${d.product.version}`} d={d} reload={reload} />
      <MainForm key={`m-${d.product.version}`} d={d} reload={reload} />
      <Compat key={`c-${d.product.version}`} d={d} reload={reload} />
      <Variants d={d} reload={reload} />
      <Photos d={d} reload={reload} />
      <p className="muted">{d.product.publishedAt ? `Впервые опубликован ${dateTime(d.product.publishedAt)}` : "Ещё не публиковался"}</p>
    </>
  );
}

export function Vehicles() {
  const vehicles = useLoad((signal) => api<{ items: Vehicle[] }>("/admin/vehicles", { signal }), []);
  const materials = useLoad((signal) => api<{ items: Material[] }>("/admin/materials", { signal }), []);
  return (
    <>
      <PageHead title="Модели авто" />
      <VehicleCreate onDone={vehicles.reload} />
      {vehicles.loading && !vehicles.data && <Loading />}
      <ErrorBox error={vehicles.error} onRetry={vehicles.reload} />
      {vehicles.data?.items.length === 0 && <Empty>Моделей пока нет</Empty>}
      {!!vehicles.data?.items.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Адрес</th>
                <th>Марка</th>
                <th>Модель</th>
                <th>Порядок</th>
                <th>На сайте</th>
                <th>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {vehicles.data.items.map((v) => (
                <VehicleRow key={`${v.id}-${v.version}`} v={v} reload={vehicles.reload} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <MaterialsPanel materials={materials} />
    </>
  );
}

function VehicleCreate({ onDone }: { onDone: () => void }) {
  const act = useAction();
  const [f, setF] = useState({ slug: "", make: "", model: "", sort: "0" });
  const fe = fieldsOf(act.error);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await act.run(() => api("/admin/vehicles", { body: { slug: f.slug.trim(), make: f.make.trim(), model: f.model.trim(), sort: Number(f.sort) || 0 } }), "Модель добавлена");
    if (r) {
      setF({ slug: "", make: "", model: "", sort: "0" });
      onDone();
    }
  };
  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>Добавить модель</h2>
      <div className="grid-2">
        <Field label="Адрес (slug)" error={fe.slug} hint="Латиница, цифры и дефис">
          {(p) => <input {...p} value={f.slug} onChange={set("slug")} maxLength={80} required />}
        </Field>
        <Field label="Марка" error={fe.make}>
          {(p) => <input {...p} value={f.make} onChange={set("make")} maxLength={60} required />}
        </Field>
        <Field label="Модель" error={fe.model}>
          {(p) => <input {...p} value={f.model} onChange={set("model")} maxLength={60} required />}
        </Field>
        <Field label="Порядок" error={fe.sort}>
          {(p) => <input {...p} type="number" value={f.sort} onChange={set("sort")} />}
        </Field>
      </div>
      <ErrorBox error={act.error} />
      <Done message={act.done} />
      <button className="btn primary" type="submit" disabled={act.busy}>
        {act.busy ? "Добавляем…" : "Добавить"}
      </button>
    </form>
  );
}

function VehicleRow({ v, reload }: { v: Vehicle; reload: () => void }) {
  const act = useAction();
  useConflictReload(act.error, reload);
  const [make, setMake] = useState(v.make);
  const [model, setModel] = useState(v.model);
  const [sort, setSort] = useState(String(v.sort));
  const [published, setPublished] = useState(v.published);
  const save = async () => {
    const body: Record<string, unknown> = {};
    if (make.trim() !== v.make) body.make = make.trim();
    if (model.trim() !== v.model) body.model = model.trim();
    if ((Number(sort) || 0) !== v.sort) body.sort = Number(sort) || 0;
    if (published !== v.published) body.published = published;
    if (!Object.keys(body).length) return;
    const r = await act.run(() => api(`/admin/vehicles/${v.id}`, { method: "PATCH", body: { version: v.version, ...body } }));
    if (r) reload();
  };
  return (
    <tr>
      <td className="mono">{v.slug}</td>
      <td>
        <input aria-label={`Марка ${v.slug}`} value={make} onChange={(e) => setMake(e.target.value)} maxLength={60} />
      </td>
      <td>
        <input aria-label={`Модель ${v.slug}`} value={model} onChange={(e) => setModel(e.target.value)} maxLength={60} />
      </td>
      <td>
        <input aria-label={`Порядок ${v.slug}`} type="number" value={sort} onChange={(e) => setSort(e.target.value)} />
      </td>
      <td>
        <label className="check">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          <span>{published ? "Опубликована" : "Скрыта"}</span>
        </label>
      </td>
      <td>
        <button className="btn small" type="button" disabled={act.busy} onClick={() => void save()}>
          {act.busy ? "Сохраняем…" : "Сохранить"}
        </button>
        {act.error && <div className="err">{act.error.message}</div>}
      </td>
    </tr>
  );
}

function MaterialsPanel({ materials }: { materials: ReturnType<typeof useLoad<{ items: Material[] }>> }) {
  const act = useAction();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const fe = fieldsOf(act.error);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await act.run(() => api("/admin/materials", { body: { code: code.trim(), label: label.trim() } }), "Материал сохранён");
    if (r) {
      setCode("");
      setLabel("");
      materials.reload();
    }
  };
  return (
    <section className="panel">
      <h2>Материалы</h2>
      {materials.loading && !materials.data && <Loading />}
      <ErrorBox error={materials.error} onRetry={materials.reload} />
      {materials.data?.items.length === 0 && <Empty>Материалов пока нет</Empty>}
      {!!materials.data?.items.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Код</th>
                <th>Название</th>
                <th>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {materials.data.items.map((m) => (
                <tr key={m.code}>
                  <td className="mono">{m.code}</td>
                  <td>{m.label}</td>
                  <td>
                    <button
                      className="btn small"
                      type="button"
                      onClick={() => {
                        setCode(m.code);
                        setLabel(m.label);
                      }}
                    >
                      Изменить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={submit} noValidate className="add-variant">
        <h3>Добавить или изменить материал</h3>
        <div className="grid-2">
          <Field label="Код" error={fe.code} hint="Латиница нижнего регистра, цифры, дефис и подчёркивание">
            {(p) => <input {...p} value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} required />}
          </Field>
          <Field label="Название" error={fe.label}>
            {(p) => <input {...p} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} required />}
          </Field>
        </div>
        <ErrorBox error={act.error} />
        <Done message={act.done} />
        <button className="btn primary" type="submit" disabled={act.busy}>
          {act.busy ? "Сохраняем…" : "Сохранить материал"}
        </button>
      </form>
    </section>
  );
}
