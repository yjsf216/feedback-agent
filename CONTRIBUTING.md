# Contributing to Feedback Agent

Thanks for helping make product feedback easier to act on. Focused bug fixes,
integration examples, tests, documentation, and well-scoped product
improvements are welcome.

## Before you start

- Search existing issues and Discussions before opening a new one.
- Open an issue first for architecture changes, schema changes, new providers,
  or broad UI redesigns.
- Never include real conversations, customer exports, credentials, private
  URLs, or screenshots containing personal information.
- Report security problems privately through [SECURITY.md](SECURITY.md).

## Development setup

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm infra:up
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Use Node.js 22.13–26 and pnpm 11. Flutter changes use Flutter 3.44.2 through
FVM in local development.

## Required checks

Run the checks relevant to your change:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm sdk:analyze
pnpm sdk:test
```

Also validate the production Compose configuration when changing deployment
files:

```sh
cp .env.production.example .env.production
pnpm prod:config
```

## Pull requests

- Keep one coherent change per pull request.
- Use Conventional Commit-style subjects such as feat:, fix:, docs:, or chore:.
- Explain the user impact, security implications, schema or environment
  changes, and verification performed.
- Add or update tests for behavior changes.
- Preserve app ID isolation and the human-approval boundary for AI-generated
  requirements.
- Retain third-party copyright and license notices.

## Contribution license

Unless explicitly stated otherwise, contributions intentionally submitted to
this repository are licensed under Apache-2.0 as described in section 5 of the
Apache License. The MIT-licensed pure-admin-derived files remain subject to
their preserved notice in apps/admin/LICENSE.
