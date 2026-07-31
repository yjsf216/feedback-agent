# Feedback Agent

Feedback Agent is a reusable, multi-application AI support and feedback intelligence platform. Products can integrate through a Flutter SDK or direct API, while users without an installed app can use a branded Web conversation page.

The platform answers product questions from an app-scoped knowledge base, detects feedback, extracts pain points, groups related feedback into requirement drafts, and places unresolved conversations in an administrator queue.

## Planned surfaces

- `apps/api`: NestJS API and LangGraph.js conversation runtime
- `apps/worker`: background ingestion, extraction, clustering, and report jobs
- `apps/web`: Next.js public landing and app-specific conversation pages
- `apps/admin`: pure-admin-thin management console
- `packages/flutter_sdk`: reusable Flutter client and customizable chat UI

## Local prerequisites

- Node.js 22.13–26 and pnpm 11+
- FVM with Flutter 3.44.2
- OrbStack or Docker Desktop with Docker Compose

Copy `.env.example` to `.env` only on your machine, then start infrastructure with `pnpm infra:up`. Detailed setup will be added as each milestone lands.
