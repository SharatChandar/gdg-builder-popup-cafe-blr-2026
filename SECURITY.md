# Security

## Reporting an issue

Report vulnerabilities privately to the repository owner. Use a private GitHub security advisory if private reporting is enabled for this repository. Do not put exploitable details, credentials, customer data, or payment links in a public issue.

Include affected behavior, reproduction steps using synthetic data, impact, and any proposed fix. This project does not promise a response-time SLA.

## Credentials and private data

- Store deployed credentials in Google Secret Manager. Use ignored environment files only for local development.
- Keep Gemini, Stripe, Twilio, database, session, and staff credentials server-side. Never use frontend environment variables for secrets.
- Firebase web configuration is public; restrict its API key to the required authentication services and configure authorized domains and SMS regions.
- Generated staff passwords, Firebase setup output, and local databases belong under the ignored `.data/` directory.
- Use the runtime service account and Application Default Credentials instead of committing service-account JSON keys.
- If a secret is accidentally published, revoke or rotate it at the provider and remove it from repository history. Deleting it from the latest file alone is insufficient.

Git, Docker, and Cloud Build ignore rules exclude common credential and generated-file paths. Those rules are a safeguard, not a substitute for reviewing staged files before pushing.

## Implemented safeguards and pilot limits

The app uses signed HTTP-only sessions, server-side staff permissions, transaction-protected updates, trusted server pricing, signed scoped payment links, and Stripe webhook verification. AI output is checked against the available menu. Media uploads are not persisted by the app.

This is a single-café MVP. Rate limits are per process, sessions do not have an administrative revocation UI, and the audit trail is limited. Before a larger rollout, review threat models, distributed rate limiting, retention policies, monitoring, backups, provider configuration, and dependency updates.
