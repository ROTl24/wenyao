# Agent Note: 内置古籍分类由跨运行时共享入口装配

Status: implemented

## Problem

内置古籍正文与知识分类分别保存在 `corpus.json` 和 `knowledge-index.json`。Electron 主进程会在加载时合并两者，PWA 设置页、古籍浏览和隔离 Worker 却直接消费未分类正文，导致同一批 1263 条语料在网页端显示为 0 条规则、0 条占例和 1263 条义理。检索仍能命中正文，但证据标签与按知识类型增加多样性的语义失真。

## Decision

`shared/corpus-knowledge.cjs` 是内置语料分类装配与统计的共同入口。Electron、PWA 渲染适配器和 Web AI Worker 均把正文与知识索引交给该纯函数，获得一致的 `knowledgeKind` 与 `topics`；设置页统计从已装配条目计算，书内条目和检索证据直接携带同一分类。

知识索引缺失、条目未标注或类型未知时，运行时把该条目降级为 `doctrine`，主题沿用条目自身 `topics` 或 `tags`。正式内置数据由覆盖性测试要求全部 1263 个 ID 可分类并保持 495 条规则、190 条占例和 578 条义理，因此安全降级不掩盖随应用发布的数据漂移。

## Alternatives considered

- 只把网页设置页数字改为 495、190 和 578：该方案不会修复书内条目、Worker 证据和检索类型多样性，并会在语料重建后再次漂移。
- 在网页与 Electron 各自保留分类合并代码：该方案继续允许两个运行时在缺省值、主题回退或索引格式变化时产生不同语义。
- 把分类字段复制进 `corpus.json`：该方案让正文包和知识索引同时成为分类权威，并把两个构建步骤的顺序耦合到数据格式中。

## Consequences

桌面端与 PWA 的分类统计、古籍浏览和 AI 证据语义保持一致，分类索引也进入网页构建依赖。PWA JavaScript 产物会包含这份索引数据，增加静态资源体积；若未来语料规模显著增长，应在保持单一分类权威的前提下评估更紧凑的构建表示。运行时降级保证索引局部异常不会清空整套古籍，但发布验收必须继续执行全 ID 覆盖测试。

## Verification

- 回归测试先复现网页状态 `0 / 0 / 1263` 和 Worker 证据缺少分类，随后验证网页状态为 `495 / 190 / 578`、书内条目分类正确且所有 Worker 证据具有合法类型。
- `electron/services/corpus-knowledge.test.cjs` 验证 1263 个内置条目分类计数与缺失索引时的安全降级。
- `npm.cmd test`、`npm.cmd run typecheck`、`npm.cmd run build:renderer` 与 `npm.cmd run verify:web` 完成无真实模型调用的本地验收。
- 本地构建与静态产物验证不能证明 Cloudflare Pages 已部署，也不能证明已打开的 PWA 标签页已切换到新 Service Worker。
