# @eosway/rtsp-live-gateway-player-vue

`@eosway/rtsp-live-gateway-player-vue` 提供 Vue 3 HTTP-FLV 播放组件和 composable，使用 rivmux 管理浏览器端播放生命周期，并负责网关 stream 的创建与删除。

## 1. 导出

- `RtspFlvPlayer`
- `useRtspFlvPlayer`
- `RtspFlvPlayerProps`
- `RtspFlvPlayerError`
- `RivmuxPlayerOptions`
- `MediaInfo`

## 2. Props

| Prop             | 类型                  | 必填 | 默认值          | 说明                                                   |
| ---------------- | --------------------- | ---- | --------------- | ------------------------------------------------------ |
| `baseUrl`        | `string`              | 是   | -               | 网关服务地址                                           |
| `sourceConfig`   | `StreamCreateRequest` | 是   | -               | 用于创建 stream 的播放源配置                           |
| `autoPlay`       | `boolean`             | 否   | `true`          | 是否自动播放                                           |
| `playerOptions`  | `RivmuxPlayerOptions` | 否   | rivmux 默认配置 | rivmux 播放器配置；`autoPlay` 和静音策略由组件统一收口 |
| `cleanOnUnmount` | `boolean`             | 否   | `false`         | 卸载时是否删除后端 stream                              |

`autoPlay` prop 优先于 `playerOptions.playback.autoPlay`。未显式设置 `playerOptions.playback.muted` 时，播放器使用 video 元素的 `muted` 属性。

稳定播放路径是 HTTP-FLV + H.264/AVC 或 HEVC/H.265 + AAC-LC。HEVC 需要浏览器支持准确的 `hvc1` MIME；服务端和 rivmux 均按 FFmpeg 采纳的 Enhanced FLV 最终标准实现，不使用非标准的 `id12` packet type。其他 codec 组合不构成稳定承诺。

## 3. 使用方式

### 3.1 默认播放

```vue
<script setup lang="ts">
import { RtspFlvPlayer } from '@eosway/rtsp-live-gateway-player-vue'
</script>

<template>
  <RtspFlvPlayer base-url="http://localhost:3000" :source-config="{ url: 'rtsp://camera/live', transport: 'tcp' }" muted playsinline />
</template>
```

### 3.2 配置 rivmux

```vue
<RtspFlvPlayer
  base-url="http://localhost:3000"
  :source-config="sourceConfig"
  :player-options="{
    playback: { muted: true },
    latency: { startupBuffer: 0.5, target: 1.5, max: 3 },
  }" />
```

只有在固定公共路径或 CDN 部署 Worker/WASM 时才需要设置 rivmux 的 `runtime.workerUrl` 和 `runtime.wasmUrl`。覆盖时必须提供同一版本的资产对，并满足目标环境的 CORS 与 CSP 要求。

## 4. Events

| 事件        | 载荷                 | 说明                           |
| ----------- | -------------------- | ------------------------------ |
| `created`   | `streamId: string`   | 已创建后端 stream              |
| `ready`     | -                    | video 首次进入可播放态         |
| `error`     | `RtspFlvPlayerError` | 网关客户端或 rivmux 播放器错误 |
| `mediaInfo` | `MediaInfo`          | rivmux 已识别的媒体信息        |
| `closed`    | `reason: string`     | 主动停止、重载或卸载关闭       |

播放器错误保留 rivmux 的 `code`、`message`、`terminal` 等信息于 `detail` 和 `cause` 中。终止错误会立即进入 `error` 状态；启动阶段的非终止错误保留 2 秒宽限窗口，期间 video 进入可播放态则忽略。

## 5. 生命周期

1. 检查当前浏览器是否满足 rivmux 基础运行条件。
2. 创建后端 stream 并组装 `/v1/live/:streamId`。
3. 依次等待 `attach(video)` 和 `start()`。
4. `stop()` 删除播放器和后端 stream。
5. `reload()` 删除旧 stream 后完整重建。
6. `detach()` 默认只销毁播放器；`cleanOnUnmount=true` 时同时删除 stream。
7. `baseUrl`、`sourceConfig`、`autoPlay` 或 `playerOptions` 变化时，组件自动重载。

组件 ref 暴露 `streamId`、`status`、`start()`、`stop()` 和 `reload()`。

## 6. 从旧 playerConfig 迁移

本次为破坏性替换，不保留兼容别名：

```diff
- :player-config="{ liveSyncMaxLatency: 3, liveSyncTargetLatency: 1.5 }"
+ :player-options="{ latency: { target: 1.5, max: 3 } }"
```

旧的 mpegts.js 配置不能直接传给 rivmux；请按 rivmux 的 `RivmuxPlayerOptions` 重新配置。mpegts.js 的 `metadataArrived` 事件也不再提供。

## 7. 注意事项

- 组件会在创建后端 stream 前检查 `rivmux.isSupported()`；不满足 Worker MSE、流式 Fetch、ReadableStream 或 WebAssembly 条件时不会创建 stream。
- 浏览器自动播放通常要求静音；组件模式可透传 `muted`，或设置 `playerOptions.playback.muted`。
- 网关的 MP3 音频输出不属于 rivmux 稳定输入范围；建议服务端转为 AAC-LC。
- H.265/HEVC 播放取决于浏览器解码能力和准确的 `hvc1` MIME；服务端输出与 rivmux 输入使用 FFmpeg 采纳的 Enhanced FLV 最终标准。
- 业务状态建议只依赖 `ready`、`error` 和页面级启动超时，不把 `mediaInfo` 视为播放成功。

## 8. 验证命令

```bash
pnpm --filter @eosway/rtsp-live-gateway-player-vue tsc
pnpm --filter @eosway/rtsp-live-gateway-player-vue test
pnpm --filter @eosway/rtsp-live-gateway-player-vue build
```
