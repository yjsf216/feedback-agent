# Feedback Agent API

The NestJS API is the trusted boundary for authentication, app isolation,
knowledge retrieval, SSE conversations, LangGraph orchestration, feedback
management, and administration endpoints.

Run it from the repository root:

```sh
pnpm dev:api
```

Configuration is loaded from the root .env file. Never place JWT secrets, app
credentials, model keys, or object-storage secrets in browser or Flutter
configuration. Every domain operation must use an app ID derived from a
validated credential or administrator session.

API contracts and authentication flows are documented in
[../../docs/api.md](../../docs/api.md). Swagger is available at
http://localhost:4100/docs during local development.
