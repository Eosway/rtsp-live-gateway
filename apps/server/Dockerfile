FROM node:24-trixie-slim AS builder

WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY playground/package.json playground/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY packages/client/package.json packages/client/package.json
COPY packages/player-vue/package.json packages/player-vue/package.json

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM node:24-trixie-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates tini \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 1001 appuser

COPY --from=builder /app /app

USER appuser
EXPOSE 3000

ENTRYPOINT ["tini","--"]
CMD ["node","apps/server/dist/index.js"]
