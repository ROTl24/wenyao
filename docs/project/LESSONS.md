---
project_docs_schema: 1
document_type: lessons
last_reviewed: 2026-09-04
---

# 项目教训

## Lesson Index

| 教训 | 状态 | 适用范围 | 摘要 |
|---|---|---|---|
| `LES-20260827-corpus-metadata-parity` | `active` | Electron、PWA、Worker 的内置语料边界 | 共享算法不等于共享输入语义，分类元数据必须在所有运行时统一装配 |
| `LES-20260827-openai-html-response` | `active` | 自定义 AI Base URL 与能力接口 | HTTP 200 的管理页面 HTML 仍是错误接口，裸域名必须在请求前规范化 |
| `LES-20260827-chat-visible-output` | `active` | OpenAI Chat 生成模型与最小测试 | HTTP 200 和推理输出不等于可展示正文，探测预算与空正文原因必须独立验证 |
| `LES-20260904-formal-generation-uncapped` | `active` | Electron 与 PWA 正式解读和追问 | 探测预算不能变成正式生成上限，正式请求由服务商模型决定可用上下文与输出空间 |
| `LES-20260827-model-catalog-before-model` | `active` | PWA 模型目录与出站域名确认 | 模型发现发生在模型选择之前，目录安全目标不能依赖模型名称 |
| `LES-20260827-release-metadata-drives-update` | `active` | Windows 桌面在线更新与 GitHub Release | 代码和安装包上传不等于旧客户端可更新，稳定 Release 元数据与资产必须共同验证 |
| `LES-20260831-paid-batch-recovery` | `active` | Electron、PWA 的远程向量建库 | 可续建不等于可盲目重试，失败恢复必须同时约束完整批次断点、服务状态验证与用户显式动作 |
| `LES-20260901-web-ai-terminal-cleanup` | `active` | PWA OpenAI Chat 流式生成 | 协议完成态不能被底层流清理异常覆盖 |
| `LES-20260904-rerank-endpoint-parity` | `active` | 阿里云重排测试、激活与调用 | 同一规范化接口必须在所有阶段按同一契约解释 |

## Active Lessons

### LES-20260904-formal-generation-uncapped

- Status: `active`
- Source: `user-confirmed` / `code-verified`
- 适用范围：Electron 与 PWA 的 OpenAI Chat 正式解读、追问、Provider 请求体和最小连接测试。
- 症状：DeepSeek 正式解读接收完整输入后输出恰好达到 8192 Token，`finish_reason` 为 `length`，推理内容耗尽预算但没有生成可展示正文。
- 错误方向：自动重试、把内部推理当作正文或全局关闭 DeepSeek 思考；这些做法会重复计费、破坏可展示正文契约或改变正式解读质量。
- 已验证根因：正式调用固定传入 `maxTokens: 8192`，桌面和网页 Provider 又无条件序列化为 `max_tokens`，把应用默认值变成了推理模型的硬输出预算。
- 正确规则：正式解读和追问不设置应用侧输入或输出 Token 上限；Provider 只在调用方明确给出预算时发送 `max_tokens`。最小连接测试继续以 512 Token 单次预算控制费用，服务商自身限制继续如实报告。
- 防线：桌面正式调用、桌面 Provider、网页 Provider 分别断言正式请求没有 `max_tokens` 或 `max_completion_tokens`，既有探测回归断言显式 512 Token 仍会发送且失败不会自动重试。
- 不再适用：服务商要求正式请求必须显式提供输出预算，或产品新增用户可见且经过费用确认的正式生成预算配置时。
- 证据：`electron/services/ai.cjs`、`electron/services/ai-provider.cjs`、`src/lib/webAI/provider.ts` 及对应回归测试。
- 相关 Note：[OpenAI Chat 探测与响应采用跨运行时共享契约](../../.agents/notes/implemented/bug-fix/2026-08-27-openai-chat-probe-response.md)。

### LES-20260904-rerank-endpoint-parity

- Status: `active`
- Source: `user-confirmed` / `code-verified`
- 适用范围：共享 AI 地址规范化、Electron 能力测试、方案激活与重排调用。
- 症状：阿里云重排最小测试已经成功，点击完成配置后仍在 0/1263 处提示缺少北京地域业务空间接口。
- 错误方向：要求用户重复填写业务空间 ID 或重复最小测试；地址已经成功调用过，重复远程请求不能修复内部字段判定不一致，还可能增加计费。
- 已验证根因：完整重排地址被规范化为 `baseUrl + path`，Provider 按该组合完成了最小测试；桌面方案激活却只检查独立 `url` 字段，把同一份有效配置误判为缺少接口。
- 正确规则：最小测试、方案激活与实际调用必须接受同一端点表示。`url` 或规范化后的 `path` 任一存在即表示接口已配置；两者都不存在的旧配置或损坏配置继续失败关闭。
- 防线：离线 Runtime 回归从阿里云业务空间完整地址执行重排最小测试，再完成三项配置和本地模拟建库；配套反例验证没有 `url` 与 `path` 时不会发起建库请求。
- 不再适用：能力定义统一为一种强制端点结构，并由解析层在保存前完成 Schema 校验后。
- 证据：`shared/ai-setup-core.cjs`、`electron/services/ai-runtime.cjs`、`electron/services/ai-provider.cjs`、`electron/services/ai-runtime.test.cjs`。
- 相关 Note：[阿里云业务空间地址按浏览器能力路由](../../.agents/notes/implemented/bug-fix/2026-08-24-alibaba-web-endpoint-routing.md)。

### LES-20260901-web-ai-terminal-cleanup

- Status: `active`
- Source: `user-confirmed` / `code-verified`
- 适用范围：PWA OpenAI Chat SSE 生成与浏览器 `ReadableStream` 生命周期。
- 症状：AI 服务已经返回完整正文和终止标记，界面仍可能显示“无法连接 AI 服务”，完整报告不会进入自动保存。
- 错误方向：自动重试、缩短输出或改用公共代理；这些做法不能修复已完成结果被清理异常覆盖的问题，还会增加重复计费或改变安全边界。
- 已验证根因：Provider 在解析到 `[DONE]` 后仍等待 `reader.cancel()`；底层流已经关闭或异常时，取消操作的拒绝会进入通用网络错误分支并覆盖完成态。
- 正确规则：协议终止标记确立完成态后应立即返回已解析结果；底层流清理可以继续尝试，但其失败不能逆转业务成功。尚未完成的中断流仍按单次失败处理，不自动重试。
- 防线：构造正文、`finish_reason`、`[DONE]` 和拒绝取消操作的 Provider 回归测试，直接断言完整正文成功返回。
- 不再适用：应用不再消费 SSE 流，或底层传输协议提供独立且原子的结果提交语义时。
- 证据：`src/lib/webAI/provider.ts`、`src/lib/webAI/provider.test.ts`。
- 相关 Note：[网页 AI 流式解读使用分层超时边界](../../.agents/notes/implemented/bug-fix/2026-08-25-web-ai-stream-start-deadline.md)。

### LES-20260827-corpus-metadata-parity

- Status: `active`
- Source: `code-verified`
- 适用范围：`resources/corpus.json`、`resources/knowledge-index.json` 及 Electron/PWA/Worker 消费路径。
- 症状：PWA 显示 0 条规则、0 条占例和 1263 条义理，检索证据缺少合法 `knowledgeKind`。
- 错误方向：只修正设置页数字；该做法不能修复书内条目、证据标签或检索分类多样性。
- 已验证根因：Electron 合并正文与知识索引，PWA 两条消费路径只导入正文，平台共享了检索算法却没有共享分类后的输入。
- 正确规则：内置语料必须先通过跨运行时共享装配入口，再用于统计、浏览和检索。
- 防线：浏览器状态测试、Worker 证据分类测试、全 ID 分类计数测试和浏览器 CommonJS 转换测试。
- 不再适用：正文和分类合并为具有单一权威 Schema 的构建产物，并由等价测试覆盖所有运行时后。
- 证据：`shared/corpus-knowledge.cjs`、`src/lib/desktop.test.ts`、`src/lib/webAI/worker.test.ts`、`electron/services/corpus-knowledge.test.cjs`。
- 相关 Note：[内置古籍分类由跨运行时共享入口装配](../../.agents/notes/implemented/bug-fix/2026-08-27-shared-corpus-knowledge.md)。

### LES-20260827-openai-html-response

- Status: `active`
- Source: `code-verified`
- 适用范围：`shared/ai-setup-core.cjs`、Electron AI Runtime 与 Web AI Worker。
- 症状：自定义服务返回 HTTP 200，但响应正文是管理站点 HTML，界面显示无法解析模型数据。
- 已验证根因：只填写裸域名时直接拼接 `/chat/completions`，遗漏 OpenAI 兼容网关使用的 `/v1` Base Path。
- 正确规则：自定义服务裸域名在共享入口默认规范为 `/v1`；用户提供的显式 Base Path 或完整能力接口保持权威。
- 防线：纯地址契约测试、配置向导可见补全测试和跨运行时全量测试。
- 不再适用：配置协议能从服务端元数据无计费地可靠发现，并由用户确认实际能力接口时。
- 证据：`shared/ai-setup-core.cjs`、`electron/services/ai-setup-core.test.cjs`、`src/components/AISetupWizard.test.tsx`。
- 相关 Note：[自定义 OpenAI 兼容服务裸域名使用版本化基址](../../.agents/notes/implemented/bug-fix/2026-08-27-openai-base-url-default.md)。

### LES-20260827-chat-visible-output

- Status: `active`
- Source: `user-confirmed` / `code-verified`
- 适用范围：OpenAI Chat 生成能力、Electron Provider、PWA 流式 Provider 与最小连接测试。
- 症状：模型目录正常且 Chat 接口返回 HTTP 200，但界面提示没有可展示内容。
- 已验证根因：固定 16 Token 探测预算可能被模型推理消耗，响应只含 `reasoning_content` 并以 `length` 结束；两端旧解析器又把所有空正文归为协议错误。
- 正确规则：探测需要为短推理保留有限余量，最终成功仍以可展示正文为准；额度耗尽、只有推理、非文本结果和协议结构错误必须分别报告。
- 防线：共享响应解析核心、桌面与网页 Provider 回归测试、Runtime 与 Worker 单次请求测试。
- 不再适用：生成协议能够在不计费的能力协商中证明最终文本输出，或应用不再消费 Chat `message.content` 时。
- 证据：`shared/chat-completion-core.cjs`、`shared/ai-setup-core.cjs`、`electron/services/ai-provider.test.cjs`、`src/lib/webAI/provider.test.ts`。
- 相关 Note：[OpenAI Chat 探测与响应采用跨运行时共享契约](../../.agents/notes/implemented/bug-fix/2026-08-27-openai-chat-probe-response.md)。

### LES-20260827-model-catalog-before-model

- Status: `active`
- Source: `code-verified`
- 适用范围：PWA AI 配置向导、Web AI Worker 与模型目录请求。
- 症状：API 地址和密钥已填写、域名确认框已勾选，但模型名称为空时目录请求被报告为“服务域名尚未得到完整确认”。
- 已验证根因：界面只有在模型名称非空时才构造完整能力连接和确认 origin，目录发现因此提交空的 `confirmedOrigins`。
- 正确规则：模型目录使用由规范化 Base URL 构造的独立安全目标；界面展示与 Worker 校验必须共用该目标。
- 防线：向导空模型回归测试、安全目标单元测试和 Worker 目录请求测试。
- 不再适用：配置流程不再提供模型发现，或模型目录通过不携带用户凭据的受信任本地清单提供时。
- 证据：`src/components/AISetupWizard.test.tsx`、`src/lib/webAI/security.test.ts`、`src/lib/webAI/worker.test.ts`。
- 相关 Note：[模型目录域名确认独立于模型名称](../../.agents/notes/implemented/bug-fix/2026-08-27-model-catalog-origin-confirmation.md)。

### LES-20260827-release-metadata-drives-update

- Status: `active`
- Source: `code-verified`
- 适用范围：GitHub 正式桌面 Release、Windows `electron-updater` 与版本标签。
- 症状：源码和新安装包已经存在，但旧客户端仍可能无法发现新版本。
- 已验证根因：更新发现依赖 GitHub 最新稳定 Release 中与安装包匹配的 `latest.yml`，下载还依赖安装包、blockmap 和 SHA-512 完整性一致。
- 正确规则：版本标签、`package.json`、`latest.yml`、NSIS 安装包和 blockmap 必须版本一致；Release 必须从草稿切换为最新稳定版本后才算更新通道生效。
- 防线：`scripts/verify-release.mjs`、GitHub Actions 资产摘要校验、正式 Release 远端元数据校验和旧版本语义比较。
- 不再适用：Windows 更新提供方不再使用 GitHub Releases 或更新协议不再消费 `latest.yml` 时。
- 证据：`electron/services/update-manager.cjs`、`.github/workflows/release-desktop.yml`、`scripts/verify-release.mjs`。
- 相关 Note：[桌面稳定版本通过可验证发布元数据驱动 Windows 在线更新](../../.agents/notes/implemented/architecture/2026-08-27-desktop-update-release-contract.md)。

### LES-20260831-paid-batch-recovery

- Status: `active`
- Source: `user-confirmed` / `code-verified` / `external-verified`
- 适用范围：Electron、PWA、OpenAI 兼容向量服务和本地向量断点。
- 症状：建库在 450/1263 处收到 HTTP 400，点击“手动继续”后仍停在同一位置并再次失败。
- 已验证根因：成功批次断点本身有效，但服务商失败被压缩为通用状态，错误页允许在服务状态未验证时原样续发；PWA 还缺少逐批持久化，且两端向量文本模板不同。Windows 对状态文件的瞬时占用也可能让原子替换返回 `EPERM`，把已成功保存的向量批次误报为建库失败。
- 正确规则：只有有效并已保存的完整批次才能推进断点；错误状态必须先重新测试能力或显式降级，不能直接继续；诊断只保存允许字段；改变文本模板的缓存必须更新指纹，未改变的桌面模板必须保持既有付费断点可识别。本地状态替换可以做短时、有限的文件系统重试，但不得借此重发远程请求。
- 防线：共享失败分类、失败范围、运行时续发守卫、Worker 内存与 IndexedDB 批次断点、跨端共享文档模板、Windows 原子替换故障注入和可见恢复路径测试。
- 不再适用：远程协议提供具有幂等键、明确计费结果和服务端作业断点的建库 API，并由应用验证其恢复契约后。
- 证据：`shared/provider-response-core.cjs`、`shared/embedding-core.cjs`、`electron/services/ai-runtime.test.cjs`、`electron/services/store.test.cjs`、`src/lib/webAI/worker.test.ts`、`src/components/AISetupWizard.test.tsx`。
- 相关 Note：[远程向量建库以完整批次断点和显式恢复为边界](../../.agents/notes/implemented/bug-fix/2026-08-31-provider-index-recovery.md)。
