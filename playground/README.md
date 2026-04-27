# @rtsp-gateway/playground

`@rtsp-gateway/playground` 是基于 Vue 3 + Vite 的联调页面，用于快速验证：

- 输入 RTSP 参数
- 调用网关创建流
- 使用 `@rtsp-gateway/player-vue` 直接播放 HTTP-FLV

## 启动方式

在仓库根目录：

```bash
pnpm install
pnpm --filter @rtsp-gateway/playground dev
```

默认访问：`http://localhost:5173`

## 页面能力

- 编辑网关 `baseUrl`
- 设置 RTSP URL 与 transport
- 切换 `allowPrivateIp`（开发联调开关）
- 一键创建并播放
- 展示播放器状态与当前 `streamId`

## 依赖关系

- `@rtsp-gateway/client`
- `@rtsp-gateway/player-vue`

## 构建与检查

```bash
pnpm --filter @rtsp-gateway/playground typecheck
pnpm --filter @rtsp-gateway/playground build
```
