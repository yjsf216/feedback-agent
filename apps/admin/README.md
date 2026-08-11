# Feedback Agent Admin

The Vue 3 administration console manages applications, knowledge,
conversations, structured feedback, requirement drafts, owner follow-up,
model settings, and reports.

Run it from the repository root:

```sh
pnpm dev:admin
```

The development server is available at http://localhost:8848. In production,
the static build is served by Nginx and calls the API through /api.

## Upstream attribution

This application is derived from
[pure-admin-thin](https://github.com/pure-admin/pure-admin-thin). The retained
upstream framework code and assets remain licensed under the MIT License;
the original copyright and permission notice are preserved in
[LICENSE](LICENSE). Feedback Agent-specific behavior is documented at the
repository root.
