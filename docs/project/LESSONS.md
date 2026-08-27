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
