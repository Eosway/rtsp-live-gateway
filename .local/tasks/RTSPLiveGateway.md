# RTSP → HTTP-FLV 网关 V1 项目蓝图

本蓝图定义一个可产品化交付的 V1：服务端基于 Hono + Node.js 提供“控制面 HTTP API + 媒体面 HTTP-FLV”，以 `sourceKey` 实现单源复用与懒启动；FFmpeg 由容器镜像显式安装并通过 `child_process.spawn` 驱动，stdout 进入 fanout 分发，stderr 结构化解析用于诊断；仓库采用 monorepo，同步交付浏览器侧 SDK 与 Vue 3 播放组件（封装 mpegts.js，支持传 `streamId` 或创建参数），并以 Docker（Debian slim 默认、Alpine 可选）作为一等公民，配套 CI 校验 FFmpeg 能力与安全/运维约束。mpegts.js 明确支持 HTTP MPEG2-TS/FLV 直播播放与 `type:'flv', isLive:true` 的数据源配置，且强调需正确设置 CORS；Hono 提供可写入 `Uint8Array` 的流式响应 helper，适合输出二进制媒体流。citeturn5view0turn6view0turn10view0turn12search7

```mermaid
graph TD
  subgraph Browser
    V[Vue3 播放组件<br/>@scope/vue-player]
    S[JS SDK<br/>@scope/sdk]
    M[mpegts.js]
  end

  subgraph Server[Hono + Node.js 服务端]
    API[控制面 API<br/>POST/GET/DELETE /streams]
    LIVE[媒体面<br/>GET /live/:streamId.flv]
    REG[StreamRegistry]
    SRC[StreamSource]
    HUB[FanoutHub]
    RUN[FFmpegRunner]
    CMD[FFmpegCommandBuilder]
    PARSE[FFmpegStderrParser]
    GUARD[SSRF/URL 校验与脱敏]
  end

  subgraph OS[容器/宿主]
    F[ffmpeg 可执行文件]
  end

  V --> S
  V --> M
  S --> API
  API --> GUARD
  API --> REG
  LIVE --> REG
  REG --> SRC
  SRC --> CMD
  CMD --> RUN
  RUN --> F
  RUN --> PARSE
  RUN --> HUB
  HUB --> LIVE
  LIVE --> V
```

citeturn10view0turn5view0turn5view4

## 目标与关键决策

**确认的 V1 约束（作为实现“规格”）**

- 接入层：Hono + Node.js（Node.js 端通过 `@hono/node-server` 运行 Hono）。citeturn12search2turn12search7turn12search11  
- 媒体主链路：HTTP-FLV（不使用 WebSocket）；控制面：普通 HTTP API。mpegts.js 文档给出 HTTP-FLV 直播数据源示例，并说明 HTTP MPEG2-TS/FLV 直播依赖浏览器的 stream IO（fetch/streams）。citeturn5view0  
- stream 创建/播放：`POST /streams` 创建（只入注册表，不拉流），首个 `GET /live/{streamId}.flv` 触发懒启动；`sourceKey` 单源复用。  
- 编码策略：copy/transmux 优先；必要时转码 H.264；视频优先，音频默认关闭。  
- FFmpeg：服务端不使用 fluent-ffmpeg，而是 `child_process.spawn` 直接驱动（stdout 二进制流、stderr 诊断）；FFmpeg 路径解析优先级：`FFMPEG_PATH` > 系统 PATH >（仅开发）`@ffmpeg-installer/ffmpeg`。Node 的 child process 文档明确 `spawn()` 提供 stdout/stderr 管道能力。citeturn2search2turn3search2  
- 容器化一等公民：默认生产镜像 `node:22-bookworm-slim`；可选 `node:22-alpine` 实验镜像。Node 官方镜像文档指出 Alpine 变体使用 musl libc 而非 glibc，并提示可能引发兼容性问题；Hono 文档示例在 Alpine 上安装 `gcompat`。citeturn8view0turn9view0  
- CI：必须执行 `ffmpeg -version/-codecs` 等能力检查；FFmpeg 官方协议文档列出 RTSP 相关选项（如 `rtsp_transport` 支持 tcp/udp/udp_multicast/http/https 等），适合作为 CI 断言基础。citeturn5view4  

**Debian slim vs Alpine 的工程权衡（V1 推荐默认 Debian）**

| 维度 | Debian slim（默认） | Alpine（实验） |
|---|---|---|
| libc/兼容性 | 基于 Debian（bookworm=Debian 12），通常更贴近多数二进制与库兼容预期。citeturn8view0 | 使用 musl libc，Node 官方文档指出某些软件可能因 libc 需求深度而出问题；需要额外兼容层（`gcompat`/`libc6-compat`）。citeturn8view0turn9view0 |
| 镜像体积 | 较大但“可预测/好排障”。 | 更小；但引入兼容层与媒体依赖时收益可能被抵消。citeturn8view0 |
| FFmpeg 安装 | `apt-get install ffmpeg`（版本随发行版稳定）。 | `apk add ffmpeg`（版本随 Alpine 仓库；需验证 codec/protocol）。citeturn8view0 |
| V1 推荐 | ✅ 默认生产路线 | ⚠️ 仅在验证通过后作为可选镜像 |

## Monorepo 结构与包职责

**交付物要求（对应你列的“可交付开发蓝图”第 1/2 项）**：monorepo 必须同时交付服务端、SDK、Vue 组件、示例应用、部署模板与 CI。

**建议使用 pnpm workspace（也可替换 npm/yarn），目录如下：**

```text
rtsp-httpflv-gateway/
  apps/
    server/                 # Hono 服务端（控制面 + 媒体面）
    playground/             # Vue3 示例应用（验证组件 + SDK + 服务端）
  packages/
    protocol/               # API 契约、错误码、状态机枚举、类型
    sdk/                    # create/get/delete/buildLiveUrl（浏览器/Node 通用）
    vue-player/             # Vue3 组件 + composables（封装 mpegts.js）
    shared/                 # 工具：hash、sanitize、time、logger 接口等
  deploy/
    docker/
      server/
        Dockerfile
        Dockerfile.alpine
        compose.yaml
        .dockerignore
  .github/
    workflows/
      ci.yaml
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  eslint.config.js
```

**package 列表与职责边界**

- `apps/server`：Hono 路由、鉴权/限流/CORS、流式响应输出、调用 domain/modules；通过 `@hono/node-server` 启动。citeturn12search2turn12search11turn10view0  
- `packages/protocol`：  
  - 定义控制面请求/响应、错误码、状态枚举；  
  - 定义 `sourceKey` 归一化规则字段（但不含具体实现）。  
- `packages/sdk`：  
  - 仅封装 HTTP API 调用与 URL 拼装（不包含播放器逻辑）。  
- `packages/vue-player`：  
  - Vue 组件 + composable；封装 mpegts.js 的创建、挂载、销毁与交互；支持两种模式：传 `streamId` 或传创建参数并内部调用 SDK 创建流。mpegts.js API 文档定义了 `createPlayer(mediaDataSource, config)`、`type:'flv'`、`isLive` 等字段与 `Player` 的 attach/load/play 生命周期。citeturn6view0turn5view0  
- `apps/playground`：  
  - 提供最小可运行页面：输入 RTSP 参数 -> 创建流 -> 播放；也用于回归测试与联调。

**TypeScript 契约草案（核心类型：packages/protocol）**

```ts
// packages/protocol/src/types.ts

export type StreamId = string;
export type SourceKey = string;
export type SessionId = string;

export type RtspTransport = 'tcp' | 'udp' | 'udp_multicast' | 'http' | 'https';

export type VideoMode = 'auto' | 'copy' | 'transcode';
export type AudioMode = 'drop' | 'copy' | 'transcode';

export type StreamState = 'idle' | 'starting' | 'running' | 'stopping' | 'error';

export interface VideoOptions {
  mode?: VideoMode;              // default: 'auto'
  forceCodec?: 'h264';           // V1: only 'h264' when transcode
  width?: number;
  height?: number;
  fps?: number;
  bitrateKbps?: number;
  gop?: number;                  // keyframe interval
}

export interface AudioOptions {
  enabled?: boolean;             // default: false
  mode?: AudioMode;              // default: 'drop'
  codec?: 'aac';
  bitrateKbps?: number;
}

export interface StreamCreateRequest {
  url: string;                   // rtsp://...
  transport?: RtspTransport;      // default: 'tcp'
  connectTimeoutMs?: number;      // default: 5000
  ioTimeoutUs?: number;           // see ffmpeg rtsp 'timeout' (microseconds)
  video?: VideoOptions;
  audio?: AudioOptions;
  // 风险控制
  allowPrivateIp?: boolean;       // default: false
  labels?: Record<string, string>;
}

export interface StreamCreateResponse {
  streamId: StreamId;
  state: StreamState;            // V1: usually 'idle'
  playUrl: string;               // GET /live/{streamId}.flv
  reused: boolean;               // 是否复用现有 sourceKey
  createdAt: string;             // ISO
}

export interface StreamStatusResponse {
  streamId: StreamId;
  state: StreamState;
  viewerCount: number;
  createdAt: string;
  startedAt?: string;
  lastActiveAt?: string;
  sourceKey?: SourceKey;         // 默认不返回；debug 可开
  config: {
    transport: RtspTransport;
    video: Required<VideoOptions>;
    audio: Required<AudioOptions>;
  };
  stats: {
    bytesOut: number;
    ffmpegPid?: number;
    startAttempts: number;
    startLatencyMs?: number;
    lastErrorAt?: string;
  };
  recentError?: ApiErrorBody;
}

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  requestId?: string;
  detail?: Record<string, unknown>;
}

export type ApiErrorCode =
  | 'INVALID_ARGUMENT'
  | 'INVALID_RTSP_URL'
  | 'SSRF_BLOCKED'
  | 'STREAM_NOT_FOUND'
  | 'STREAM_DELETED'
  | 'STREAM_START_TIMEOUT'
  | 'UPSTREAM_AUTH_FAILED'
  | 'UPSTREAM_CONNECT_FAILED'
  | 'NO_MEDIA_OUTPUT'
  | 'FFMPEG_NOT_FOUND'
  | 'FFMPEG_UNSUPPORTED'
  | 'FFMPEG_EXITED'
  | 'INTERNAL_ERROR';
```

**核心类方法签名草案（apps/server 内 domain/modules）**

```ts
// apps/server/src/domain/StreamRegistry.ts
export interface StreamRegistry {
  createOrReuse(req: StreamCreateRequest): Promise<{ streamId: StreamId; reused: boolean }>;
  get(streamId: StreamId): StreamSource | undefined;
  remove(streamId: StreamId): Promise<void>;
  list(): StreamStatusResponse[];
}

// apps/server/src/domain/StreamSource.ts
export interface StreamSource {
  readonly streamId: StreamId;
  readonly sourceKey: SourceKey;
  state: StreamState;

  ensureStarted(trigger: 'first_viewer' | 'manual'): Promise<void>;
  addViewer(session: PlaybackSession): void;
  removeViewer(sessionId: SessionId, reason: string): void;

  scheduleIdleStop(): void;
  stop(reason: string): Promise<void>;

  snapshotStatus(): StreamStatusResponse;
}

// apps/server/src/domain/PlaybackSession.ts
export interface PlaybackSession {
  sessionId: SessionId;
  streamId: StreamId;
  connectedAt: number;
  remoteIp?: string;
  userAgent?: string;

  // fanout writer
  enqueue(chunk: Uint8Array): boolean;
  close(reason: string): void;
  isClosed(): boolean;
}

// apps/server/src/infra/ffmpeg/FFmpegCommandBuilder.ts
export interface BuildContext {
  req: StreamCreateRequest;
  ffmpegPath: string;
  // derived:
  inputUrl: string;
}
export interface FFmpegCommand {
  cmd: string;        // ffmpegPath
  args: string[];     // spawn args
  safePreview: string;// masked url for logs
}
export interface FFmpegCommandBuilder {
  build(ctx: BuildContext): FFmpegCommand;
}

// apps/server/src/infra/ffmpeg/FFmpegRunner.ts
export interface FFmpegRunner {
  start(command: FFmpegCommand): void;
  onStdout(cb: (chunk: Buffer) => void): void;
  onStderrLine(cb: (line: string) => void): void;
  onExit(cb: (code: number | null, signal: NodeJS.Signals | null) => void): void;
  stop(graceMs: number): Promise<void>;
  kill(): void;
  pid(): number | undefined;
}

// apps/server/src/domain/FanoutHub.ts
export interface FanoutHub {
  publish(chunk: Uint8Array): void;
  subscribe(session: PlaybackSession): void;
  unsubscribe(sessionId: SessionId, reason: string): void;
  closeAll(reason: string): void;
}
```

## HTTP API 契约

**控制面与媒体面分离的必要性**：mpegts.js 在 HTTP-FLV 直播场景要求服务端正确配置 `Access-Control-Allow-Origin` 等 CORS 头；同时它给出 HTTP-FLV 与 WebSocket 源的不同示例（V1 选 HTTP-FLV）。citeturn5view0  

**接口清单（建议全部以 `/v1` 作为前缀，便于演进）**

- `POST /v1/streams`：创建/复用流（仅登记 + 返回 `streamId`，不启动）  
- `GET /v1/streams/:streamId`：查询流状态  
- `DELETE /v1/streams/:streamId`：删除流（强制停止并移除注册）  
- `GET /v1/live/:streamId.flv`：媒体流（HTTP-FLV），首个访问触发懒启动  
- `GET /v1/healthz`：健康检查（包含 ffmpeg 可用性摘要）  
- `GET /v1/metrics`：Prometheus 指标（可选但强烈建议 V1 就上）

**请求/响应示例**

`POST /v1/streams`

请求：

```json
{
  "url": "rtsp://user:pass@192.168.1.10:554/Streaming/Channels/101",
  "transport": "tcp",
  "connectTimeoutMs": 5000,
  "ioTimeoutUs": 5000000,
  "video": { "mode": "auto" },
  "audio": { "enabled": false },
  "allowPrivateIp": false,
  "labels": { "camera": "gate-1" }
}
```

成功响应（200）：

```json
{
  "streamId": "st_01JQZ6P2K0D3P1Y8N5E7M9T2R1",
  "state": "idle",
  "playUrl": "http://127.0.0.1:3000/v1/live/st_01JQZ6P2K0D3P1Y8N5E7M9T2R1.flv",
  "reused": false,
  "createdAt": "2026-03-26T03:12:45.123Z"
}
```

注意：`reused=true` 表示 `sourceKey` 已存在，返回一个指向同一 source 的新 `streamId`（或直接返回既有 `streamId`，二选一；本蓝图默认“可返回既有 streamId”，但要在响应标注 `reused` 以便前端 UI 解释）。

`GET /v1/streams/:streamId`（200）

```json
{
  "streamId": "st_...",
  "state": "running",
  "viewerCount": 2,
  "createdAt": "2026-03-26T03:12:45.123Z",
  "startedAt": "2026-03-26T03:12:49.321Z",
  "lastActiveAt": "2026-03-26T03:13:10.015Z",
  "config": {
    "transport": "tcp",
    "video": { "mode": "auto", "forceCodec": "h264", "width": 0, "height": 0, "fps": 0, "bitrateKbps": 0, "gop": 0 },
    "audio": { "enabled": false, "mode": "drop", "codec": "aac", "bitrateKbps": 0 }
  },
  "stats": {
    "bytesOut": 9328123,
    "ffmpegPid": 123,
    "startAttempts": 1,
    "startLatencyMs": 410
  }
}
```

`GET /v1/live/:streamId.flv`

- 成功：`200`，`Content-Type: video/x-flv`；持续输出二进制内容。  
- 失败（响应尚未开始时）：返回 JSON 错误体（例如 404/502/504）；一旦开始输出 FLV 就不能再返回 JSON（流式响应特性）。

**错误码与 HTTP 状态映射（建议做成强约束，便于 SDK/组件统一处理）**

| 场景 | HTTP 状态 | `ApiErrorCode` | 备注 |
|---|---:|---|---|
| 参数缺失/非法 | 400 | `INVALID_ARGUMENT` / `INVALID_RTSP_URL` | 控制面校验失败 |
| SSRF/地址不允许 | 403 | `SSRF_BLOCKED` | 详见安全章节；参考 entity["organization","OWASP","security nonprofit org"] SSRF 防护建议。citeturn1search3turn1search19 |
| streamId 不存在 | 404 | `STREAM_NOT_FOUND` | 控制面与媒体面均适用 |
| 首次播放启动超时 | 504 | `STREAM_START_TIMEOUT` | 懒启动阶段 |
| 上游鉴权失败（RTSP 401/403） | 502 | `UPSTREAM_AUTH_FAILED` | 不建议透传上游细节 |
| 上游连接失败/断流 | 502 | `UPSTREAM_CONNECT_FAILED` | |
| FFmpeg 不存在/不可执行 | 500 | `FFMPEG_NOT_FOUND` | 启动时检查 |
| FFmpeg 能力不足（缺协议/codec） | 500 | `FFMPEG_UNSUPPORTED` | CI 与启动自检一致 |
| FFmpeg 异常退出 | 502 | `FFMPEG_EXITED` | |

**CORS 与缓存头（媒体面建议默认开启可配置）**

- `Access-Control-Allow-Origin`：按部署域名配置（或 `*`，但若需要 cookies/鉴权则不能用 `*`）。mpegts.js 文档明确指出需正确配置该头。citeturn5view0  
- `Cache-Control: no-store, no-cache, must-revalidate`（直播流不要被缓存）。  
- `X-Content-Type-Options: nosniff`（建议）。  

## 服务端运行时模型与实现草案

**Hono 流式输出能力（关键依据）**：Hono Streaming Helper 的 `stream()` 支持写入 `Uint8Array`、支持 `onAbort()`，适合将 ffmpeg stdout 按 chunk 写入响应，并在客户端断开时触发清理。citeturn10view0  

### 运行时对象与字段定义

**StreamRegistry（全局）**

- `byStreamId: Map<StreamId, StreamSource>`
- `bySourceKey: Map<SourceKey, StreamSource>`
- `config: RegistryConfig`
- `createOrReuse()`：计算 `sourceKey`，若存在则复用，否则新建 `StreamSource` 并登记为 `idle`

**StreamSource（每个 sourceKey 唯一实例）**

字段（建议最小集）：

- 标识：`streamId`, `sourceKey`, `createdAt`
- 状态：`state: StreamState`
- 观众：`sessions: Map<SessionId, PlaybackSession>`
- 计时器：`startupTimer?`, `idleTimer?`
- 统计：`bytesOut`, `startAttempts`, `startLatencyMs?`, `lastErrorAt?`
- FFmpeg：`runner?: FFmpegRunner`, `fanout: FanoutHub`, `stderrRing: string[]`

事件（驱动状态机）：

- `FIRST_VIEWER_ATTACHED`
- `STARTUP_SUCCESS`（收到首个 stdout）
- `STARTUP_TIMEOUT`
- `LAST_VIEWER_LEFT`
- `IDLE_GRACE_EXPIRED`
- `FFMPEG_EXIT`
- `DELETE_REQUESTED`

**PlaybackSession（每个 HTTP-FLV 连接一个）**

- `sessionId`, `streamId`, `connectedAt`
- `queueBytes: number`（用于慢客户端）
- `queue: Uint8Array[]`（或环形队列）
- `closed: boolean`, `closeReason?`
- `enqueue(chunk)`：若超阈值返回 false 并触发关闭
- `drainToHonoStream(stream)`：循环从队列取出并 `await stream.write(chunk)`；客户端 abort 时退出

### 状态机定义与默认超时

- `startupTimeoutMs`：默认 `8000`（可配置）
- `idleGraceMs`：默认 `15000`（最后一个观众离开到停止 FFmpeg 的宽限期）
- `stopGraceMs`：默认 `1500`（发送 `SIGTERM` 后等待，再 `SIGKILL`）
- `maxStartAttempts`：默认 `2`（首次 + 1 次重试；可配置）

```mermaid
stateDiagram-v2
  [*] --> idle: POST /streams
  idle --> starting: first GET /live/*.flv
  starting --> running: stdout first chunk
  starting --> error: startupTimeout / ffmpegExit
  running --> stopping: DELETE /streams
  running --> stopping: lastViewerLeft + idleGraceExpired
  stopping --> [*]: removed from registry
  error --> [*]: removed or kept for debug (config)
```

citeturn10view0  

### 请求流程时序图

```mermaid
sequenceDiagram
  participant U as Browser(Vue3组件)
  participant SDK as SDK(@scope/sdk)
  participant API as Hono 控制面
  participant LIVE as Hono 媒体面
  participant REG as StreamRegistry
  participant SRC as StreamSource
  participant FF as FFmpegRunner

  U->>SDK: createStream(req)
  SDK->>API: POST /v1/streams
  API->>REG: createOrReuse(sourceKey)
  REG-->>API: streamId, state=idle
  API-->>SDK: 200 {streamId, playUrl}

  U->>LIVE: GET /v1/live/{streamId}.flv
  LIVE->>REG: get(streamId)
  REG-->>LIVE: StreamSource
  LIVE->>SRC: addViewer(session)
  SRC->>SRC: ensureStarted() (lazy)
  SRC->>FF: spawn ffmpeg
  FF-->>SRC: stdout first chunk
  SRC-->>LIVE: fanout publish
  LIVE-->>U: HTTP-FLV stream bytes...
```

citeturn12search2turn10view0  

### FFmpeg 命令构建策略与示例

**关键依据**

- FFmpeg 官方协议文档列出 RTSP demuxer/muxer选项与 `rtsp_transport` 可选值（tcp/udp/udp_multicast/http/https 等），且给出示例。citeturn5view4  
- FFmpeg 的 `pipe` 协议用于将输出写到 stdout（`pipe:1`），但文档提醒某些需要 seekable 的格式会在 pipe 上失败；FLV 适合非 seekable 直播输出。citeturn11search0turn2search15  
- FLV muxer 文档包含 `flvflags no_duration_filesize`（用于非 seekable living stream）与 `no_sequence_end` 等选项，适合直播场景。citeturn2search15  

**构建原则**

- 输入侧：优先 `-rtsp_transport tcp`（默认），必要时允许 udp/udp_multicast/http/https（由请求指定）。citeturn5view4  
- 输出侧：固定 `-f flv pipe:1`；直播建议加 `-flvflags no_duration_filesize`（必要时再加 `no_sequence_end`）。citeturn2search15  
- 音频默认关闭：`-an`（减少兼容面与资源）。  
- video mode：
  - `auto/copy`：尽量 `-c:v copy`（转封装）；
  - `transcode`：`-c:v libx264` + 低延迟参数（具体参数可配置）。

**示例命令（便于直接编码实现）**

1) **transmux（copy）+ 禁音（V1 默认）**

```bash
ffmpeg -hide_banner -loglevel warning \
  -rtsp_transport tcp \
  -timeout 5000000 \
  -i "rtsp://..." \
  -an -c:v copy \
  -f flv -flvflags no_duration_filesize \
  pipe:1
```

RTSP `timeout`（微秒）与 `rtsp_transport` 为官方协议文档所述选项；`pipe:1` 属于 pipe 协议用法。citeturn5view4turn11search0  

2) **transmux（copy）+ 开启音频 copy（未来可选，V1 可不开放）**

```bash
ffmpeg -hide_banner -loglevel warning \
  -rtsp_transport tcp \
  -timeout 5000000 \
  -i "rtsp://..." \
  -c:v copy -c:a copy \
  -f flv -flvflags no_duration_filesize \
  pipe:1
```

3) **转码到 H.264（必要时）+ 禁音（仍默认）**

```bash
ffmpeg -hide_banner -loglevel warning \
  -rtsp_transport tcp \
  -timeout 5000000 \
  -i "rtsp://..." \
  -an \
  -c:v libx264 -preset veryfast -tune zerolatency \
  -g 50 -keyint_min 50 \
  -f flv -flvflags no_duration_filesize \
  pipe:1
```

> 说明：转码参数（preset/tune/gop）属于工程策略，不是协议硬约束；应做成配置项并在 CI/运行时自检 `libx264` 是否存在（见后文 CI）。FFmpeg “输入→管道→输出”的整体工作方式在官方文档中被描述为由组件构建的处理管线。citeturn11search5turn11search4  

### FFmpegRunner 行为规范

**spawn 基线**：Node.js `child_process` 文档说明可以通过 `spawn()` 启动子进程，并通过默认建立的 `stdin/stdout/stderr` 管道进行非阻塞数据流动。citeturn2search2turn2search22  

**Runner 规则（强约束）**

- `spawn(cmd, args, { stdio: ['ignore','pipe','pipe'], windowsHide:true })`
- 进程启动后：
  - stdout：每个 `data` chunk 转为 `Uint8Array` 并 `FanoutHub.publish()`  
  - stderr：按行切分（`\n`），喂给 `FFmpegStderrParser`（生成结构化事件）并保存到 ring buffer（用于状态查询）  
  - exit：若 `state` 在 `starting/running`，触发 `FFMPEG_EXIT` 事件并进入 `error`（若仍有观众：主动断开所有 session 并返回错误；若无观众：清理即可）
- 启动成功判定：收到 stdout 首个 chunk 即视为 `STARTUP_SUCCESS`（同时记录 `startLatencyMs`）
- 重试策略（V1 简化）：
  - `starting` 阶段失败：允许重试 1 次（`maxStartAttempts=2`）
  - `running` 阶段异常退出：V1 不自动重连（避免隐藏问题）；由前端提示并允许用户点击“重试”触发新的 `GET /live/...`（也可由服务端在无人观看时自动重启，但不建议 V1 默认开启）

**stderr 解析器（V1 目标：可诊断，而非完美）**

- 解析输出行模式，映射到：
  - `UPSTREAM_AUTH_FAILED`（含 401/403 关键词）
  - `UPSTREAM_CONNECT_FAILED`（connect/timeout/refused 等）
  - `NO_MEDIA_OUTPUT`（未见任何 packet 输出且超时）
  - `UNSUPPORTED_CODEC`（unknown decoder/encoder）
- 结构化事件：

```ts
export interface FFmpegDiagEvent {
  ts: number;
  level: 'info'|'warn'|'error';
  code: ApiErrorCode;
  line: string;          // 原始行（可截断）
}
```

### FanoutHub 与慢客户端策略

**为什么 V1 必须做慢客户端治理**：HTTP-FLV 是长连接流式输出，避免“慢 consumer 导致内存无限涨/源被拖垮”是稳定性底线。Node 的 backpressure 指南解释了流之间速度不匹配会产生背压问题，并给出最佳实践方向。citeturn2search27turn2search2  

**建议实现：每 session 独立队列 + 统一发布**

- `FanoutHub.publish(chunk)`：遍历所有 session，调用 `session.enqueue(chunk)`
- `session.enqueue(chunk)`：
  - `queueBytes += chunk.byteLength`
  - 若超过阈值 `MAX_QUEUE_BYTES`（默认 2MB，可配置），则返回 `false` 并触发 `close('slow_client')`
- `LIVE` 路由侧的 streaming 回调中，为每个 session 启动 drain loop：
  - `while (!closed) { const chunk = await dequeue(); await stream.write(chunk); }`
- 断开策略：
  - 达到阈值：只断开该 session（不影响 source）
  - 断开后：若 `viewerCount==0`，启动 idleGrace 计时器

**阈值建议（V1 默认，必须可配置）**

- `MAX_QUEUE_BYTES=2 * 1024 * 1024`
- `MAX_QUEUE_CHUNKS=256`（可选第二道阈值）
- `DRAIN_TICK_MS=0`（使用 `await` 写入自然背压；不做 busy loop）

## 前端 Vue3 组件与 SDK

### Vue3 播放组件与 composable API

**mpegts.js 依据**

- Livestream 文档给出 HTTP-FLV 数据源示例：`{ type:'flv', isLive:true, url:'http://.../livestream.flv' }`，并说明需要正确 CORS。citeturn5view0  
- API 文档规定 `mpegts.createPlayer(mediaDataSource, config)`、`Player.attachMediaElement/load/play/destroy` 等生命周期；并提供 `enableStashBuffer`、`liveBufferLatencyChasing` 等配置项。citeturn6view0  

**packages/vue-player 对外导出（示例）**

- 组件：`<RtspFlvPlayer />`
- composable：
  - `useRtspStream()`：负责创建/查询/删除流（调用 SDK）
  - `useMpegtsFlvPlayer()`：负责 mpegts.js player 生命周期

**组件 Props（V1 最小集）**

```ts
export type PlayerSourceMode = 'streamId' | 'create';

export interface RtspFlvPlayerProps {
  baseUrl: string; // 服务端 base
  mode: PlayerSourceMode;

  streamId?: string;                 // mode='streamId'
  createRequest?: StreamCreateRequest; // mode='create'

  autoplay?: boolean;                // default true
  muted?: boolean;                   // default true（避免浏览器自动播放限制）
  stashBuffer?: boolean;             // default false（直播低延迟）
}
```

**组件 Events（建议）**

- `created(streamId)`
- `statechange({ state })`
- `stats({ decodedFrames, latency? })`（可选）
- `error({ code, message })`
- `closed(reason)`

**典型实现片段（Vue3 + mpegts.js）**

> 代码示意仅展示关键路径；实际实现需在 unmount 时 destroy，并处理重试按钮。

```ts
import mpegts from 'mpegts.js'
import type { StreamCreateRequest } from '@scope/protocol'
import { createStream, buildLiveUrl } from '@scope/sdk'

export async function mountPlayer(
  videoEl: HTMLVideoElement,
  baseUrl: string,
  mode: 'streamId'|'create',
  input: { streamId?: string; req?: StreamCreateRequest },
  opts: { stashBuffer: boolean; autoplay: boolean }
) {
  let streamId = input.streamId

  if (mode === 'create') {
    const res = await createStream(baseUrl, input.req!)
    streamId = res.streamId
  }

  const url = buildLiveUrl(baseUrl, streamId!)

  const player = mpegts.createPlayer(
    { type: 'flv', isLive: true, url, hasAudio: false, hasVideo: true },
    { enableStashBuffer: opts.stashBuffer }
  )

  player.attachMediaElement(videoEl)
  player.load()
  if (opts.autoplay) await player.play()

  return { streamId, player }
}
```

mpegts.js 对 `MediaDataSource.type/isLive/url/hasAudio/hasVideo` 与 `Config.enableStashBuffer` 的定义见其 API 文档；HTTP-FLV 直播示例见其 livestream 文档。citeturn6view0turn5view0  

### SDK（packages/sdk）接口与用法

**对外 API（建议）**

```ts
export async function createStream(baseUrl: string, req: StreamCreateRequest): Promise<StreamCreateResponse>;
export async function getStream(baseUrl: string, streamId: string): Promise<StreamStatusResponse>;
export async function deleteStream(baseUrl: string, streamId: string): Promise<void>;
export function buildLiveUrl(baseUrl: string, streamId: string): string;
```

**使用示例**

```ts
const baseUrl = 'http://localhost:3000'
const { streamId } = await createStream(baseUrl, { url: 'rtsp://...', transport: 'tcp' })
const playUrl = buildLiveUrl(baseUrl, streamId) // /v1/live/{streamId}.flv
```

## 容器化与 CI/本地开发

### FFmpeg 来源方案对比

| 方案 | 适用环境 | 优点 | 风险/代价 | V1 推荐 |
|---|---|---|---|---|
| 镜像内显式安装（apt/apk） | 生产容器/CI | 依赖透明、可审计、与镜像版本绑定；便于运维排障 | 发行版版本可能落后于最新；不同 distro 版本差异需通过固定镜像控制 | ✅ 默认 |
| `@ffmpeg-installer/ffmpeg` dev fallback | 本地开发 | 开发者无需手工安装 ffmpeg；跨平台启动快 | npm 包更新时间较久（npm 显示 1.1.0，2021-07 发布）；不宜作为生产依赖 | ✅ 仅开发兜底 |

citeturn3search2turn3search17  

### Dockerfile 草案（Debian slim 默认）

> 目标：monorepo 下只构建 server；镜像内安装 ffmpeg；非 root 运行；提供环境变量配置。

```dockerfile
# deploy/docker/server/Dockerfile
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# 安装 ffmpeg（生产依赖显式化）
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

FROM base AS builder
# 仅复制必要文件以便缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN corepack enable && pnpm fetch

COPY . .
RUN corepack enable && pnpm -r install --offline
RUN pnpm -C apps/server build
RUN pnpm -C apps/server prune --prod || true

FROM base AS runner
WORKDIR /app
# 非 root 用户（示例）
RUN useradd -m -u 1001 appuser
USER appuser

COPY --from=builder /app/apps/server/dist /app/dist
COPY --from=builder /app/apps/server/package.json /app/package.json
COPY --from=builder /app/node_modules /app/node_modules

ENV PORT=3000
EXPOSE 3000
ENTRYPOINT ["tini","--"]
CMD ["node","/app/dist/index.js"]
```

Node 官方说明 `node:bookworm` 基于 Debian 12；你选择 `node:22-bookworm-slim` 符合“默认生产镜像 Debian slim”的前提。citeturn8view0turn7view2  

### Dockerfile.alpine 草案（实验）

> 说明：Node 官方强调 Alpine 使用 musl libc，可能带来兼容问题；Hono 文档示例在 Alpine builder 安装 `gcompat`。因此 Alpine 版本必须明确标注“实验”。citeturn8view0turn9view0  

```dockerfile
# deploy/docker/server/Dockerfile.alpine
FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# 兼容层 + ffmpeg
RUN apk add --no-cache gcompat ffmpeg ca-certificates tini

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN corepack enable && pnpm fetch

COPY . .
RUN corepack enable && pnpm -r install --offline
RUN pnpm -C apps/server build

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 app \
  && adduser --system --uid 1001 app -G app
USER app

COPY --from=builder /app/apps/server/dist /app/dist
COPY --from=builder /app/apps/server/package.json /app/package.json
COPY --from=builder /app/node_modules /app/node_modules

ENV PORT=3000
EXPOSE 3000
ENTRYPOINT ["tini","--"]
CMD ["node","/app/dist/index.js"]
```

### compose 示例与 .dockerignore

`compose.yaml`（最小可运行）：

```yaml
services:
  server:
    build:
      context: ../..
      dockerfile: deploy/docker/server/Dockerfile
    ports:
      - "3000:3000"
    environment:
      PORT: "3000"
      LOG_LEVEL: "info"
      FFMPEG_PATH: "ffmpeg"
      STREAM_STARTUP_TIMEOUT_MS: "8000"
      STREAM_IDLE_GRACE_MS: "15000"
      MAX_QUEUE_BYTES: "2097152"
      SSRF_ALLOW_PRIVATE_IP: "false"
```

`.dockerignore` 推荐：

```text
**/node_modules
**/.pnpm-store
**/dist
.git
.github
apps/playground
```

### 运行时环境变量清单（服务端）

- `PORT`：监听端口  
- `LOG_LEVEL`：debug/info/warn/error  
- `FFMPEG_PATH`：优先级最高；覆盖系统 PATH。  
- `STREAM_STARTUP_TIMEOUT_MS`：启动超时（默认 8000）  
- `STREAM_IDLE_GRACE_MS`：空闲回收宽限（默认 15000）  
- `STOP_GRACE_MS`：SIGTERM 等待（默认 1500）  
- `MAX_QUEUE_BYTES`：慢客户端阈值（默认 2MB）  
- `MAX_SOURCES`：最大并发 source（防止爆内存）  
- `MAX_VIEWERS_PER_SOURCE`：每路最大观众  
- `SSRF_ALLOW_PRIVATE_IP`：是否允许私网（默认 false）  
- `RTSP_HOST_ALLOWLIST`：允许的主机/网段（强烈建议生产配置）  

### 本地开发与 @ffmpeg-installer/ffmpeg fallback

**约束来源**：`@ffmpeg-installer/ffmpeg` npm 页面显示其为跨平台二进制 installer，最新版本 1.1.0，最后发布于 2021-07（适合作为开发兜底而非生产主依赖）。citeturn3search2  

建议实现 `resolveFfmpegPath()`：

```ts
// apps/server/src/infra/ffmpeg/resolveFfmpegPath.ts
export async function resolveFfmpegPath(): Promise<string> {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  // 2) try system path: 'ffmpeg'
  // 这里可用 `spawnSync('ffmpeg',['-version'])` 探测
  if (await canRun('ffmpeg')) return 'ffmpeg';

  // 3) dev fallback
  if (process.env.NODE_ENV !== 'production') {
    const mod = await import('@ffmpeg-installer/ffmpeg');
    return mod.path;
  }

  throw new Error('FFMPEG_NOT_FOUND');
}
```

### CI 建议（能力检查必须可重复）

**RTSP/FLV 关键能力依据**：FFmpeg 协议文档详述 RTSP 及 `rtsp_transport`；FLV muxer 文档详述 `flvflags`；pipe 协议说明非 seekable 输出限制。citeturn5view4turn2search15turn11search0  

CI 步骤建议：

1. `ffmpeg -version`（存在性 + 版本记录到 build logs）  
2. `ffmpeg -protocols | grep rtsp`（必须支持 rtsp）  
3. `ffmpeg -codecs`（记录 codecs，用于排障）  
4. `ffmpeg -h muxer=flv`（应包含 flv muxer 选项；可进一步 grep `no_duration_filesize`）  
5.（若开放转码）`ffmpeg -encoders | grep libx264`（必须有 libx264）

## 监控、安全与里程碑

### 基本监控/指标与日志清单

**指标（Prometheus 命名建议）**

- `rtsp_gw_sources{state}`：当前 source 数  
- `rtsp_gw_viewers`：当前 viewer/session 数  
- `rtsp_gw_ffmpeg_start_latency_ms_bucket`：首帧耗时直方图  
- `rtsp_gw_bytes_out_total`：总输出字节  
- `rtsp_gw_slow_clients_total`：慢客户端断开次数  
- `rtsp_gw_ffmpeg_exits_total{reason}`：ffmpeg 退出计数  
- `rtsp_gw_start_fail_total{code}`：启动失败分类

**日志（结构化 JSON，必须包含 requestId/streamId/sourceKey）**

- 控制面：create/get/delete 请求日志  
- 媒体面：viewer connect/disconnect、close reason  
- FFmpeg：spawn cmd（脱敏）、pid、exit code、stderr 分类事件  
- 安全：SSRF 拦截原因、allowlist 命中规则（不打印原始密码）

### 安全与运维注意事项（SSRF、防泄漏、资源限制）

**SSRF 风险是该类系统的头号安全问题**：因为控制面允许用户提交 URL，服务端会发起对该 URL 的网络连接。entity["organization","OWASP","security nonprofit org"] 给出 SSRF 防护要点（输入校验、网络访问控制、禁止访问内网敏感地址等）。citeturn1search3turn1search19  

V1 必须实现的防线（建议均可配置）：

- URL 解析：只允许 `rtsp://` / `rtsps://`；拒绝 `file://`、`http://` 等非预期 scheme。  
- 解析主机到 IP 后校验网段：默认拒绝 RFC1918/localhost/link-local；只有在明确配置 `SSRF_ALLOW_PRIVATE_IP=true` 或 allowlist 命中时放行。  
- allowlist/denylist：支持 CIDR、域名后缀、端口白名单。  
- 凭据脱敏：日志中对 `rtsp://user:pass@host` 脱敏（保留 host/path，mask password）。  
- 资源限制：  
  - `MAX_SOURCES` 限制并发 ffmpeg 数（防止 DoS）。  
  - 每个 source 的 `MAX_VIEWERS_PER_SOURCE`。  
  - 启动超时与空闲回收（防僵尸进程）。  
- 容器层安全：以非 root 运行，限制 CPU/内存（Kubernetes/Compose 均可设置），并限制出站网络（如通过网络策略/iptables）。  

### 开发优先级与里程碑（分阶段可交付）

**阶段一：闭环可播放（最小可用）**

- protocol 包：错误码/请求响应类型  
- server：`POST /streams`、`GET /live/:id.flv`、懒启动（单观众）、FFmpeg spawn、stdout→Hono stream.write  
- playground：Vue3 页面可输入 RTSP 并播放  
- Docker（Debian slim）：可 build/run，镜像内 ffmpeg 可用

交付判定：mpegts.js 按 `type:'flv', isLive:true, url:http...flv` 能稳定播放。citeturn5view0turn6view0  

**阶段二：可用与可运维（单源复用 + 回收 + 诊断）**

- `sourceKey` 归一化与复用  
- StreamRegistry/StreamSource/PlaybackSession 成型  
- startupTimeout + idleGrace 回收  
- stderr 解析 + 状态查询 `GET /streams/:id`  
- 慢客户端淘汰（MAX_QUEUE_BYTES）  
- metrics/healthz

**阶段三：交付增强（容器/CI/安全）**

- CI：ffmpeg 能力检查（rtsp、flv muxer、（可选）libx264）citeturn5view4turn2search15turn11search0  
- Alpine 实验镜像 + 文档标注风险（musl/gcompat）citeturn8view0turn9view0  
- SSRF allowlist/denylist 完整实现 + 日志脱敏落地citeturn1search3turn1search19  
- SDK 与 Vue 组件对外 API 稳定、发布产物（npm package）

---

**权威参考摘要（你要求的“优先官方/权威来源”对应关系）**：  
Hono Streaming Helper 支持写入 `Uint8Array` 并提供 `onAbort`。citeturn10view0 ；Hono 在 Node.js 上通过 `@hono/node-server` 运行。citeturn12search2turn12search11 ；mpegts.js 直播文档给出 HTTP-FLV 与 WebSocket 源示例、并强调 CORS 与浏览器兼容性。citeturn5view0 ；mpegts.js API 文档定义 `createPlayer`、`MediaDataSource`、`Config` 与 Player 生命周期。citeturn6view0 ；FFmpeg 协议文档定义 RTSP 选项（`rtsp_transport`/`timeout` 等）。citeturn5view4 ；FFmpeg muxers 文档定义 FLV `flvflags`（含 `no_duration_filesize` 用于 non-seekable living stream）。citeturn2search15 ；FFmpeg protocols 文档说明 pipe 输出的 seekable 限制。citeturn11search0 ；Node 官方镜像文档说明 Alpine 使用 musl libc 并可用 `gcompat`/`libc6-compat` 解决部分共享库问题。citeturn8view0 ；Hono Dockerfile 示例展示 Alpine + `gcompat` 的模式。citeturn9view0 ；entity["organization","OWASP","security nonprofit org"] 给出 SSRF 防护权威建议。citeturn1search3turn1search19