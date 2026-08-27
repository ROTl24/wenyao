---
project_docs_schema: 1
document_type: project_context
last_reviewed: 2026-08-27
---

# 项目长期上下文

## Domain Terms

- 古籍语料：`resources/corpus.json` 中可检索的原文片段。
- 知识分类：`resources/knowledge-index.json` 为每条语料标注的 `rule`、`case` 或 `doctrine`。
- 混合检索：BM25 与可选向量召回经 RRF 融合，可再由专用模型重排，最终自适应选择证据。
- 受信任发布域名：通过 `src/lib/webAI/security.ts` 校验、允许在隔离 Worker 中使用会话级 API Key 的 PWA 来源。

## Invariants

- 同一语料 ID 在桌面端与 PWA 中必须具有相同正文、分类和主题元数据。
- 古籍分类统计必须由实际已加载语料计算，不以界面常量代替数据事实。
- 桌面密钥由系统安全存储保护；PWA 密钥只存在于当前页面会话的 Worker 内存中。
- 起卦、排盘、本机历史和内置古籍不依赖付费模型调用。
- 真实模型验证可能产生费用，必须在明确范围、成本与停止规则后获得授权。
- 自定义 OpenAI 兼容服务只填写裸域名时默认使用 `/v1`；显式 Base Path 或完整能力地址具有最高优先级，地址失败不会触发自动重试。
- OpenAI Chat 生成能力只把最终可展示文本作为成功；内部推理、工具调用和拒答不能替代 `message.content`，最小测试失败不会自动重试。

## Project Preferences

- 代码、注释和项目文档使用当前系统视角与领域术语。
- 优先修复跨运行时的根层契约，避免只改界面数字或添加平台专用补丁。
- 验证必须区分本地通过、已提交、已推送、已部署与用户可见生效。
- 来源：`user-confirmed`，依据仓库 `AGENTS.md` 的全局工程约定。

## Data and Privacy Boundaries

- 不在项目文档、日志或测试夹具中保存 API Key、Cookie、个人信息或生产数据。
- 浏览器会话和 IndexedDB 属于本机站点数据；清除站点数据会移除本机历史或索引缓存。
- 用户导入古籍只由桌面端处理；是否发送片段给向量服务受独立确认约束。

## External Systems

| 系统 | 用途 | 当前证据 | 状态 |
|---|---|---|---|
| GitHub `ROTl24/wenyao` | 源码、Actions、桌面 Release | `config/public-links.json`、`.github/workflows/release-desktop.yml` | `code-verified` |
| Cloudflare Pages | PWA 公开托管 | README 中的 `https://wenyao-9pu.pages.dev` | `code-verified`，当前部署内容未在本次任务中外部验证 |
| OpenAI 兼容 AI 服务 | 生成、向量和重排 | `config/ai-providers.json`、Provider 实现 | `code-verified`，本次任务不调用 |
| 可选 Cloudflare Worker/D1 | 匿名反馈聚合 | `workers/feedback` | `code-verified`，部署状态未验证 |

## Environment Constraints

- 主要开发环境为 Windows PowerShell；项目短命令使用 `npm.cmd`。
- Renderer 使用 React、TypeScript、Vite 与 Vitest；桌面端使用 Electron 和 Node 测试运行器。
- macOS DMG 必须在 macOS 构建环境验证；Windows 本地不能替代该产物验收。
- PWA 使用提示式 Service Worker 更新；构建成功不等于已打开页面立即切换到新资源。

## Easy-to-Misread Context

- `corpus.json` 保存正文，`knowledge-index.json` 保存知识分类；只加载前者会让条目仍可检索，但分类统计、证据标签和分类多样性语义失真。
- HTTP 200、新 HTML 或本地构建不能证明当前 PWA 标签页已使用新 Service Worker 控制的资源。
- 模型接口返回 HTTP 200 但正文是管理页面 HTML 时，属于接口路径错误，不代表模型连接成功；裸域名补全只发生在请求前，不会失败后换地址重试。
- 检索回归指标证明召回链稳定，不证明现实预测准确率。
- 桌面端允许导入自有古籍，PWA 只浏览和检索内置古籍。

## Authority Index

| 主题 | 权威位置 | 来源 | 最近验证 |
|---|---|---|---|
| 项目目标与状态 | `docs/project/PROJECT.md` | `user-confirmed` / `code-verified` | 2026-08-27 |
| 语料正文与分类 | `resources/corpus.json`、`resources/knowledge-index.json` | `code-verified` | 2026-08-27 |
| 运行时能力边界 | `src/lib/desktop.ts`、`electron/main.cjs` | `code-verified` | 2026-08-27 |
| 自定义 AI 地址规范化 | `shared/ai-setup-core.cjs` | `code-verified` | 2026-08-27 |
| OpenAI Chat 响应分类 | `shared/chat-completion-core.cjs` | `code-verified` | 2026-08-27 |
| 构建与测试入口 | `package.json`、`vite.config.ts` | `code-verified` | 2026-08-27 |
| 桌面发布流程 | `.github/workflows/release-desktop.yml` | `code-verified` | 2026-08-27 |

## Superseded Context

- 暂无。
