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
- 服务端内部执行模型，例如 `NormalizedStreamCreateRequest`
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
- `ioTimeoutUs`: `5000000`
- `video.codec`: `h264`
- `audio.enabled`: `false`
- `audio.mode`: `drop`
- `audio.codec`: `aac`
- `audio.bitrateKbps`: `0`
- `allowPrivateIp`: `false`
- `labels`: `{}`

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

- `StreamStatusResponse.effectiveConfig` 表示服务端归一化后的生效配置，不是原始请求体回显。
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
