# @rtsp-gateway/protocol

`@rtsp-gateway/protocol` 定义网关跨包共享的数据契约与错误码。

## 目标

- 保持控制面 API 类型单一来源
- 约束 SDK、Server、Vue Player 的交互字段一致

## 主要类型

- 标识与状态：
  - `StreamId`
  - `SourceKey`
  - `SessionId`
  - `StreamState`
- 创建与查询：
  - `StreamCreateRequest`
  - `StreamCreateResponse`
  - `StreamStatusResponse`
- 错误：
  - `ApiErrorBody`
  - `ApiErrorCode`

## 导出

统一从 `src/index.ts` 导出，业务侧直接：

```ts
import type { StreamCreateRequest, ApiErrorCode } from "@rtsp-gateway/protocol";
```

## 开发命令

```bash
pnpm --filter @rtsp-gateway/protocol typecheck
pnpm --filter @rtsp-gateway/protocol build
```

