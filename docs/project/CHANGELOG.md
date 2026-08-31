---
project_docs_schema: 1
document_type: changelog
last_reviewed: 2026-08-31
---

# 项目成果记录

## Active Period

- 当前记录周期：2026 年。

## Entries

### CHG-20260831-plate-copy-return-direction

- 日期：2026-08-31
- 结果：纯文本、Markdown 与 JSON 明确区分本卦到变卦的成卦变化和变爻对本爻的回头作用，不再用无标签反向箭头表达两种不同语义。
- 原因：无标签的“变爻→本爻”回头关系与排盘中的“本爻→变爻”成卦方向外观相反，外部模型会合理地把同一盘判断为输入矛盾。
- 验证：风水涣变山泽损截图同盘回归、全量测试、类型检查、Renderer 构建、三种格式的本地页面复制验收；Claude 独立复审意见在提交前逐项处理并复核。
- Git：实现、测试与知识记录位于同一本地提交；未推送。
- Agent Note：[排盘复制显式区分成卦变化与回头作用](../../.agents/notes/implemented/bug-fix/2026-08-31-plate-copy-return-direction.md)。
- 文档影响：PROJECT_CONTEXT、DECISIONS、CHANGELOG、结构化复制 Agent Note 与回头方向 Agent Note。

### CHG-20260830-mit-license

- 日期：2026-08-30
- 结果：问爻原创源代码以 MIT License 免费开源，根许可证、包元数据和 README 使用同一许可声明，并保留第三方许可与 AI 服务费用边界。
- 原因：公开源码但没有许可证不能向外部使用者授予明确的使用、修改和分发权，也不能准确宣称开源。
- 验证：标准 MIT 文本、JSON 元数据、README 链接、项目知识严格审计与 `git diff --check`。
- Git：实现与知识记录位于同一本地提交；未推送。
- Agent Note：[问爻原创源代码采用 MIT 许可](../../.agents/notes/implemented/process/2026-08-30-mit-license.md)。
- 文档影响：README、PROJECT、PROJECT_CONTEXT、DECISIONS、CHANGELOG。

### CHG-20260827-release-054

- 日期：2026-08-27
- 结果：`0.5.4` 桌面版本包含 `0.5.3` 之后的古籍分类、自定义地址、Chat 响应和模型目录修复；既有 Windows 安装版通过 GitHub 稳定更新通道发现该版本。
- 原因：网站与 `main` 已包含修复，而桌面正式 Release 仍停留在 `0.5.3`。
- 验证：全量测试、类型检查、Renderer 构建、Windows 安装包验收、GitHub Actions 双平台构建以及正式 Release 更新元数据校验。
- Git：版本标签 `v0.5.4`；远端 Release 与资产状态以实时检查为准。
- Agent Note：[桌面稳定版本通过可验证发布元数据驱动 Windows 在线更新](../../.agents/notes/implemented/architecture/2026-08-27-desktop-update-release-contract.md)。
- 文档影响：README、PROJECT、PROJECT_CONTEXT、DECISIONS、LESSONS。

### CHG-20260827-model-catalog-origin-confirmation

- 日期：2026-08-27
- 结果：PWA 在模型名称为空时仍能显示并确认规范化模型目录的 HTTPS origin，目录请求不再被错误的空确认拦截。
- 原因：配置界面曾依赖完整能力连接计算域名，而完整能力连接要求模型名称非空，形成模型发现的循环前置条件。
- 验证：`npm.cmd test`、`npm.cmd run typecheck`、`npm.cmd run build:renderer`、`npm.cmd run verify:web`。
- Git：实现、测试与知识记录位于同一提交；远端与部署状态不在成果条目中固化，以实时检查为准。
- Agent Note：[模型目录域名确认独立于模型名称](../../.agents/notes/implemented/bug-fix/2026-08-27-model-catalog-origin-confirmation.md)。
- 文档影响：PROJECT、PROJECT_CONTEXT、DECISIONS、LESSONS。

### CHG-20260827-openai-chat-probe-response

- 日期：2026-08-27
- 结果：所有 OpenAI Chat 生成模型在 Electron 与 PWA 共用 512 Token 单次探测预算、文本正文解析和空正文原因分类。
- 原因：16 Token 可能在模型输出最终正文前被推理消耗，且旧解析器无法区分额度耗尽、推理输出、非文本结果和协议结构错误。
- 验证：`npm.cmd test`、`npm.cmd run typecheck`、`npm.cmd run build:renderer`、`npm.cmd run verify:web`。
- Git：实现、测试与知识记录位于同一提交；远端与部署状态不在成果条目中固化，以实时检查为准。
- Agent Note：[OpenAI Chat 探测与响应采用跨运行时共享契约](../../.agents/notes/implemented/bug-fix/2026-08-27-openai-chat-probe-response.md)。
- 文档影响：PROJECT、PROJECT_CONTEXT、DECISIONS、LESSONS。

### CHG-20260827-custom-api-v1-default

- 日期：2026-08-27
- 结果：自定义 OpenAI 兼容服务只填写裸域名时，桌面端与 PWA 自动使用 `/v1` 并在配置界面显示规范化地址。
- 原因：裸域名直接拼接能力路径可能命中返回 HTTP 200 HTML 的管理页面，造成模型响应解析失败。
- 验证：`npm.cmd test`、`npm.cmd run build:renderer`、`npm.cmd run verify:web`。
- Git：实现、测试与知识记录位于同一提交；远端与部署状态不在成果条目中固化，以实时检查为准。
- Agent Note：[自定义 OpenAI 兼容服务裸域名使用版本化基址](../../.agents/notes/implemented/bug-fix/2026-08-27-openai-base-url-default.md)。
- 文档影响：PROJECT、PROJECT_CONTEXT、DECISIONS、LESSONS。

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
