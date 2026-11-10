set local search_path = app;

create table identities (
  provider text not null check (provider in ('telegram')),
  subject text not null,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider, subject)
);
create index identities_user_idx on identities(user_id);

create table oidc_nonces (
  nonce_hash bytea primary key,
  purpose text not null check (purpose in ('login', 'link')),
  session_id uuid references sessions(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table loyalty_rules (
  id uuid primary key default gen_random_uuid(),
  program text not null check (program in ('welcome')),
  version int not null,
  points int not null check (points > 0),
  confirm_days int not null default 30 check (confirm_days > 0),
  points_ttl_days int check (points_ttl_days > 0),
  kopecks_per_point int not null default 100 check (kopecks_per_point > 0),
  redeem_limit_pct int not null default 20 check (redeem_limit_pct between 1 and 100),
  active boolean not null default true,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (program, version)
);
create unique index loyalty_rules_one_active_idx on loyalty_rules(program) where active;

create table loyalty_awards (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  rule_id uuid not null references loyalty_rules(id),
  program text not null,
  user_id uuid references users(id),
  points int not null check (points > 0),
  status text not null check (status in ('pending', 'credited', 'ineligible')),
  confirm_deadline timestamptz not null,
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  unique (lead_id, rule_id)
);
create index loyalty_awards_status_idx on loyalty_awards(status, confirm_deadline);

create table loyalty_program_claims (
  user_id uuid not null references users(id) on delete cascade,
  program text not null,
  award_id uuid not null references loyalty_awards(id),
  created_at timestamptz not null default now(),
  primary key (user_id, program)
);

create table loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('earn', 'redeem', 'reverse', 'expire', 'adjust')),
  points int not null check (points <> 0),
  award_id uuid references loyalty_awards(id),
  sale_id uuid references sales(id),
  rule_id uuid references loyalty_rules(id),
  op_key text not null unique,
  reason text,
  actor_user_id uuid references users(id),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check ((type in ('earn') and points > 0) or (type in ('redeem', 'expire') and points < 0) or type in ('reverse', 'adjust'))
);
create index loyalty_ledger_user_idx on loyalty_ledger(user_id, created_at);

create table loyalty_expiry_checks (
  earn_id uuid primary key references loyalty_ledger(id) on delete cascade,
  checked_at timestamptz not null default now()
);

alter table sales add column redeemed_points int not null default 0 check (redeemed_points >= 0);
alter table sales add column offer_id uuid;
alter table sales add column offer_rule_version int;

create table posts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('offer', 'news')),
  slug text not null check (slug ~ '^[a-z0-9-]{1,80}$'),
  title text not null,
  summary text not null default '',
  body text not null default '',
  cover_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, slug),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table offer_rules (
  post_id uuid primary key references posts(id) on delete cascade,
  rule_version int not null default 1,
  min_purchases int check (min_purchases >= 1),
  product_ids uuid[] not null default '{}',
  combinable boolean not null default false,
  benefit text not null default ''
);

alter table sales add constraint sales_offer_fk foreign key (offer_id) references posts(id);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  user_id uuid references users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'active', 'unsubscribed')),
  consent_text_version text not null,
  source text not null,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table consent_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  type text not null check (type in ('subscribe', 'confirm', 'unsubscribe')),
  text_version text,
  source text,
  created_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body_text text not null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'done', 'cancelled')),
  scheduled_at timestamptz,
  created_by uuid references users(id),
  scheduled_by uuid references users(id),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaign_deliveries (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'accepted', 'rejected', 'skipped', 'needs_review')),
  outbox_id uuid references outbox(id),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, subscription_id)
);
create index campaign_deliveries_outbox_idx on campaign_deliveries(outbox_id);

do $$
declare t text;
begin
  foreach t in array array['identities', 'oidc_nonces', 'loyalty_rules', 'loyalty_awards', 'loyalty_program_claims',
    'loyalty_ledger', 'loyalty_expiry_checks', 'posts', 'offer_rules', 'subscriptions', 'consent_events', 'campaigns', 'campaign_deliveries'] loop
    execute format('alter table app.%I enable row level security', t);
  end loop;
end $$;
