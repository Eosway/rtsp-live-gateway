# RTSP Live Gateway

Monorepo implementation of RTSP -> HTTP-FLV gateway:

- `apps/server`: Hono + Node.js gateway service (`/v1/streams`, `/v1/live/:streamId`)
- `packages/client`: control-plane API client and live URL builder
- `packages/player-vue`: Vue 3 player component wrapping `mpegts.js`
- `playground`: demo web app to create stream and play in browser

## Quick Start

```bash
pnpm install
pnpm run tsc
pnpm run build
```

Runtime baseline:

- Node.js `24+`
- Default container base: `node:24-trixie-slim` (Debian 13)

### Run server locally

```bash
pnpm run build:server
node apps/server/dist/index.js
```

### Run playground locally

```bash
pnpm --filter @eosway/rtsp-live-gateway-playground dev
```

## Docker

Debian slim (default):

```bash
docker build -f apps/server/Dockerfile -t rtsp-live-gateway:latest .
```

Alpine (experimental):

```bash
docker build -f apps/server/Dockerfile.alpine -t rtsp-live-gateway:alpine .
```
