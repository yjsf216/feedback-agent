# Security policy

## Supported versions

Feedback Agent is currently pre-1.0. Security fixes are applied to the main
branch and, after releases begin, to the latest release only. Older snapshots
may not receive patches.

## Report a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/yjsf216/feedback-agent/security/advisories/new).
Do not open a public issue for authentication bypasses, cross-app data access,
credential exposure, remote code execution, injection, or vulnerabilities
involving real user data.

Include the affected component and version or commit, reproduction steps,
impact, and a minimal proof of concept. Remove API keys, production URLs,
personal information, conversation content, and customer data before sending.

We aim to acknowledge a report within seven days and will coordinate a fix
and disclosure when the issue is confirmed. These are best-effort targets,
not a service-level agreement.

## Security boundaries

- Every domain operation must use a server-validated app ID.
- App secrets, signing credentials, and model keys belong on trusted servers.
- Production deployments must use HTTPS and exact CORS origins.
- PostgreSQL, Redis, MinIO, and the MinIO console must not be exposed directly
  to the public internet.
- AI-generated requirement drafts require human approval.

See [docs/deployment.md](docs/deployment.md) for production controls.
