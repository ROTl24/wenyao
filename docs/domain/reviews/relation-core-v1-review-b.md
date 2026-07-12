# `relation_core_v1` 独立来源审阅 B

审阅结论：`MATCHED`

本报告由自动化代理独立完成，不是人工底本复核，也不把电子文本转录质量提升为人工校勘。审阅过程中未读取 A 报告，未询问或接收 A 的结论。

## 1. 审阅记录

```yaml
reviewerId: codex-corpus-relation-b
reviewerKind: automated-agent
independentRunId: relation-core-v1-b-0656a5f5-e8e3-47e0-9df5-02d0fd919f8a
reviewedAt: 2026-07-12T09:34:19.2997047+08:00
artifactHash: 60a7d9f9e9d607c83ddfe191347c1b9e5f30a47d1ee53a3e70fe29976aea8608
outcome: matched
reportPath: docs/domain/reviews/relation-core-v1-review-b.md
inputSourceRefs:
  - WS-ZENGSHAN-11
  - WS-ZENGSHAN-12
  - WS-ZENGSHAN-19
  - WS-ZENGSHAN-20
  - WS-LIUREN-DAQUAN-1
  - WS-WUXING-JINGJI
checkedClaims:
  - artifact-hash-and-dependency
  - element-five-by-five-matrix
  - six-combines-and-six-clashes
  - six-harms-profile
  - break-profiles-and-default-intersection
  - directional-punishments
  - source-evidence-capsules
```

## 2. 独立路径与证据边界

- 完整读取候选 `relation-core-v1.ts`、`branch-relations.ts`、`element-relations.ts`、关系 registry、审阅脚本及候选审阅册。
- `agent-reach` CLI 和 `mcporter` 在本机不可用；按技能降级路径使用 Jina Reader、Wikisource raw 固定修订及 MediaWiki revision API。
- 本地独立交叉材料为 `resources/corpus-manifest.json` 和 `resources/corpus.json`。manifest 标明语料版本 `2026.07.11-user-books-1`、类型 `user-provided-plain-text`；其中《增删卜易》源 `ZENGSHAN-BUYI` 的原文件 SHA-256 为 `5a1bf59de04180d2f118ebe25abb84565b30aa731c986a83ace4898f5c0c04ae`。
- 本地《增删卜易》条目 `ZENGSHAN-BUYI-0045` 同时保存五行相生、相克原文，`ZENGSHAN-BUYI-0054` 保存六合表，`ZENGSHAN-BUYI-0058` 保存六冲表；四项均与固定 Wikisource 修订一致。
- 本地 corpus 不含《六壬大全》或《五行精纪》，这两项仅按实际打开的固定 Wikisource 修订核验，不声称有本地底本交叉。
- `RuleSourceRef.contentHash` 仅验证本地 evidence capsule payload；下文另列远程实际证据。它不是远程页面字节哈希。
- 本次候选的六个 `RuleSourceRef.url` 均已直接包含 `oldid`。MediaWiki revision API 对六个 revid 的回查分别得到《增刪卜易/11》`2100315`、《增刪卜易/12》`2100316`、《增刪卜易/19》`2100447`、《增刪卜易/20》`2100449`、《六壬大全/1》`854569` 和《五行精紀》`2352956`；逐个给 URL 追加 `action=raw` 后，locator 所列原文均实际命中。

## 3. Artifact、依赖与胶囊复算

使用独立 canonicalizer（对象键升序、数组保序、UTF-8 无额外空白）及 Node `crypto` 重算：

| 项目 | 结果 |
|---|---|
| canonical UTF-8 bytes | `3,476` |
| declared artifactHash | `60a7d9f9e9d607c83ddfe191347c1b9e5f30a47d1ee53a3e70fe29976aea8608` |
| computed artifactHash | `60a7d9f9e9d607c83ddfe191347c1b9e5f30a47d1ee53a3e70fe29976aea8608` |
| Task 3 frozen dependency | `241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa` |
| candidate dependency | `241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa` |
| manifest 审阅前状态 | `unverified + fixture-only + reviews=[]` |
| 生产门 | 关闭，符合候选状态 |

六个胶囊的 declared/computed SHA-256 全部一致：

| sourceRef | SHA-256 |
|---|---|
| `WS-ZENGSHAN-11` | `f16f6336f4fb7df3dae731dbfbc409828edd1fe14dce9d6e11495b61ad0df50c` |
| `WS-ZENGSHAN-12` | `1511a1abe713d5ac655b279cf3431f7c1adc05bac644d500c1b6f9dd83d5441a` |
| `WS-ZENGSHAN-19` | `d79377f29e075dd8f6f2aa0d386f7e261fa4258d596709e2b0b4ebd0b8787721` |
| `WS-ZENGSHAN-20` | `53e84f4b5c9b20b7364b7a482d590231f23e9eb0cc2d6bdab2c74836e302b546` |
| `WS-LIUREN-DAQUAN-1` | `cd27a67f0265fc79cc6683a17ce6bcd90d1a2c01d3657e4860823e46ef2c1ed4` |
| `WS-WUXING-JINGJI` | `a0425df7a140eaaa0af02774092d3562c5d9deae8d54fd8ab47bcb0f283f2f41` |

`node scripts/review-relation-candidate.mjs` 另一次执行也为 exit 0，并输出相同 hash、字节数、依赖和六个胶囊 hash。

## 4. 六个 sourceRef 的实际证据

| sourceRef | 实际打开的固定证据 | 对应主张与差异 |
|---|---|---|
| `WS-ZENGSHAN-11` | [《增刪卜易/11》oldid 2100315](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/11&oldid=2100315)，修订时间 `2022-01-20T03:07:47Z` | 原文列“金生水，水生木，木生火，火生土，土生金”。候选只循环移位为木起序，边集合完全一致。页面标示 50% 文本质量；本地用户语料 `ZENGSHAN-BUYI-0045` 独立一致。 |
| `WS-ZENGSHAN-12` | [《增刪卜易/12》oldid 2100316](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/12&oldid=2100316)，修订时间 `2022-01-20T03:09:47Z` | 原文列“金克木，木克土，土克水，水克火，火克金”。候选只循环移位为木起序，边集合完全一致；本地 `ZENGSHAN-BUYI-0045` 独立一致。 |
| `WS-ZENGSHAN-19` | [《增刪卜易/19》oldid 2100447](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/19&oldid=2100447)，修订时间 `2022-01-20T19:13:46Z` | 原文逐项为子丑、寅亥、卯戌、辰酉、巳申、午未；与候选六个对称 pair 完全一致。本地 `ZENGSHAN-BUYI-0054` 独立一致。 |
| `WS-ZENGSHAN-20` | [《增刪卜易/20》oldid 2100449](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/20&oldid=2100449)，修订时间 `2022-01-20T19:15:06Z` | 原文逐项为子午、丑未、寅申、卯酉、辰戌、巳亥；与候选六个对称 pair 完全一致。本地 `ZENGSHAN-BUYI-0058` 独立一致。 |
| `WS-LIUREN-DAQUAN-1` | [《六壬大全/1》oldid 854569](https://zh.wikisource.org/w/index.php?title=%E5%85%AD%E5%A3%AC%E5%A4%A7%E5%85%A8/1&oldid=854569)，修订时间 `2017-04-16T03:58:04Z`，实际核对“破、害、刑”三节 | ref locator 将三节按内容规范化为“十二支破、十二支害、十二支刑”；固定修订中的实际标题为“破、害、刑”，且各节开头都明确以十二支立法。“破”逐项给午破卯、辰破丑、酉破子、戌破未、亥破寅、申破巳并称“六反皆然”，规范化后恰为候选六个对称破；“害”逐对列子未、丑午、寅巳、卯辰、酉戌、申亥及反向，恰为候选六害；“刑”明确丑→戌→未、寅→巳→申、子卯互刑、辰亥午酉自刑，并明确拒绝未→丑、申→寅。候选将异体 `夘` 规范为 `卯`，无结构差异。 |
| `WS-WUXING-JINGJI` | [《五行精紀》oldid 2352956](https://zh.wikisource.org/w/index.php?title=%E4%BA%94%E8%A1%8C%E7%B2%BE%E7%B4%80&oldid=2352956)，修订时间 `2024-01-07T13:37:52Z`，实际命中 `【破杀】` 段 | ref locator 已固定为“破杀”条，并逐项列子酉、丑辰、卯午、未戌；原文为“卯与午，丑与辰，子与酉，未与戌，皆相破，惟寅申巳亥无破”，集合完全一致，且注明引自《李虚中书》。locator 与实际小标题、主张均吻合。 |

以上页面都实际打开；没有把 capsule 中的 `normalizedClaim` 反向当作远程核验结果。电子文本未做本次人工影像校勘，因此本报告只能支持 `independent-automated`。

## 5. 五行 5×5

行是 source，列是 target：

| source\target | 木 | 火 | 土 | 金 | 水 |
|---|---|---|---|---|---|
| 木 | same-element | generates | controls | — | — |
| 火 | — | same-element | generates | controls | — |
| 土 | — | — | same-element | generates | controls |
| 金 | controls | — | — | same-element | generates |
| 水 | generates | controls | — | — | same-element |

计数为 same-element 5、generates 5、controls 5、空 10。逐格调用候选 `elementRelation` 共 25 格，差异 0。`same-element` 是相等性原语；相生、相克来源没有另行声称“同元素”规则，本候选没有据此添加额外远程主张。

## 6. 地支表、默认交集与有向刑

| 关系 | 独立复算结果 | 候选差异 |
|---|---|---|
| 六合 | 子丑、寅亥、卯戌、辰酉、巳申、午未 | 0 |
| 六冲 | 子午、丑未、寅申、卯酉、辰戌、巳亥 | 0 |
| 六害 | 子未、丑午、寅巳、卯辰、申亥、酉戌 | 0 |
| 六壬六破 | 子酉、丑辰、寅亥、卯午、巳申、未戌 | 0 |
| 五行精纪四破 | 子酉、丑辰、卯午、未戌 | 0 |
| 默认共同四破 | 子酉、丑辰、卯午、未戌 | 0；严格等于两来源交集 |
| 有向刑 | 寅→巳、巳→申、丑→戌、戌→未、子→卯、卯→子、辰→辰、午→午、酉→酉、亥→亥 | 0 |

默认 12×12 有序矩阵计数：六合 12、六冲 12、六害 12、共同四破 8、有向刑匹配 14。其中刑为 10 个 forward 和 4 个 reverse 观察方向；reverse 只是查询方向标签，不会把 `申→寅` 或 `未→丑` 注册成来源规则。

默认 profile 的重叠均被保留：

- 寅↔巳：`harms + punishes`；
- 巳↔申：`combines + punishes`；
- 未↔戌：`breaks + punishes`。

显式切换 `liuren-six-breaks-v1` 后还会得到：

- 寅↔亥：`combines + breaks`；
- 巳↔申：`combines + breaks + punishes`。

候选 matcher 没有以 `if/else` 吞掉重叠关系。六破和有向刑继续保持 `profile-dependent + disputed`；本报告的 `matched` 表示 artifact 忠实匹配登记来源和争议标记，不表示这些表是跨流派唯一结论。

## 7. 差异、限制与最终结论

逐项结构差异为 0。仅记录以下非阻断性证据说明：

1. 六个 sourceRef 均已固定 exact `oldid`；《五行精纪》locator 已与实际 `破杀` 小标题一致。《六壬大全》locator 的“十二支”是对三节内容范围的规范化说明，实际标题为“破、害、刑”，三节及全部登记主张均命中。
2. Wikisource《增删卜易》至少相生、相克页明确显示 50% 文本质量；已有本地用户语料做独立交叉，但没有人工逐页影像复核。
3. 《六壬大全》《五行精纪》不在本地 corpus 中；本报告只确认固定电子修订确实含所登记主张，并保留候选的 profile/disputed 边界。

核心 artifact、依赖、五行矩阵、六合六冲六害、两套六破、默认交集、有向刑、重叠语义及六个 evidence capsule 全部与候选一致，因此本次 outcome 为 `matched`。该结论明确为自动化独立审阅 B，不能标为 `human-reviewed`。
