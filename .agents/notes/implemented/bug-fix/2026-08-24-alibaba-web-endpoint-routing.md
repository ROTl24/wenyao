# Agent Note: 阿里云业务空间地址按浏览器能力路由

Status: implemented

## Problem

阿里云华北 2 业务空间的 OpenAI 兼容域名可以返回模型目录和聊天结果，但浏览器对不同能力接口的跨域预检结果并不一致。将同一个业务空间 Base URL 用于解读、向量和重排，会让两字段配置看似识别成功，却在向量请求阶段被浏览器阻止。能力地址规范化后可能表示成独立 `url`，也可能表示成 `baseUrl + path`；最小测试、方案激活与实际调用必须接受同一份规范化结果。

## Decision

解读、向量和重排作为三个独立能力配置，每项分别校验完整调用地址。阿里云解读与向量可使用 `dashscope.aliyuncs.com/compatible-mode/v1`，重排使用业务空间的 `compatible-api/v1/reranks`；网页端在发起请求前展示并锁定每项能力的实际请求来源。桌面端把完整重排地址规范化为 `baseUrl + path` 后，能力测试、索引准备和运行时调用共同将该组合视为已配置接口；只有 `url` 与 `path` 都不存在时才按业务空间接口缺失处理。

能力地址不会从另一项能力的路径隐式推断业务空间。API Key 可以通过内部引用沿用，但密钥明文仍由现有会话密钥边界管理。

## Alternatives considered

- 三项能力继续共用用户粘贴的业务空间 Base URL：该地址的向量接口不满足浏览器预检要求，无法完成网页版检索链路。
- 通过问爻公共代理转发模型请求：这会扩大 API Key 的传输与服务端处理边界，而阿里云已经提供满足浏览器调用要求的能力组合，因此没有必要引入代理。
- 仅依赖模型目录猜测重排模型：模型目录不能表达独立重排地址，无法形成可执行的三能力配置。

## Consequences

用户在对应能力页面填写服务商提供的调用地址；模型目录不可表达独立重排地址时，仍可使用厂商示例或手动模型名称完成设置。单独配置主模型不会触发阿里云向量或重排请求。已通过最小测试的业务空间重排地址不会在索引准备阶段因内部字段表示不同而被再次拒绝。

该路由依赖阿里云现行地域域名与接口契约；当服务商调整域名、CORS 或重排协议时，需要同步更新服务商目录与回归测试。

## Verification

- `src/lib/webAI/security.test.ts` 验证各能力端点、来源确认和相似恶意域名拒绝。
- `src/components/AISetupWizard.test.tsx` 验证独立能力页面、密钥引用和手动模型入口。
- `electron/services/ai-runtime.test.cjs` 验证业务空间重排最小测试可进入索引准备，同时继续拒绝没有 `url` 或 `path` 的损坏配置。
- `npm.cmd test`、`npm.cmd run typecheck`、`npm.cmd run build:renderer` 与 `npm.cmd run verify:web` 验证当前实现和网页发布产物。
