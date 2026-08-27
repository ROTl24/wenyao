---
project_docs_schema: 1
document_type: decisions
last_reviewed: 2026-08-27
---

# 项目决策

## Decision Index

| 决策 | 状态 | 主题 | 权威 Note | 替代关系 |
|---|---|---|---|---|
| `ADR-20260827-shared-corpus-knowledge` | `accepted` | 跨运行时内置古籍分类装配 | [Agent Note](../../.agents/notes/implemented/bug-fix/2026-08-27-shared-corpus-knowledge.md) | 无 |
| `ADR-20260827-openai-base-url-default` | `accepted` | 自定义 OpenAI 兼容服务裸域名默认使用 `/v1` | [Agent Note](../../.agents/notes/implemented/bug-fix/2026-08-27-openai-base-url-default.md) | 无 |
| `ADR-20260827-openai-chat-probe-response` | `accepted` | OpenAI Chat 探测预算与可展示响应分类 | [Agent Note](../../.agents/notes/implemented/bug-fix/2026-08-27-openai-chat-probe-response.md) | 取代按单一服务处理 16 Token 探测失败的局部规则 |
| `ADR-20260827-model-catalog-origin-confirmation` | `accepted` | PWA 模型目录使用独立域名确认目标 | [Agent Note](../../.agents/notes/implemented/bug-fix/2026-08-27-model-catalog-origin-confirmation.md) | 无 |
| `ADR-20260827-desktop-update-release-contract` | `accepted` | 桌面稳定版本与 Windows 在线更新发布契约 | [Agent Note](../../.agents/notes/implemented/architecture/2026-08-27-desktop-update-release-contract.md) | 无 |

## Active Decisions

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
- 主题：所有 OpenAI Chat 生成模型共用 512 Token 单次探测预算和跨运行时响应分类；服务协议明确支持的探测参数可按服务适配。
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
