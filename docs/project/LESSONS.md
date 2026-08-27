---
project_docs_schema: 1
document_type: lessons
last_reviewed: 2026-08-27
---

# 项目教训

## Lesson Index

| 教训 | 状态 | 适用范围 | 摘要 |
|---|---|---|---|
| `LES-20260827-corpus-metadata-parity` | `active` | Electron、PWA、Worker 的内置语料边界 | 共享算法不等于共享输入语义，分类元数据必须在所有运行时统一装配 |
| `LES-20260827-openai-html-response` | `active` | 自定义 AI Base URL 与能力接口 | HTTP 200 的管理页面 HTML 仍是错误接口，裸域名必须在请求前规范化 |
| `LES-20260827-chat-visible-output` | `active` | OpenAI Chat 生成模型与最小测试 | HTTP 200 和推理输出不等于可展示正文，探测预算与空正文原因必须独立验证 |
| `LES-20260827-model-catalog-before-model` | `active` | PWA 模型目录与出站域名确认 | 模型发现发生在模型选择之前，目录安全目标不能依赖模型名称 |
| `LES-20260827-release-metadata-drives-update` | `active` | Windows 桌面在线更新与 GitHub Release | 代码和安装包上传不等于旧客户端可更新，稳定 Release 元数据与资产必须共同验证 |

## Active Lessons

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
