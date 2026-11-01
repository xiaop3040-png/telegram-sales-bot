# XiaoP ShopBot v3 audit

Baseline: main 8dc077a; foundation 9891fee. Audit date: 2026-11-01.
Inventory includes all 80 tracked files, including the Pencil design, legacy specifications and lockfile. Runtime implementation is CommonJS Node/Express/node-telegram-bot-api/sql.js; specifications describing Prisma, multi-tenant RBAC, USDT pollers and PayPal webhook handlers do not represent shipped code. Static UI uses inline JavaScript and external fonts. No existing CI workflow was found. No production data or secrets were accessed.

## Findings at baseline

| ID | Severity | Evidence / consequence | Remediation |
|---|---|---|---|
| S01 | Critical | webhookHandler trusts unauthenticated JSON; secret URL is not authentication | SePay API Key authentication, fail closed |
| S02 | Critical | webhook/poller independently mark paid; no persistent transaction uniqueness | One ledger and compare-and-set transaction |
| S03 | Critical | deliveryHandler selects stock, awaits Telegram, then marks sold | Reserve stock before I/O, durable delivery jobs |
| S04 | Critical | Admin API compares undefined key to undefined config; query-string keys; shared SePay secret | Independent required header key, constant-time compare, limiter, audit |
| S05 | High | customer email/product/category strings interpolated into admin innerHTML and onclick | DOM textContent, external scripts and strict CSP |
| S06 | High | order detail/cancel callbacks do not check purchaser | Check ownership and private chat |
| S07 | High | invite/preorder completion callback lacks actor/state verification | Integrate security branch and enforce state transitions |
| S08 | High | cart delivery uses first product_id with sum(quantity) | Deliver persisted order_items separately |
| S09 | High | plaintext DB/backups; no process lock; snapshot not fsynced; failure leaves live memory modified | Encrypted snapshots, process lock, durable transaction wrapper |
| S10 | High | public link checker can fetch internal hosts/redirects; trusts X-Forwarded-For; quota increment after await; paid scraper over HTTP | Disable public execution by default; safe outbound allowlist and explicit paid-provider opt-in |
| S11 | High | deleting delivered manual orders releases already disclosed credentials | Never return allocated credentials to stock automatically |
| S12 | High | negative/fractional quantities; stale prices; unrestricted update SQL column interpolation | Validate quantities/prices at persistence boundary; allowlist columns |
| S13 | Medium | delivering revenue omitted; invite/preorder stock ignores delivering/cart lines | Count all paid states and per-item consumption |
| S14 | Medium | seed deletes data; migration swallows every error; no rollback/runbook | Refuse seed on existing DB; versioned additive migration and safe rollback rules |
| S15 | Medium | API key persisted in localStorage; Telegram token embedded in webhook URL and logs | Memory-only admin login; Telegram secret header |
| S16 | Medium | existing tests primarily manual-order helpers, some catch-only tests can falsely pass | Real HTTP, DB restart, replay/race, failure-injection regressions |
| S17 | Medium | discount auto-apply skips membership; cart discount uses first product price; limits race | Consistent eligibility and checkout validation |

## Existing branches / PR decision

PR #1 is a draft containing atomic rename, transactional cart inserts and headers. Retain these concepts but strengthen durability and recovery. Its only review comment says automated review skipped drafts; no completed security approval is claimed. `security/harden-delivery-callbacks` (8f546e2) correctly restricts actor/chat and delivering state. `fix/sepay-poller-validation` correctly rejects outgoing transfers and partial order tokens, but batch-local deduplication is insufficient across restarts/webhook races. Integrate behavior with persistent ledger rather than merging unrelated README history.

## Architecture and deployment boundary

Keep existing single-shop schema compatible. Introduce services for payment acceptance, allocation and delivery; synchronous database transactions complete before any network await. A unique provider transaction ID can settle only one order. Allocation is durable and never automatically released after possible disclosure. Telegram cannot guarantee exactly-once message delivery: a timeout/crash after send is ambiguous and requires operator review; retries reuse allocations.

sql.js retains the complete DB in memory and exports snapshots on writes. This release must run one process/one replica on a persistent local volume. Horizontal scaling requires a transactional database and queue migration. TLS termination, secrets, volume backup and external provider staging verification are deployment prerequisites, not resources created by this task.

Historical documents remain for reference; docs/v3 describes current implementation. Test evidence and remaining limitations are recorded separately as implementation progresses.
