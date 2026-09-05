---
project_docs_schema: 1
document_type: decisions
last_reviewed: 2026-09-06
---

# 项目决策

## Decision Index

| 决策 | 状态 | 主题 | 权威 Note | 替代关系 |
|---|---|---|---|---|
| `ADR-20260906-generation-drafts-tasks` | `accepted` | 生成任务、停止与独立草稿 | [Agent Note](../../.agents/notes/implemented/feature/2026-09-06-generation-drafts-tasks.md) | 无 |
| `ADR-20260906-offline-report-evaluation` | `accepted` | 离线诊断与人工报告评分分开 | [Agent Note](../../.agents/notes/implemented/process/2026-09-06-offline-report-evaluation.md) | 无 |
| `ADR-20260906-session-archive-review` | `accepted` | 版本化占簿备份、整批恢复与独立复盘 | [Agent Note](../../.agents/notes/implemented/feature/2026-09-06-session-archive-review.md) | 无 |
| `ADR-20260906-result-reading-onboarding` | `accepted` | 原文结论节选、新手入口与弹窗焦点管理 | [Agent Note](../../.agents/notes/implemented/feature/2026-09-06-result-reading-onboarding.md) | 无 |
| `ADR-20260826-structured-plate-copy` | `accepted` | 三种排盘复制格式共用结构化事实文档 | [Agent Note](../../.agents/notes/implemented/feature/2026-08-26-structured-plate-copy.md) | 无 |
| `ADR-20260827-shared-corpus-knowledge` | `accepted` | 跨运行时内置古籍分类装配 | [Agent Note](../../.agents/notes/implemented/bug-fix/2026-08-27-shared-corpus-knowledge.md) | 无 |
| `ADR-20260827-openai-base-url-default` | `accepted` | 自定义 OpenAI 兼容服务裸域名默认使用 `/v1` | [Agent Note](../../.agents/notes/implemented/bug-fix/2026-08-27-openai-base-url-default.md) | 无 |
| `ADR-20260827-openai-chat-probe-response` | `accepted` | OpenAI Chat 探测、正式生成预算与可展示响应分类 | [Agent Note](../../.agents/notes/implemented/bug-fix/2026-08-27-openai-chat-probe-response.md) | 取代按单一服务处理 16 Token 探测失败的局部规则 |
| `ADR-20260827-model-catalog-origin-confirmation` | `accepted` | PWA 模型目录使用独立域名确认目标 | [Agent Note](../../.agents/notes/implemented/bug-fix/2026-08-27-model-catalog-origin-confirmation.md) | 无 |
| `ADR-20260827-desktop-update-release-contract` | `accepted` | 桌面稳定版本与 Windows 在线更新发布契约 | [Agent Note](../../.agents/notes/implemented/architecture/2026-08-27-desktop-update-release-contract.md) | 无 |
| `ADR-20260830-mit-license` | `accepted` | 问爻原创源代码使用 MIT License | [Agent Note](../../.agents/notes/implemented/process/2026-08-30-mit-license.md) | 取代无明确许可证的源码公开状态 |
| `ADR-20260831-plate-copy-return-direction` | `accepted` | 成卦变化与回头作用使用显式方向契约 | [Agent Note](../../.agents/notes/implemented/bug-fix/2026-08-31-plate-copy-return-direction.md) | 取代无标签箭头表达回头关系 |
| `ADR-20260904-formal-generation-deadline` | `accepted` | 内置正式生成按 SSE 活动设置时限并呈现阶段 | [Agent Note](../../.agents/notes/implemented/bug-fix/2026-09-04-desktop-ai-total-timeout.md) | 取代 Electron 正式生成固定 180 秒总时限与静态等待状态 |

## Active Decisions

### ADR-20260906-generation-drafts-tasks

- Status: `accepted`
- Source: `user-confirmed` / `code-verified`
- 主题：应用内任务支持逐段阅读与停止，未完成草稿及证据独立保存，迟到结果不能覆盖停止状态。
- 权威 Note：[生成任务与草稿](../../.agents/notes/implemented/feature/2026-09-06-generation-drafts-tasks.md)。
- 重新考虑：支持应用关闭后的任务恢复、跨实例共享或服务商任务取消接口时。
- Supersedes：无，延续既有正式调用时限与单次请求契约。

### ADR-20260906-offline-report-evaluation

- Status: `accepted`
- Source: `user-confirmed` / `code-verified`
- 主题：离线自动诊断结构与引用，人工评分核对语义，并绑定报告、排盘和证据身份。
- 权威 Note：[离线报告评测](../../.agents/notes/implemented/process/2026-09-06-offline-report-evaluation.md)。
- 重新考虑：报告格式、评分维度或固定采样规范改变时。
- Supersedes：无。

### ADR-20260906-session-archive-review

- Status: `accepted`
- Source: `user-confirmed` / `code-verified`
- 主题：备份仅承载占簿记录，整批校验后一次写入；独立复盘随记录保存并与异步报告合并。
- 权威 Note：[版本化备份与独立复盘](../../.agents/notes/implemented/feature/2026-09-06-session-archive-review.md)。
- 重新考虑：需要跨端云同步、大规模分块存储或新的备份版本时。
- Supersedes：无。

### ADR-20260906-result-reading-onboarding

- Status: `accepted`
- Source: `user-confirmed` / `code-verified`
- 主题：节选完整报告原文并提供定位，明确检索阶段，统一弹窗焦点。
- 权威 Note：[结果阅读与操作状态](../../.agents/notes/implemented/feature/2026-09-06-result-reading-onboarding.md)。
- 重新考虑：正式报告章节契约或 UI 容器模型变化时。
- Supersedes：无。

### ADR-20260905-ai-configuration-identity

- Status: `accepted`
- Source: `user-confirmed` / `code-verified`
- 主题：用户配置与测试、实际调用保持一致；目录只提示模型候选，密钥通过同域显式引用沿用，向量能力身份包含实际端点。
- 权威 Note：[AI 能力采用逐项配置与可选检索链路](../../.agents/notes/implemented/architecture/2026-08-26-optional-ai-capability-pipeline.md)。
- 重新考虑：引入另一种生成协议、服务端模型能力协商或跨服务凭据授权模型时。
- Supersedes：无。

### ADR-20260826-structured-plate-copy

- Status: `accepted`
- Source: `code-verified`
- 主题：纯文本、Markdown 和 JSON 由同一结构化排盘文档生成，并共同覆盖确定性盘面、起卦记录、关系事实和相关经文。
- 权威 Note：[排盘复制由同一结构化事实文档生成](../../.agents/notes/implemented/feature/2026-08-26-structured-plate-copy.md)。
- 重新考虑：外部复制协议形成需要版本化兼容的公开 API，或复制内容不再由当前会话的结构化事实生成时。
- Supersedes：无。

### ADR-20260827-shared-corpus-knowledge

- Status: `accepted`
- Source: `code-verified`
- 主题：Electron、PWA 渲染适配器与 Web AI Worker 通过同一纯函数装配内置古籍分类和主题元数据。
- 权威 Note：[内置古籍分类由跨运行时共享入口装配](../../.agents/notes/implemented/bug-fix/2026-08-27-shared-corpus-knowledge.md)。
- 重新考虑：语料规模使分类索引显著影响 PWA 加载成本，或正文与分类数据格式合并为单一权威产物时。
- Supersedes：无。

### ADR-20260827-openai-base-url-default

- Status: `accepted`
- Source: `user-confirmed` / `code-verified`
- 主题：共享地址规范化在请求前为自定义 OpenAI 兼容服务裸域名补全 `/v1`，显式路径优先且失败后不自动重试。
- 权威 Note：[自定义 OpenAI 兼容服务裸域名使用版本化基址](../../.agents/notes/implemented/bug-fix/2026-08-27-openai-base-url-default.md)。
- 重新考虑：自定义服务协议不再以 OpenAI 兼容接口为唯一生成协议，或配置层引入可显式选择的接口版本时。
- Supersedes：无。

### ADR-20260827-openai-chat-probe-response

- Status: `accepted`
- Source: `user-confirmed` / `code-verified`
- 主题：所有 OpenAI Chat 生成模型共用 512 Token 单次探测预算和跨运行时响应分类；正式解读与追问不设置应用侧输入或输出 Token 上限，服务协议明确支持的探测参数可按服务适配。
- 权威 Note：[OpenAI Chat 探测与响应采用跨运行时共享契约](../../.agents/notes/implemented/bug-fix/2026-08-27-openai-chat-probe-response.md)。
- 重新考虑：项目引入 Responses API、模型目录提供可靠的能力元数据，或服务商形成可无计费协商的标准探测协议时。
- Supersedes：DeepSeek 官方连接使用 16 Token 探测预算的局部决策。

### ADR-20260827-model-catalog-origin-confirmation

- Status: `accepted`
- Source: `user-confirmed` / `code-verified`
- 主题：PWA 配置界面与隔离 Worker 从规范化模型目录地址计算同一组确认 origin，目录发现不依赖模型名称。
- 权威 Note：[模型目录域名确认独立于模型名称](../../.agents/notes/implemented/bug-fix/2026-08-27-model-catalog-origin-confirmation.md)。
- 重新考虑：模型目录迁移到与能力接口不同的受信任服务，或配置协议引入经过用户确认的独立目录 URL 时。
- Supersedes：无。

### ADR-20260827-desktop-update-release-contract

- Status: `accepted`
- Source: `user-confirmed` / `code-verified`
- 主题：正式桌面版本以 Git 标签触发 Windows 与 macOS 构建；Windows `latest` 通道发布更新元数据并由既有安装版提示下载和安装，macOS 免费发行版保持手动更新。
- 权威 Note：[桌面稳定版本通过可验证发布元数据驱动 Windows 在线更新](../../.agents/notes/implemented/architecture/2026-08-27-desktop-update-release-contract.md)。
- 重新考虑：项目获得 Windows/macOS 代码签名与 Apple 公证能力，或更换 GitHub Releases 更新服务时。
- Supersedes：无。

### ADR-20260830-mit-license

- Status: `accepted`
- Source: `user-confirmed` / `code-verified`
- 主题：问爻原创源代码使用 MIT License 免费开源，第三方依赖、字体、古籍和数据保留各自许可，第三方 AI 服务费用不属于软件免费承诺。
- 权威 Note：[问爻原创源代码采用 MIT 许可](../../.agents/notes/implemented/process/2026-08-30-mit-license.md)。
- 重新考虑：版权主体、贡献者协议、商业授权策略或第三方资产边界发生变化时。
- Supersedes：无明确许可证的源码公开状态。

### ADR-20260831-plate-copy-return-direction

- Status: `accepted`
- Source: `user-confirmed` / `code-verified`
- 主题：本卦与变卦表示成卦变化；回头关系固定表示变爻对同位本爻的作用，领域字段与三种复制格式都显式标注双方身份、作用方向和六合六冲范围。
- 权威 Note：[排盘复制显式区分成卦变化与回头作用](../../.agents/notes/implemented/bug-fix/2026-08-31-plate-copy-return-direction.md)。
- 重新考虑：回头作用的领域模型、六合六冲范围或外部复制 Schema 发生变化时。
- Supersedes：使用无标签箭头同时表达成卦变化和反向回头作用的复制表示。

### ADR-20260904-formal-generation-deadline

- Status: `accepted`
- Source: `user-confirmed` / `code-verified`
- 主题：Electron 内置生成服务与 PWA 使用单次 SSE 请求，以首段和流中空闲时限识别停滞，持续活跃流没有固定总时限；桌面结果页显示阶段与累计等待时间，自定义 JSON 服务保留原协议，远程失败不自动重试。
- 权威 Note：[桌面正式生成按可观测流活动管理等待](../../.agents/notes/implemented/bug-fix/2026-09-04-desktop-ai-total-timeout.md)。
- 重新考虑：自定义服务形成可持久化的 SSE 能力声明，或服务商提供可验证的任务状态与幂等取消能力时。
- Supersedes：Electron 正式生成固定 180 秒总时限。
