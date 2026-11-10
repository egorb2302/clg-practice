import { useState, type FormEvent } from "react";
import { api, ApiFailure, dateTime, newKey } from "../api";
import { useAuth } from "../auth";
import { Badge, Done, Empty, ErrorBox, Field, Loading, PageHead, useAction, useLoad } from "../ui";
import { errorMessage, fieldsOf, isoFromLocal, localFromIso, Problems, useConflictReload } from "./kit";

const postStatusLabels: Record<string, string> = { draft: "Черновик", published: "Опубликована", archived: "Архив" };
const postTypeLabels: Record<string, string> = { offer: "Акция", news: "Новость" };

type PostRow = {
  id: string;
  type: string;
  slug: string;
  title: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  version: number;
  minPurchases: number | null;
  ruleVersion: number | null;
};

type FullPost = {
  id: string;
  type: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  coverUrl: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  version: number;
  minPurchases: number | null;
  variantIds: string[] | null;
  combinable: boolean | null;
  benefit: string | null;
  ruleVersion: number | null;
};

type VariantOption = { id: string; title: string; status: string; productTitle: string; productCode: string; vehicle: string };

function VariantPicker({ value, onChange, error }: { value: string[]; onChange: (ids: string[]) => void; error?: string }) {
  const list = useLoad((signal) => api<{ items: VariantOption[] }>("/admin/offer-variants", { signal }), []);
  if (list.loading && !list.data) return <Loading />;
  if (!list.data) return <ErrorBox error={list.error} onRetry={list.reload} />;
  const groups = new Map<string, VariantOption[]>();
  for (const v of list.data.items) groups.set(v.productCode, [...(groups.get(v.productCode) ?? []), v]);
  const known = new Set(list.data.items.map((v) => v.id));
  const missing = value.filter((id) => !known.has(id)).length;
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((x) => x !== id));
  return (
    <fieldset className="roles variant-picker">
      <legend>Варианты, на которые действует акция</legend>
      <p className="muted">Если ничего не выбрать, акция действует на любой товар</p>
      {missing > 0 && (
        <div className="row">
          <span className="muted">Ещё выбрано в архиве: {missing}</span>
          <button className="btn small" type="button" onClick={() => onChange(value.filter((id) => known.has(id)))}>
            Убрать архивные
          </button>
        </div>
      )}
      {list.data.items.length === 0 && <Empty>Вариантов пока нет</Empty>}
      {[...groups].map(([code, items]) => (
        <div key={code} className="variant-group">
          <strong>{items[0]!.productTitle}</strong>
          {items.map((v) => (
            <label key={v.id} className="check">
              <input type="checkbox" checked={value.includes(v.id)} onChange={(e) => toggle(v.id, e.target.checked)} />
              <span>
                {v.vehicle} · {v.title}
                {v.status !== "active" && <span className="muted"> (скрыт)</span>}
              </span>
            </label>
          ))}
        </div>
      ))}
      {error && (
        <span className="err" role="alert">
          {error}
        </span>
      )}
    </fieldset>
  );
}

function PostForm({ row, onDone, onCancel }: { row: PostRow | null; onDone: () => void; onCancel: () => void }) {
  const full = useLoad((signal) => (row ? api<{ post: FullPost }>(`/admin/posts/${row.id}`, { signal }) : Promise.resolve(null)), [row?.id]);
  if (row && full.loading && !full.data) return <Loading />;
  if (row && !full.data) {
    return (
      <div className="panel">
        <ErrorBox error={full.error} onRetry={full.reload} />
        <button className="btn" type="button" onClick={onCancel}>
          Закрыть
        </button>
      </div>
    );
  }
  return <PostFormInner post={full.data?.post ?? null} onDone={onDone} onCancel={onCancel} />;
}

function PostFormInner({ post, onDone, onCancel }: { post: FullPost | null; onDone: () => void; onCancel: () => void }) {
  const { meta } = useAuth();
  const types = [...(meta?.features.offers ? ["offer"] : []), ...(meta?.features.news ? ["news"] : [])];
  const act = useAction();
  useConflictReload(act.error, onDone);
  const [f, setF] = useState({
    type: post?.type ?? types[0] ?? "news",
    slug: post?.slug ?? "",
    title: post?.title ?? "",
    summary: post?.summary ?? "",
    body: post?.body ?? "",
    coverUrl: post?.coverUrl ?? "",
    startsAt: localFromIso(post?.startsAt),
    endsAt: localFromIso(post?.endsAt),
    minPurchases: post?.minPurchases ? String(post.minPurchases) : "",
    benefit: post?.benefit ?? "",
    combinable: post?.combinable ?? false,
  });
  const [variantIds, setVariantIds] = useState<string[]>(post?.variantIds ?? []);
  const fe = fieldsOf(act.error);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const editing = !!post;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const startsAt = isoFromLocal(f.startsAt);
    const endsAt = isoFromLocal(f.endsAt);
    const minPurchases = f.minPurchases.trim() ? Number(f.minPurchases) : null;
    const offer = {
      minPurchases,
      benefit: f.benefit.trim(),
      combinable: f.combinable,
      variantIds,
    };
    let body: Record<string, unknown>;
    let path: string;
    let method: string;
    if (post) {
      path = `/admin/posts/${post.id}`;
      method = "PATCH";
      body = { version: post.version };
      if (f.title.trim() !== post.title) body.title = f.title.trim();
      if (f.summary.trim() !== post.summary) body.summary = f.summary.trim();
      if (f.body.trim() !== post.body) body.body = f.body.trim();
      if ((f.coverUrl.trim() || null) !== post.coverUrl) body.coverUrl = f.coverUrl.trim() || null;
      if (f.startsAt !== localFromIso(post.startsAt)) body.startsAt = startsAt;
      if (f.endsAt !== localFromIso(post.endsAt)) body.endsAt = endsAt;
      if (post.type === "offer") {
        const o: Record<string, unknown> = {};
        if (minPurchases !== post.minPurchases) o.minPurchases = minPurchases;
        if (offer.benefit !== (post.benefit ?? "")) o.benefit = offer.benefit;
        if (f.combinable !== (post.combinable ?? false)) o.combinable = f.combinable;
        const before = [...(post.variantIds ?? [])].sort().join();
        if ([...variantIds].sort().join() !== before) o.variantIds = variantIds;
        body.offer = o;
      }
    } else {
      path = "/admin/posts";
      method = "POST";
      body = {
        type: f.type,
        slug: f.slug.trim(),
        title: f.title.trim(),
        summary: f.summary.trim(),
        body: f.body.trim(),
        coverUrl: f.coverUrl.trim() || null,
        startsAt,
        endsAt,
        ...(f.type === "offer" ? { offer } : {}),
      };
    }
    if ((f.startsAt && !startsAt) || (f.endsAt && !endsAt)) {
      act.setError(new ApiFailure(422, errorMessage("Проверьте дату", "startsAt")));
      return;
    }
    const r = await act.run(() => api(path, { method, body }));
    if (r) onDone();
  };
  const isOffer = (editing ? post!.type : f.type) === "offer";
  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>{editing ? "Редактирование публикации" : "Новая публикация"}</h2>
      <div className="grid-2">
        <Field label="Тип" error={fe.type}>
          {(p) => (
            <select {...p} value={f.type} onChange={set("type")} disabled={editing}>
              {(editing ? [post!.type] : types).map((t) => (
                <option key={t} value={t}>
                  {postTypeLabels[t]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Адрес (slug)" error={fe.slug} hint={editing ? "Адрес после создания не меняется" : "Латиница, цифры и дефис"}>
          {(p) => <input {...p} value={f.slug} onChange={set("slug")} disabled={editing} maxLength={80} required />}
        </Field>
        <Field label="Заголовок" error={fe.title}>
          {(p) => <input {...p} value={f.title} onChange={set("title")} maxLength={200} required />}
        </Field>
        <Field label="Ссылка на обложку" error={fe.coverUrl}>
          {(p) => <input {...p} type="url" value={f.coverUrl} onChange={set("coverUrl")} maxLength={500} />}
        </Field>
        <Field label="Начало" error={fe.startsAt}>
          {(p) => <input {...p} type="datetime-local" value={f.startsAt} onChange={set("startsAt")} />}
        </Field>
        <Field label="Окончание" error={fe.endsAt}>
          {(p) => <input {...p} type="datetime-local" value={f.endsAt} onChange={set("endsAt")} />}
        </Field>
      </div>
      <Field label="Кратко" error={fe.summary} hint="Нужно для публикации">
        {(p) => <textarea {...p} value={f.summary} onChange={set("summary")} maxLength={500} />}
      </Field>
      <Field label="Текст" error={fe.body}>
        {(p) => <textarea {...p} value={f.body} onChange={set("body")} maxLength={20000} />}
      </Field>
      {isOffer && (
        <fieldset className="roles">
          <legend>Условия акции</legend>
          <Field label="Минимум покупок" error={fe.minPurchases}>
            {(p) => <input {...p} type="number" min={1} max={1000} value={f.minPurchases} onChange={set("minPurchases")} />}
          </Field>
          <Field label="Что получает клиент" error={fe.benefit}>
            {(p) => <textarea {...p} value={f.benefit} onChange={set("benefit")} maxLength={500} />}
          </Field>
          <label className="check">
            <input type="checkbox" checked={f.combinable} onChange={(e) => setF((s) => ({ ...s, combinable: e.target.checked }))} />
            <span>Совмещается с другими акциями</span>
          </label>
          <VariantPicker value={variantIds} onChange={setVariantIds} error={fe.variantIds} />
        </fieldset>
      )}
      <ErrorBox error={act.error} />
      <div className="row">
        <button className="btn primary" type="submit" disabled={act.busy}>
          {act.busy ? "Сохраняем…" : editing ? "Сохранить" : "Создать"}
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}

function PostLine({ p, onEdit, reload }: { p: PostRow; onEdit: () => void; reload: () => void }) {
  const act = useAction();
  useConflictReload(act.error, reload);
  const setStatus = async (status: string, ask?: string) => {
    if (ask && !confirm(ask)) return;
    const r = await act.run(() => api(`/admin/posts/${p.id}/status`, { body: { version: p.version, status } }));
    if (r) reload();
  };
  return (
    <tr>
      <td>
        {p.title}
        <div className="muted mono">{p.slug}</div>
      </td>
      <td>{postTypeLabels[p.type] ?? p.type}</td>
      <td>
        <Badge kind={p.status === "published" ? "ok" : p.status === "draft" ? "new" : "bad"}>{postStatusLabels[p.status] ?? p.status}</Badge>
      </td>
      <td>
        {p.startsAt ? dateTime(p.startsAt) : <span className="muted">нет</span>}
        <div>{p.endsAt ? `до ${dateTime(p.endsAt)}` : ""}</div>
      </td>
      <td>
        <div className="row">
          <button className="btn small" type="button" onClick={onEdit}>
            Изменить
          </button>
          {p.status !== "published" && (
            <button className="btn small primary" type="button" disabled={act.busy} onClick={() => void setStatus("published")}>
              {act.busy ? "Выполняем…" : "Опубликовать"}
            </button>
          )}
          {p.status !== "archived" && (
            <button className="btn small danger" type="button" disabled={act.busy} onClick={() => void setStatus("archived", "Отправить публикацию в архив? Она пропадёт с сайта")}>
              В архив
            </button>
          )}
        </div>
        {act.error && (
          <div className="err">
            {act.error.message}
            <Problems error={act.error} />
          </div>
        )}
      </td>
    </tr>
  );
}

export function Posts() {
  const [type, setType] = useState("");
  const [form, setForm] = useState<PostRow | "new" | null>(null);
  const list = useLoad((signal) => api<{ items: PostRow[] }>(`/admin/posts${type ? `?type=${type}` : ""}`, { signal }), [type]);
  const done = () => {
    setForm(null);
    list.reload();
  };
  return (
    <>
      <PageHead title="Публикации">
        <button className="btn primary" type="button" onClick={() => setForm("new")}>
          Новая публикация
        </button>
      </PageHead>
      {form && <PostForm key={form === "new" ? "new" : `${form.id}-${form.version}`} row={form === "new" ? null : form} onDone={done} onCancel={() => setForm(null)} />}
      <div className="panel">
        <Field label="Тип">
          {(p) => (
            <select {...p} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Все</option>
              <option value="offer">Акции</option>
              <option value="news">Новости</option>
            </select>
          )}
        </Field>
      </div>
      {list.loading && !list.data && <Loading />}
      <ErrorBox error={list.error} onRetry={list.reload} />
      {list.data?.items.length === 0 && <Empty>Публикаций пока нет</Empty>}
      {!!list.data?.items.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Заголовок</th>
                <th>Тип</th>
                <th>Статус</th>
                <th>Период</th>
                <th>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((p) => (
                <PostLine key={`${p.id}-${p.version}`} p={p} onEdit={() => setForm(p)} reload={list.reload} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const campaignStatusLabels: Record<string, string> = { draft: "Черновик", scheduled: "Запланирована", sending: "Отправляется", done: "Отправлена", cancelled: "Отменена" };
const reportLabels: [string, string][] = [
  ["accepted", "принято"],
  ["rejected", "отклонено"],
  ["skipped", "пропущено"],
  ["queued", "в очереди"],
  ["needs_review", "нужна проверка"],
];

type CampaignRow = { id: string; subject: string; status: string; scheduledAt: string | null; version: number; report: Record<string, number> | null };

type FullCampaign = { id: string; subject: string; bodyText: string; status: string; scheduledAt: string | null; version: number };

function CampaignForm({ row, onDone, onCancel }: { row: CampaignRow | null; onDone: () => void; onCancel: () => void }) {
  const full = useLoad((signal) => (row ? api<{ campaign: FullCampaign }>(`/admin/campaigns/${row.id}`, { signal }) : Promise.resolve(null)), [row?.id]);
  if (row && full.loading && !full.data) return <Loading />;
  if (row && !full.data) {
    return (
      <div className="panel">
        <ErrorBox error={full.error} onRetry={full.reload} />
        <button className="btn" type="button" onClick={onCancel}>
          Закрыть
        </button>
      </div>
    );
  }
  return <CampaignFormInner c={full.data?.campaign ?? null} onDone={onDone} onCancel={onCancel} />;
}

function CampaignFormInner({ c, onDone, onCancel }: { c: FullCampaign | null; onDone: () => void; onCancel: () => void }) {
  const act = useAction();
  useConflictReload(act.error, onDone);
  const [subject, setSubject] = useState(c?.subject ?? "");
  const [text, setText] = useState(c?.bodyText ?? "");
  const fe = fieldsOf(act.error);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await act.run(() => {
      if (!c) return api("/admin/campaigns", { body: { subject: subject.trim(), bodyText: text.trim() } });
      const body: Record<string, unknown> = { version: c.version };
      if (subject.trim() !== c.subject) body.subject = subject.trim();
      if (text.trim() !== c.bodyText) body.bodyText = text.trim();
      return api(`/admin/campaigns/${c.id}`, { method: "PATCH", body });
    });
    if (r) onDone();
  };
  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>{c ? "Редактирование черновика" : "Новая рассылка"}</h2>
      <Field label="Тема письма" error={fe.subject}>
        {(p) => <input {...p} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} required />}
      </Field>
      <Field label="Текст письма" error={fe.bodyText} hint="Не короче 10 символов">
        {(p) => <textarea {...p} value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} />}
      </Field>
      <ErrorBox error={act.error} />
      <div className="row">
        <button className="btn primary" type="submit" disabled={act.busy}>
          {act.busy ? "Сохраняем…" : "Сохранить"}
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}

function CampaignLine({ c, canSend, onEdit, reload }: { c: CampaignRow; canSend: boolean; onEdit: () => void; reload: () => void }) {
  const act = useAction();
  useConflictReload(act.error, reload);
  const [planning, setPlanning] = useState(false);
  const [at, setAt] = useState("");
  const [ok, setOk] = useState(false);
  const fe = fieldsOf(act.error);
  const test = () => act.run(() => api<{ to: string }>(`/admin/campaigns/${c.id}/test`, { body: {} }).then((r) => r), "Тестовое письмо отправлено");
  const schedule = async (e: FormEvent) => {
    e.preventDefault();
    const iso = isoFromLocal(at);
    if (!iso) {
      act.setError(new ApiFailure(422, errorMessage("Укажите время отправки", "at")));
      return;
    }
    const r = await act.run(() => api(`/admin/campaigns/${c.id}/schedule`, { body: { version: c.version, at: iso, confirm: true } }), "Рассылка запланирована");
    if (r) reload();
  };
  const cancel = async () => {
    if (!confirm("Отменить рассылку? Неотправленные письма не уйдут")) return;
    const r = await act.run(() => api(`/admin/campaigns/${c.id}/cancel`, { body: {} }), "Рассылка отменена");
    if (r) reload();
  };
  return (
    <tr>
      <td>
        {c.subject}
        {c.scheduledAt && <div className="muted">Отправка {dateTime(c.scheduledAt)}</div>}
      </td>
      <td>
        <Badge kind={c.status === "done" ? "ok" : c.status === "cancelled" ? "bad" : c.status === "draft" ? "new" : "work"}>{campaignStatusLabels[c.status] ?? c.status}</Badge>
      </td>
      <td>
        {c.report ? (
          <ul className="plain">
            {reportLabels.filter(([k]) => c.report![k]).map(([k, l]) => (
              <li key={k}>
                {l}: {c.report![k]}
              </li>
            ))}
          </ul>
        ) : (
          <span className="muted">нет</span>
        )}
      </td>
      <td>
        <div className="row">
          {c.status === "draft" && (
            <button className="btn small" type="button" onClick={onEdit}>
              Изменить
            </button>
          )}
          <button className="btn small" type="button" disabled={act.busy} onClick={() => void test()}>
            Тестовое письмо
          </button>
          {canSend && c.status === "draft" && (
            <button className="btn small primary" type="button" aria-expanded={planning} onClick={() => setPlanning((v) => !v)}>
              Запланировать
            </button>
          )}
          {canSend && ["draft", "scheduled", "sending"].includes(c.status) && (
            <button className="btn small danger" type="button" disabled={act.busy} onClick={() => void cancel()}>
              Отменить
            </button>
          )}
        </div>
        {planning && (
          <form onSubmit={schedule} className="schedule" noValidate>
            <Field label="Время отправки" error={fe.at}>
              {(p) => <input {...p} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />}
            </Field>
            <label className="check">
              <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
              <span>Я проверил текст и список получателей</span>
            </label>
            <button className="btn small primary" type="submit" disabled={act.busy || !ok || !at}>
              {act.busy ? "Планируем…" : "Подтвердить"}
            </button>
          </form>
        )}
        {act.error && !fe.at && <div className="err">{act.error.message}</div>}
        {act.done && <div className="muted">{act.done}</div>}
      </td>
    </tr>
  );
}

export function Campaigns() {
  const { caps } = useAuth();
  const [form, setForm] = useState<CampaignRow | "new" | null>(null);
  const list = useLoad((signal) => api<{ items: CampaignRow[]; activeSubscribers: number }>("/admin/campaigns", { signal }), []);
  const done = () => {
    setForm(null);
    list.reload();
  };
  return (
    <>
      <PageHead title="Рассылки">
        <button className="btn primary" type="button" onClick={() => setForm("new")}>
          Новая рассылка
        </button>
      </PageHead>
      {form && <CampaignForm key={form === "new" ? "new" : `${form.id}-${form.version}`} row={form === "new" ? null : form} onDone={done} onCancel={() => setForm(null)} />}
      {list.data && (
        <div className="stats">
          <div className="stat">
            <b>{list.data.activeSubscribers}</b>
            <span>Активных подписчиков</span>
          </div>
        </div>
      )}
      <div className="spacer-y" />
      {list.loading && !list.data && <Loading />}
      <ErrorBox error={list.error} onRetry={list.reload} />
      {list.data?.items.length === 0 && <Empty>Рассылок пока нет</Empty>}
      {!!list.data?.items.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Тема</th>
                <th>Статус</th>
                <th>Отчёт о доставке</th>
                <th>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((c) => (
                <CampaignLine key={`${c.id}-${c.version}-${c.status}`} c={c} canSend={caps.campaignsSend} onEdit={() => setForm(c)} reload={list.reload} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type Rule = {
  id: string;
  version: number;
  points: number;
  confirm_days: number;
  points_ttl_days: number | null;
  kopecks_per_point: number;
  redeem_limit_pct: number;
  active: boolean;
  created_at: string;
};

function RuleForm({ last, onDone }: { last?: Rule; onDone: () => void }) {
  const act = useAction();
  const [f, setF] = useState({
    points: String(last?.points ?? 500),
    confirmDays: String(last?.confirm_days ?? 30),
    pointsTtlDays: last?.points_ttl_days ? String(last.points_ttl_days) : "",
    kopecksPerPoint: String(last?.kopecks_per_point ?? 100),
    redeemLimitPct: String(last?.redeem_limit_pct ?? 20),
  });
  const fe = fieldsOf(act.error);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await act.run(
      () =>
        api("/admin/loyalty/rules", {
          body: {
            points: Number(f.points),
            confirmDays: Number(f.confirmDays),
            pointsTtlDays: f.pointsTtlDays.trim() ? Number(f.pointsTtlDays) : null,
            kopecksPerPoint: Number(f.kopecksPerPoint),
            redeemLimitPct: Number(f.redeemLimitPct),
          },
        }),
      "Новая версия правил включена",
    );
    if (r) onDone();
  };
  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>Новая версия правил</h2>
      <div className="grid-2">
        <Field label="Баллов за первую покупку" error={fe.points}>
          {(p) => <input {...p} type="number" min={1} value={f.points} onChange={set("points")} />}
        </Field>
        <Field label="Дней до подтверждения" error={fe.confirmDays}>
          {(p) => <input {...p} type="number" min={1} max={365} value={f.confirmDays} onChange={set("confirmDays")} />}
        </Field>
        <Field label="Срок жизни баллов, дней" hint="Пусто: баллы не сгорают" error={fe.pointsTtlDays}>
          {(p) => <input {...p} type="number" min={1} max={3650} value={f.pointsTtlDays} onChange={set("pointsTtlDays")} />}
        </Field>
        <Field label="Копеек за балл" error={fe.kopecksPerPoint}>
          {(p) => <input {...p} type="number" min={1} value={f.kopecksPerPoint} onChange={set("kopecksPerPoint")} />}
        </Field>
        <Field label="Лимит списания, % от суммы" error={fe.redeemLimitPct}>
          {(p) => <input {...p} type="number" min={1} max={100} value={f.redeemLimitPct} onChange={set("redeemLimitPct")} />}
        </Field>
      </div>
      <ErrorBox error={act.error} />
      <Done message={act.done} />
      <button className="btn primary" type="submit" disabled={act.busy}>
        {act.busy ? "Сохраняем…" : "Включить новую версию"}
      </button>
    </form>
  );
}

type LedgerRow = { type: string; points: number; reason: string | null; opKey: string; createdAt: string };
const ledgerLabels: Record<string, string> = { earn: "Начисление", redeem: "Списание", reverse: "Отмена начисления", expire: "Сгорание", adjust: "Корректировка" };

function UserLookup() {
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState("");
  const data = useLoad((signal) => (userId ? api<{ balance: number; history: LedgerRow[] }>(`/admin/loyalty/users/${userId}`, { signal }) : Promise.resolve(null)), [userId]);
  const act = useAction();
  const [points, setPointsRaw] = useState("");
  const [reason, setReasonRaw] = useState("");
  const [key, setKey] = useState(newKey);
  const setPoints = (v: string) => {
    setPointsRaw(v);
    setKey(newKey());
  };
  const setReason = (v: string) => {
    setReasonRaw(v);
    setKey(newKey());
  };
  const fe = fieldsOf(act.error);
  const adjust = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(points);
    if (!Number.isInteger(n) || n === 0) {
      act.setError(new ApiFailure(422, errorMessage("Укажите целое число баллов, не ноль", "points")));
      return;
    }
    const r = await act.run(() => api(`/admin/loyalty/users/${userId}/adjust`, { body: { points: n, reason: reason.trim() }, idempotencyKey: key }), "Баланс изменён");
    if (r) {
      setPoints("");
      setReason("");
      data.reload();
    }
  };
  return (
    <section className="panel">
      <h2>Баланс клиента</h2>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          setUserId(input.trim());
          setKey(newKey());
        }}
      >
        <Field label="Идентификатор клиента">{(p) => <input {...p} value={input} onChange={(e) => setInput(e.target.value)} className="wide" />}</Field>
        <div className="field">
          <button className="btn" type="submit" disabled={!input.trim()}>
            Найти
          </button>
        </div>
      </form>
      {userId && data.loading && !data.data && <Loading />}
      {userId && <ErrorBox error={data.error} onRetry={data.reload} />}
      {userId && data.data && (
        <>
          <div className="stats">
            <div className="stat">
              <b>{data.data.balance}</b>
              <span>Баланс, баллов</span>
            </div>
          </div>
          <form onSubmit={adjust} noValidate className="add-variant">
            <h3>Корректировка</h3>
            <div className="grid-2">
              <Field label="Баллы" hint="Минус для списания" error={fe.points}>
                {(p) => <input {...p} type="number" value={points} onChange={(e) => setPoints(e.target.value)} />}
              </Field>
              <Field label="Причина" error={fe.reason}>
                {(p) => <input {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />}
              </Field>
            </div>
            <ErrorBox error={act.error} />
            <Done message={act.done} />
            <button className="btn primary" type="submit" disabled={act.busy}>
              {act.busy ? "Сохраняем…" : "Изменить баланс"}
            </button>
          </form>
          <h3>История</h3>
          {data.data.history.length === 0 && <Empty>Операций пока нет</Empty>}
          {!!data.data.history.length && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Операция</th>
                    <th>Баллы</th>
                    <th>Причина</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.history.map((h) => (
                    <tr key={h.opKey}>
                      <td>{dateTime(h.createdAt)}</td>
                      <td>{ledgerLabels[h.type] ?? h.type}</td>
                      <td>{h.points > 0 ? `+${h.points}` : h.points}</td>
                      <td>{h.reason ?? <span className="muted">нет</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function Loyalty() {
  const rules = useLoad((signal) => api<{ items: Rule[] }>("/admin/loyalty/rules", { signal }), []);
  const off = useAction();
  const turnOff = async () => {
    if (!confirm("Выключить бонусную программу? Новые баллы начисляться не будут")) return;
    const r = await off.run(() => api("/admin/loyalty/rules/deactivate", { body: {} }), "Программа выключена");
    if (r) rules.reload();
  };
  const active = rules.data?.items.find((r) => r.active);
  return (
    <>
      <PageHead title="Бонусы">
        {active && (
          <button className="btn danger" type="button" disabled={off.busy} onClick={() => void turnOff()}>
            {off.busy ? "Выключаем…" : "Выключить программу"}
          </button>
        )}
      </PageHead>
      <ErrorBox error={off.error} />
      <Done message={off.done} />
      {rules.loading && !rules.data && <Loading />}
      <ErrorBox error={rules.error} onRetry={rules.reload} />
      {rules.data && !active && <div className="notice">Программа сейчас выключена</div>}
      {rules.data && <RuleForm key={rules.data.items[0]?.id ?? "none"} last={rules.data.items[0]} onDone={rules.reload} />}
      {rules.data?.items.length === 0 && <Empty>Правил пока не было</Empty>}
      {!!rules.data?.items.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Версия</th>
                <th>Баллы</th>
                <th>Подтверждение, дней</th>
                <th>Срок жизни, дней</th>
                <th>Копеек за балл</th>
                <th>Лимит списания</th>
                <th>Создана</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {rules.data.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.version}</td>
                  <td>{r.points}</td>
                  <td>{r.confirm_days}</td>
                  <td>{r.points_ttl_days ?? <span className="muted">без срока</span>}</td>
                  <td>{r.kopecks_per_point}</td>
                  <td>{r.redeem_limit_pct}%</td>
                  <td>{dateTime(r.created_at)}</td>
                  <td>{r.active ? <Badge kind="ok">Действует</Badge> : <Badge>Архив</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="spacer-y" />
      <UserLookup />
    </>
  );
}
