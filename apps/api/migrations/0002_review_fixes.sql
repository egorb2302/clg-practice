set local search_path = app;

alter table compatibilities add column if not exists active boolean not null default true;
alter table outbox add column if not exists lease_token uuid;

create table if not exists email_budget (
  day date primary key,
  used int not null default 0 check (used >= 0)
);

create table if not exists monitor_runs (
  day date primary key,
  ran_at timestamptz not null default now()
);

alter table email_budget enable row level security;
alter table monitor_runs enable row level security;
