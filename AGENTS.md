# Feedback Agent project conventions

- This directory is an independent Git repository. Keep commits milestone-based, focused, and local unless the user explicitly asks to push.
- Use `pnpm` for all TypeScript packages and FVM Flutter 3.44.2 for the Dart SDK.
- The backend stack is NestJS + Prisma + PostgreSQL/pgvector + Redis/BullMQ. LangGraph.js runs inside NestJS; do not add a Python agent service.
- Every domain query must be scoped by a server-validated `appId`. Never trust an `appId` from a client without checking the credential or administrator session.
- Keep secrets server-side and out of Git, browser bundles, Flutter assets, logs, fixtures, and screenshots.
- Public Web UI follows `docs/frontend-design.md`. Admin UI starts from the non-i18n TypeScript `pure-admin-thin` main branch and preserves its license notice.
- User-facing UI must cover empty, loading, streaming, retry, error, rate-limit, resolved, and unresolved states in both Chinese and English.
- Use semantic color tokens, Lucide-compatible line icons for the public Web, and no emoji as product icons.
- Before each milestone commit, run the checks available for that milestone, inspect `git status` and the raw diff, and exclude generated output and credentials.
