# RTSP Live Gateway

Monorepo implementation of RTSP -> HTTP-FLV gateway:

- `apps/server`: Hono + Node.js gateway service (`/v1/streams`, `/v1/live/:streamId`)
- `packages/sdk`: API SDK for create/get/delete stream and live url builder
- `packages/vue-player`: Vue 3 player component wrapping `mpegts.js`
- `apps/playground`: demo web app to create stream and play in browser

## Quick Start

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

Runtime baseline:

- Node.js `24+`
- Default container base: `node:24-trixie-slim` (Debian 13)

### Run server locally

```bash
node apps/server/dist/index.js
```

### Run playground locally

```bash
pnpm --filter @rtsp-gateway/playground dev
```

## Docker

Debian slim (default):

```bash
docker build -f deploy/docker/server/Dockerfile -t rtsp-live-gateway:latest .
```

Alpine (experimental):

```bash
docker build -f deploy/docker/server/Dockerfile.alpine -t rtsp-live-gateway:alpine .
```
