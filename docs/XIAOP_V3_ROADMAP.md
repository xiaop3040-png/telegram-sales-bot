# XiaoP Shop v3 — Security-first roadmap

This branch is the initial foundation for a customized Telegram digital-goods storefront. It is not production-ready.

## Implemented
- Atomic database snapshot replacement (temporary file + rename).
- Transactional order + order-item creation.
- Baseline HTTP response headers and JSON request-size limit.

## Required before production
1. Authenticate SePay webhooks with provider-supported verification and fail closed when not configured.
2. Introduce a unique payment transaction ledger, atomic pending-to-paid transition, and replay-safe reconciliation.
3. Reserve credentials transactionally before Telegram delivery; add retry/recovery states.
4. Use separate admin API credentials, never accept credentials in query strings, and implement rate limits.
5. Add backup rotation, disaster recovery and secret management.
6. Build a responsive admin UI with design tokens, accessible components, order-status timeline, and mobile-first inventory views.

## Verification
No CI or end-to-end tests have been run for this branch. Review database transaction and file-system behavior on the deployment platform before merging.
