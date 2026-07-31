FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates g++ make openssl python3 \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/agent-core/package.json packages/agent-core/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY apps/worker apps/worker
COPY packages/agent-core packages/agent-core
COPY packages/contracts packages/contracts
COPY packages/database packages/database
RUN pnpm --filter @feedback-agent/worker... build
RUN pnpm --filter @feedback-agent/worker deploy --prod --legacy /prod/worker

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates dumb-init openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /prod/worker ./
USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
