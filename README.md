# RTSP Live Gateway

Monorepo implementation of RTSP -> HTTP-FLV gateway:

## Workspace Packages

| 包名                                   | 介绍                                                                                             | 目录                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------- |
| `@eosway/rtsp-live-gateway-server`     | RTSP Live Gateway 服务端，负责控制面 API、HTTP-FLV 输出、FFmpeg 进程管理、单源复用与 SSRF 防护。 | `apps/server`         |
| `@eosway/rtsp-live-gateway-player-vue` | Vue 3 播放组件与播放辅助逻辑，封装流创建/删除和 `mpegts.js` 的 HTTP-FLV 播放生命周期。           | `packages/player-vue` |
| `@eosway/rtsp-live-gateway-client`     | 控制面 API 的轻量客户端封装，提供创建流、查询流、删除流与播放地址构造能力。                      | `packages/client`     |
| `@eosway/rtsp-live-gateway-protocol`   | 跨包共享的控制面协议、类型契约与错误码定义。                                                     | `packages/protocol`   |
| `@eosway/rtsp-live-gateway-playground` | 基于 Vue 3 + Vite 的联调页面，用于快速验证 RTSP 参数输入、创建流与浏览器播放。                   | `playground`          |

## Quick Start

```bash
pnpm install
pnpm run check
```

Runtime baseline:

- Node.js `24+`
- Default container base: `node:24-alpine`
- `ffmpeg`
  - 优先读取 `FFMPEG_PATH`
  - 其次使用系统 PATH 中的 `ffmpeg`
  - 非生产环境下可回退到 `@ffmpeg-installer/ffmpeg`

## Common Scripts

| 命令                        | 说明                                      |
| --------------------------- | ----------------------------------------- |
| `pnpm run check`            | 依次执行类型检查、构建与测试。            |
| `pnpm run tsc`              | 对全部 workspace 执行类型检查。           |
| `pnpm run build`            | 全量构建 packages、server 与 playground。 |
| `pnpm run build:packages`   | 构建 `protocol`、`client`、`player-vue`。 |
| `pnpm run build:server`     | 构建 `protocol` 与 `server`。             |
| `pnpm run build:playground` | 仅构建 `playground`。                     |
| `pnpm run test`             | 运行 workspace 内可用的测试。             |
| `pnpm run clean`            | 清理各包构建产物。                        |
| `pnpm run lint`             | 对仓库执行 ESLint 自动修复。              |
| `pnpm run format`           | 对仓库执行 Prettier 格式化。              |
| `pnpm run dev:server`       | 以 watch 模式启动服务端开发流程。         |
| `pnpm run dev:playground`   | 启动 playground 开发服务器。              |
| `pnpm run docker:build`     | 构建服务端 Docker 镜像。                  |
| `pnpm run docker:export`    | 导出已有服务端 Docker 镜像。              |

### Run server locally

```bash
pnpm run build:server
pnpm --filter @eosway/rtsp-live-gateway-server start
```

### Run playground locally

```bash
pnpm run dev:playground
```

## Docker

```bash
pnpm run docker:build
pnpm run docker:export
```
