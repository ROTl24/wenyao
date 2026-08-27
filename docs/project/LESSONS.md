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
