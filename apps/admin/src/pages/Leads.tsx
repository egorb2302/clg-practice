import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { api, closeReasonLabels, dateTime, leadStatusLabels, leadTypeLabels, rub } from "../api";
import { useAuth } from "../auth";
import { Badge, Done, Empty, ErrorBox, Field, Loading, PageHead, useAction, useLoad } from "../ui";

type LeadRow = {
  reference: string;
  type: string;
  status: string;
  name: string;
  phone: string | null;
  email: string | null;
  assignee: { id: string; name: string | null } | null;
  itemsCount: number;
  createdAt: string;
};

type Staff = { id: string; name: string | null; email: string };

const statusKind = (s: string) =>
  s === "new" ? "new" : s === "sale_confirmed" ? "ok" : s === "closed" ? "bad" : "work";

export function StatusBadge({ status }: { status: string }) {
  return <Badge kind={statusKind(status)}>{leadStatusLabels[status] ?? status}</Badge>;
}

export function Leads() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const query = params.toString();
  const list = useLoad((signal) => api<{ items: LeadRow[]; total: number; page: number; pageSize: number }>(`/admin/leads?${query}`, { signal }), [query]);
  const staff = useLoad((signal) => api<{ items: Staff[] }>("/admin/staff", { signal }), []);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    set("q", q.trim());
  };

  const page = Number(params.get("page") ?? 1);
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <>
      <PageHead title="Заявки" />
      <div className="panel">
        <form className="row" onSubmit={submitSearch} role="search">
          <Field label="Номер, телефон, email или имя">
            {(p) => <input {...p} value={q} onChange={(e) => setQ(e.target.value)} placeholder="AX-000123" />}
          </Field>
          <Field label="Статус">
            {(p) => (
              <select {...p} value={params.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}>
                <option value="">Все</option>
                {Object.entries(leadStatusLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Ответственный">
            {(p) => (
              <select {...p} value={params.get("assignee") ?? ""} onChange={(e) => set("assignee", e.target.value)}>
                <option value="">Все</option>
                <option value="none">Без ответственного</option>
                {staff.data?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name ?? s.email}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="С даты">
            {(p) => <input {...p} type="date" value={params.get("from") ?? ""} onChange={(e) => set("from", e.target.value)} />}
          </Field>
          <Field label="По дату">
            {(p) => <input {...p} type="date" value={params.get("to") ?? ""} onChange={(e) => set("to", e.target.value)} />}
          </Field>
          <div className="field">
            <button className="btn">Найти</button>
          </div>
        </form>
      </div>
      {list.loading && <Loading />}
      <ErrorBox error={list.error} onRetry={list.reload} />
      {list.data && list.data.items.length === 0 && <Empty>Заявок по этим условиям нет</Empty>}
      {list.data && list.data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Статус</th>
                  <th>Тип</th>
                  <th>Клиент</th>
                  <th>Ответственный</th>
                  <th>Создана</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((l) => (
                  <tr key={l.reference}>
                    <td>
                      <Link to={`/leads/${l.reference}`}>{l.reference}</Link>
                    </td>
                    <td>
                      <StatusBadge status={l.status} />
                    </td>
                    <td>
                      {leadTypeLabels[l.type]}
                      {l.itemsCount ? <span className="muted"> · позиций: {l.itemsCount}</span> : null}
                    </td>
                    <td>
                      {l.name}
                      <div className="muted">{l.phone ?? l.email}</div>
                    </td>
                    <td>{l.assignee?.name ?? <span className="muted">нет</span>}</td>
                    <td>{dateTime(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <span className="muted">
              Всего: {list.data.total} · страница {page} из {pages}
            </span>
            <button className="btn small" disabled={page <= 1} onClick={() => set("page", String(page - 1))} type="button">
              Назад
            </button>
            <button className="btn small" disabled={page >= pages} onClick={() => set("page", String(page + 1))} type="button">
              Дальше
            </button>
          </div>
        </>
      )}
    </>
  );
}

type LeadDetailResponse = {
  lead: {
    reference: string;
    type: string;
    status: string;
    closeReason: string | null;
    closeComment: string | null;
    name: string;
    preferredContact: string;
    phone: string | null;
    email: string | null;
    deliveryMethod: string | null;
    vehicle: { make: string; model: string; year: number | null } | null;
    request: string | null;
    message: string | null;
    comment: string | null;
    assignee: { id: string; name: string | null } | null;
    version: number;
    createdAt: string;
  };
  items: { variantId: string; productTitle: string; productCode: string; variantTitle: string; vehicleLabel: string; priceFrom: number | null; quantity: number }[];
  events: { type: string; fromStatus: string | null; toStatus: string | null; note: string | null; createdAt: string; actorName: string | null; actorEmail: string | null }[];
  sales: { id: string; status: string; amount: number | null; soldOn: string | null; externalId: string | null }[];
  notifications: { id: string; channel: string; topic: string; status: string; attempts: number; lastError: string | null }[];
};

const transitions: Record<string, string[]> = {
  new: ["in_progress", "closed"],
  in_progress: ["offer_agreed", "closed"],
  offer_agreed: ["in_progress", "closed"],
  closed: ["in_progress"],
  sale_confirmed: [],
};

const eventText = (e: LeadDetailResponse["events"][number]) => {
  if (e.type === "created") return "Заявка создана";
  if (e.type === "status") return `Статус: ${leadStatusLabels[e.fromStatus ?? ""] ?? e.fromStatus} → ${leadStatusLabels[e.toStatus ?? ""] ?? e.toStatus}`;
  if (e.type === "assign") return e.note ? "Назначен ответственный" : "Ответственный снят";
  if (e.type === "note") return `Заметка: ${e.note}`;
  if (e.type === "claim") return "Клиент привязал заявку к кабинету";
  if (e.type === "notify_retry") return "Повтор отправки уведомлений";
  return e.type;
};

export function LeadDetail() {
  const { ref = "" } = useParams();
  const { caps } = useAuth();
  const navigate = useNavigate();
  const data = useLoad((signal) => api<LeadDetailResponse>(`/admin/leads/${ref}`, { signal }), [ref]);
  const staff = useLoad((signal) => api<{ items: Staff[] }>("/admin/staff", { signal }), []);
  const act = useAction();
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");

  if (data.loading && !data.data) return <Loading />;
  if (data.error && !data.data) return <ErrorBox error={data.error} onRetry={data.reload} />;
  if (!data.data) return null;
  const { lead, items, events, sales, notifications } = data.data;
  const fe = act.error?.fieldErrors ?? {};

  const changeStatus = async (e: FormEvent) => {
    e.preventDefault();
    const r = await act.run(
      () => api(`/admin/leads/${ref}/status`, { body: { to, version: lead.version, ...(to === "closed" ? { reason, comment: comment || undefined } : comment ? { comment } : {}) } }),
      "Статус обновлён",
    );
    if (r) {
      setTo("");
      setReason("");
      setComment("");
      data.reload();
    }
  };

  const assign = async (userId: string) => {
    const r = await act.run(() => api(`/admin/leads/${ref}/assign`, { body: { userId: userId || null, version: lead.version } }), "Ответственный обновлён");
    if (r) data.reload();
  };

  const addNote = async (e: FormEvent) => {
    e.preventDefault();
    const r = await act.run(() => api(`/admin/leads/${ref}/notes`, { body: { text: note } }), "Заметка добавлена");
    if (r) {
      setNote("");
      data.reload();
    }
  };

  const retry = async () => {
    const r = await act.run(() => api<{ retried: number }>(`/admin/leads/${ref}/notifications/retry`, { method: "POST" }));
    if (r) data.reload();
  };

  const startSale = async () => {
    const r = await act.run(() => api<{ saleId: string }>(`/admin/leads/${ref}/sale`, { method: "POST" }));
    if (r) navigate(`/sales/${r.saleId}`);
  };

  return (
    <>
      <PageHead title={`Заявка ${lead.reference}`}>
        <StatusBadge status={lead.status} />
        <Link className="btn small" to="/leads">
          К списку
        </Link>
      </PageHead>
      <ErrorBox error={act.error} />
      <Done message={act.done} />
      <div className="grid-2">
        <section className="panel" aria-labelledby="client-h">
          <h2 id="client-h">Клиент</h2>
          <dl className="kv">
            <dt>Тип</dt>
            <dd>{leadTypeLabels[lead.type]}</dd>
            <dt>Имя</dt>
            <dd>{lead.name}</dd>
            <dt>Связаться</dt>
            <dd>{lead.preferredContact === "phone" ? "По телефону" : "По email"}</dd>
            <dt>Телефон</dt>
            <dd>{lead.phone ? caps.contacts ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : lead.phone : "нет"}</dd>
            <dt>Email</dt>
            <dd>{lead.email ? caps.contacts ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : lead.email : "нет"}</dd>
            {lead.deliveryMethod && (
              <>
                <dt>Получение</dt>
                <dd>{{ pickup: "Самовывоз", shipping: "Доставка транспортной компанией", install: "Установка у нас" }[lead.deliveryMethod]}</dd>
              </>
            )}
            {lead.vehicle && (
              <>
                <dt>Автомобиль</dt>
                <dd>
                  {lead.vehicle.make} {lead.vehicle.model} {lead.vehicle.year ?? ""}
                </dd>
              </>
            )}
            <dt>Создана</dt>
            <dd>{dateTime(lead.createdAt)}</dd>
            {lead.closeReason && (
              <>
                <dt>Причина закрытия</dt>
                <dd>
                  {closeReasonLabels[lead.closeReason]}
                  {lead.closeComment ? `: ${lead.closeComment}` : ""}
                </dd>
              </>
            )}
          </dl>
          {(lead.request || lead.message) && (
            <>
              <h3 style={{ marginTop: 16 }}>Текст обращения</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{lead.request ?? lead.message}</p>
            </>
          )}
          {lead.comment && (
            <>
              <h3 style={{ marginTop: 16 }}>Комментарий клиента</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{lead.comment}</p>
            </>
          )}
        </section>
        <section className="panel" aria-labelledby="work-h">
          <h2 id="work-h">Работа с заявкой</h2>
          {caps.leads && (
            <Field label="Ответственный">
              {(p) => (
                <select {...p} value={lead.assignee?.id ?? ""} disabled={act.busy} onChange={(e) => void assign(e.target.value)}>
                  <option value="">Не назначен</option>
                  {staff.data?.items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ?? s.email}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          {caps.leads && transitions[lead.status]!.length > 0 && (
            <form onSubmit={changeStatus}>
              <Field label="Новый статус" error={fe.to}>
                {(p) => (
                  <select {...p} value={to} onChange={(e) => setTo(e.target.value)}>
                    <option value="">Выберите</option>
                    {transitions[lead.status]!.map((s) => (
                      <option key={s} value={s}>
                        {leadStatusLabels[s]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              {to === "closed" && (
                <Field label="Причина закрытия" error={fe.reason}>
                  {(p) => (
                    <select {...p} value={reason} onChange={(e) => setReason(e.target.value)}>
                      <option value="">Выберите</option>
                      {Object.entries(closeReasonLabels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              )}
              {to && (
                <Field label={to === "closed" && reason === "other" ? "Комментарий (обязательно)" : "Комментарий"} error={fe.comment}>
                  {(p) => <textarea {...p} value={comment} onChange={(e) => setComment(e.target.value)} />}
                </Field>
              )}
              <button className="btn primary" disabled={!to || act.busy}>
                {act.busy ? "Сохраняем…" : "Сменить статус"}
              </button>
            </form>
          )}
          {caps.sales && lead.status !== "closed" && lead.status !== "sale_confirmed" && (
            <div style={{ marginTop: 16 }}>
              <button className="btn" type="button" onClick={() => void startSale()} disabled={act.busy}>
                Оформить продажу
              </button>
            </div>
          )}
          {sales.length > 0 && (
            <>
              <h3 style={{ marginTop: 16 }}>Сделки</h3>
              <ul className="timeline">
                {sales.map((s) => (
                  <li key={s.id}>
                    <Link to={`/sales/${s.id}`}>{s.externalId ?? "Черновик"}</Link> <span className="muted">{s.amount ? rub(s.amount) : ""}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
      {items.length > 0 && (
        <section className="panel" aria-labelledby="items-h">
          <h2 id="items-h">Позиции на момент отправки</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Вариант</th>
                  <th>Автомобиль</th>
                  <th>Цена от</th>
                  <th>Кол-во</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.variantId}>
                    <td>
                      {i.productTitle}
                      <div className="muted mono">{i.productCode}</div>
                    </td>
                    <td>{i.variantTitle}</td>
                    <td>{i.vehicleLabel}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{rub(i.priceFrom)}</td>
                    <td>{i.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <div className="grid-2">
        <section className="panel" aria-labelledby="hist-h">
          <h2 id="hist-h">История</h2>
          <ul className="timeline">
            {events.map((e, i) => (
              <li key={i}>
                {eventText(e)}
                <div className="muted">
                  {dateTime(e.createdAt)}
                  {e.actorName || e.actorEmail ? ` · ${e.actorName ?? e.actorEmail}` : ""}
                </div>
              </li>
            ))}
          </ul>
          {caps.leads && (
            <form onSubmit={addNote} style={{ marginTop: 16 }}>
              <Field label="Заметка для коллег" error={fe.text}>
                {(p) => <textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
              </Field>
              <button className="btn" disabled={!note.trim() || act.busy}>
                Добавить заметку
              </button>
            </form>
          )}
        </section>
        <section className="panel" aria-labelledby="notif-h">
          <h2 id="notif-h">Уведомления</h2>
          {notifications.length === 0 && <Empty>Уведомлений для этой заявки нет</Empty>}
          <ul className="timeline">
            {notifications.map((n) => (
              <li key={n.id}>
                {n.channel === "telegram" ? "Telegram" : "Email"} · {n.topic === "lead.customer" ? "клиенту" : "сотрудникам"}{" "}
                <Badge kind={n.status === "sent" ? "ok" : n.status === "failed" || n.status === "needs_review" ? "bad" : "new"}>
                  {{ sent: "отправлено", pending: "в очереди", processing: "отправляется", failed: "ошибка", needs_review: "на проверке" }[n.status] ?? n.status}
                </Badge>
                {n.lastError && <div className="muted mono">{n.lastError}</div>}
              </li>
            ))}
          </ul>
          {caps.leads && notifications.some((n) => n.status === "failed" || n.status === "needs_review") && (
            <button className="btn" type="button" onClick={() => void retry()} disabled={act.busy} style={{ marginTop: 16 }}>
              Повторить отправку
            </button>
          )}
        </section>
      </div>
    </>
  );
}
