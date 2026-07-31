# Architecture

## Runtime boundaries

- Next.js, pure-admin, and Flutter clients use the same versioned NestJS API.
- NestJS validates application and user context, persists domain messages through Prisma, and streams LangGraph.js output over SSE.
- LangGraph checkpoints live in a dedicated PostgreSQL `langgraph` schema; Prisma owns domain tables in `public`.
- BullMQ workers handle PDF/URL ingestion, embeddings, feedback extraction, requirement clustering, and manual report generation.
- Original uploads use S3-compatible storage. Knowledge chunks and vectors live in PostgreSQL with pgvector.

## Trust boundaries

- A publishable app key identifies branding but never authorizes privileged actions.
- Host backends exchange a server credential for short-lived feedback tokens; server credentials are never embedded in Flutter.
- The Web stores access and refresh sessions in secure HttpOnly cookies. Flutter stores feedback tokens using platform secure storage.
- Every query is scoped by a server-validated `appId`, including vector search and background jobs.

## MVP boundaries

The first release excludes live human takeover, external notifications, scheduled reports, OCR, recursive crawling, voice, and message attachments. Unresolved conversations remain in an administrator queue with internal notes and status changes.
