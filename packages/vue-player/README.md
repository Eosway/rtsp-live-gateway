# @rtsp-gateway/vue-player

`@rtsp-gateway/vue-player` 提供 Vue 3 播放组件与播放辅助逻辑，封装了：

- `@rtsp-gateway/sdk` 的流创建/删除能力
- `mpegts.js` 的 HTTP-FLV 播放生命周期

适用于浏览器端播放 `/v1/live/:streamId.flv`。

## 1. 安装与导出

工作区内依赖：

```bash
pnpm --filter @rtsp-gateway/vue-player build
```

导出：

- `RtspFlvPlayer`
- `createMpegtsPlayer`
- `ensureStreamId`
- `cleanupStream`
- 类型：`RtspFlvPlayerProps`、`RtspFlvPlayerError`、`PlayerSourceMode`

## 2. 组件能力

### 2.1 两种数据源模式

- `mode="streamId"`
  - 外部直接传入已创建的 `streamId`
- `mode="create"`
  - 传入 `createRequest`，组件内部先创建流，再开始播放

### 2.2 Props

| Prop | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `baseUrl` | `string` | 是 | - | 网关服务地址，例如 `http://localhost:3000` |
| `mode` | `'streamId' \| 'create'` | 是 | - | 数据源模式 |
| `streamId` | `string` | 否 | - | `streamId` 模式使用 |
| `createRequest` | `StreamCreateRequest` | 否 | - | `create` 模式使用 |
| `autoplay` | `boolean` | 否 | `true` | 自动播放 |
| `muted` | `boolean` | 否 | `true` | 视频元素静音属性 |
| `stashBuffer` | `boolean` | 否 | `false` | 传给 mpegts `enableStashBuffer` |
| `destroyOnUnmount` | `boolean` | 否 | `false` | 组件卸载时，若由组件创建流则自动删除 |

### 2.3 Events

| 事件 | 载荷 | 说明 |
|---|---|---|
| `created` | `streamId: string` | 成功拿到 streamId（复用或新建） |
| `statechange` | `{ state: string }` | `starting/running/error/idle` 状态变化 |
| `error` | `{ code: string; message: string }` | 启动或播放失败 |
| `closed` | `reason: string` | 组件主动停止或卸载关闭 |

## 3. 使用示例

### 3.1 组件内部创建流（推荐）

```vue
<script setup lang="ts">
import { RtspFlvPlayer } from "@rtsp-gateway/vue-player";
</script>

<template>
  <RtspFlvPlayer
    base-url="http://localhost:3000"
    mode="create"
    :create-request="{ url: 'rtsp://camera/live', transport: 'tcp' }"
    :autoplay="true"
    :muted="true"
    :stash-buffer="false"
    :destroy-on-unmount="true"
  />
</template>
```

### 3.2 外部传 streamId

```vue
<script setup lang="ts">
import { RtspFlvPlayer } from "@rtsp-gateway/vue-player";
const streamId = "st_xxx";
</script>

<template>
  <RtspFlvPlayer
    base-url="http://localhost:3000"
    mode="streamId"
    :stream-id="streamId"
  />
</template>
```

## 4. 生命周期说明

1. `onMounted` 触发 `startPlayback`
2. 根据 `mode` 解析/创建 `streamId`
3. 通过 `buildLiveUrl` 组装 `.flv` 地址
4. `mpegts.createPlayer` -> `attachMediaElement` -> `load` -> `play`
5. `onBeforeUnmount` 执行 `stopPlayback`
6. 若 `destroyOnUnmount=true` 且流由组件创建，则调用 `deleteStream`

## 5. mpegts.js 相关行为

- 检查 `mpegts.isSupported()`，不支持时直接报错
- 使用直播配置：
  - `type: "flv"`
  - `isLive: true`
  - `hasAudio: false`
  - `hasVideo: true`
- 可控低延迟参数：
  - `enableStashBuffer`（由 `stashBuffer` 控制）
  - `liveBufferLatencyChasing: true`

## 6. 注意事项

- 必须确保服务端 CORS 配置正确。
- 浏览器自动播放策略可能要求静音后才允许自动播放，建议默认 `muted=true`。
- `error` 事件用于 UI 层展示与重试控制。

## 7. 开发命令

```bash
pnpm --filter @rtsp-gateway/vue-player typecheck
pnpm --filter @rtsp-gateway/vue-player build
```

