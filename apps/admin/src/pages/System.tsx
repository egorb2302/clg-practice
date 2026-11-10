import { useState, type FormEvent } from "react";
import { api, dateTime } from "../api";
import { useAuth } from "../auth";
import { Badge, Done, Empty, ErrorBox, Field, Loading, PageHead, useAction, useLoad } from "../ui";
import { fieldsOf } from "./kit";

const roleLabels: Record<string, string> = {
  manager: "Менеджер",
  editor: "Редактор",
  admin: "Администратор",
  contacts_view: "Просмотр контактов",
  sales_confirm: "Подтверждение продаж",
  campaigns_send: "Запуск рассылок",
};

type Staff = { id: string; email: string; name: string; status: string; createdAt: string; roles: string[]; mfaEnrolled: boolean };

function RoleChecks({ value, onChange, error }: { value: string[]; onChange: (v: string[]) => void; error?: string }) {
  return (
    <fieldset className="roles">
      <legend>Роли</legend>
      {Object.entries(roleLabels).map(([k, l]) => (
        <label className="check" key={k}>
          <input type="checkbox" checked={value.includes(k)} onChange={(e) => onChange(e.target.checked ? [...value, k] : value.filter((x) => x !== k))} />
          <span>{l}</span>
        </label>
      ))}
      {error && <span className="err">{error}</span>}
    </fieldset>
  );
}

function Invite({ onDone }: { onDone: () => void }) {
  const act = useAction();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<string[]>(["manager"]);
  const fe = fieldsOf(act.error);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await act.run(() => api("/admin/users", { body: { email: email.trim(), name: name.trim(), roles } }), "Приглашение отправлено");
    if (r) {
      setEmail("");
      setName("");
      onDone();
    }
  };
  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>Пригласить сотрудника</h2>
      <div className="grid-2">
        <Field label="Email" error={fe.email}>
          {(p) => <input {...p} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Field>
        <Field label="Имя" error={fe.name}>
          {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />}
        </Field>
      </div>
      <RoleChecks value={roles} onChange={setRoles} error={fe.roles} />
      <ErrorBox error={act.error} />
      <Done message={act.done} />
      <button className="btn primary" type="submit" disabled={act.busy}>
        {act.busy ? "Отправляем…" : "Пригласить"}
      </button>
    </form>
  );
}

function UserRow({ u, self, reload }: { u: Staff; self: boolean; reload: () => void }) {
  const act = useAction();
  const [editing, setEditing] = useState(false);
  const [roles, setRoles] = useState(u.roles);
  const disabled = u.status === "disabled";
  const saveRoles = async () => {
    const r = await act.run(() => api(`/admin/users/${u.id}/roles`, { method: "PUT", body: { roles } }), "Роли сохранены");
    if (r) {
      setEditing(false);
      reload();
    }
  };
  const doAction = async (action: "disable" | "enable" | "reset-totp", ask?: string) => {
    if (ask && !confirm(ask)) return;
    const r = await act.run(() => api(`/admin/users/${u.id}/${action}`, { method: "POST", body: {} }));
    if (r) reload();
  };
  return (
    <tr>
      <td>
        {u.name}
        <div className="muted">{u.email}</div>
      </td>
      <td>
        {editing ? (
          <>
            <RoleChecks value={roles} onChange={setRoles} error={fieldsOf(act.error).roles} />
            <div className="row">
              <button className="btn small primary" type="button" disabled={act.busy} onClick={() => void saveRoles()}>
                {act.busy ? "Сохраняем…" : "Сохранить"}
              </button>
              <button
                className="btn small"
                type="button"
                onClick={() => {
                  setEditing(false);
                  setRoles(u.roles);
                }}
              >
                Отмена
              </button>
            </div>
          </>
        ) : (
          <div className="row tags">
            {u.roles.map((r) => (
              <Badge key={r}>{roleLabels[r] ?? r}</Badge>
            ))}
          </div>
        )}
      </td>
      <td>
        <Badge kind={disabled ? "bad" : "ok"}>{disabled ? "Отключён" : "Активен"}</Badge>
      </td>
      <td>{u.mfaEnrolled ? "Приложение подключено" : <span className="muted">Не подключено</span>}</td>
      <td>
        <div className="row">
          {!editing && (
            <button className="btn small" type="button" onClick={() => setEditing(true)}>
              Роли
            </button>
          )}
          {!self &&
            (disabled ? (
              <button className="btn small" type="button" disabled={act.busy} onClick={() => void doAction("enable")}>
                Включить
              </button>
            ) : (
              <button className="btn small danger" type="button" disabled={act.busy} onClick={() => void doAction("disable", `Отключить доступ для ${u.name}? Его сессии завершатся`)}>
                Отключить
              </button>
            ))}
          {!self && (
            <button className="btn small danger" type="button" disabled={act.busy} onClick={() => void doAction("reset-totp", `Сбросить приложение-аутентификатор для ${u.name}? Ему придётся подключить его заново`)}>
              Сбросить TOTP
            </button>
          )}
        </div>
        {act.error && <div className="err">{act.error.message}</div>}
        {act.done && <div className="muted">{act.done}</div>}
      </td>
    </tr>
  );
}

export function Users() {
  const { session } = useAuth();
  const list = useLoad((signal) => api<{ items: Staff[] }>("/admin/users", { signal }), []);
  return (
    <>
      <PageHead title="Сотрудники" />
      <Invite onDone={list.reload} />
      {list.loading && !list.data && <Loading />}
      <ErrorBox error={list.error} onRetry={list.reload} />
      {list.data?.items.length === 0 && <Empty>Сотрудников пока нет</Empty>}
      {!!list.data?.items.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Роли</th>
                <th>Статус</th>
                <th>Вход по коду</th>
                <th>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((u) => (
                <UserRow key={`${u.id}-${u.roles.join()}-${u.status}-${u.mfaEnrolled}`} u={u} self={u.id === session?.user.id} reload={list.reload} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type Job = { id: string; channel: string; topic: string; status: string; attempts: number; lastError: string | null; runAfter: string; createdAt: string; sentAt: string | null };
const jobTabs: [string, string][] = [
  ["failed", "С ошибкой"],
  ["needs_review", "Нужна проверка"],
  ["pending", "В очереди"],
];

function JobRow({ j, reload }: { j: Job; reload: () => void }) {
  const act = useAction();
  const retry = async () => {
    const r = await act.run(() => api(`/admin/jobs/${j.id}/retry`, { method: "POST", body: {} }));
    if (r) reload();
  };
  return (
    <tr>
      <td>{j.channel}</td>
      <td className="mono">{j.topic}</td>
      <td>{j.attempts}</td>
      <td className="mono">{j.lastError ?? <span className="muted">нет</span>}</td>
      <td>{dateTime(j.createdAt)}</td>
      <td>{dateTime(j.runAfter)}</td>
      <td>
        {j.status !== "pending" && (
          <button className="btn small" type="button" disabled={act.busy} onClick={() => void retry()}>
            {act.busy ? "Повторяем…" : "Повторить"}
          </button>
        )}
        {act.error && <div className="err">{act.error.message}</div>}
      </td>
    </tr>
  );
}

export function Jobs() {
  const [status, setStatus] = useState("failed");
  const list = useLoad((signal) => api<{ items: Job[] }>(`/admin/jobs?status=${status}`, { signal }), [status]);
  return (
    <>
      <PageHead title="Уведомления" />
      <div className="row tabs" role="group" aria-label="Статус задач">
        {jobTabs.map(([k, l]) => (
          <button key={k} className={`btn small ${status === k ? "primary" : ""}`} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}>
            {l}
          </button>
        ))}
      </div>
      {list.loading && !list.data && <Loading />}
      <ErrorBox error={list.error} onRetry={list.reload} />
      {list.data?.items.length === 0 && <Empty>В этом списке задач нет</Empty>}
      {!!list.data?.items.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Канал</th>
                <th>Тема</th>
                <th>Попытки</th>
                <th>Последняя ошибка</th>
                <th>Создана</th>
                <th>Следующая попытка</th>
                <th>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((j) => (
                <JobRow key={j.id} j={j} reload={list.reload} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type AuditRow = { action: string; entity: string; entityId: string | null; data: unknown; createdAt: string; actorName: string | null; actorEmail: string | null };
const entities = ["product", "variant", "media", "vehicle", "material", "user", "outbox", "settings", "delivery_method", "lead", "sale", "post", "campaign", "loyalty_rule", "loyalty_award"];

export function Audit() {
  const [entity, setEntity] = useState("");
  const [entityId, setEntityId] = useState("");
  const [applied, setApplied] = useState({ entity: "", entityId: "" });
  const qs = new URLSearchParams();
  if (applied.entity) qs.set("entity", applied.entity);
  if (applied.entityId) qs.set("entityId", applied.entityId);
  const list = useLoad((signal) => api<{ items: AuditRow[] }>(`/admin/audit${qs.size ? `?${qs}` : ""}`, { signal }), [applied.entity, applied.entityId]);
  return (
    <>
      <PageHead title="Журнал" />
      <form
        className="panel row"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ entity: entity.trim(), entityId: entityId.trim() });
        }}
      >
        <Field label="Объект">
          {(p) => (
            <>
              <input {...p} list="audit-entities" value={entity} onChange={(e) => setEntity(e.target.value)} />
              <datalist id="audit-entities">
                {entities.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Идентификатор">{(p) => <input {...p} value={entityId} onChange={(e) => setEntityId(e.target.value)} />}</Field>
        <div className="field">
          <button className="btn primary" type="submit">
            Показать
          </button>
        </div>
      </form>
      {list.loading && !list.data && <Loading />}
      <ErrorBox error={list.error} onRetry={list.reload} />
      {list.data?.items.length === 0 && <Empty>Записей нет</Empty>}
      {!!list.data?.items.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Действие</th>
                <th>Объект</th>
                <th>Кто</th>
                <th>Данные</th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((a, i) => (
                <tr key={`${a.createdAt}-${i}`}>
                  <td>{dateTime(a.createdAt)}</td>
                  <td className="mono">{a.action}</td>
                  <td>
                    {a.entity}
                    <div className="muted mono">{a.entityId}</div>
                  </td>
                  <td>{a.actorName ?? a.actorEmail ?? <span className="muted">система</span>}</td>
                  <td>
                    {a.data ? (
                      <details>
                        <summary>Показать</summary>
                        <pre className="json">{JSON.stringify(a.data, null, 2)}</pre>
                      </details>
                    ) : (
                      <span className="muted">нет</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type Contacts = { phone?: string; email?: string; telegram?: string; address?: string; hours?: string };
type SettingsData = { contacts: Contacts; deliveryMethods: { code: string; label: string; enabled: boolean; sort: number }[] };

function ContactsForm({ initial, canEdit }: { initial: Contacts; canEdit: boolean }) {
  const act = useAction();
  const [f, setF] = useState({ phone: initial.phone ?? "", email: initial.email ?? "", telegram: initial.telegram ?? "", address: initial.address ?? "", hours: initial.hours ?? "" });
  const fe = fieldsOf(act.error);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await act.run(
      () =>
        api("/admin/settings/contacts", {
          method: "PUT",
          body: {
            phone: f.phone.trim(),
            address: f.address.trim(),
            hours: f.hours.trim(),
            email: f.email.trim(),
            telegram: f.telegram.trim(),
          },
        }),
      "Контакты сохранены",
    );
  };
  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>Контакты на сайте</h2>
      <div className="grid-2">
        <Field label="Телефон" error={fe.phone}>
          {(p) => <input {...p} type="tel" value={f.phone} onChange={set("phone")} readOnly={!canEdit} maxLength={40} />}
        </Field>
        <Field label="Email" error={fe.email}>
          {(p) => <input {...p} type="email" value={f.email} onChange={set("email")} readOnly={!canEdit} />}
        </Field>
        <Field label="Telegram" hint="Ссылка, начинается с https" error={fe.telegram}>
          {(p) => <input {...p} type="url" value={f.telegram} onChange={set("telegram")} readOnly={!canEdit} />}
        </Field>
        <Field label="Адрес" error={fe.address}>
          {(p) => <input {...p} value={f.address} onChange={set("address")} readOnly={!canEdit} maxLength={300} />}
        </Field>
        <Field label="Часы работы" error={fe.hours}>
          {(p) => <input {...p} value={f.hours} onChange={set("hours")} readOnly={!canEdit} maxLength={200} />}
        </Field>
      </div>
      <ErrorBox error={act.error} />
      <Done message={act.done} />
      {canEdit ? (
        <button className="btn primary" type="submit" disabled={act.busy}>
          {act.busy ? "Сохраняем…" : "Сохранить"}
        </button>
      ) : (
        <p className="muted">Менять настройки может администратор</p>
      )}
    </form>
  );
}

function DeliveryRow({ m, canEdit }: { m: SettingsData["deliveryMethods"][number]; canEdit: boolean }) {
  const act = useAction();
  const [enabled, setEnabled] = useState(m.enabled);
  const toggle = async (next: boolean) => {
    setEnabled(next);
    const r = await act.run(() => api(`/admin/settings/delivery-methods/${m.code}`, { method: "PUT", body: { enabled: next } }), "Сохранено");
    if (!r) setEnabled(!next);
  };
  return (
    <li className="delivery">
      <label className="check">
        <input type="checkbox" checked={enabled} disabled={!canEdit || act.busy} onChange={(e) => void toggle(e.target.checked)} />
        <span>{m.label}</span>
      </label>
      {act.busy && <span className="muted">Сохраняем…</span>}
      {act.done && <span className="muted">{act.done}</span>}
      {act.error && <span className="err">{act.error.message}</span>}
    </li>
  );
}

export function Settings() {
  const { caps } = useAuth();
  const data = useLoad((signal) => api<SettingsData>("/admin/settings", { signal }), []);
  return (
    <>
      <PageHead title="Настройки" />
      {data.loading && !data.data && <Loading />}
      <ErrorBox error={data.error} onRetry={data.reload} />
      {data.data && (
        <>
          <ContactsForm initial={data.data.contacts} canEdit={caps.admin} />
          <section className="panel">
            <h2>Способы получения</h2>
            {data.data.deliveryMethods.length === 0 && <Empty>Способов пока нет</Empty>}
            <ul className="plain">
              {data.data.deliveryMethods.map((m) => (
                <DeliveryRow key={m.code} m={m} canEdit={caps.admin} />
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
