import { deliveryMethodCodes, grants, staffRoles } from "@armorix/contracts";
import { Router } from "express";
import { z } from "zod";
import type { Deps } from "../../deps";
import { HttpError, notFound, parse } from "../../http/errors";
import { authOf, requireStaff } from "../../security/session";
import { audit } from "../../services/audit";
import { enqueue, kick } from "../../services/outbox";
import { normalizeEmail } from "../../util";

const staffRoleValues = [...staffRoles, ...grants] as const;
const rolesSchema = z.array(z.enum(staffRoleValues)).min(1).max(6);

const inviteBody = z.object({
  email: z.email().max(254),
  name: z.string().trim().min(1).max(80),
  roles: rolesSchema,
});

const contactsBody = z.object({
  phone: z.string().trim().max(40).optional(),
  email: z.email().max(254).optional(),
  telegram: z.url().max(200).optional(),
  address: z.string().trim().max(300).optional(),
  hours: z.string().trim().max(200).optional(),
});

export function adminSystemRoutes(deps: Deps) {
  const r = Router();
  const admin = requireStaff("users_manage");

  r.get("/admin/users", admin, async (_req, res) => {
    const items = await deps.sql`
      select u.id, u.email, u.name, u.status, u.created_at as "createdAt",
        coalesce(array(select role from user_roles r where r.user_id = u.id order by role), '{}') as roles,
        exists (select 1 from totp_factors f where f.user_id = u.id and f.confirmed_at is not null) as "mfaEnrolled"
      from users u where u.is_staff order by u.created_at`;
    res.json({ items });
  });

  r.post("/admin/users", admin, async (req, res) => {
    const b = parse(inviteBody, req.body);
    const email = normalizeEmail(b.email);
    const actor = authOf(res).user.id;
    const result = await deps.sql.begin(async (tx) => {
      const [existing] = await tx`select id from users where email = ${email}`;
      if (existing) throw new HttpError(409, "CONFLICT", "Пользователь с таким email уже есть");
      const [u] = await tx<{ id: string }[]>`
        insert into users (email, name, is_staff) values (${email}, ${b.name}, true) returning id`;
      for (const role of new Set(b.roles)) {
        await tx`insert into user_roles (user_id, role, granted_by) values (${u!.id}, ${role}, ${actor})`;
      }
      const jobIds = await enqueue(tx, [
        {
          channel: "email",
          topic: "staff.invite",
          dedupeKey: `invite:${u!.id}`,
          payload: {
            to: email,
            subject: "Доступ к админке ARMORIX",
            text: [
              `${b.name}, вам открыт доступ к админке ARMORIX.`,
              `Вход: ${deps.cfg.SITE_URL}/admin/login`,
              "Войдите по коду на этот email и подключите приложение-аутентификатор.",
            ].join("\n"),
          },
        },
      ]);
      await audit(tx, actor, "user.invite", "user", u!.id, { roles: b.roles });
      return { id: u!.id, jobIds };
    });
    kick(deps, result.jobIds);
    res.status(201).json({ id: result.id });
  });

  r.put("/admin/users/:id/roles", admin, async (req, res) => {
    const roles = parse(z.object({ roles: rolesSchema }), req.body).roles;
    const id = String(req.params.id);
    const actor = authOf(res).user.id;
    if (id === actor && !roles.includes("admin")) {
      throw new HttpError(409, "CONFLICT", "Нельзя снять роль администратора с себя");
    }
    await deps.sql.begin(async (tx) => {
      const [u] = await tx`select id from users where id = ${id} and is_staff`;
      if (!u) throw notFound("Сотрудник не найден");
      await tx`delete from user_roles where user_id = ${id}`;
      for (const role of new Set(roles)) {
        await tx`insert into user_roles (user_id, role, granted_by) values (${id}, ${role}, ${actor})`;
      }
      await tx`update sessions set revoked_at = now() where user_id = ${id} and revoked_at is null and ${id !== actor}`;
      await audit(tx, actor, "user.roles", "user", id, { roles });
    });
    res.json({ id, roles });
  });

  r.post("/admin/users/:id/:action", admin, async (req, res) => {
    const id = String(req.params.id);
    const action = String(req.params.action);
    if (!["disable", "enable", "reset-totp"].includes(action) || !z.uuid().safeParse(id).success) throw notFound();
    const actor = authOf(res).user.id;
    if (id === actor) throw new HttpError(409, "CONFLICT", "Это действие нельзя применить к себе");
    await deps.sql.begin(async (tx) => {
      const [u] = await tx`select id from users where id = ${id} and is_staff`;
      if (!u) throw notFound("Сотрудник не найден");
      if (action === "disable") await tx`update users set status = 'disabled' where id = ${id}`;
      if (action === "enable") await tx`update users set status = 'active' where id = ${id}`;
      if (action === "reset-totp") {
        await tx`delete from totp_factors where user_id = ${id}`;
        await tx`delete from recovery_codes where user_id = ${id}`;
      }
      if (action !== "enable") await tx`update sessions set revoked_at = now() where user_id = ${id} and revoked_at is null`;
      await audit(tx, actor, `user.${action}`, "user", id);
    });
    res.json({ id, action });
  });

  r.get("/admin/jobs", requireStaff("jobs_manage"), async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "failed";
    const items = await deps.sql`
      select id, channel, topic, status, attempts, last_error as "lastError", run_after as "runAfter",
        created_at as "createdAt", sent_at as "sentAt"
      from outbox where status = ${status} order by created_at desc limit 200`;
    res.json({ items });
  });

  r.post("/admin/jobs/:id/retry", requireStaff("jobs_manage"), async (req, res) => {
    const id = String(req.params.id);
    if (!z.uuid().safeParse(id).success) throw notFound();
    const rows = await deps.sql<{ id: string }[]>`
      update outbox set status = 'pending', attempts = 0, run_after = now(), last_error = null
      where id = ${id} and status in ('failed', 'needs_review') returning id`;
    if (rows.length === 0) throw notFound("Задача не найдена или уже в работе");
    await audit(deps.sql, authOf(res).user.id, "job.retry", "outbox", id);
    kick(deps, [id]);
    res.json({ id, status: "pending" });
  });

  r.get("/admin/audit", requireStaff("audit_view"), async (req, res) => {
    const entity = typeof req.query.entity === "string" ? req.query.entity : undefined;
    const entityId = typeof req.query.entityId === "string" ? req.query.entityId : undefined;
    const items = await deps.sql`
      select a.action, a.entity, a.entity_id as "entityId", a.data, a.created_at as "createdAt",
        u.name as "actorName", u.email as "actorEmail"
      from audit_events a left join users u on u.id = a.actor_user_id
      where true
        ${entity ? deps.sql`and a.entity = ${entity}` : deps.sql``}
        ${entityId ? deps.sql`and a.entity_id = ${entityId}` : deps.sql``}
      order by a.created_at desc limit 200`;
    res.json({ items });
  });

  r.get("/admin/settings", requireStaff(), async (_req, res) => {
    const [contacts] = await deps.sql`select value from site_settings where key = 'contacts'`;
    const deliveryMethods = await deps.sql`select code, label, enabled, sort from delivery_methods order by sort`;
    res.json({ contacts: contacts?.value ?? {}, deliveryMethods });
  });

  r.put("/admin/settings/contacts", admin, async (req, res) => {
    const b = parse(contactsBody, req.body);
    await deps.sql`
      insert into site_settings (key, value) values ('contacts', ${deps.sql.json(b)})
      on conflict (key) do update set value = excluded.value, updated_at = now()`;
    await audit(deps.sql, authOf(res).user.id, "settings.contacts", "settings", "contacts");
    res.json(b);
  });

  r.put("/admin/settings/delivery-methods/:code", admin, async (req, res) => {
    const code = parse(z.enum(deliveryMethodCodes), req.params.code);
    const b = parse(z.object({ enabled: z.boolean(), label: z.string().trim().min(1).max(100).optional() }), req.body);
    const rows = await deps.sql`
      update delivery_methods set enabled = ${b.enabled}, label = coalesce(${b.label ?? null}, label)
      where code = ${code} returning code, label, enabled`;
    if (rows.length === 0) throw notFound();
    await audit(deps.sql, authOf(res).user.id, "settings.delivery", "delivery_method", code, b);
    res.json(rows[0]);
  });

  return r;
}
