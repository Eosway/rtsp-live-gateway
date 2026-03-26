# RTSP Live Gateway 实施记录（2026-03-26）

## 目标

- 基于 ` .local/tasks/RTSPLiveGateway.md ` 蓝图，完成可运行的 RTSP -> HTTP-FLV 网关与网页端闭环。
- 交付 monorepo：服务端、SDK、Vue 播放组件、playground、Docker、CI。

## 分步实施

### Step 1：仓库与基础骨架

- 改动内容：
  - 初始化 git 仓库与 monorepo 结构（apps/packages/deploy/.github）。
  - 建立 `protocol` 与 `shared` 基础包及类型契约。
- 改动原因：
  - 为后续服务端与前端包提供统一契约与最小共享能力。
- 验证方式：
  - JSON 配置文件解析检查。
  - Git 首次提交。

### Step 2：服务端核心链路

- 改动内容：
  - 实现 `apps/server`：
    - Hono 路由：`POST/GET/DELETE /v1/streams`、`GET /v1/live/:streamId.flv`、`/v1/healthz`、`/v1/metrics`。
    - `StreamRegistry` / `StreamSource` / `PlaybackSession` / `FanoutHub`。
    - FFmpeg command builder、runner、stderr parser、path resolve。
    - SSRF 校验与错误码映射。
    - 懒启动、单源复用、空闲回收、慢客户端队列阈值。
- 改动原因：
  - 落地蓝图中“控制面+媒体面+状态机+FFmpeg spawn”核心约束。
- 验证方式：
  - `npm run typecheck`
  - `npm run build`
  - 运行态导入验证：`server-app-ok`
  - Git 提交。

### Step 3：SDK / Vue 组件 / Playground

- 改动内容：
  - `packages/sdk`：`createStream/getStream/listStreams/deleteStream/buildLiveUrl`。
  - `packages/vue-player`：`RtspFlvPlayer`、`useRtspStream`、`useMpegtsFlvPlayer`。
  - `apps/playground`：Vite + Vue3 页面，输入 RTSP 参数后创建并播放。
  - 包管理切换到 pnpm（workspace 依赖、`pnpm-lock.yaml`）。
- 改动原因：
  - 实现蓝图要求的网页端闭环与可复用前端交付。
- 验证方式：
  - `pnpm run typecheck`
  - `pnpm run build`
  - Git 提交。

### Step 4：交付增强（部署与 CI）

- 改动内容：
  - Docker：
    - ` deploy/docker/server/Dockerfile `（Debian slim 默认）
    - ` deploy/docker/server/Dockerfile.alpine `（实验）
    - ` deploy/docker/server/compose.yaml `
    - ` deploy/docker/server/.dockerignore `
  - CI：
    - ` .github/workflows/ci.yaml `（类型检查、构建、FFmpeg 能力检查）
  - 文档：
    - ` README.md `
- 改动原因：
  - 满足蓝图对容器化与 CI 的一等公民要求。
- 验证方式：
  - `pnpm run typecheck`
  - `pnpm run build`
  - Git 提交。

## 结果

- 已形成可构建的 RTSP Live Gateway V1 全链路工程骨架与核心实现。
- 关键能力已覆盖：懒启动、单源复用、HTTP-FLV 分发、前端播放器封装、容器化、CI 能力检查。

