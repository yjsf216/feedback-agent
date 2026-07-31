FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates g++ make openssl python3 \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs ./
COPY apps/api/package.json apps/api/package.json
COPY packages/agent-core/package.json packages/agent-core/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY apps/api apps/api
COPY packages/agent-core packages/agent-core
COPY packages/contracts packages/contracts
COPY packages/database packages/database
RUN pnpm --filter @feedback-agent/api... build
RUN pnpm --filter @feedback-agent/api deploy --prod --legacy /prod/api

FROM build AS migration
CMD ["./packages/database/node_modules/.bin/prisma", "migrate", "deploy", "--schema=packages/database/prisma/schema.prisma"]

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV API_PORT=4100
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates dumb-init openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /prod/api ./
USER node
EXPOSE 4100
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
