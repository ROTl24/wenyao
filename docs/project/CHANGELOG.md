---
project_docs_schema: 1
document_type: changelog
last_reviewed: 2026-09-06
---

# 项目成果记录

## Active Period

- 当前记录周期：2026 年。

## Entries

### CHG-20260906-release-057

- 日期：2026-09-06（Asia/Singapore）。
- 结果：`0.5.7` 将长文流式阅读、停止及草稿、结果导航、占簿备份恢复与复盘、新手模板和 AI 配置改进同步发布到 GitHub 源码、Cloudflare Pages、Windows 安装包与 macOS 通用 DMG。
- 验证：本地 306 项 Renderer、165 项 Electron 回归通过；Windows 安装包、类型、Renderer 构建与 PWA 产物通过校验。GitHub Actions `33990404576` 的 Windows、macOS Apple Silicon、Intel 与 publish 四项任务成功；最新稳定 Release 五项文件已下载，逐项大小及 SHA-256 与 GitHub 摘要一致，Windows SHA-512 更新元数据和 DMG 校验清单均匹配。
- 网站：主 JS、CSS、AI Worker、manifest 与本地构建字节一致。HTML 除构建换行与托管分析脚本外一致；Service Worker 预缓存 URL、资源版本和行为一致。关闭旧缓存控制的验收标签后重开，实际加载新主 Bundle，并验证事项模板、备份入口和三种复盘状态，控制台无错误。
- Git：发布源码 `b22c0c8`，标签 `v0.5.7`；后续提交只补发布记录与更新说明，不改变桌面产物。
- 边界：Windows 更新需用户确认下载，macOS 手动覆盖安装；没有静默安装本机软件，没有执行真实付费模型调用。
- Agent Note：[桌面更新与发布契约](../../.agents/notes/implemented/architecture/2026-08-27-desktop-update-release-contract.md)。
- 文档影响：README、PROJECT、PROJECT_CONTEXT、CHANGELOG，更新既有发布与生成任务 Note；无新增架构决策或事故教训。

### CHG-20260906-long-report-reading

- 日期：2026-09-06
- 结果：长解读复用已稳定的 Markdown 段落，完成时按原文偏移保留正在阅读的位置，结论速览插入不再影响当前段落。
- 验证：306 项 Renderer、165 项 Electron 测试，类型/Renderer 构建与 PWA 校验通过；真实本机 HTTP 长流覆盖中文网络分片、提前显示、完整聚合及中止。桌面与手机以 68,108 字符通过持续阅读、完成保存及位置保持验收。
- 边界：合成服务只验证本机链路与阅读行为；不证明真实模型速度、内容质量或取消计费。原有付费调用与发布边界不变。
- Git：相关实现与知识记录保留在当前未提交工作区，未推送、部署或更新已有安装版。
- Agent Note：[生成任务与草稿](../../.agents/notes/implemented/feature/2026-09-06-generation-drafts-tasks.md)。
- 文档影响：PROJECT、PROJECT_CONTEXT、CHANGELOG 与既有生成任务 Note；沿用已有决策归属，无新增独立决策或事故教训。

### CHG-20260906-experience-second-batch

- 日期：2026-09-06
- 结果：正式正文与追问支持流式阅读和停止接收，应用内切页可返回任务；停止/失败草稿独立保存并带证据快照，备份保留草稿。增加完整报告离线诊断及人工评分模板。
- 修复：输出额度截断不再因已有正文被判定为成功；接受停止后拒绝迟到结果；保存失败只重试本机写入。
- 验证：302 项 Renderer 与 164 项 Electron 测试通过；类型检查、Renderer 构建、PWA 产物与 Electron 入口语法校验通过。1280×800、390×844 合成页面验证正文、引用、停止、后台完成与追问草稿，无横向溢出和控制台错误；离线评测 CLI 用合成占簿完成文件输出。
- 边界：未执行真实模型调用、真实报告人工质量基线、应用关闭后的任务恢复或公开发布。自动诊断不是预测准确率。
- Git：实现与相关知识记录在同一工作区保留，尚未提交；保护任务开始时已有修改，未推送或部署。
- Agent Note：[生成任务与草稿](../../.agents/notes/implemented/feature/2026-09-06-generation-drafts-tasks.md)、[离线评测](../../.agents/notes/implemented/process/2026-09-06-offline-report-evaluation.md)。
- 文档影响：PROJECT、PROJECT_CONTEXT、DECISIONS、LESSONS、CHANGELOG 与评测使用说明；新增两份 Note，更新既有流式与备份 Note。

### CHG-20260906-experience-first-batch

- 日期：2026-09-06
- 结果：结果页提前展示综合结论、应期和最终结论原文，提供目录与固定导航；占簿支持完整备份、预览恢复、重复处理及独立复盘；首页提供事项示例，配置收拢高级接口选项，盘面增加术语说明。
- 修复：尚未检索与无命中不再混淆；通用弹窗支持焦点移入、Tab 循环、Esc 退出与焦点恢复。
- 验证：跨运行时自动化测试、类型/Renderer 构建与 PWA 产物验证；1280×720、390×844 本地浏览器用虚构记录完成完整恢复、复盘刷新、筛选、复制、实际下载与再解析，未调用真实 AI 服务。
- Git：实现、回归与相关知识记录保留在同一工作区，尚未提交；进入任务时已有的未提交修改完整保留，未推送或部署。
- Agent Note：[占簿备份与复盘](../../.agents/notes/implemented/feature/2026-09-06-session-archive-review.md)、[结果阅读与新手入口](../../.agents/notes/implemented/feature/2026-09-06-result-reading-onboarding.md)。
- 后续：正文逐段显示/停止、后台任务管理和完整解读离线质量评测属于下一批，不作为本条成果。
- 文档影响：PROJECT、PROJECT_CONTEXT、DECISIONS、LESSONS、CHANGELOG；新增两份功能 Agent Note。

### CHG-20260905-ai-configuration-consistency

- 日期：2026-09-05
- 结果：AI 地址支持完整接口原样调用并显示实际目标；手填模型与代理别名保留，目录仅作提示。修改地址、模型或密钥后重新测试，主模型可直接完成配置，本机服务支持免密钥。
- 原因：模型发现覆盖手填值、编辑后沿用旧测试结果、跨服务隐式取旧密钥及向量维度和路径身份不一致会让用户配置与实际请求脱节。
- 验证：向导交互、共享地址与密钥契约、Runtime/Worker 测试到正式调用及向量配置切换回归通过；全量测试、类型构建、PWA 产物检查和本地浏览器检查通过。使用模拟服务，未执行真实付费调用。
- Git：实现、回归与知识记录同属本地提交，未推送或部署。
- Agent Note：[AI 能力采用逐项配置与可选检索链路](../../.agents/notes/implemented/architecture/2026-08-26-optional-ai-capability-pipeline.md)、[自定义 AI 地址规范化](../../.agents/notes/implemented/bug-fix/2026-08-27-openai-base-url-default.md)。
- 文档影响：PROJECT、PROJECT_CONTEXT、CHANGELOG、DECISIONS 与已有能力配置、地址规范化 Note。

### CHG-20260904-desktop-analysis-stream-progress

- 日期：2026-09-04
- 结果：Electron 内置生成服务改为单次 SSE 请求，结果页持续显示检索、连接、推理、正文生成阶段和累计等待时间。首段最多等待 3 分钟，流开始后连续 90 秒无活动才失败；活跃长流没有固定总时限，失败不会自动重试。
- 原因：一次 DeepSeek 正式解读在检索后约 4 分 28 秒成功完成并自动保存，说明请求不是死锁；桌面端完整 JSON 响应和静态转圈界面在模型完成前没有任何活动证据，使正常长推理看起来已经卡死。
- 验证：SSE 解析失败与静态等待回归先在旧实现上失败；修复后覆盖超过连接期限的活跃流、90 秒停滞、未完成中断、用量、阶段传递和 65 秒等待计时。268 项 Renderer 测试、148 项 Electron 测试、类型构建、Renderer 构建、PWA 静态产物、Windows 安装包与发布结构校验通过。
- Git：实现、测试与知识记录位于同一本地提交，未推送或部署。
- Agent Note：[桌面正式生成按可观测流活动管理等待](../../.agents/notes/implemented/bug-fix/2026-09-04-desktop-ai-total-timeout.md)。
- 文档影响：PROJECT、PROJECT_CONTEXT、CHANGELOG、DECISIONS、LESSONS 与既有桌面正式生成 Agent Note。

### CHG-20260904-desktop-formal-generation-deadline

- 日期：2026-09-04
- 结果：Electron 正式解读和追问不再使用 180 秒应用总时限；模型探测、向量化和重排仍使用有限时限。Provider 对连接和正文读取阶段的中止统一返回中文 `AI_TIMEOUT`，不会自动重试。
- 原因：移除正式输出 Token 上限后，DeepSeek 长推理仍被 Electron Runtime 在 180 秒处主动中止；正文读取阶段的异常没有经过超时归类，界面直接显示底层英文错误。
- 验证：故障注入回归先稳定复现 `The operation was aborted due to timeout`，修复后确认正式解读与追问均不创建固定总时限；正文读取超时只发起一次请求并返回中文操作建议。266 项 Renderer 测试、144 项 Electron 测试、类型构建、Renderer 构建、PWA 静态产物、Windows 安装包与发布结构校验通过。
- Git：实现、测试与知识记录位于同一本地提交，未推送或部署。安装后运行时复核期间，账本新增一次查询向量化和一次重排，未新增生成调用；调用图没有应用启动自动执行正式分析的路径，因此这两次检索不作为修复验收证据。
- Agent Note：[桌面正式生成按可观测流活动管理等待](../../.agents/notes/implemented/bug-fix/2026-09-04-desktop-ai-total-timeout.md)。
- 文档影响：PROJECT、PROJECT_CONTEXT、CHANGELOG、DECISIONS、LESSONS 与新增桌面正式生成 Agent Note。

### CHG-20260904-formal-generation-uncapped

- 日期：2026-09-04
- 结果：桌面端与 PWA 的正式 AI 解读和追问不再发送应用侧输入或输出 Token 限制；Provider 只在最小连接测试等调用方显式给出预算时发送 `max_tokens`。
- 原因：本地正式解读输入 16639 Token 后，DeepSeek 输出恰好在问爻固定的 8192 Token 上限结束，推理阶段耗尽预算且没有产生可展示正文。
- 验证：桌面正式生成、桌面 Provider 与网页 Provider 的请求体回归先稳定捕获 `max_tokens: 8192`，修复后均确认正式请求省略 Token 上限；显式 512 Token 推理耗尽用例和 Worker 最小测试继续通过。266 项 Renderer 测试、142 项 Electron 测试、类型检查、Renderer 构建与网页产物校验通过。
- Git：实现、测试与知识记录位于同一本地提交，未推送、部署或执行新的真实模型请求。
- Agent Note：[OpenAI Chat 探测与响应采用跨运行时共享契约](../../.agents/notes/implemented/bug-fix/2026-08-27-openai-chat-probe-response.md)。
- 文档影响：PROJECT、PROJECT_CONTEXT、CHANGELOG、DECISIONS、LESSONS 与既有 OpenAI Chat Agent Note。

### CHG-20260904-alibaba-rerank-index-activation

- 日期：2026-09-04
- 结果：桌面端已通过最小测试的阿里云业务空间重排地址可以继续完成向量索引准备，不再停在 0/1263 并误报业务空间接口缺失；真正没有任何显式端点的配置仍会在远程建库前失败关闭。
- 原因：完整重排地址保存为 `baseUrl + path`，Provider 使用该组合完成最小测试，方案激活却只把独立 `url` 字段视为有效接口。
- 验证：离线回归先复现 `AI_RERANK_ENDPOINT_REQUIRED`，修复后同一用例完成三项配置与模拟建库；反例确认缺失 `url` 和 `path` 时不发起建库。266 项 Renderer 测试、142 项 Electron 测试、类型检查、Renderer 构建与网页产物校验通过。
- Git：实现、测试与知识记录位于同一本地提交，未推送或发布。
- Agent Note：[阿里云业务空间地址按浏览器能力路由](../../.agents/notes/implemented/bug-fix/2026-08-24-alibaba-web-endpoint-routing.md)。
- 文档影响：PROJECT、PROJECT_CONTEXT、CHANGELOG、LESSONS 与既有阿里云端点 Agent Note。

### CHG-20260901-release-056

- 日期：2026-09-01
- 结果：`0.5.6` 将 Windows 状态文件原子替换恢复与 PWA AI 流完成态修复同步发布到 GitHub 源码、Cloudflare Pages、Windows 安装包和 macOS 通用安装包。
- 原因：两项已验证修复只存在于本地提交，线上 PWA、稳定更新通道和公开安装包尚未包含相同实现。
- 验证：266 项 Renderer 测试、140 项 Electron 测试、类型构建、PWA 发布校验与 Windows 本地安装包校验通过；GitHub Actions `33490650166` 的 Windows、macOS Apple Silicon、Intel 验收和 publish 任务全部成功。最新稳定 Release 包含五项预期资产，`latest.yml` 指向 `0.5.6` 安装包，DMG 摘要与 `SHA256SUMS.txt` 一致。Cloudflare Pages 主 JS、CSS、AI Worker 与 manifest 的 SHA-256 和本地构建一致，Service Worker 预缓存 URL 集合一致；关闭旧 Worker 控制的测试标签后重新打开，浏览器加载新主 Bundle 且无应用控制台错误。
- Git：实现提交 `dc269f7`、`9094f3d`；版本提交与标签 `e11ad87` / `v0.5.6`；GitHub Actions `33490650166`。
- Agent Note：[桌面稳定版本通过可验证发布元数据驱动 Windows 在线更新](../../.agents/notes/implemented/architecture/2026-08-27-desktop-update-release-contract.md)、[远程向量建库以完整批次断点和显式恢复为边界](../../.agents/notes/implemented/bug-fix/2026-08-31-provider-index-recovery.md)、[网页 AI 流式解读使用分层超时边界](../../.agents/notes/implemented/bug-fix/2026-08-25-web-ai-stream-start-deadline.md)。
- 文档影响：README、PROJECT、PROJECT_CONTEXT、CHANGELOG 与既有桌面发布、向量恢复、网页流式解读 Agent Note。

### CHG-20260901-web-ai-stream-completion

- 日期：2026-09-01
- 结果：PWA 在收到 OpenAI Chat 流的 `[DONE]` 后立即保留完整解读，底层 `ReadableStream` 清理拒绝不再把成功结果改判为“无法连接 AI 服务”。
- 原因：旧实现等待 `reader.cancel()` 完成后才返回已解析结果；若服务商已结束响应而浏览器流取消同时拒绝，该清理异常会进入通用网络错误分支并丢弃完整正文。
- 验证：先以故障注入测试复现截图中的通用网络失败，再验证修复后的同一用例；Provider 10 项测试、Renderer 构建和 PWA 发布校验通过。受控 SiliconFlow 线上最小测试与完整十一节解读均成功，完整流程生成山地剥之地风升并自动保存到历史；本地开发页的后续调用因 Vite 首次依赖优化刷新中断，不作为修复后真实验收。
- Git：实现、测试与知识记录位于提交 `9094f3d`，并由 `v0.5.6` 发布。
- Agent Note：[网页 AI 流式解读使用分层超时边界](../../.agents/notes/implemented/bug-fix/2026-08-25-web-ai-stream-start-deadline.md)。
- 文档影响：PROJECT、CHANGELOG、LESSONS 与既有网页流式解读 Agent Note。

### CHG-20260831-windows-index-progress-persistence

- 日期：2026-08-31
- 结果：Windows 在短暂占用 `app-data.json` 时会有限重试原子替换，远程向量建库不再因瞬时 `EPERM` 丢失状态进度或中断。
- 原因：SiliconFlow 全量验收在 280/1263 处成功保存向量断点后，Windows 拒绝状态文件重命名；服务商请求和向量数据均有效，故障属于本地进度持久化。
- 验证：故障注入回归、140 项 Electron 测试；真实建库从 280 条完整断点继续到 1263/1263，落盘 1024 维向量文件为 5,173,248 字节且 ID 顺序完整，向量检索返回 40 个候选。整个验收新增 130 条向量调用账本记录、472,292 个输入 Token，未自动重试远程请求。
- Agent Note：[远程向量建库以完整批次断点和显式恢复为边界](../../.agents/notes/implemented/bug-fix/2026-08-31-provider-index-recovery.md)。
- 文档影响：PROJECT、PROJECT_CONTEXT、CHANGELOG、LESSONS 与既有向量恢复 Agent Note。

### CHG-20260831-release-055

- 日期：2026-08-31
- 结果：`0.5.5` 将远程向量建库恢复与排盘复制方向修复同步发布到 GitHub 源码、Cloudflare Pages、Windows 安装包和 macOS 通用安装包。
- 原因：仓库中的两项已验证修复尚未进入公开 PWA 和桌面稳定更新通道。
- 验证：265 项 Renderer 测试、139 项 Electron 测试、类型检查、PWA 发布校验、Windows 本地安装包校验；GitHub Actions 完成 Windows、Apple Silicon、Intel 与发布任务，正式 Release 五项资产摘要有效；线上 JS、CSS 摘要和 Service Worker 预缓存清单与本地构建一致。
- Git：实现提交 `e88a171`、`0fe1221`；版本提交与标签 `4c381c0` / `v0.5.5`；GitHub Actions `33402940402`。
- Agent Note：[远程向量建库以完整批次断点和显式恢复为边界](../../.agents/notes/implemented/bug-fix/2026-08-31-provider-index-recovery.md)、[排盘复制显式区分成卦变化与回头作用](../../.agents/notes/implemented/bug-fix/2026-08-31-plate-copy-return-direction.md)。
- 文档影响：README、PROJECT、PROJECT_CONTEXT、CHANGELOG；发布沿用既有桌面更新契约，无新增 Agent Note。

### CHG-20260831-plate-copy-return-direction

- 日期：2026-08-31
- 结果：纯文本、Markdown 与 JSON 明确区分本卦到变卦的成卦变化和变爻对本爻的回头作用，不再用无标签反向箭头表达两种不同语义。
- 原因：无标签的“变爻→本爻”回头关系与排盘中的“本爻→变爻”成卦方向外观相反，外部模型会合理地把同一盘判断为输入矛盾。
- 验证：风水涣变山泽损截图同盘回归、全量测试、类型检查、Renderer 构建、三种格式的本地页面复制验收；Claude 独立复审意见在提交前逐项处理并复核。
- Git：实现、测试与知识记录位于提交 `0fe1221`，并由 `v0.5.5` 发布。
- Agent Note：[排盘复制显式区分成卦变化与回头作用](../../.agents/notes/implemented/bug-fix/2026-08-31-plate-copy-return-direction.md)。
- 文档影响：PROJECT_CONTEXT、DECISIONS、CHANGELOG、结构化复制 Agent Note 与回头方向 Agent Note。

### CHG-20260830-mit-license

- 日期：2026-08-30
- 结果：问爻原创源代码以 MIT License 免费开源，根许可证、包元数据和 README 使用同一许可声明，并保留第三方许可与 AI 服务费用边界。
- 原因：公开源码但没有许可证不能向外部使用者授予明确的使用、修改和分发权，也不能准确宣称开源。
- 验证：标准 MIT 文本、JSON 元数据、README 链接、项目知识严格审计与 `git diff --check`。
- Git：实现与知识记录位于提交 `6575f1a`，已推送到 `main`。
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
