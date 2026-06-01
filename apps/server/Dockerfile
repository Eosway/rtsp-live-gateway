FROM node:24-trixie-slim AS builder

WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
ENV HUSKY=0

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY patches patches

RUN npm config set registry https://registry.npmmirror.com
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.json
COPY apps/server apps/server
COPY packages/protocol packages/protocol

RUN pnpm run build:server
RUN pnpm --filter @eosway/rtsp-live-gateway-server deploy --legacy --prod /prod/apps/server

FROM node:24-trixie-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN sed -i 's/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list.d/debian.sources
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash -u 1001 app

COPY --from=builder /prod/apps/server /app

USER app
EXPOSE 3000

ENTRYPOINT ["tini","--"]
CMD ["node","dist/index.js"]
