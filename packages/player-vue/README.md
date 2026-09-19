# @eosway/rtsp-live-gateway-player-vue

`@eosway/rtsp-live-gateway-player-vue` 为 Vue 3 应用提供 RTSP 播放封装。组件通过 `@eosway/rtsp-live-gateway-client` 请求网关创建或复用流，再将网关返回的 HTTP-FLV 地址交给 `rivmux` 在浏览器中播放。

本包不直接连接 RTSP 源，也不负责删除网关 stream。网关 stream 可能被多个播放请求复用，生命周期清理由服务端或网关管理端负责。

## 安装

```sh
pnpm add @eosway/rtsp-live-gateway-player-vue
```

运行时需要同时安装并提供 Vue 3。播放器依赖现代浏览器的 Dedicated Worker、Worker MSE、流式 Fetch、ReadableStream 和 WebAssembly 能力。

## 导出

- `RtspFlvPlayer`：默认的 `<video>` 播放组件。
- `useRtspFlvPlayer`：用于自定义承载场景的 composable。
- `RtspFlvPlayerOptions`：组件和 composable 输入类型。
- `RtspFlvPlayerController`：composable 与组件 ref 的控制器类型。
- `RtspFlvPlayerStatus`：播放器状态类型。
- `RtspFlvPlayerError`：网关或播放器错误类型。
- `MediaInfo`、`PlayerError`、`PlayerStats`、`PlayerWarning`、`ReconnectInfo`、`RecoveryInfo`、`RivmuxPlayerOptions`：rivmux 公开类型。
- `isSupported()`、`getCapabilities()`：rivmux 基础运行能力探测。

## 组件用法

```vue
<script setup lang="ts">
import { RtspFlvPlayer } from '@eosway/rtsp-live-gateway-player-vue'

const sourceConfig = {
  url: 'rtsp://camera-host/live',
  transport: 'tcp',
  video: { mode: 'auto', codec: 'h264' },
  audio: { enabled: true, mode: 'auto', codec: 'aac' },
}

function handleError(error: { type: string; code: string; message: string }) {
  console.error(`[${error.type}:${error.code}] ${error.message}`)
}
</script>

<template>
  <RtspFlvPlayer
    server-url="http://localhost:3000"
    :source-config="sourceConfig"
    :player-options="{ playback: { autoPlay: true, muted: true } }"
    playsinline
    controls
    @started="() => console.log('播放器已启动')"
    @error="handleError" />
</template>
```

组件未声明的属性会透传给内部 `<video>` 元素，例如 `muted`、`playsinline`、`controls`、`poster`、`preload`、`class` 和 `style`。组件会附加 `width: 100%` 与 `max-width: 100%` 的默认样式；传入的 `style` 会继续合并。

### Props

| Prop            | 类型                  | 必填 | 说明                                                             |
| --------------- | --------------------- | ---- | ---------------------------------------------------------------- |
| `serverUrl`     | `string`              | 是   | RTSP Live Gateway 服务地址，例如 `http://localhost:3000`。       |
| `sourceConfig`  | `StreamCreateRequest` | 是   | 网关创建或复用 stream 时使用的 RTSP 地址、传输方式和音视频配置。 |
| `playerOptions` | `RivmuxPlayerOptions` | 否   | 直接传给 rivmux 的播放器配置。                                   |

`autoPlay` 和 `muted` 不再有组件级重复配置，分别通过 `playerOptions.playback.autoPlay` 和 `playerOptions.playback.muted` 设置。video 元素上的 `muted` 属性仍可透传；为了让播放器配置和元素属性保持一致，建议在 `playerOptions.playback` 中明确设置 `muted`。

### Events

| 事件           | 载荷                 | 说明                                                                                     |
| -------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| `started`      | 无                   | `RivmuxPlayer.start()` 成功完成。此事件不表示已经收到媒体数据或 video 已触发 `canplay`。 |
| `stopped`      | 无                   | 播放器已停止并由 rivmux 报告停止完成；实例可以再次 `start()`。                           |
| `destroyed`    | 无                   | 播放器实例已销毁，不应再次使用。组件卸载时会触发。                                       |
| `media-info`   | `MediaInfo`          | rivmux 已识别出容器、音视频 codec 或轨道信息。                                           |
| `warning`      | `PlayerWarning`      | rivmux 报告的可恢复警告。                                                                |
| `reconnecting` | `ReconnectInfo`      | rivmux 已安排下一次网络重连。                                                            |
| `recovered`    | `RecoveryInfo`       | 重连后的新会话已经恢复媒体输出。                                                         |
| `error`        | `RtspFlvPlayerError` | 网关请求、播放器运行时或媒体处理错误。                                                   |

Vue 模板中使用 kebab-case 监听事件，例如 `@media-info`、`@reconnecting` 和 `@destroyed`。

### Ref 控制器

组件 ref 暴露以下属性和方法：

```ts
interface RtspFlvPlayerController {
  readonly status: Readonly<Ref<RtspFlvPlayerStatus>>
  readonly error: Readonly<Ref<RtspFlvPlayerError | undefined>>
  start(): Promise<void>
  stop(): Promise<void>
  restart(): Promise<void>
  destroy(): Promise<void>
}
```

`stop()` 只停止浏览器播放器，不删除网关 stream；`restart()` 销毁当前 rivmux 实例、丢弃本地 stream 标识，并按当前 options 重新请求或复用 stream；`destroy()` 销毁播放器实例，销毁后不应继续调用控制方法。

## Composable 用法

当需要自定义 video 承载、布局或控制条时，可以直接使用 composable：

```ts
import { ref } from 'vue'
import { useRtspFlvPlayer } from '@eosway/rtsp-live-gateway-player-vue'

const video = ref<HTMLVideoElement>()
const controller = useRtspFlvPlayer(
  {
    serverUrl: 'http://localhost:3000',
    sourceConfig: { url: 'rtsp://camera-host/live', transport: 'tcp' },
    playerOptions: {
      playback: { autoPlay: true, muted: true },
      latency: { startupBuffer: 0.5, target: 1.5, max: 3 },
    },
  },
  {
    onStarted: () => console.log('播放器已启动'),
    onMediaInfo: (info) => console.log('媒体信息', info),
    onError: (error) => console.error(error),
  }
)

controller.attach(video.value!)
await controller.start()
```

Composable 的 options 也可以传入返回 options 的函数，适合组件 props 或其他响应式输入：

```ts
useRtspFlvPlayer(() => ({
  serverUrl: serverUrl.value,
  sourceConfig: sourceConfig.value,
}))
```

## 生命周期与错误

启动流程会先检查 `isSupported()`，确认浏览器具备 rivmux 的基础运行能力后才请求网关 stream。随后按 `create stream → attach(video) → start()` 的顺序初始化播放器。

播放器错误分为两类：

- `type: 'client'`：网关请求或 stream 创建失败。`requestId`、HTTP 状态和服务端错误详情会保留在错误对象中。
- `type: 'player'`：rivmux attach、网络读取、解封装、codec、MSE 或运行时错误。rivmux 原始结构会保留在 `detail` 和 `cause` 中，其中包括 `code`、`message`、`terminal` 等字段。

非终止播放器错误会通过 `error` 事件报告，但不代表播放器实例一定已经不可用；应结合 `warning`、`reconnecting`、`recovered` 和当前 `status` 判断后续状态。终止错误通常会使当前播放实例进入 `error` 状态，需要调用 `restart()` 或重新挂载组件。

## rivmux 配置

`playerOptions` 直接使用 rivmux 的配置结构：

```vue
<RtspFlvPlayer
  server-url="http://localhost:3000"
  :source-config="sourceConfig"
  :player-options="{
    playback: { autoPlay: true, muted: true },
    latency: {
      startupBuffer: 0.35,
      target: 1.2,
      max: 2.5,
      maxForwardBuffer: 4,
      backwardBuffer: 1.5,
    },
    network: {
      credentials: 'same-origin',
      retry: { maxAttempts: 3, backoffMs: 500 },
    },
  }" />
```

只有在固定公共路径或 CDN 部署 rivmux Worker/WASM 资产时才需要覆盖 `runtime.workerUrl` 和 `runtime.wasmUrl`。覆盖时必须使用同一版本的资产，并满足目标环境的 CORS 与 CSP 要求。

## 支持边界

稳定播放路径为 HTTP-FLV + H.264/AVC 或 HEVC/H.265 + AAC-LC。HEVC 播放取决于浏览器、操作系统和设备对准确 `hvc1` MIME 的解码支持。AV1、Opus 以及其他 codec 组合不构成稳定承诺。

`isSupported()` 只表示 Dedicated Worker、Worker MSE、流式 Fetch、ReadableStream 和 WebAssembly 等基础运行条件可用，不保证具体 stream 一定能够播放。实际播放仍受网关输出、浏览器 codec 能力、CORS、CSP 和自动播放策略影响。

网关 stream 可能被多个请求复用，因此组件不会在 `stop()`、`destroy()` 或卸载时调用删除接口。需要释放后端 stream 时，应由网关管理端根据服务端资源策略显式处理。

## 从旧版本迁移

本次重构不保留兼容层，直接替换旧 API：

```diff
- :auto-play="true"
- :clean-on-unmount="true"
- @created="onCreated"
- @ready="onReady"
- @closed="onClosed"
- controller.reload()
+ :player-options="{ playback: { autoPlay: true, muted: true } }"
+ @started="onStarted"
+ @stopped="onStopped"
+ @destroyed="onDestroyed"
+ controller.restart()
```

旧的 mpegts.js 配置不能直接传给 rivmux；请按 `RivmuxPlayerOptions` 重新配置。mpegts.js 的 `metadataArrived` 等事件不再提供。

## 本地验证

```sh
pnpm --filter @eosway/rtsp-live-gateway-player-vue tsc
pnpm --filter @eosway/rtsp-live-gateway-player-vue test
pnpm --filter @eosway/rtsp-live-gateway-player-vue build
```
