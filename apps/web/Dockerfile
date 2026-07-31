FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG NEXT_PUBLIC_FEEDBACK_API_URL=http://localhost:4100
ARG NEXT_PUBLIC_DEMO_APP_SLUG=demo
ENV NEXT_PUBLIC_FEEDBACK_API_URL=$NEXT_PUBLIC_FEEDBACK_API_URL
ENV NEXT_PUBLIC_DEMO_APP_SLUG=$NEXT_PUBLIC_DEMO_APP_SLUG
COPY apps/web apps/web
COPY packages/contracts packages/contracts
RUN pnpm --filter @feedback-agent/web... build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
