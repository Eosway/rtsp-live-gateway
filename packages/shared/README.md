# @rtsp-gateway/shared

`@rtsp-gateway/shared` 提供跨包通用工具函数。

## 导出内容

- `sha256(input: string)`：生成哈希
- `nowIso()`：生成 ISO 时间字符串
- `maskRtspUrl(url: string)`：脱敏 RTSP URL 中的密码
- `createConsoleLogger()`：结构化控制台日志实现
- `Logger`、`LogLevel` 类型

## 设计约束

- 仅放无业务状态、可复用基础能力
- 避免引入重量依赖

## 开发命令

```bash
pnpm --filter @rtsp-gateway/shared typecheck
pnpm --filter @rtsp-gateway/shared build
```

