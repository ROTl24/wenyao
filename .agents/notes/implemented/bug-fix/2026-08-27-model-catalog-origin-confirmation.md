# Agent Note: 模型目录域名确认独立于模型名称

Status: implemented

## Problem

模型目录用于在模型名称未知时发现可选模型。PWA 配置界面曾复用完整能力连接来计算待确认域名，而完整能力连接要求模型名称非空；用户尚未选择模型时，界面提交空的域名确认，Worker 随后根据目录地址算出真实域名并拒绝请求。

## Decision

网页安全层为模型目录定义独立验证入口，从规范化后的 Base URL 构造 `/models` 安全目标并返回实际 origin。配置界面与隔离 Worker 共用该入口；目录域名的展示和确认只依赖 API 地址，不依赖模型名称。

实际生成、向量和重排请求继续使用完整能力连接验证。目录发现仍只发送一次请求，不绕过 HTTPS、公开域名和逐字 origin 匹配约束。

## Alternatives considered

- 在界面或 Worker 中填入占位模型：占位值会把目录安全契约伪装成完整能力配置，并让两个运行时继续重复推导规则。
- 模型目录请求跳过域名确认：该方案会让携带 API Key 的请求失去 PWA 既有的出站域名边界。
- 要求用户先手动填写任意模型：这会让模型发现依赖其本应发现的数据，形成循环前置条件。

## Consequences

用户只填写 API 地址和 API Key 时即可确认并请求模型目录；选择目录结果后再形成完整能力连接。模型目录与能力接口位于同一规范化服务 origin 时，界面展示值和 Worker 校验值保持一致。

## Verification

- `src/components/AISetupWizard.test.tsx` 覆盖模型名为空、裸域名补全和目录 origin 传递。
- `src/lib/webAI/security.test.ts` 覆盖不依赖模型名称的目录安全目标。
- `src/lib/webAI/worker.test.ts` 覆盖目录请求通过独立域名确认并返回模型 ID。
- `npm.cmd test`、`npm.cmd run typecheck`、`npm.cmd run build:renderer` 与 `npm.cmd run verify:web` 验证跨运行时和发布产物。
