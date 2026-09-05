---
project_docs_schema: 1
document_type: project_context
last_reviewed: 2026-09-06
---

# 项目长期上下文

## Domain Terms

- 古籍语料：`resources/corpus.json` 中可检索的原文片段。
- 知识分类：`resources/knowledge-index.json` 为每条语料标注的 `rule`、`case` 或 `doctrine`。
- 混合检索：BM25 与可选向量召回经 RRF 融合，可再由专用模型重排，最终自适应选择证据。
- 受信任发布域名：通过 `src/lib/webAI/security.ts` 校验、允许在隔离 Worker 中使用会话级 API Key 的 PWA 来源。

## Invariants

- 长文追加与草稿切换为完整报告时保留当前可见段落；分块排版必须保留 Markdown 跨片段语法和后置引用定义。
- 最终正文片段可以提前显示，但停止、响应中断或输出额度截断不能写成完整报告；未完成草稿及其证据独立保存。
- 任务取消按调用方与请求标识隔离，迟到成功不能覆盖已接受的停止；本机停止不代表服务商停止处理或计费。
- 生成任务支持当前应用会话内切页，关闭/刷新后的远程恢复不在能力范围内。离线评测只读取本机备份，不增加运行时模型调用或生成门禁。
- 结论节选直接复用完整原文章节，不额外请求模型；没有检索与完成无命中是不同状态。
- 占簿恢复先整批校验与预览，再一次写入；重复记录处理按全部本机记录核对版本，副本具有独立报告和追问标识。
- 复盘是本机事件记录，不属于回答评价；异步报告保存必须保留较新的复盘。
- AI 模型目录仅作候选提示，用户填写的模型 ID 优先；测试通过只对应当时的地址、模型与密钥，编辑后必须重新测试。
- 已保存密钥仅通过显式引用在同一 origin 下沿用；服务地址跨域变更时重新填写密钥。
- 完整接口模式保留显式路径与非敏感查询参数，模型协议仍需兼容当前能力。向量接口或模型变化后重新探测维度，缓存身份区分实际接口。

- 同一语料 ID 在桌面端与 PWA 中必须具有相同正文、分类和主题元数据。
- 古籍分类统计必须由实际已加载语料计算，不以界面常量代替数据事实。
- 桌面密钥由系统安全存储保护；PWA 密钥只存在于当前页面会话的 Worker 内存中。
- 起卦、排盘、本机历史和内置古籍不依赖付费模型调用。
- 真实模型验证可能产生费用，必须在明确范围、成本与停止规则后获得授权。
- 桌面状态文件必须通过唯一临时文件原子替换；瞬时文件占用只允许有限的本地替换重试，不能触发远程模型重试。
- 自定义 OpenAI 兼容服务只填写裸域名时默认使用 `/v1`；显式 Base Path 或完整能力地址具有最高优先级，地址失败不会触发自动重试。
- OpenAI Chat 生成能力只把最终可展示文本作为成功；内部推理、工具调用和拒答不能替代 `message.content`，最小测试失败不会自动重试。
- 正式 AI 解读与追问不发送应用定义的输入 Token 限制、`max_tokens` 或 `max_completion_tokens`；最小连接测试仍使用显式有限预算，服务商模型自身的上下文窗口和输出上限继续生效。
- Electron 内置生成服务和 PWA 正式生成按 SSE 首段与流中活动判断超时：首段最多等待 3 分钟，开始后连续 90 秒无活动才失败，持续活跃的流没有固定总时限。桌面自定义 JSON 服务不强制改变协议；所有远程失败均只报告一次且不自动重试。
- 正式解读等待界面必须显示累计时间；内置服务还必须显示已连接、推理中和正文生成中的可观测阶段，不得展示内部推理内容。
- PWA 模型目录的确认域名由规范化后的目录地址确定，不得依赖尚未发现的模型名称或绕过 HTTPS 公网边界。
- 同一 AI 能力的规范化接口必须在最小测试、方案激活与实际调用阶段按同一契约解释；独立 `url` 与 `baseUrl + path` 都是有效端点表示，没有任一显式端点时失败关闭。
- Windows 正式版本通过 GitHub `latest` 稳定通道检查更新；正式 Release 必须同时提供与版本一致的 `latest.yml`、NSIS 安装包和 blockmap，下载仍由用户确认触发。
- 问爻原创源代码使用 MIT License；第三方依赖、字体、古籍和数据保留各自许可，软件免费不代表第三方 AI 服务免费。
- 排盘复制中的本卦与变卦表示成卦变化；回头关系表示变爻对同位本爻的作用，所有外部格式必须显式标注双方身份、作用方向和已建模的地支关系范围。

## Project Preferences

- 代码、注释和项目文档使用当前系统视角与领域术语。
- 优先修复跨运行时的根层契约，避免只改界面数字或添加平台专用补丁。
- 验证必须区分本地通过、已提交、已推送、已部署与用户可见生效。
- 来源：`user-confirmed`，依据仓库 `AGENTS.md` 的全局工程约定。

## Data and Privacy Boundaries

- 占簿备份为包含问题、报告、追问、证据和复盘的普通 JSON；不包含 API 密钥、应用设置、反馈上传授权或整座用户古籍书库。导入不触发 AI 请求。
- 不在项目文档、日志或测试夹具中保存 API Key、Cookie、个人信息或生产数据。
- 浏览器会话和 IndexedDB 属于本机站点数据；清除站点数据会移除本机历史或索引缓存。
- 用户导入古籍只由桌面端处理；是否发送片段给向量服务受独立确认约束。

## External Systems

| 系统 | 用途 | 当前证据 | 状态 |
|---|---|---|---|
| GitHub `ROTl24/wenyao` | 源码、Actions、桌面 Release | `config/public-links.json`、`.github/workflows/release-desktop.yml` | `external-verified`，`v0.5.7` 稳定 Release、四个发布任务与五项资产下载摘要已核验 |
| Cloudflare Pages | PWA 公开托管 | README 中的 `https://wenyao-9pu.pages.dev` | `external-verified`，生产主 JS、CSS、AI Worker、manifest 与 `0.5.7` 本地构建摘要一致，Service Worker 预缓存同一资源集合 |
| OpenAI 兼容 AI 服务 | 生成、向量和重排 | `config/ai-providers.json`、Provider 实现 | `code-verified`，真实调用由用户操作触发且失败不自动重试 |
| 可选 Cloudflare Worker/D1 | 匿名反馈聚合 | `workers/feedback` | `code-verified`，部署状态未验证 |

## Environment Constraints

- 主要开发环境为 Windows PowerShell；项目短命令使用 `npm.cmd`。
- Renderer 使用 React、TypeScript、Vite 与 Vitest；桌面端使用 Electron 和 Node 测试运行器。
- macOS DMG 必须在 macOS 构建环境验证；Windows 本地不能替代该产物验收。
- macOS 免费发行版采用 ad-hoc 签名和手动更新；没有原生更新逻辑的既有版本不能通过发布新版本远程获得自动更新能力。
- PWA 使用提示式 Service Worker 更新；构建成功不等于已打开页面立即切换到新资源。

## Easy-to-Misread Context

- `corpus.json` 保存正文，`knowledge-index.json` 保存知识分类；只加载前者会让条目仍可检索，但分类统计、证据标签和分类多样性语义失真。
- HTTP 200、新 HTML 或本地构建不能证明当前 PWA 标签页已使用新 Service Worker 控制的资源。
- 模型接口返回 HTTP 200 但正文是管理页面 HTML 时，属于接口路径错误，不代表模型连接成功；裸域名补全只发生在请求前，不会失败后换地址重试。
- 模型目录发生在模型选择之前；域名确认必须验证目录请求目标，不能复用要求模型名称非空的完整能力连接作为前置条件。
- 阿里云业务空间重排完整地址会被规范化为 Base URL 和相对路径；内部没有独立 `url` 字段不代表业务空间 ID 缺失。
- 正式请求省略 Token 上限只表示问爻不主动截断；服务商或具体模型仍可能因上下文窗口、账户策略或自身输出上限返回 `length`，并且更长输出会增加费用和等待时间。
- 桌面正式生成没有应用侧固定总时限，只表示问爻不在仍可能完成时按累计时长中止；内置服务的 90 秒边界从最后一次流活动计算。服务商和网络仍可终止请求，关闭应用也不能证明服务商已经取消处理。
- 检索回归指标证明召回链稳定，不证明现实预测准确率。
- 桌面端允许导入自有古籍，PWA 只浏览和检索内置古籍。

## Authority Index

| 主题 | 权威位置 | 来源 | 最近验证 |
|---|---|---|---|
| 项目目标与状态 | `docs/project/PROJECT.md` | `user-confirmed` / `code-verified` | 2026-08-27 |
| 语料正文与分类 | `resources/corpus.json`、`resources/knowledge-index.json` | `code-verified` | 2026-08-27 |
| 运行时能力边界 | `src/lib/desktop.ts`、`electron/main.cjs` | `code-verified` | 2026-08-27 |
| 自定义 AI 地址规范化 | `shared/ai-setup-core.cjs` | `code-verified` | 2026-08-27 |
| OpenAI Chat 响应、生成预算与时限 | `shared/chat-completion-core.cjs`、`electron/services/ai-runtime.cjs`、`electron/services/ai-provider.cjs`、`src/lib/webAI/provider.ts` | `user-confirmed` / `code-verified` | 2026-09-04 |
| 构建与测试入口 | `package.json`、`vite.config.ts` | `code-verified` | 2026-08-27 |
| 生成任务与未完成草稿 | [Agent Note](../../.agents/notes/implemented/feature/2026-09-06-generation-drafts-tasks.md) | `user-confirmed` / `code-verified` | 2026-09-06 |
| 完整报告离线评测 | [Agent Note](../../.agents/notes/implemented/process/2026-09-06-offline-report-evaluation.md) | `user-confirmed` / `code-verified` | 2026-09-06 |
| 占簿备份与复盘 | [Agent Note](../../.agents/notes/implemented/feature/2026-09-06-session-archive-review.md) | `user-confirmed` / `code-verified` | 2026-09-06 |
| 结果阅读与新手入口 | [Agent Note](../../.agents/notes/implemented/feature/2026-09-06-result-reading-onboarding.md) | `user-confirmed` / `code-verified` | 2026-09-06 |
| 桌面发布流程 | `.github/workflows/release-desktop.yml` | `code-verified` | 2026-08-27 |
| Windows 在线更新 | `electron/services/update-manager.cjs`、`scripts/verify-release.mjs` | `code-verified` | 2026-08-27 |
| 开源许可 | `LICENSE`、`package.json`、`README.md` | `user-confirmed` / `code-verified` | 2026-08-30 |
| 排盘复制与回头关系 | `src/lib/divination.ts`、`src/lib/relationLabels.ts`、`src/lib/plateExport.ts`、`src/lib/plateExport.test.ts` | `user-confirmed` / `code-verified` | 2026-08-31 |

## Superseded Context

- 暂无。
