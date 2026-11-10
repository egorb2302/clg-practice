import type { Db } from "../db";

export async function audit(
  db: Db,
  actor: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  data: Record<string, unknown> = {},
) {
  await db`
    insert into audit_events (actor_user_id, action, entity, entity_id, data)
    values (${actor}, ${action}, ${entity}, ${entityId}, ${db.json(data as never)})`;
}
