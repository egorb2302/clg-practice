set local search_path = app;

create or replace function loyalty_ledger_immutable() returns trigger
language plpgsql set search_path = app as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'loyalty_ledger rows are append-only; add a compensating entry instead' using errcode = '55000';
end $$;

create trigger loyalty_ledger_append_only
  before update or delete on loyalty_ledger
  for each row execute function loyalty_ledger_immutable();

alter table offer_rules add column variant_ids uuid[] not null default '{}';
update offer_rules r set variant_ids = coalesce(
  (select array_agg(v.id order by v.id) from variants v where v.product_id = any(r.product_ids)), '{}')
  where cardinality(r.product_ids) > 0;
alter table offer_rules drop column product_ids;

alter table oidc_nonces add column binder_hash bytea;
