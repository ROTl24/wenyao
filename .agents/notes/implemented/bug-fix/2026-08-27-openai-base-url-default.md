# Agent Note: 自定义 OpenAI 兼容服务裸域名使用版本化基址

Status: implemented

## Problem

自定义服务只填写裸域名时，地址规范化会直接拼接 `/chat/completions`。采用 OpenAI 兼容路由的网关通常把模型接口放在 `/v1` 下；根路径可能返回状态码为 200 的管理页面 HTML，随后被客户端识别为无法解析的模型响应。

## Decision

桌面端与 PWA 共用的地址规范化入口把自定义服务和 SiliconFlow 的裸域名规范为 `/v1` Base URL。DeepSeek 官方根路径和阿里云非标准路径不套用该默认值；用户明确填写的版本路径或完整能力接口始终具有最高优先级。

配置界面在地址输入框失焦后显示规范化结果。模型目录和最小测试仍各自只发起原有的一次请求，不会在响应失败后尝试第二个地址。

## Alternatives considered

- 收到无效响应后自动改用 `/v1` 重试：第一次请求可能已经到达计费模型接口，自动重试会破坏费用边界和单次测试语义。
- 只为一个服务域名添加规则：同类 OpenAI 兼容网关仍会重复出现相同问题，且域名规则不能表达协议约定。
- 只在 React 输入框补全：Electron 与 Web Worker 的非界面调用仍可能生成错误接口，无法形成跨运行时契约。

## Consequences

只填写 `https://api.example.com` 时，生成、向量与重排能力分别使用 `/v1/chat/completions`、`/v1/embeddings` 与 `/v1/rerank`。需要根路径接口的自定义服务可填写完整能力地址；已有 `/v1`、其他 Base Path 和完整接口不会被覆盖。

## Verification

- `electron/services/ai-setup-core.test.cjs` 覆盖裸域名、三项能力、显式版本路径、完整根路径接口与 DeepSeek 官方地址。
- `src/components/AISetupWizard.test.tsx` 覆盖输入框可见补全。
- `npm.cmd test`、`npm.cmd run build:renderer` 与 `npm.cmd run verify:web` 验证共享规范化在桌面端和 PWA 构建链中保持一致。
