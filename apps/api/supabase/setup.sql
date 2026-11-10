-- Run once per Supabase project in the SQL editor, after `pnpm --filter @armorix/api migrate`.
-- Replace API_ORIGIN and JOBS_SECRET with the real values before running.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://API_ORIGIN', 'armorix_api_origin');
select vault.create_secret('JOBS_SECRET', 'armorix_jobs_secret');

select cron.schedule(
  'armorix-run-jobs',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'armorix_api_origin') || '/api/v1/internal/jobs/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'armorix_jobs_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('catalog', 'catalog', true) on conflict (id) do nothing;
