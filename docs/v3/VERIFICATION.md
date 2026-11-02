# Verification

- `npm test -- --reporter=dot`: 60 tests passed (2026-11-02).
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui`: desktop and mobile passed (2026-11-02).
- Dependency audit previously reported zero vulnerabilities after upgrading dependencies; rerun against the current registry in CI.
- Tests use synthetic data and mocked Telegram calls. Real SePay, Telegram, migration on production data, recovery and load behavior require staging acceptance before deployment.
