import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { api, ApiFailure, dateTime, newKey, rub, saleStatusLabels, toKopecks } from "../api";
import { useAuth } from "../auth";
import { Badge, Done, Empty, ErrorBox, Field, Loading, PageHead, useAction, useLoad } from "../ui";

type SaleRow = {
  id: string;
  status: string;
  amount: number | null;
  refunded: number;
  soldOn: string | null;
  externalId: string | null;
  leadReference: string | null;
  createdAt: string;
};

const saleKind = (s: string) => (s === "confirmed" ? "ok" : s === "draft" ? "new" : "bad");

export function Sales() {
  const [status, setStatus] = useState("");
  const list = useLoad((signal) => api<{ items: SaleRow[] }>(`/admin/sales${status ? `?status=${status}` : ""}`, { signal }), [status]);
  return (
    <>
      <PageHead title="Продажи" />
      <div className="panel">
        <Field label="Статус">
          {(p) => (
            <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Все</option>
              {Object.entries(saleStatusLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      {list.loading && <Loading />}
      <ErrorBox error={list.error} onRetry={list.reload} />
      {list.data?.items.length === 0 && <Empty>Сделок пока нет. Продажа оформляется из карточки заявки</Empty>}
      {!!list.data?.items.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Документ</th>
                <th>Статус</th>
                <th>Сумма</th>
                <th>Дата продажи</th>
                <th>Заявка</th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/sales/${s.id}`}>{s.externalId ?? "Черновик"}</Link>
                  </td>
                  <td>
                    <Badge kind={saleKind(s.status)}>{saleStatusLabels[s.status]}</Badge>
                  </td>
                  <td>
                    {s.amount ? rub(s.amount) : "нет"}
                    {s.refunded ? <div className="muted">возврат {rub(s.refunded)}</div> : null}
                  </td>
                  <td>{s.soldOn ?? dateTime(s.createdAt)}</td>
                  <td>{s.leadReference ? <Link to={`/leads/${s.leadReference}`}>{s.leadReference}</Link> : <span className="muted">офлайн</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type SaleDetailResponse = {
  sale: {
    id: string;
    status: string;
    source: string;
    externalId: string | null;
    amount: number | null;
    refunded: number;
    soldOn: string | null;
    version: number;
    leadReference: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
  };
  items: { id: string; variantId: string | null; title: string; quantity: number; priceKopecks: number | null }[];
  events: { type: string; amount: number | null; note: string | null; createdAt: string; actorName: string | null }[];
};

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });

export function SaleDetail() {
  const { id = "" } = useParams();
  const { caps, meta } = useAuth();
  const data = useLoad((signal) => api<SaleDetailResponse>(`/admin/sales/${id}`, { signal }), [id]);
  const act = useAction();
  const [amount, setAmount] = useState("");
  const [soldOn, setSoldOn] = useState(today());
  const [externalId, setExternalId] = useState("");
  const [redeem, setRedeem] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundKey, setRefundKey] = useState(newKey);

  if (data.loading && !data.data) return <Loading />;
  if (data.error && !data.data) return <ErrorBox error={data.error} onRetry={data.reload} />;
  if (!data.data) return null;
  const { sale, items, events } = data.data;
  const fe = act.error?.fieldErrors ?? {};
  const itemsTotal = items.reduce((s, i) => s + (i.priceKopecks ?? 0) * i.quantity, 0);

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    const kopecks = toKopecks(amount);
    if (!kopecks) {
      act.setError(new ApiFailure(422, { code: "VALIDATION", message: "Проверьте сумму", fieldErrors: { amountKopecks: "Укажите сумму сделки" }, requestId: "" }));
      return;
    }
    const r = await act.run(
      () =>
        api(`/admin/sales/${id}/confirm`, {
          body: { version: sale.version, amountKopecks: kopecks, soldOn, externalId: externalId.trim(), ...(redeem ? { redeemPoints: Number(redeem) } : {}) },
        }),
      "Продажа подтверждена",
    );
    if (r) data.reload();
  };

  const refund = async (e: FormEvent) => {
    e.preventDefault();
    const kopecks = toKopecks(refundAmount);
    if (!kopecks) {
      act.setError(new ApiFailure(422, { code: "VALIDATION", message: "Проверьте сумму", fieldErrors: { amountKopecks: "Укажите сумму возврата" }, requestId: "" }));
      return;
    }
    const r = await act.run(
      () => api(`/admin/sales/${id}/refunds`, { body: { amountKopecks: kopecks, reason: refundReason }, idempotencyKey: refundKey }),
      "Возврат оформлен",
    );
    if (r) {
      setRefundAmount("");
      setRefundReason("");
      setRefundKey(newKey());
      data.reload();
    }
  };

  return (
    <>
      <PageHead title={sale.externalId ? `Сделка ${sale.externalId}` : "Черновик сделки"}>
        <Badge kind={saleKind(sale.status)}>{saleStatusLabels[sale.status]}</Badge>
        <Link className="btn small" to="/sales">
          К списку
        </Link>
      </PageHead>
      <ErrorBox error={act.error?.fieldErrors && Object.keys(act.error.fieldErrors).length ? null : act.error} />
      <Done message={act.done} />
      <div className="grid-2">
        <section className="panel" aria-labelledby="sale-h">
          <h2 id="sale-h">Данные сделки</h2>
          <dl className="kv">
            <dt>Заявка</dt>
            <dd>{sale.leadReference ? <Link to={`/leads/${sale.leadReference}`}>{sale.leadReference}</Link> : "офлайн-продажа"}</dd>
            <dt>Телефон</dt>
            <dd>{sale.contactPhone ?? "нет"}</dd>
            <dt>Email</dt>
            <dd>{sale.contactEmail ?? "нет"}</dd>
            {sale.amount !== null && (
              <>
                <dt>Сумма</dt>
                <dd>{rub(sale.amount)}</dd>
                <dt>Возвращено</dt>
                <dd>{rub(sale.refunded)}</dd>
                <dt>Дата</dt>
                <dd>{sale.soldOn}</dd>
                <dt>Источник</dt>
                <dd>{sale.source}</dd>
              </>
            )}
          </dl>
          <h3 style={{ marginTop: 16 }}>Состав</h3>
          {items.length === 0 ? (
            <Empty>Состав не указан</Empty>
          ) : (
            <ul className="timeline">
              {items.map((i) => (
                <li key={i.id}>
                  {i.title} × {i.quantity}
                  {i.priceKopecks ? <span className="muted"> · от {rub(i.priceKopecks)}</span> : null}
                </li>
              ))}
            </ul>
          )}
          {itemsTotal > 0 && sale.status === "draft" && <p className="muted">Ориентир по ценам «от»: {rub(itemsTotal)}. Фактическая сумма вводится отдельно</p>}
        </section>
        {sale.status === "draft" && caps.sales && (
          <section className="panel" aria-labelledby="confirm-h">
            <h2 id="confirm-h">Подтверждение продажи</h2>
            <form onSubmit={confirm} noValidate>
              <Field label="Фактическая сумма, ₽" error={fe.amountKopecks}>
                {(p) => <input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="45 900" />}
              </Field>
              <Field label="Дата продажи" error={fe.soldOn}>
                {(p) => <input {...p} type="date" value={soldOn} onChange={(e) => setSoldOn(e.target.value)} />}
              </Field>
              <Field label="Номер сделки или документа" error={fe.externalId} hint="Уникальный номер из кассы или договора">
                {(p) => <input {...p} value={externalId} onChange={(e) => setExternalId(e.target.value)} />}
              </Field>
              {meta?.features.loyalty && (
                <Field label="Списать баллов" error={fe.redeemPoints} hint="Только если покупка привязана к кабинету клиента">
                  {(p) => <input {...p} inputMode="numeric" value={redeem} onChange={(e) => setRedeem(e.target.value.replace(/\D/g, ""))} />}
                </Field>
              )}
              <button className="btn primary" disabled={act.busy || !amount || !externalId.trim()}>
                {act.busy ? "Подтверждаем…" : "Подтвердить продажу"}
              </button>
            </form>
          </section>
        )}
        {(sale.status === "confirmed" || sale.status === "partially_refunded") && caps.sales && (
          <section className="panel" aria-labelledby="refund-h">
            <h2 id="refund-h">Возврат</h2>
            <form onSubmit={refund} noValidate>
              <Field label="Сумма возврата, ₽" error={fe.amountKopecks}>
                {(p) => <input {...p} inputMode="decimal" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />}
              </Field>
              <Field label="Причина" error={fe.reason}>
                {(p) => <textarea {...p} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />}
              </Field>
              <button className="btn danger" disabled={act.busy || !refundAmount || refundReason.trim().length < 3}>
                {act.busy ? "Оформляем…" : "Оформить возврат"}
              </button>
            </form>
          </section>
        )}
      </div>
      <section className="panel" aria-labelledby="sale-hist-h">
        <h2 id="sale-hist-h">История</h2>
        <ul className="timeline">
          {events.map((e, i) => (
            <li key={i}>
              {{ created: "Черновик создан", confirmed: "Продажа подтверждена", refund: "Возврат", edit: "Состав изменён" }[e.type] ?? e.type}
              {e.amount ? ` · ${rub(e.amount)}` : ""}
              {e.note ? ` · ${e.note}` : ""}
              <div className="muted">
                {dateTime(e.createdAt)}
                {e.actorName ? ` · ${e.actorName}` : ""}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
