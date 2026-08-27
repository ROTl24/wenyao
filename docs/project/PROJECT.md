---
project_docs_schema: 1
document_type: project
last_reviewed: 2026-08-27
---

# 项目状态

## Project Identity

- 项目：问爻（WenYao），本地优先的水墨六爻桌面与 PWA 应用。
- 服务对象：需要起卦、排盘、古籍检索及可追溯 AI 解读的个人用户。
- 来源：`code-verified`，依据 `README.md`、`package.json` 与应用入口。

## Original Goal

- 目标版本：`G-001`
- 目标：提供覆盖起卦、纳甲排盘、古籍证据检索与 AI 解读的本地优先产品，并交付 Windows、macOS 与 PWA 运行形态。
- 来源：`proposed`，由当前产品、构建配置与说明文档归纳，尚无独立的原始需求记录。

## Current Goal

- 目标版本：`G-002`
- 目标：修复网页版古籍分类元数据缺失，使桌面端与 PWA 使用同一分类语义，并以自动化测试防止统计与检索再次漂移。
- 来源：`user-confirmed`，2026-08-27 用户确认实施。

## Scope

### Included

- 四种起卦方式、六爻排盘、日历与本机历史。
- 五部内置古籍的浏览、BM25 检索、可选向量召回与重排。
- Electron 桌面端和受信任发布域名上的 PWA AI 连接流程。
- Windows、macOS 构建以及 PWA 静态产物。

### Excluded

- 未经单独授权的推送、公开发布、部署和真实付费模型调用。
- 账号云同步、生产数据迁移和代替服务商管理密钥。

## Milestones

| 里程碑 | 状态 | 验收标准 | 证据 |
|---|---|---|---|
| 跨平台本地优先应用 | `verified` | Electron 与 PWA 构建入口存在，四种起卦和排盘具备自动化测试 | `package.json`、`vite.config.ts`、`src/lib/*.test.ts` |
| 五书混合检索 | `verified` | 1263 条语料可经共享检索核心检索，分类索引覆盖全部语料 ID | `resources/corpus.json`、`resources/knowledge-index.json`、`shared/retrieval-core.cjs` |
| 网页古籍分类一致性 | `verified` | 网页统计、书内条目和 AI 检索均使用 495 规则、190 占例、578 义理分类 | 浏览器与 Worker 回归测试、全量测试、PWA 构建验证 |

## Current State

- `package.json` 当前版本为 `0.5.3`；Git `main` 已包含网页古籍分类一致性修复提交 `d460c3d`，远端与部署状态以实时检查为准。
- Electron 主进程、PWA 渲染适配器和 Web AI Worker 均通过 `shared/corpus-knowledge.cjs` 合并正文与分类索引。
- 网页状态、书内条目和检索证据已验证使用 495 条规则、190 条占例和 578 条义理。
- GitHub Release 工作流支持手动候选构建，并仅在版本标签路径发布正式桌面产物。

## Blockers

- 无已确认阻塞。

## Next Actions

1. Cloudflare Pages 完成自动构建后，在新标签页验证活动资源与 Service Worker 已切换到包含共享分类装配的版本。
2. 已打开的旧 PWA 标签页通过更新提示切换版本，或关闭后重新打开再验收分类统计。

## Goal History

| 目标版本 | 状态 | 生效日期 | 决策 |
|---|---|---|---|
| `G-001` | `verified` | 2026-08-26 | Git 历史存在 `release: 问爻 0.5.3`，当前仓库包含三种运行形态与对应构建配置 |
| `G-002` | `verified` | 2026-08-27 | 共享分类装配、运行时回归测试与 PWA 静态产物验证完成 |
