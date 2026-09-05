---
project_docs_schema: 1
document_type: project
last_reviewed: 2026-09-06
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

- 目标版本：`G-019`
- 目标：将体验改进与既有 AI 修复发布为 0.5.7，同步 GitHub 源码、Windows/macOS 安装包与 Cloudflare Pages。
- 来源：`user-confirmed`，用户明确要求更新安装包、GitHub 和网站。

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
| 自定义 AI 配置一致性 | `verified` | 完整路径、任意模型 ID、密钥引用、修改后重新测试及向量配置切换在桌面与 PWA 中保持一致 | 共享核心、向导、Runtime 与 Worker 回归 |
| `0.5.7` 跨渠道发布 | `in_progress` | GitHub 源码、稳定 Release 五项资产与网站资源来自同一发布实现 | 当前发布核验 |
| 长解读连续阅读 | `verified` | 超过 6 万字符真实本机 SSE 提前可读，分块渲染与完成切换保持当前段落，完整保存逐字一致 | 生成任务 Agent Note、HTTP 长流回归、桌面与手机 68,108 字符合成验收 |
| 体验改进第二批 | `verified` | 正文提前可读，停止及截断不进入完成态，切页可返回，草稿与证据可备份，离线诊断和人工评分分开 | 生成任务与离线评测 Agent Notes、跨运行时回归与合成页面验收 |
| 体验改进第一批 | `verified` | 原文结论、章节导航、记录恢复、复盘保存与弹窗键盘操作通过本地验证 | 结果阅读与占簿备份 Agent Notes、跨运行时回归及浏览器验收 |
| 跨平台本地优先应用 | `verified` | Electron 与 PWA 构建入口存在，四种起卦和排盘具备自动化测试 | `package.json`、`vite.config.ts`、`src/lib/*.test.ts` |
| 五书混合检索 | `verified` | 1263 条语料可经共享检索核心检索，分类索引覆盖全部语料 ID | `resources/corpus.json`、`resources/knowledge-index.json`、`shared/retrieval-core.cjs` |
| 网页古籍分类一致性 | `verified` | 网页统计、书内条目和 AI 检索均使用 495 规则、190 占例、578 义理分类 | 浏览器与 Worker 回归测试、全量测试、PWA 构建验证 |
| 自定义 AI 地址规范化 | `verified` | 裸域名默认使用 `/v1`，显式路径和 DeepSeek 官方根地址保持原语义，界面显示实际规范化结果 | `shared/ai-setup-core.cjs`、共享核心与向导回归测试 |
| OpenAI Chat 通用响应契约 | `verified` | 桌面端与 PWA 统一解析字符串及文本块正文，最小测试允许短推理并准确区分空正文原因 | `shared/chat-completion-core.cjs`、Provider、Runtime 与 Worker 回归测试 |
| 正式生成不设应用 Token 上限 | `verified` | 桌面端与 PWA 的正式解读和追问不发送应用定义的输入限制、`max_tokens` 或 `max_completion_tokens`，最小测试仍显式使用 512 Token | 正式调用、Provider 与 Worker 请求体回归测试 |
| 正式生成不设固定总时限 | `verified` | Electron 正式解读和追问不创建应用侧总超时；探测、向量和重排短请求仍有时限，正文读取超时返回中文错误且不会自动重试 | Runtime 与 Provider 故障注入回归、完整测试与构建校验 |
| 桌面长解读可观测 | `verified` | 内置生成服务的单次 SSE 请求显示连接、推理、正文生成阶段和累计等待时间；持续活跃流不受累计时长限制，停滞或中断不自动重试 | Provider 流式边界、Renderer 计时与应用阶段传递回归 |
| PWA 模型目录域名确认 | `verified` | 模型名称为空时仍按规范化目录地址显示并确认 HTTPS origin，界面与 Worker 共用目录安全入口 | `src/lib/webAI/security.ts`、向导与 Worker 回归测试 |
| Windows 稳定更新通道 | `verified` | 打包版启动及每六小时检查 GitHub Releases，用户确认后下载并在退出或重启时安装，正式 Release 同时发布 `latest.yml`、安装包与 blockmap | `electron/services/update-manager.cjs`、`scripts/verify-release.mjs`、`.github/workflows/release-desktop.yml` |
| MIT 开源许可 | `verified` | 根许可证、包元数据、README 与项目知识记录一致声明 MIT，第三方许可边界保持独立 | `LICENSE`、`package.json`、`README.md`、Agent Note |
| 远程向量建库可恢复性 | `verified` | 失败批次可诊断且不能原样续发，重新测试后从完整批次断点恢复，桌面与 PWA 共用向量文档契约 | Provider、Runtime、Worker 与向导回归测试 |
| 阿里云重排端点激活一致性 | `verified` | 业务空间完整地址通过最小测试后可进入索引准备；没有 `url` 与 `path` 的配置仍在建库前失败关闭 | Runtime 正反例回归、完整测试与 Renderer 构建 |
| `0.5.5` 跨渠道发布 | `verified` | GitHub `main` 包含发布实现与记录，`v0.5.5` 固定正式桌面源码，Cloudflare Pages 运行资源与标签源码构建一致 | `v0.5.5`、GitHub Actions `33402940402`、线上资源摘要校验 |
| 网页 AI 流完成态可靠性 | `verified` | 收到协议终止标记后，底层流清理失败不能覆盖已完成报告；真实浏览器流程能够生成并自动保存解读 | Provider 回归测试、SiliconFlow 受控线上闭环、PWA 构建验证 |
| `0.5.6` 跨渠道发布 | `verified` | GitHub 最新稳定 Release、Windows 更新资产、macOS 通用 DMG 与 Cloudflare Pages 运行资源均来自 `v0.5.6` 实现 | `v0.5.6`、GitHub Actions `33490650166`、远端资产与线上摘要校验 |

## Current State

- 长文持续追加复用已完成 Markdown 块，完成时保留可见段落；真实本机 SSE 与两种屏幕的 68,108 字符合成验收通过，当前合计 471 项测试通过。
- 正式正文与追问可逐段阅读；生成任务保留应用内切页状态，停止/失败草稿与完整报告分开保存，草稿带独立证据定位。
- 完整报告离线评测读取占簿备份，提供章节/引用诊断与绑定材料身份的人工评分；自动诊断不等于模型质量或现实预测准确率。
- 本地结果页提供原文结论节选、目录、固定导航和术语解释；未检索与无命中明确区分，弹窗共用焦点管理。
- 占簿支持搜索及复盘状态筛选导出、备份预览与一次恢复、重复记录处理；复盘保留实际结果、日期和标签，不进入反馈上传。
- 当前已获准发布 0.5.7，正在验证安装包与发布渠道；不含真实付费模型调用或本机静默安装。
- 自定义 AI 接口支持自动补全和完整地址两种用法，并预览实际请求目标；模型列表保留手填值，修改后的配置必须重新测试，主模型可直接完成配置。

- `package.json` 当前版本为 `0.5.7`；桌面正式构建从同一提交打包当前 Renderer、Electron 服务、共享 AI 核心与古籍数据。
- Electron 主进程、PWA 渲染适配器和 Web AI Worker 均通过 `shared/corpus-knowledge.cjs` 合并正文与分类索引。
- 网页状态、书内条目和检索证据已验证使用 495 条规则、190 条占例和 578 条义理。
- Electron 与 PWA 共用自定义 AI 地址规范化：裸域名默认补全 `/v1`，失败后不会自动切换地址或重复请求。
- Electron 与 PWA 共用 OpenAI Chat 响应解析；正式解读和追问不发送应用定义的输入或输出 Token 限制，只有最小连接测试显式使用 512 Token 单次预算，未指定采样参数时不发送 `temperature`。
- Electron 内置生成服务使用单次 SSE 请求：最多等待 3 分钟收到首段数据，开始接收后以连续 90 秒无活动判定停滞，持续活跃的流没有固定总时限。结果页显示检索、连接、推理、正文生成阶段和累计等待时间；自定义 JSON 服务保留原协议且所有失败都不自动重试。
- PWA 模型目录域名确认由规范化后的 `/models` 安全目标生成，不依赖尚未发现的模型名称。
- GitHub Release 工作流支持手动候选构建，并仅在版本标签路径发布正式桌面产物；Windows 稳定 Release 的 `latest.yml` 驱动既有安装版发现更新。
- macOS 免费发行版没有 Developer ID 与公证票据，`0.5.3` 客户端保持 GitHub Releases 手动更新，不能由后续版本远程改为自动更新。
- 问爻原创源代码采用 MIT License；第三方依赖、字体、古籍和数据继续按各自许可分发，第三方 AI 服务费用不属于软件免费承诺。
- 远程向量建库按完整批次保存断点；错误状态需要重新测试向量能力或显式降级为本地 BM25，PWA 同时保存当前 Worker 与 IndexedDB 批次断点。
- 桌面端按与 Provider 相同的端点契约激活阿里云重排：规范化的 `baseUrl + path` 与独立 `url` 均可表示已测试接口，二者都缺失时不会启动向量建库。
- Windows 桌面状态文件使用唯一临时文件和短时本地替换重试维持原子写入；该机制只处理本地瞬时占用，不会重发任何远程模型请求。
- `v0.5.6` 正式 Release 提供 Windows NSIS、blockmap、`latest.yml`、macOS 通用 DMG 与 SHA-256 清单；Cloudflare Pages 的主 JS、CSS、AI Worker 和 manifest 与该版本本地构建摘要一致，Service Worker 预缓存同一运行资源。
- PWA Chat 收到 `[DONE]` 后立即保留已完成正文；`ReadableStream` 取消或释放失败只影响资源清理，不能再把成功解读改判为网络失败，未完成的中断流仍按单次失败处理且不会自动重试。

## Blockers

- 无已确认阻塞。

## Next Actions

- 完成 0.5.7 发布及跨渠道核验；真实模型质量基线仍需获准样本，不包含付费调用。

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
| `G-008` | `verified` | 2026-08-31 | `0.5.5` 源码、Windows 安装包、macOS 通用安装包与 PWA 生产资源完成跨渠道验收 |
| `G-009` | `verified` | 2026-09-01 | 完成态不再被流清理异常覆盖，Provider 回归、真实生成与历史自动保存验收完成 |
| `G-010` | `verified` | 2026-09-01 | `0.5.6` 源码、Windows 安装包、macOS 通用 DMG 与 PWA 生产资源完成跨渠道验收 |
| `G-011` | `verified` | 2026-09-04 | 阿里云重排端点在最小测试、索引激活和实际调用间使用同一表示契约，缺失端点继续失败关闭 |
| `G-012` | `verified` | 2026-09-04 | 正式生成请求移除应用侧输入与输出 Token 上限，探测请求继续保持有限单次预算 |
| `G-013` | `verified` | 2026-09-04 | Electron 正式生成移除 180 秒固定总时限，响应正文超时统一归类且远程请求不自动重试 |
| `G-014` | `verified` | 2026-09-04 | Electron 内置生成服务改为可观测 SSE，长请求显示阶段与耗时，活跃流无固定总时限且停滞流不自动重试 |
| `G-015` | `verified` | 2026-09-05 | 完整接口、自定义模型、密钥与测试状态实现一致，跨运行时离线回归及本地浏览器检查通过 |
| `G-016` | `verified` | 2026-09-06 | 结果阅读、占簿备份、新手引导与复盘在本地通过自动化和浏览器验证，未发布 |
| `G-017` | `verified` | 2026-09-06 | 流式正文、停止、草稿、后台任务与离线评测完成本地验证；未执行付费模型验证或发布 |
| `G-018` | `verified` | 2026-09-06 | 6 万余字符的真实本机 SSE、Markdown 分块等价与桌面/手机连续阅读验收通过，未执行付费模型调用或发布 |
| `G-019` | `in_progress` | 2026-09-06 | 用户授权同步安装包、GitHub 和网站，发布验证进行中 |
