# ARMORIX — release, rollback and restore

Commands run from the repository root in Git Bash unless noted. Connection strings and keys live in the Vercel project env and in the maintainer's local secret file; never paste them into issues or chat.

## Environments

| Piece | Production | Staging |
| --- | --- | --- |
| Site | Vercel `armorix-web` → https://armorix-web.vercel.app | Vercel preview deployments of `armorix-web` |
| API and admin | Vercel `armorix-api` → https://armorix-api.vercel.app | Vercel preview deployments of `armorix-api` |
| Database and storage | Supabase `armorix-prod` | Supabase `armorix-staging` |

Until the public launch the Vercel production env points at `armorix-staging` (see `STATUS.md`). After the switch, update the `DATABASE_BACKUP_URL`, `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` GitHub secrets to the prod project as well.

## Release

1. CI must be green on the branch: lint, typecheck, API tests against Postgres, admin and site builds (`.github/workflows/ci.yml`).
2. If the release adds a migration in `apps/api/migrations/`, check it on a copy of the live schema first (see "Restore drill" below: restore, then run the migration against the copy).
3. Apply the migration to the live database before the code that needs it ships. Use the session pooler (port 5432), not the transaction pooler:

   ```bash
   DATABASE_MIGRATION_URL='<session pooler URL>' pnpm --filter @armorix/api migrate
   ```

   Migrations are forward-only and additive where possible, so the code that is still live keeps working on the new schema.
4. Push to `main`. Both Vercel projects build and deploy from it; the deployment becomes production when its build passes.
5. Check after deploy: `/`, `/catalog`, a product page and `/admin` answer 200; `GET /api/v1/meta` answers 200; the Vercel runtime log of `armorix-api` shows no `level":"error` lines for the first requests.

Release 2 features ship dark: every `FEATURE_*` env var stays `false` until it is switched on in the `armorix-api` env, followed by a redeploy.

## Rollback

- **Code.** In the Vercel dashboard open the project → Deployments, pick the last good production deployment → "Instant Rollback". Do it for `armorix-api` and/or `armorix-web` separately. A rollback does not touch the database. A later push to `main` deploys again, so revert the bad commit with `git revert` before the next push.
- **Feature flag.** Set the `FEATURE_*` variable back to `false` in `armorix-api` and redeploy. Data written while the flag was on stays in the database.
- **Migration.** Never edit or delete an applied migration. Undo a schema change with a new compensating migration. If a migration destroyed data, restore from backup (below) into a scratch database and copy the affected rows back, or restore the whole schema during a maintenance window.

## Backups

- `.github/workflows/backup.yml` runs daily at 01:15 UTC and on manual dispatch (Actions → backup → Run workflow). It is enabled by the repository variable `BACKUP_ENABLED=true`.
- Each run dumps the `app` schema (`pg_dump --format=custom`), downloads the `catalog` and `uploads` buckets, packs both and encrypts the archive with GPG AES-256 using the `BACKUP_PASSPHRASE` secret. The artifact `armorix-backup` is kept for 30 days.
- A failed run shows up as a GitHub Actions failure notification to the repository owner.
- The passphrase is also kept in the maintainer's local secret file. Without it the archives cannot be opened.

## Restore drill

Run before a release with a migration and at least once a month. Verified 2026-11-12 on `armorix-staging`: 42 tables, row counts identical, migrations up to date on the copy, about 45 seconds for the restore.

1. Download the latest `armorix-backup` artifact from the backup workflow run and decrypt it:

   ```bash
   gpg --batch --pinentry-mode loopback --passphrase '<BACKUP_PASSPHRASE>' --decrypt --output armorix.tar.gz armorix-<stamp>.tar.gz.gpg && tar -xzf armorix.tar.gz
   ```

2. Create a scratch database in the staging project (Supabase SQL editor): `create database restore_drill;`
3. Restore into it through the staging session pooler, with the database name `restore_drill` in the URL:

   ```bash
   pg_restore --dbname '<staging session pooler URL with /restore_drill>' --no-owner --no-privileges --exit-on-error backup/armorix.dump
   ```

4. Compare row counts of a few tables (`leads`, `products`, `sales`, `users`) with the source, and run a pending migration against the copy with `DATABASE_MIGRATION_URL` set to the same URL.
5. Media: `backup/media/catalog/*` and `backup/media/uploads/*` mirror the bucket paths; upload them back with the Supabase dashboard or the storage API if needed.
6. Drop the scratch database: `drop database restore_drill with (force);`, and delete the local `backup/` folder and archive, which contain customer data.

## Full restore after data loss

1. Put the site into a safe state: set `FEATURE_*` flags to `false`, and expect lead submissions to fail while the database is restored.
2. Restore the dump into the production project's `app` schema after renaming the damaged one (`alter schema app rename to app_damaged;`), using the same `pg_restore` command against the production session pooler URL.
3. Re-run `apps/api/supabase/setup.sql` if `pg_cron` jobs or Vault secrets were lost.
4. Check `/api/v1/meta`, the catalog, one test lead and the admin login, then drop `app_damaged` once the restore is confirmed.

Targets from the spec: at most one day of lost data, restore within four hours.
