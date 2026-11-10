create schema if not exists app;
set local search_path = app;

create table site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table delivery_methods (
  code text primary key check (code in ('pickup', 'shipping', 'install')),
  label text not null,
  enabled boolean not null default true,
  sort int not null default 0
);

create table materials (
  code text primary key check (code ~ '^[a-z0-9_-]{1,40}$'),
  label text not null
);

create table vehicle_models (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,80}$'),
  make text not null,
  model text not null,
  sort int not null default 0,
  published boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,80}$'),
  code text not null unique,
  title text not null,
  position text not null check (position in ('front', 'rear', 'kit')),
  description text not null default '',
  composition text[] not null default '{}',
  material text references materials(code),
  installation text,
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden', 'archived')),
  version int not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table compatibilities (
  product_id uuid not null references products(id) on delete cascade,
  vehicle_model_id uuid not null references vehicle_models(id),
  note text,
  primary key (product_id, vehicle_model_id)
);

create table variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  vehicle_model_id uuid not null,
  title text not null,
  price_kopecks bigint check (price_kopecks > 0),
  available boolean not null default true,
  status text not null default 'active' check (status in ('active', 'hidden', 'archived')),
  sort int not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, vehicle_model_id) references compatibilities(product_id, vehicle_model_id)
);
create index variants_product_idx on variants(product_id);

create table media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  upload_path text not null,
  url text,
  variants jsonb not null default '[]',
  alt text not null default '',
  width int,
  height int,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index media_product_idx on media(product_id, sort);

create table slug_redirects (
  old_slug text primary key,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique check (email = lower(email)),
  email_verified_at timestamptz,
  phone text,
  phone_verified_at timestamptz,
  name text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  is_staff boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index users_verified_phone_idx on users(phone) where phone_verified_at is not null;

create table user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('client', 'manager', 'editor', 'admin', 'contacts_view', 'sales_confirm', 'campaigns_send')),
  granted_by uuid references users(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique,
  user_id uuid not null references users(id) on delete cascade,
  mfa_passed boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index sessions_user_idx on sessions(user_id);

create table login_challenges (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('login', 'claim', 'email_change')),
  email text not null,
  user_id uuid references users(id) on delete cascade,
  code_hmac bytea not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index login_challenges_email_idx on login_challenges(email, created_at);

create table totp_factors (
  user_id uuid primary key references users(id) on delete cascade,
  secret_enc text not null,
  confirmed_at timestamptz,
  last_used_step bigint not null default 0,
  created_at timestamptz not null default now()
);

create table recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  code_hash bytea not null,
  used_at timestamptz
);
create index recovery_codes_user_idx on recovery_codes(user_id);

create sequence lead_number_seq;

create table leads (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('lead_number_seq'),
  reference text generated always as ('AX-' || lpad(number::text, 6, '0')) stored unique,
  type text not null check (type in ('catalog', 'custom', 'general')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'offer_agreed', 'sale_confirmed', 'closed')),
  close_reason text check (close_reason in ('no_contact', 'price', 'no_solution', 'spam', 'other')),
  close_comment text,
  name text not null,
  preferred_contact text not null check (preferred_contact in ('phone', 'email')),
  phone text,
  email text,
  delivery_method text references delivery_methods(code),
  vehicle_make text,
  vehicle_model text,
  vehicle_year int,
  request text,
  message text,
  comment text,
  owner_user_id uuid references users(id),
  assignee_user_id uuid references users(id),
  source text not null default 'web',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'closed' or close_reason is not null),
  check (phone is not null or email is not null)
);
create index leads_status_idx on leads(status, created_at desc);
create index leads_assignee_idx on leads(assignee_user_id, created_at desc);
create index leads_phone_idx on leads(phone);
create index leads_email_idx on leads(email);

create table lead_items (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  variant_id uuid references variants(id),
  product_id uuid references products(id),
  product_slug text not null,
  product_title text not null,
  product_code text not null,
  variant_title text not null,
  vehicle_label text not null,
  price_from_kopecks bigint,
  quantity int not null check (quantity between 1 and 20)
);
create index lead_items_lead_idx on lead_items(lead_id);

create table lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  actor_user_id uuid references users(id),
  type text not null check (type in ('created', 'status', 'assign', 'note', 'claim', 'notify_retry')),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);
create index lead_events_lead_idx on lead_events(lead_id, created_at);

create table sales (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  client_user_id uuid references users(id),
  contact_phone text,
  contact_email text,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'refunded', 'partially_refunded')),
  source text not null default 'manual',
  external_id text,
  amount_kopecks bigint check (amount_kopecks > 0),
  refunded_kopecks bigint not null default 0 check (refunded_kopecks >= 0),
  sold_on date,
  confirmed_by uuid references users(id),
  confirmed_at timestamptz,
  version int not null default 1,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (source, external_id),
  check (status = 'draft' or (amount_kopecks is not null and sold_on is not null and external_id is not null)),
  check (amount_kopecks is null or refunded_kopecks <= amount_kopecks)
);
create unique index sales_one_draft_per_lead_idx on sales(lead_id) where status = 'draft';

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  variant_id uuid references variants(id),
  title text not null,
  quantity int not null check (quantity between 1 and 100),
  price_kopecks bigint check (price_kopecks > 0)
);

create table sale_events (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  type text not null check (type in ('created', 'confirmed', 'refund', 'edit')),
  amount_kopecks bigint,
  idempotency_key text,
  actor_user_id uuid references users(id),
  note text,
  created_at timestamptz not null default now(),
  unique (sale_id, type, idempotency_key)
);

create table outbox (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'telegram')),
  topic text not null,
  payload jsonb not null,
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'needs_review')),
  attempts int not null default 0,
  max_attempts int not null default 6,
  run_after timestamptz not null default now(),
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index outbox_due_idx on outbox(status, run_after);

create table idempotency_keys (
  scope text not null,
  key text not null,
  fingerprint text not null,
  response_status int,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  primary key (scope, key)
);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb not null default '{}',
  request_id text,
  created_at timestamptz not null default now()
);
create index audit_events_entity_idx on audit_events(entity, entity_id, created_at desc);
create index audit_events_created_idx on audit_events(created_at desc);

create table telegram_updates (
  update_id bigint primary key,
  received_at timestamptz not null default now()
);

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'app' loop
    execute format('alter table app.%I enable row level security', t.tablename);
  end loop;
end $$;
