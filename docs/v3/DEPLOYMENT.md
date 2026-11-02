# Configuration, migration and recovery

## Install and test

Use Node 24. `npm ci --ignore-scripts`, `npm test`, `npx playwright install chromium`, `npm run test:ui`, `npm audit --audit-level=high`. Development tests use synthetic data and mocked Telegram sends. Never use production credentials in tests or the UI fixture.

Copy `.env.example` to `.env` outside version control. Set the bot token, private admin Telegram ID, bank details, independent admin and SePay webhook keys (at least 32 characters each), Telegram webhook secret, and a 32-byte encryption key encoded as 64 hex characters. `openssl rand -hex 32` can generate each secret. Keep the encryption key in the deployment secret store and a separate protected offline recovery location. Lost keys mean lost data. Do not rotate DATA_ENCRYPTION_KEY without a deliberate decrypt/re-encrypt operation and verified backups.

Configure SePay **API Key** authentication and exactly the same SEPAY_WEBHOOK_KEY. Supported provider header is `Authorization: Apikey <key>`; see https://docs.sepay.vn/tich-hop-webhooks.html (checked 2026-11-01). The outgoing SEPAY_API_KEY is a different REST API credential. Set the incoming bank account correctly. In staging, verify a real low-value transfer, wrong account, duplicate callback, restart and stock exhaustion before considering production. This repository's automated tests do not prove provider configuration.

Use one process, one replica, persistent DB_PATH on a local volume and TLS. Never run seed against live data. Seed now requires NODE_ENV=test and a new DB_PATH. In Railway set RAILWAY_PUBLIC_DOMAIN and deploy with persistent storage; this activates `/telegram-webhook` with `X-Telegram-Bot-Api-Secret-Token`. Outside Railway the default is long polling: remove any old webhook before enabling polling for the same token. The health endpoint is `/`; admin is `/admin.html`.

## Migration

Stop the previous application and disable incoming payments during the maintenance window. Make a verified backup with the old application offline. Start v3 on a **copy** first. It accepts legacy plaintext sql.js databases, runs existing additive column migrations and `migrations/003-shopbot.sql`, then writes encrypted snapshots. The pre-v3 copy is saved as `DB_PATH.pre-v3`, encrypted when a key is configured. No business rows are deleted by the v3 migration. Historical checker quota cleanup is retained.

Inspect pending/paid/delivering legacy orders and previously assigned credentials before turning payments back on. Old versions did not persist in-flight delivery attempts, so ambiguous pre-upgrade sends require manual reconciliation. Existing cancelled/expired orders are never automatically reopened. Keep legacy backups until reconciliation is complete. The old app cannot read encrypted v3 snapshots.

The lock `DB_PATH.lock` deliberately remains after an unclean exit. Confirm no bot process is running before removing this lock manually. Never auto-delete a lock simply because deployment wants to start: it protects against double writers. Normal SIGTERM/SIGINT shutdown releases it.

## Backup and restore

`npm run backup` creates an independently encrypted complete snapshot in BACKUP_DIR with restrictive permissions and verifies SQLite integrity first. Schedule this command on the host at the required RPO; copy backups to an existing protected offline destination. This task does not create paid storage or upload sensitive data. Retain daily backups and pre-upgrade backups according to your retention policy; rotation is operator-managed to avoid deleting the only recovery copy.

Verify with `node scripts/verify-backup.js /path/to/backup.db`. Restore rehearsal: copy a verified backup to a **new temporary DB_PATH** and use the same encryption key; run against a test bot only, inspect orders/ledger/allocations, and never register a production webhook from the rehearsal. For a real restore, stop all writers and payment ingress, preserve the current database, verify the backup, atomically replace DB_PATH and reconcile bank/Telegram events since the backup time before resuming. Never restore an old snapshot and immediately replay payments: the restored ledger may predate accepted transactions.

## Rollback

Before live traffic, rollback can use the untouched original backup plus the original app. `003-rollback.sql` removes only new schema objects and must be run offline **only if all v3 tables are empty**. Once payment_ledger, delivery_jobs, support tickets, account snapshots or audit records exist, do not execute this SQL. Keep v3 schema and forward-fix, or export/reconcile these records with an operator-reviewed rollback plan. Do not drop replay protection or return allocated credentials to inventory. This task does not execute a production rollback.

## Operations

Paid/ready delivery recovery runs every minute. `sending` or `review` requires operator review and the explicit Deliver/retry action. Confirm the customer and existing allocations before retrying. Manual completion only completes manual jobs; it does not bypass credential delivery review. Cancel/delete never returns disclosed credentials to stock. Refunds remain an external operator procedure.

Admin key changes require operator re-login. Rate limit is 120 requests/minute per peer IP, in memory; configure a known trusted proxy explicitly if per-client limits are needed behind a shared proxy. API responses are no-store. Review audit logs regularly. Public link checking is disabled by default, uses only explicitly allowed HTTPS hosts, IPv4 public addresses, no redirects and no paid scraper integration.

Current limits: whole-database synchronous snapshots, no distributed workers, single admin role, bounded reconciliation batch, per-order (earliest) renewal date for mixed carts, Telegram messages limited by Telegram's message size, and no live provider or production load test. Do not call this deployment approved until staging acceptance is complete.
