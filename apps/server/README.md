# @eosway/rtsp-live-gateway-server

`@eosway/rtsp-live-gateway-server` 是 RTSP Live Gateway 的服务端实现，负责：

- 控制面 API（创建、查询、删除流）
- 媒体面 HTTP-FLV 输出（`/v1/live/:streamId`）
- FFmpeg 进程管理（懒启动、超时、退出处理）
- 单源复用（`sourceKey`）
- SSRF 防护与基础指标输出

## 1. 运行要求

- Node.js `24+`
- 可执行 `ffmpeg`
  - 优先 `FFMPEG_PATH`
  - 其次系统 PATH 中的 `ffmpeg`
  - 非生产环境下可回退到 `@ffmpeg-installer/ffmpeg`

## 2. 快速启动

在仓库根目录执行：

```bash
pnpm install
pnpm --filter @eosway/rtsp-live-gateway-server build
node apps/server/dist/index.js
```

默认端口 `3000`。

## 3. API

### 3.1 控制面

- `POST /v1/streams`
  - 创建或复用流（仅登记，不立即拉流）
- `GET /v1/streams`
  - 查询所有流状态
- `GET /v1/streams/:streamId`
  - 查询单路流状态
- `DELETE /v1/streams/:streamId`
  - 删除流并停止对应 FFmpeg

### 3.2 媒体面

- `GET /v1/live/:streamId`
  - 首个观众触发懒启动
  - 输出 `video/x-flv` 持续字节流

### 3.3 运维接口

- `GET /v1/healthz`
- `GET /v1/metrics`

## 4. 核心行为

### 4.1 懒启动与复用

1. `POST /v1/streams` 时计算 `sourceKey`。
2. 已存在相同 `sourceKey` 则复用已有 `StreamSource`。
3. 第一个观众访问 `/live/:streamId` 时才启动 FFmpeg。

### 4.2 观众与回收

- 每个 HTTP 连接对应一个 `PlaybackSession`
- `MAX_QUEUE_BYTES` 限制慢客户端队列
- 运行中新增观众不会从 FLV 中间字节直接接入
- 服务端会先下发当前 FFmpeg 实例的 FLV bootstrap 与最近 GOP，再在下一个完整 FLV tag 边界切入实时流
- 最后一个观众离开后，等待 `STREAM_IDLE_GRACE_MS` 再停止 FFmpeg
- 空闲停止后仍可再次懒启动（不等同于删除）

### 4.3 启动与失败处理

- 启动成功判定：收到首个 stdout chunk
- 启动超时：`STREAM_START_TIMEOUT`
- 启动阶段失败：按 `maxStartAttempts`（当前 2）重试
- 运行中退出：标记为 `error`，断开观众

## 5. FFmpeg 命令策略

默认输出链路：

- 输入：`rtsp://` 或 `rtsps://`
- 输出：`-f flv -flvflags no_duration_filesize pipe:1`
- 默认禁音：`-an`
- `video.mode = copy`：始终 `-c:v copy`
- `video.mode = transcode`：始终按 `video.codec` 转码
- `video.mode = auto`：首次 `-c:v copy`，失败后按 `video.codec` 回退转码
- `video.codec = libx264`：转码使用 `libx264`
- `video.codec = libx265`：转码使用 `libx265`

超时参数：

- `ioTimeoutUs` -> `-timeout`

## 6. 环境变量

基础：

- `PORT`（默认 `3000`）
- `LOG_LEVEL`（默认 `info`）
- `FFMPEG_PATH`
- `CORS_ALLOW_ORIGIN`（默认 `*`）

流控制：

- `STREAM_STARTUP_TIMEOUT_MS`（默认 `8000`）
- `STREAM_IDLE_GRACE_MS`（默认 `15000`）
- `STOP_GRACE_MS`（默认 `1500`）
- `MAX_QUEUE_BYTES`（默认 `2097152`）
- `MAX_SOURCES`（默认 `64`）
- `MAX_VIEWERS_PER_SOURCE`（默认 `256`）

SSRF：

- `SSRF_ALLOW_PRIVATE_IP`（默认 `true`）
- `RTSP_HOST_ALLOWLIST`（逗号分隔）
- `RTSP_HOST_DENYLIST`（逗号分隔）
- `RTSP_PORT_ALLOWLIST`（逗号分隔，默认 `554,8554`）

## 7. 代码结构

- `src/app.ts`：路由与请求处理
- `src/domain/StreamRegistry.ts`：流注册和复用
- `src/domain/StreamSource.ts`：单源生命周期与状态机
- `src/domain/PlaybackSession.ts`：单观众队列与回压
- `src/infra/ffmpeg/*`：FFmpeg 构建、运行、诊断
- `src/security/ssrf.ts`：URL/主机/IP/端口防护
- `src/config.ts`：配置读取与默认值

## 8. 开发验证

```bash
pnpm --filter @eosway/rtsp-live-gateway-server tsc
pnpm --filter @eosway/rtsp-live-gateway-server build
```
