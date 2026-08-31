---
project_docs_schema: 1
document_type: project
last_reviewed: 2026-08-31
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

- 目标版本：`G-007`
- 目标：以 MIT License 免费开源问爻原创源代码，并明确第三方许可与 AI 服务费用边界。
- 来源：`user-confirmed`，2026-08-30 用户确认采用 MIT License。

## Scope

### Included

- 四种起卦方式、六爻排盘、日历与本机历史。
- 五部内置古籍的浏览、BM25 检索、可选向量召回与重排。
- Electron 桌面端和受信任发布域名上的 PWA AI 连接流程。
- Windows、macOS 构建以及 PWA 静态产物。
- 问爻原创源代码以 MIT License 公开发布。

### Excluded

- 未经单独授权的推送、公开发布、部署和真实付费模型调用。
- 账号云同步、生产数据迁移和代替服务商管理密钥。

## Milestones

| 里程碑 | 状态 | 验收标准 | 证据 |
|---|---|---|---|
| 跨平台本地优先应用 | `verified` | Electron 与 PWA 构建入口存在，四种起卦和排盘具备自动化测试 | `package.json`、`vite.config.ts`、`src/lib/*.test.ts` |
| 五书混合检索 | `verified` | 1263 条语料可经共享检索核心检索，分类索引覆盖全部语料 ID | `resources/corpus.json`、`resources/knowledge-index.json`、`shared/retrieval-core.cjs` |
| 网页古籍分类一致性 | `verified` | 网页统计、书内条目和 AI 检索均使用 495 规则、190 占例、578 义理分类 | 浏览器与 Worker 回归测试、全量测试、PWA 构建验证 |
| 自定义 AI 地址规范化 | `verified` | 裸域名默认使用 `/v1`，显式路径和 DeepSeek 官方根地址保持原语义，界面显示实际规范化结果 | `shared/ai-setup-core.cjs`、共享核心与向导回归测试 |
| OpenAI Chat 通用响应契约 | `verified` | 桌面端与 PWA 统一解析字符串及文本块正文，最小测试允许短推理并准确区分空正文原因 | `shared/chat-completion-core.cjs`、Provider、Runtime 与 Worker 回归测试 |
| PWA 模型目录域名确认 | `verified` | 模型名称为空时仍按规范化目录地址显示并确认 HTTPS origin，界面与 Worker 共用目录安全入口 | `src/lib/webAI/security.ts`、向导与 Worker 回归测试 |
| Windows 稳定更新通道 | `verified` | 打包版启动及每六小时检查 GitHub Releases，用户确认后下载并在退出或重启时安装，正式 Release 同时发布 `latest.yml`、安装包与 blockmap | `electron/services/update-manager.cjs`、`scripts/verify-release.mjs`、`.github/workflows/release-desktop.yml` |
| MIT 开源许可 | `verified` | 根许可证、包元数据、README 与项目知识记录一致声明 MIT，第三方许可边界保持独立 | `LICENSE`、`package.json`、`README.md`、Agent Note |
| 远程向量建库可恢复性 | `verified` | 失败批次可诊断且不能原样续发，重新测试后从完整批次断点恢复，桌面与 PWA 共用向量文档契约 | Provider、Runtime、Worker 与向导回归测试 |

## Current State

- `package.json` 当前版本为 `0.5.5`；桌面正式构建从同一提交打包当前 Renderer、Electron 服务、共享 AI 核心与古籍数据。
- Electron 主进程、PWA 渲染适配器和 Web AI Worker 均通过 `shared/corpus-knowledge.cjs` 合并正文与分类索引。
- 网页状态、书内条目和检索证据已验证使用 495 条规则、190 条占例和 578 条义理。
- Electron 与 PWA 共用自定义 AI 地址规范化：裸域名默认补全 `/v1`，失败后不会自动切换地址或重复请求。
- Electron 与 PWA 共用 OpenAI Chat 响应解析；所有生成模型使用 512 Token 单次最小测试预算，未指定采样参数时不发送 `temperature`。
- PWA 模型目录域名确认由规范化后的 `/models` 安全目标生成，不依赖尚未发现的模型名称。
- GitHub Release 工作流支持手动候选构建，并仅在版本标签路径发布正式桌面产物；Windows 稳定 Release 的 `latest.yml` 驱动既有安装版发现更新。
- macOS 免费发行版没有 Developer ID 与公证票据，`0.5.3` 客户端保持 GitHub Releases 手动更新，不能由后续版本远程改为自动更新。
- 问爻原创源代码采用 MIT License；第三方依赖、字体、古籍和数据继续按各自许可分发，第三方 AI 服务费用不属于软件免费承诺。
- 远程向量建库按完整批次保存断点；错误状态需要重新测试向量能力或显式降级为本地 BM25，PWA 同时保存当前 Worker 与 IndexedDB 批次断点。

## Blockers

- 无已确认阻塞。

## Next Actions

- 无已确认后续动作。

## Goal History

| 目标版本 | 状态 | 生效日期 | 决策 |
|---|---|---|---|
| `G-001` | `verified` | 2026-08-26 | Git 历史存在 `release: 问爻 0.5.3`，当前仓库包含三种运行形态与对应构建配置 |
| `G-002` | `verified` | 2026-08-27 | 共享分类装配、运行时回归测试与 PWA 静态产物验证完成 |
| `G-003` | `verified` | 2026-08-27 | 共享地址规范化、界面可见补全与跨运行时回归测试完成 |
| `G-004` | `verified` | 2026-08-27 | 共享 Chat 响应分类、通用探测预算与跨运行时回归测试完成 |
| `G-005` | `verified` | 2026-08-27 | 模型目录独立安全目标、界面域名展示与 Worker 回归测试完成 |
| `G-006` | `verified` | 2026-08-27 | `0.5.4` 桌面版本定义与 Windows 稳定更新发布契约完成 |
| `G-007` | `verified` | 2026-08-30 | 根许可证、包元数据、README 与项目知识记录共同确立 MIT 开源边界 |
