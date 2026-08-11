# Feedback Agent Worker

The BullMQ worker handles asynchronous knowledge ingestion, text extraction,
embedding, feedback enrichment, similarity grouping, and report generation.

Run it from the repository root:

```sh
pnpm dev:worker
```

The worker shares PostgreSQL, Redis, S3-compatible storage, encryption, and
model configuration with the API. It does not expose a public HTTP port.
Production deployments should monitor failed BullMQ jobs and keep Redis AOF
enabled; PostgreSQL remains the source of truth.
