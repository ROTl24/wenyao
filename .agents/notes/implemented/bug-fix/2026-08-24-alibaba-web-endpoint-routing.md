# Agent Note: 阿里云业务空间地址按浏览器能力路由

Status: implemented

## Problem

阿里云华北 2 业务空间的 OpenAI 兼容域名可以返回模型目录和聊天结果，但浏览器对不同能力接口的跨域预检结果并不一致。将同一个业务空间 Base URL 用于解读、向量和重排，会让两字段配置看似识别成功，却在向量请求阶段被浏览器阻止。

## Decision

两字段接入识别到严格匹配的 `{workspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` 地址时，将其解释为阿里云百炼完整方案。解读与向量使用 `dashscope.aliyuncs.com/compatible-mode/v1`，重排使用该业务空间的 `compatible-api/v1/reranks`，业务空间 ID 只从已校验的主机名中提取。

该识别只接受锚定的华北 2 域名和路径。连接确认继续展示所有实际请求来源，API Key 仍由现有会话密钥边界管理。

## Alternatives considered

- 三项能力继续共用用户粘贴的业务空间 Base URL：该地址的向量接口不满足浏览器预检要求，无法完成网页版检索链路。
- 通过问爻公共代理转发模型请求：这会扩大 API Key 的传输与服务端处理边界，而阿里云已经提供满足浏览器调用要求的能力组合，因此没有必要引入代理。
- 仅依赖模型目录猜测重排模型：模型目录不能表达独立重排地址，无法形成可执行的三能力配置。

## Consequences

用户继续只需提供业务空间 API 地址和 API Key，问爻无需先请求模型目录即可生成完整配置。非华北 2、非严格匹配域名以及未知服务商仍走通用发现流程，不会套用阿里云规则。

该路由依赖阿里云现行地域域名与接口契约；当服务商调整域名、CORS 或重排协议时，需要同步更新服务商目录与回归测试。

## Verification

- `src/lib/customAIConnection.test.ts` 验证业务空间地址、最终三项端点以及相似恶意域名拒绝。
- `src/components/AISetupWizard.test.tsx` 验证两字段向导无需模型目录请求即可识别完整方案。
- `npm.cmd test`、`npm.cmd run typecheck`、`npm.cmd run build:renderer` 与 `npm.cmd run verify:web` 验证当前实现和网页发布产物。
