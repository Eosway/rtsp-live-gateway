# @rtsp-gateway/client

`@rtsp-gateway/client` 是网关控制面 API 的轻量封装，不包含播放器逻辑。

## 导出 API

- `createStream(baseUrl, req)`
- `getHealthz(baseUrl)`
- `getStream(baseUrl, streamId)`
- `listStreams(baseUrl)`
- `deleteStream(baseUrl, streamId)`
- `buildLiveUrl(baseUrl, streamId)`
- `ClientError`

## 使用示例

```ts
import { createStream, buildLiveUrl, deleteStream } from '@rtsp-gateway/client'

const baseUrl = 'http://localhost:3000'
const created = await createStream(baseUrl, {
  url: 'rtsp://camera/live',
  transport: 'tcp',
})

console.log(created.streamId)
console.log(buildLiveUrl(baseUrl, created.streamId))

await deleteStream(baseUrl, created.streamId)
```

## 错误处理

请求失败会抛出 `ClientError`：

- `status`：HTTP 状态码
- `code`：服务端 `ApiErrorCode`（若有）
- `requestId`：服务端请求 ID（若有）
- `detail`：服务端错误详情（若有）

## 边界说明

- SDK 依赖全局 `fetch`（浏览器或 Node 18+ 环境）
- 仅做协议封装，不处理重试策略和播放器生命周期

## 开发命令

```bash
pnpm --filter @rtsp-gateway/client tsc
pnpm --filter @rtsp-gateway/client build
pnpm --filter @rtsp-gateway/client test
```
