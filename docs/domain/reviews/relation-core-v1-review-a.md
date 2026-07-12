# `relation_core_v1` 独立自动审阅 A

结论：`MATCHED`

本报告是自动代理对候选 artifact 的独立来源审阅，不是人工底本复核。审阅过程中未读取、询问或引用 B 审阅报告。

## 1. 审阅记录

- `reviewerId`: `codex-wikisource-relation-a`
- `reviewerKind`: `automated-agent`
- `independentRunId`: `relation-core-a-rerun-20260712-093342-3136109`
- `reviewedAt`: `2026-07-12T09:33:42.3136109+08:00`
- `artifactHash`: `60a7d9f9e9d607c83ddfe191347c1b9e5f30a47d1ee53a3e70fe29976aea8608`
- `outcome`: `matched`
- `reportPath`: `docs/domain/reviews/relation-core-v1-review-a.md`

`inputSourceRefs`（完整 6 项）：

1. `WS-ZENGSHAN-11`
2. `WS-ZENGSHAN-12`
3. `WS-ZENGSHAN-19`
4. `WS-ZENGSHAN-20`
5. `WS-LIUREN-DAQUAN-1`
6. `WS-WUXING-JINGJI`

`checkedClaims`（完整等集，顺序固定）：

1. `artifact-hash-and-dependency`
2. `element-five-by-five-matrix`
3. `six-combines-and-six-clashes`
4. `six-harms-profile`
5. `break-profiles-and-default-intersection`
6. `directional-punishments`
7. `source-evidence-capsules`

## 2. 实际来源路径与证据

本次候选的六个 `RuleSourceRef.url` 均已直接固定到精确 `oldid`。通过 MediaWiki API 以六个 revision ID 反查，分别解析为《增刪卜易/11》《增刪卜易/12》《增刪卜易/19》《增刪卜易/20》《六壬大全/1》《五行精紀》，与 sourceRef 标题和 locator 指向一致。以下固定修订是本次复验实际读取的远程电子文本；页面校对等级不等同于人工底本复核。

| sourceRef | 本次实际读取的固定修订 | 远程正文核对结果 |
|---|---|---|
| `WS-ZENGSHAN-11` | [《增刪卜易/11》oldid 2100315](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/11&oldid=2100315) | 正文明确列出“金生水、水生木、木生火、火生土、土生金”；与候选五生有向环一致。页面标为 50% 电子文本。 |
| `WS-ZENGSHAN-12` | [《增刪卜易/12》oldid 2100316](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/12&oldid=2100316) | 正文明确列出“金克木、木克土、土克水、水克火、火克金”；与候选五克有向环一致。页面标为 50% 电子文本。 |
| `WS-ZENGSHAN-19` | [《增刪卜易/19》oldid 2100447](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/19&oldid=2100447) | 开篇逐项列出子丑、寅亥、卯戌、辰酉、巳申、午未六合；与候选六对一致。 |
| `WS-ZENGSHAN-20` | [《增刪卜易/20》oldid 2100449](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/20&oldid=2100449) | 开篇逐项列出子午、丑未、寅申、卯酉、辰戌、巳亥六冲；与候选六对一致。 |
| `WS-LIUREN-DAQUAN-1` | [《六壬大全/1》oldid 854569](https://zh.wikisource.org/w/index.php?title=%E5%85%AD%E5%A3%AC%E5%A4%A7%E5%85%A8/1&oldid=854569) | “害”条逐对解释六害；十二支神煞表给出六破；“刑”条明确自刑、互刑和朋刑的有向限制。候选将这些来源特定规则标成 profile-dependent，并将破、刑标 disputed，处理与来源状态相符。 |
| `WS-WUXING-JINGJI` | [《五行精紀》oldid 2352956](https://zh.wikisource.org/w/index.php?title=%E4%BA%94%E8%A1%8C%E7%B2%BE%E7%B4%80&oldid=2352956) | “破杀”条明列“卯与午、丑与辰、子与酉、未与戌，皆相破，惟寅申巳亥无破”；与候选四破完全一致。 |

来源差异与限制如实记录：

- 《六壬大全/1》的“支害”横表第二项可见转录异常，写成了 `子`；同页连续正文明确写有“丑加午、午加丑”，其余五害也逐对正反解释，因此候选采用丑午而不是复制横表错字，有直接正文依据。
- 《六壬大全/1》在解释刑法的推演句中还出现通向自刑的中间链；随后又明确总结“辰亥午酉为自刑、子卯与卯子为互刑”，并写明朋刑只取丑→戌→未、寅→巳→申的前向核心、不得反补。候选只登记这个明确的有向核心，并标记 `disputed`，没有冒充无争议全表。
- 《六壬大全/1》固定修订中的可见小标题为“破”“害”“刑”；sourceRef locator 写作“卷一‘十二支破’‘十二支害’‘十二支刑’三条”，其中“十二支”是对三段内容的限定而非伪造的逐字标题，仍能唯一定位本次核验的三段。
- 候选 `RuleSourceRef.contentHash` 哈希的是代码中逐字保存、含 `fixedUrl` 的 normalized evidence capsule，不是远程网页字节。本次另行打开 sourceRef 自身固定的修订完成语义核对；本报告不把 capsule hash 表述为网页 hash。

## 3. `artifact-hash-and-dependency`

运行 `node scripts/review-relation-candidate.mjs` 并独立检查结果：

- canonical UTF-8 bytes：`3,476`
- declared artifact hash：`60a7d9f9e9d607c83ddfe191347c1b9e5f30a47d1ee53a3e70fe29976aea8608`
- computed SHA-256：`60a7d9f9e9d607c83ddfe191347c1b9e5f30a47d1ee53a3e70fe29976aea8608`
- 结果：一致
- `dependsOnWenwangArtifactHash`：`241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa`
- Task 3 冻结 hash：`241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa`
- 依赖结果：一致
- 候选 manifest 仍为 `unverified + fixture-only + reviews=[]`，生产门保持关闭；符合审阅前状态。

## 4. `element-five-by-five-matrix`

完整有向矩阵复算如下；行是 source，列是 target：

| source \ target | 木 | 火 | 土 | 金 | 水 |
|---|---|---|---|---|---|
| 木 | same | 生 | 克 | 空 | 空 |
| 火 | 空 | same | 生 | 克 | 空 |
| 土 | 空 | 空 | same | 生 | 克 |
| 金 | 克 | 空 | 空 | same | 生 |
| 水 | 生 | 克 | 空 | 空 | same |

计数为：`same-element=5`、`generates=5`、`controls=5`、`null=10`。生克方向与固定修订 2100315、2100316 一致；候选从 Task 3 冻结原语复用，没有复制第二份生克表。

## 5. `six-combines-and-six-clashes`

- 六合：子丑、寅亥、卯戌、辰酉、巳申、午未，共 6 个无序对；12×12 有序矩阵为 12 个命中。
- 六冲：子午、丑未、寅申、卯酉、辰戌、巳亥，共 6 个无序对；12×12 有序矩阵为 12 个命中。
- 两表均为 `structural + computed`，与各自来源正文逐项一致。

## 6. `six-harms-profile`

《六壬大全/1》正文逐对支持：子未、丑午、寅巳、卯辰、申亥、酉戌。候选恰为这 6 个对，12×12 有序矩阵为 12 个命中；元数据为 `profile-dependent + computed`、profile `liuren-six-harms-v1`，没有把六壬来源体系伪装成通用结构表。

## 7. `break-profiles-and-default-intersection`

- 六壬六破：子酉、丑辰、寅亥、卯午、巳申、未戌，恰为 6 对。
- 五行精纪四破：子酉、丑辰、卯午、未戌，恰为 4 对。
- 两表集合交集复算：子酉、丑辰、卯午、未戌。
- 默认 `cross-source-common-four-breaks-v1` 与交集完全相等，未混入六壬独有的寅亥、巳申；默认有序矩阵为 8 个破命中。
- 三套破规则均为 `profile-dependent + disputed`，来源和 profile 未被合并覆盖。

## 8. `directional-punishments`

候选有向核心为：

- 寅→巳、巳→申；
- 丑→戌、戌→未；
- 子→卯、卯→子；
- 辰→辰、午→午、酉→酉、亥→亥。

共 10 条 forward 边；反向查询四个自刑仍显示同一 forward 边，因此默认有序矩阵统计为 `forward=10`、`reverse=4`。候选没有补出申→寅或未→丑；反向查询这两对只保留原有六冲，不出现刑。元数据为 `profile-dependent + disputed`，与来源内部存在的刑法口径复杂性相符。

## 9. 多关系重叠与不覆盖

实际调用 `branchRelationMatches` 验证：

- 默认寅亥：仅六合；显式六壬六破 profile：六合 + 破。
- 六壬六破 profile 下巳申：六合 + 破 + 巳→申刑。
- 默认寅巳：害 + 寅→巳刑。
- 默认辰辰：辰自刑。

候选返回全部命中，没有使用互斥分支覆盖重叠关系。

## 10. `source-evidence-capsules`

六个本地 capsule 均按 UTF-8 SHA-256 复算一致：

| sourceRef | declared / computed hash |
|---|---|
| `WS-ZENGSHAN-11` | `f16f6336f4fb7df3dae731dbfbc409828edd1fe14dce9d6e11495b61ad0df50c` |
| `WS-ZENGSHAN-12` | `1511a1abe713d5ac655b279cf3431f7c1adc05bac644d500c1b6f9dd83d5441a` |
| `WS-ZENGSHAN-19` | `d79377f29e075dd8f6f2aa0d386f7e261fa4258d596709e2b0b4ebd0b8787721` |
| `WS-ZENGSHAN-20` | `53e84f4b5c9b20b7364b7a482d590231f23e9eb0cc2d6bdab2c74836e302b546` |
| `WS-LIUREN-DAQUAN-1` | `cd27a67f0265fc79cc6683a17ce6bcd90d1a2c01d3657e4860823e46ef2c1ed4` |
| `WS-WUXING-JINGJI` | `a0425df7a140eaaa0af02774092d3562c5d9deae8d54fd8ab47bcb0f283f2f41` |

## 11. 最终判断

候选 artifact 的 hash、3,476 字节 canonical payload、Task 3 依赖、5×5 五行矩阵、六合六冲、六害、两份六破、默认交集、有向三刑核心、多关系重叠、六个精确 oldid sourceRef/locator 及新版 capsule hash 均与本次实际读取和复算结果相符。

因此本独立自动审阅 A 的结果为 `matched`。该结论只说明候选如实编码并隔离了所登记来源及其争议，不提升为 `human-reviewed`，也不否认电子文本的转录与流派限制。
