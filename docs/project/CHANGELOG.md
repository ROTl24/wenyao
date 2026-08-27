---
project_docs_schema: 1
document_type: changelog
last_reviewed: 2026-08-27
---

# 项目成果记录

## Active Period

- 当前记录周期：2026 年。

## Entries

### CHG-20260827-web-corpus-classification

- 日期：2026-08-27
- 结果：网页设置统计、古籍书内条目和 Web AI 检索证据统一使用 495 条规则、190 条占例与 578 条义理分类。
- 原因：正文与分类索引分离存储时，PWA 绕过分类装配并把全部 1263 条语料视为义理。
- 验证：`npm.cmd test`、`npm.cmd run typecheck`、`npm.cmd run build:renderer`、`npm.cmd run verify:web`。
- Git：`d460c3d`；远端与部署状态不在成果条目中固化，以实时检查为准。
- Agent Note：[内置古籍分类由跨运行时共享入口装配](../../.agents/notes/implemented/bug-fix/2026-08-27-shared-corpus-knowledge.md)。
- 文档影响：PROJECT、PROJECT_CONTEXT、DECISIONS、LESSONS。

### CHG-20260826-release-053

- 日期：2026-08-26
- 结果：仓库形成 `0.5.3` 桌面与 PWA 产品基线，包含四种起卦、排盘复制、五书证据检索和逐能力 AI 配置。
- 原因：交付 Windows、macOS 与 PWA 共用的问爻产品能力。
- 验证：`package.json` 版本、构建脚本、自动化测试入口和 Git 提交 `314a530`。
- Git：`314a530 release: 问爻 0.5.3 (#1)`。
- Agent Note：无；该成果早于项目知识治理初始化。
- 文档影响：建立 PROJECT 与 PROJECT_CONTEXT 当前基线。

### CHG-20260823-shared-retrieval-core

- 日期：2026-08-23
- 结果：桌面端与 PWA 共用 `shared/retrieval-core.cjs`，支持 BM25、向量召回、RRF、重排与自适应证据选择。
- 原因：统一两端检索算法并保留可见降级行为。
- 验证：共享模块调用点、检索测试和 `resources/evaluation-cases.json`。
- Git：`0e91e8a`。
- Agent Note：无；该成果早于项目知识治理初始化。
- 文档影响：PROJECT_CONTEXT 记录混合检索术语与证据边界。
