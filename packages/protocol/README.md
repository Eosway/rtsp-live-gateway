# @eosway/rtsp-live-gateway-protocol

`@eosway/rtsp-live-gateway-protocol` 定义 RTSP Live Gateway 控制面的跨包共享契约与错误码。

## 目标

- 保持控制面 API 类型单一来源
- 约束 SDK、Server、Vue Player 的交互字段一致
- 将请求、响应、运行态状态与错误模型显式化

## 范围

`@eosway/rtsp-live-gateway-protocol` 当前覆盖控制面 JSON 协议：

- `POST /v1/streams`
- `GET /v1/streams`
- `GET /v1/streams/:streamId`
- `DELETE /v1/streams/:streamId`
- `GET /v1/healthz`

不包含以下内容：

- `GET /v1/live/:streamId` 的媒体字节流协议
- `GET /v1/metrics` 的 Prometheus 文本协议
- 服务端内部运行时模型，例如 `ResolvedStreamCreateRequest`
- 服务端内部复用键，例如 `sourceKey`

## 主要类型

- 标识与状态：
  - `StreamId`
  - `SessionId`
  - `StreamState`
- 创建与查询：
  - `StreamCreateRequest`
  - `StreamCreateResponse`
  - `StreamStatusResponse`
  - `StreamListResponse`
  - `StreamDeleteResponse`
  - `HealthzResponse`
- 错误：
  - `ApiErrorBody`
  - `ApiErrorCode`
  - `ApiErrorDetailByCode`

## 请求默认值语义

`StreamCreateRequest` 是外部输入契约，允许省略部分字段。服务端当前默认值为：

- `transport`: `tcp`
- `video.mode`: `auto`
- `video.codec`: 默认不显式指定
- `video.fallbackCodec`: `h264`
- `audio.enabled`: `false`
- `audio.mode`: `auto`（仅当 `audio.enabled = true` 且未显式指定时）
- `audio.codec`: `aac`（仅当 `audio.enabled = true` 时，表示 `auto` 回退或 `transcode` 的目标 codec）

## 错误 detail 语义

`ApiErrorBody.detail` 已按 `ApiErrorCode` 收敛为结构化映射。

当前主要 detail 形状包括：

- `INVALID_ARGUMENT`
  - `field`
  - `maxSources`
  - `maxViewersPerSource`
- `SSRF_BLOCKED`
  - `port`
  - `host`
  - `address`
- `STREAM_START_TIMEOUT`
  - `stderrTail`
- `UPSTREAM_AUTH_FAILED` / `UPSTREAM_CONNECT_FAILED` / `NO_MEDIA_OUTPUT` / `FFMPEG_UNSUPPORTED`
  - `ts`
  - `level`
- `FFMPEG_NOT_FOUND`
  - `error`
  - `stderrTail`
- `FFMPEG_EXITED`
  - `code`
  - `signal`
  - `stderrTail`

## 边界说明

- `StreamStatusResponse.resolvedConfig`: 当前流生效配置。
- `resolvedConfig` 当前包含：`transport`、`video`、`audio`。
- `resolvedConfig` 不回显原始请求体。
- `resolvedConfig` 不包含 `url`。
- `startedAt` 表示最近一次成功启动时间；空闲停止后不会清空，下次再次成功启动时会覆盖。
- `lastActiveAt` 表示最近一次观众活动时间；创建流、观众加入、观众离开时都会更新。
- `stats.bytesOutTotal` 是当前 `StreamSource` 生命周期内累计扇出字节数，不会在 stop / restart 时清零。
- `stats.currentFfmpegPid` 仅在当前存在运行中 FFmpeg 进程时返回。
- `stats.startAttemptsTotal` 是当前 `StreamSource` 生命周期内累计启动尝试次数，不会在 stop / restart 时清零。
- `stats.lastStartLatencyMs` 表示最近一次成功启动耗时，不是平均值，也不是累计值。
- `stats.lastErrorAt` 表示最近一次记录 `recentError` 的时间。
- `resolvedConfig.audio.enabled = false`: 执行 `-an`。
- `resolvedConfig.audio.mode = auto`: 输入音频为 `aac` 或 `mp3` 时使用 `copy`；否则转为 `audio.codec`。
- `resolvedConfig.audio.mode = transcode`: 始终转为 `audio.codec`。
- `resolvedConfig.video.mode = auto` 且 `resolvedConfig.video.codec` 缺省: 输入视频为已知 `h264` 或 `h265` 时使用 `copy`；否则转为 `resolvedConfig.video.fallbackCodec`。
- `resolvedConfig.video.mode = auto` 且 `resolvedConfig.video.codec` 已指定: 输入视频与 `resolvedConfig.video.codec` 一致时使用 `copy`；否则转为 `resolvedConfig.video.codec`。
- `video.mode = transcode`: 始终转码，不走 `copy`。
- `ioTimeoutMs` 与 `allowPrivateIp` 属于服务端部署策略，不属于用户侧创建协议。
- `sourceKey` 仅用于服务端内部单源复用，不属于对外稳定协议。

## 导出

统一从 `src/index.ts` 导出，业务侧直接：

```ts
import type { StreamCreateRequest, ApiErrorCode } from '@eosway/rtsp-live-gateway-protocol'
```

## 开发命令

```bash
pnpm --filter @eosway/rtsp-live-gateway-protocol tsc
pnpm --filter @eosway/rtsp-live-gateway-protocol build
```
