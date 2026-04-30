# @eosway/rtsp-live-gateway-player-vue

`@eosway/rtsp-live-gateway-player-vue` 提供 Vue 3 播放组件与播放辅助逻辑，封装了：

- `@eosway/rtsp-live-gateway-client` 的流创建/删除能力
- `mpegts.js` 的 HTTP-FLV 播放生命周期

适用于浏览器端播放 `/v1/live/:streamId`。

## 1. 安装与导出

工作区内依赖：

```bash
pnpm --filter @eosway/rtsp-live-gateway-player-vue build
```

导出：

- `RtspFlvPlayer`
- `useRtspFlvPlayer`
- 类型：`RtspFlvPlayerProps`、`RtspFlvPlayerError`、`UseRtspFlvPlayerOptions`（与 `RtspFlvPlayerProps` 等价）

## 2. 组件能力

### 2.1 创建并播放单路流

- 组件只支持传入 `sourceConfig`
- 创建后会播放 `/v1/live/:streamId`
- 以事件驱动为主，不暴露状态 ref
- 默认情况下，组件卸载只销毁前端播放器实例，不会自动删除后端 stream
- 如果传入 `cleanOnUnmount=true`，组件卸载时会显式删除后端 stream
- 如果需要显式删除后端 stream，调用组件实例的 `stop()`

### 2.2 Props

| Prop             | 类型                  | 必填 | 默认值  | 说明                                           |
| ---------------- | --------------------- | ---- | ------- | ---------------------------------------------- |
| `baseUrl`        | `string`              | 是   | -       | 网关服务地址，例如 `http://localhost:3000`     |
| `sourceConfig`   | `StreamCreateRequest` | 是   | -       | 播放源配置，会用于创建 stream                  |
| `autoPlay`       | `boolean`             | 否   | `true`  | 自动播放                                       |
| `playerConfig`   | `MediaPlayerConfig`   | 否   | -       | 传给 mpegts 的播放器配置，会覆盖默认 live 配置 |
| `cleanOnUnmount` | `boolean`             | 否   | `false` | 组件卸载时是否显式删除后端 stream              |

### 2.3 Events

| 事件              | 载荷                                                                                                                         | 说明                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `created`         | `streamId: string`                                                                                                           | 成功创建 stream 并拿到 streamId |
| `error`           | `{ type: 'client' \| 'media_player'; code: string; message: string; requestId?: string; detail?: unknown; cause?: unknown }` | 启动或播放失败                  |
| `mediaInfo`       | `MediaInfo`                                                                                                                  | 已解析到媒体信息                |
| `metadataArrived` | `unknown`                                                                                                                    | 已收到 mpegts metadata          |
| `closed`          | `reason: string`                                                                                                             | 组件主动停止或卸载关闭          |

## 3. 使用示例

### 3.1 组件内部创建流（推荐）

```vue
<script setup lang="ts">
import { RtspFlvPlayer } from '@eosway/rtsp-live-gateway-player-vue'
</script>

<template>
  <RtspFlvPlayer
    base-url="http://localhost:3000"
    :source-config="{ url: 'rtsp://camera/live', transport: 'tcp' }"
    :auto-play="true"
    :player-config="{ liveSyncMaxLatency: 3, liveSyncTargetLatency: 1.5 }"
    muted
    playsinline
    :clean-on-unmount="false" />
</template>
```

### 3.2 通过 ref 显式停止并删除后端 stream

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { RtspFlvPlayer } from '@eosway/rtsp-live-gateway-player-vue'

const playerRef = ref<InstanceType<typeof RtspFlvPlayer>>()

async function stopPlayer() {
  await playerRef.value?.stop('manual_stop')
}
</script>

<template>
  <button @click="stopPlayer">停止并删除流</button>

  <RtspFlvPlayer ref="playerRef" base-url="http://localhost:3000" :source-config="{ url: 'rtsp://camera/live', transport: 'tcp' }" />
</template>
```

组件 `ref` 仅暴露命令式方法和 `streamId`：

- `streamId`
- `start()`
- `stop()`
- `reload()`

## 4. 生命周期说明

1. 组件挂载后自动创建 stream
2. 使用 `streamId` 组装 `/v1/live/:streamId`
3. `mpegts.createPlayer` -> `attachMediaElement` -> `load` -> `play`
4. 组件卸载时默认只销毁前端播放器实例
5. 若 `cleanOnUnmount=true`，组件卸载时会显式调用 `deleteStream`
6. 调用 `ref.stop()` 时会显式调用 `deleteStream`
7. 调用 `ref.reload()` 时会走完整重建流程：删除旧 stream，重新创建新 stream，再重新播放
8. `baseUrl`、`sourceConfig`、`autoPlay`、`playerConfig` 变化时，组件会自动重载

## 5. useRtspFlvPlayer

`useRtspFlvPlayer` 是高级模式，统一只接收 `sourceConfig`，由 composable 内部创建 stream。
它不会自动接管生命周期，调用方需要自己：

- `attach(videoEl)`
- `start()`
- `reload()`
- `stop()`
- `detach()`

返回值中不暴露 `state`，调用方应优先消费事件和错误回调。

额外选项：

- `playerConfig`
  - 会透传给 `mpegts.createPlayer`
  - 在内部默认 live 配置基础上做覆盖
- 其余未声明为组件 props 的属性，会透传给内部 `<video>` 元素
  - 例如 `muted`、`playsinline`、`controls`、`poster`、`preload`、`class`、`style`
- `cleanOnUnmount`
  - 默认 `false`
  - `detach()` 时是否执行删除后端 stream 的清理语义
  - 会显式删除当前后端 stream

## 6. mpegts.js 相关行为

- 检查 `mpegts.isSupported()`，不支持时直接报错
- 使用直播配置：
  - `type: "flv"`
  - `isLive: true`
  - `hasAudio: false`
  - `hasVideo: true`
- 默认监控直播配置：
  - `enableStashBuffer: true`
  - `liveSync: true`
  - `liveSyncMaxLatency: 4`
  - `liveSyncTargetLatency: 2`
  - `liveSyncPlaybackRate: 1.2`
  - `autoCleanupSourceBuffer: true`
  - `autoCleanupMaxBackwardDuration: 30`
  - `autoCleanupMinBackwardDuration: 15`
- 传入 `playerConfig` 时，会在以上默认值基础上覆盖

## 7. 注意事项

- 必须确保服务端 CORS 配置正确。
- 浏览器自动播放策略可能要求视频元素静音后才允许自动播放，建议透传 `muted` 给内部 `<video>`。
- `error` 事件统一透传 `{ type, code, message, requestId, detail, cause }`，其中 `type` 用于区分 `client` 与 `media_player`。

## 8. 开发命令

```bash
pnpm --filter @eosway/rtsp-live-gateway-player-vue tsc
pnpm --filter @eosway/rtsp-live-gateway-player-vue build
```
