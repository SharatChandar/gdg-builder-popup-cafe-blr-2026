# Contributing

## Local development

Use Node.js 22, run `npm ci`, copy `.env.example` to `.env`, and start `npm run dev`. Local demo mode uses PGlite and requires no cloud credentials. See [README.md](README.md) for live integrations.

Keep changes scoped to the feature or defect being addressed. Follow the existing React/Express style and format edited JavaScript/JSX files with Prettier. Avoid reformatting unrelated files.

## Validation

Before opening a pull request:

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
node tests/live-server.mjs
```

Use focused tests for business rules, authorization, persistence, and regressions. Check guest and staff screens at mobile widths for UI changes. AR camera placement also needs manual verification on compatible hardware; browser mocks do not prove tracking works on a phone.

## Data and integration changes

- Preserve existing orders, visits, bills, and account data when introducing new fields. Make startup migrations repeatable.
- Compute prices, permissions, and payment state on the server. Never accept client-calculated totals or AI-generated prices.
- AI suggestions must remain drafts that users review. Do not let AI calls place orders, send messages, or settle payments.
- Keep provider failures explicit. Never add simulated activity to live mode.
- Use temporary databases and synthetic credentials in tests. Do not send real SMS or create production orders as part of CI.

## Pull requests

Explain the problem, resulting behavior, and validation performed. Include relevant screenshots for UI changes only after checking that they contain no personal data or credentials. Document new configuration variables in `.env.example` with blank secret values and update the relevant README or feature-guide section.

Never commit `.env`, `.data`, generated credentials, service-account keys, logs, database dumps, or build artifacts. See [SECURITY.md](SECURITY.md) before reporting a vulnerability.
