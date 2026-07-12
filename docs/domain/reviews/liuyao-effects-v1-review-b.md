# `liuyao_effects_v1` 独立来源审阅 B

审阅结论：`MATCHED`

本报告由自动化代理独立完成，不是人工底本校勘。审阅期间未读取、修改或询问审阅 A 的报告与判断；候选代码、manifest 和审阅 A 均未被本审阅修改。

## 1. 审阅记录

```yaml
reviewerId: codex-corpus-matrix-effects-b
reviewerKind: automated-agent
independentRunId: liuyao-effects-v1-b-a5d7cb2f-77da-4b82-bd23-2d9a9c5454c4
reviewedAt: 2026-07-12T12:00:40.9619972+08:00
artifactHash: 208ff324b2bc1a9dbdf45a848927d8bf6f0495152ab0ba6c45e477a7c5e742d6
outcome: matched
reportPath: docs/domain/reviews/liuyao-effects-v1-review-b.md
humanReviewed: false
inputSourceRefs:
  - WS-ZENGSHAN-SEASONS-2100323
  - WS-ZENGSHAN-MOVING-2100321
  - WS-ZENGSHAN-THREE-HARMONY-2100447
  - WS-ZENGSHAN-DAY-2100338
  - WS-ZENGSHAN-FAN-FU-2100458
  - WS-ZENGSHAN-VOID-2100460
  - CORPUS-ZENGSHAN-EFFECTS
  - CORPUS-BUSHI-EFFECTS
  - WS-ZENGSHAN-11
  - WS-ZENGSHAN-12
  - WS-ZENGSHAN-19
  - WS-ZENGSHAN-20
  - WS-ZENGSHAN-GROWTH-2100461
checkedClaims:
  - artifact-hash-and-three-dependencies
  - month-status-break-void-and-day-clash-policy
  - changed-to-base-return-relations-and-basis-facts
  - advance-retreat-and-growth-delegation
  - restricted-three-harmony-and-blockers
  - hexagram-harmony-clash-and-fan-fu-oracles
  - local-corpus-and-fixed-oldid-bindings
  - profile-source-and-production-gates
```

## 2. 结论与独立核验路径

总体结论为 `MATCHED`。当前候选 artifact 的 canonical hash、三项冻结依赖、十三个 evidence capsule、两书 manifest hash、十六条本地文本、月令/旬空/回头/进退/墓绝矩阵、受限三合、六合六冲、反吟伏吟和运行门均能独立复算或回溯到绑定来源。没有发现来源绑定与当前实现之间的新差异。

本次以 `resources/corpus.json`、`resources/corpus-manifest.json` 和另写在命令行中的硬编码 oracle 为主；候选 `review-effects-candidate.mjs` 仅作为待审对象另行运行，没有把脚本自身的布尔结果直接当作结论。六个自有 Wikisource ref 及五个继承 ref 均按 exact `oldid` 重新打开；四千零九十六状态还对实际 fixture 输出进行了全量枚举。

## 3. Artifact、三依赖与十三个胶囊

使用与候选实现独立书写的 canonicalizer（对象键按 code unit 升序、数组保序、UTF-8 无额外空白）重算：

| 项目 | 结果 |
|---|---|
| canonical UTF-8 bytes | `10,092` |
| declared artifactHash | `208ff324b2bc1a9dbdf45a848927d8bf6f0495152ab0ba6c45e477a7c5e742d6` |
| computed artifactHash | `208ff324b2bc1a9dbdf45a848927d8bf6f0495152ab0ba6c45e477a7c5e742d6` |
| manifest artifactHash | `208ff324b2bc1a9dbdf45a848927d8bf6f0495152ab0ba6c45e477a7c5e742d6` |
| manifest 候选状态 | `unverified + fixture-only + reviews=[]` |

三项依赖均由其 canonical payload 重新计算，并与候选 `dependsOn` 三方相等：

| 依赖 | computed SHA-256 |
|---|---|
| `wenwang_najia_v2` | `241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa` |
| `relation_core_v1` | `60a7d9f9e9d607c83ddfe191347c1b9e5f30a47d1ee53a3e70fe29976aea8608` |
| `growth_shensha_core_v1` | `e216e1d8a854972a1c5524bc8f73162e6eb2754144fd971152b795e24318f129` |

十三个 capsule 的 payload SHA-256 逐一一致，且顺序严格等于审阅记录中的 `inputSourceRefs`：

| inputSourceRef | SHA-256 |
|---|---|
| `WS-ZENGSHAN-SEASONS-2100323` | `81fd4baddc7171116e544a987a89cecf0c5c520134ff230c8750825b06bf705e` |
| `WS-ZENGSHAN-MOVING-2100321` | `8a3bd4cb3162a7260d0f33b9bb05616844335d96c46d0221c98ab36af180a641` |
| `WS-ZENGSHAN-THREE-HARMONY-2100447` | `b4cca4a1168daddee1f1381c51cf8232ca0a74510ed0b74a1b2c25eef295a347` |
| `WS-ZENGSHAN-DAY-2100338` | `82da6f9676ad40a24d06b4eaf1f54fe7b13df88d3fb4fc18cec52c6bf65e21f9` |
| `WS-ZENGSHAN-FAN-FU-2100458` | `5f683b9e4bf080dbc9919973b279e63d38dca6d8217c1bf180c68e661cd5f048` |
| `WS-ZENGSHAN-VOID-2100460` | `4cf2d5f1acc0ea6cb532329dc7865fe733d97d4b18791f1e82a65802bc513646` |
| `CORPUS-ZENGSHAN-EFFECTS` | `218bf82923531754da057049700a42931f8f27b9e401832f85ac3e2f52f49267` |
| `CORPUS-BUSHI-EFFECTS` | `1734bc45e5c7fdd50ccdd42534c3d59c6af8291ddcb83b6bf61e4810709d8e45` |
| `WS-ZENGSHAN-11` | `f16f6336f4fb7df3dae731dbfbc409828edd1fe14dce9d6e11495b61ad0df50c` |
| `WS-ZENGSHAN-12` | `1511a1abe713d5ac655b279cf3431f7c1adc05bac644d500c1b6f9dd83d5441a` |
| `WS-ZENGSHAN-19` | `d79377f29e075dd8f6f2aa0d386f7e261fa4258d596709e2b0b4ebd0b8787721` |
| `WS-ZENGSHAN-20` | `53e84f4b5c9b20b7364b7a482d590231f23e9eb0cc2d6bdab2c74836e302b546` |
| `WS-ZENGSHAN-GROWTH-2100461` | `e1fc94c03775c1f6be3c61869e184e9d653c99fbf12f9f2762293f86fd0d37da` |

`RuleSourceRef.contentHash` 是 capsule 中规范化 evidence payload 的 hash，不是远程页面字节 hash；远程正文另按固定修订核验。

## 4. 本地 corpus 绑定

manifest 和 artifact 的 corpusVersion 均为 `2026.07.11-user-books-1`。工作树没有两书原始 `.txt`，所以全书 hash 的可验证边界是 artifact 与本地 manifest 的精确相等；十六条 entry 则直接从 `corpus.json` 的 `text` 字段重新计算 SHA-256。

| sourceId | artifact / manifest 全书 SHA-256 | 结果 |
|---|---|---|
| `ZENGSHAN-BUYI` | `5a1bf59de04180d2f118ebe25abb84565b30aa731c986a83ace4898f5c0c04ae` | MATCHED |
| `BUSHI-ZHENGZONG` | `e6ba468011293b3f4cd368a3f5c66c284334b1dcb96dd5530f9b749c84ba881b` | MATCHED |

| corpus entry | computed SHA-256 | 主要核验范围 |
|---|---|---|
| `ZENGSHAN-BUYI-0047` | `13f51c0e23bd25d99ad0887fcfae4eeb4dbe423596438a6299edb5e337a524d7` | 变爻只回头作用本位动爻 |
| `ZENGSHAN-BUYI-0048` | `8093a8de4643f9d7baa0c6a29797686c88dbc96e29ef0b0cc87d2a174d6cf61b` | 四时旺相、月令、月破 |
| `ZENGSHAN-BUYI-0054` | `0f2009f48b1eb2cd1bbe5bcceda7c07c0d505dfbcfdcde0effd3ce4de244ab8e` | 六合、化合与卦合 |
| `ZENGSHAN-BUYI-0056` | `1d818e39a2f6d1510b87dfe8e0b0dcf87386c9676ab9faccc02db518dd6d332c` | 四组三合和内外补局 |
| `ZENGSHAN-BUYI-0057` | `8ca5e3329fe5ae98aed5703878e6c54ab6c1c7095881694aa5b6923ef01d51ce` | 明暗动、空破、入墓候局 |
| `ZENGSHAN-BUYI-0058` | `13ddbbf4040c7bd90c1ba93779b2c529353d02ca110dce5dea0ce50eb5dd9d64` | 六冲、月破、暗动、日破、回头冲 |
| `ZENGSHAN-BUYI-0060` | `e8afac171243393b25858f37925fb3e686be259276022aeb2f98d079ee16b932` | 旺静暗动、休囚日破 |
| `ZENGSHAN-BUYI-0062` | `34c393656661ebd31df4eb2d80e9e178896b6abdc2f734acada67f2cfe37eda8` | 内外反伏及半卦变化 |
| `ZENGSHAN-BUYI-0063` | `dad94225c5a75e4abba8e7acc26915c6a75dc370232b6f9fe409cf97ce41e286` | 外卦反吟与内外伏吟例 |
| `ZENGSHAN-BUYI-0064` | `032e33e83153b4217aa75a552ebd1a8b92feff66d806096280baca0bb7f19732` | 六旬旬空表 |
| `ZENGSHAN-BUYI-0066` | `a8187ed5badeb248a90637acca7eef99370e933bb16a0c4213182c2130ca103a` | 化墓化绝与土随水争议 |
| `ZENGSHAN-BUYI-0079` | `cd41af7f1ef51b05290badd128e7b656ae4baaed200f01f45a2af5bbd618809d` | 默认七对进退 |
| `BUSHI-ZHENGZONG-0046` | `d863150cbda9a39ba1a2d5d24e5ec24b4792a6ba0f1b34c82f38b3af1790b86b` | 六旬旬空交叉 |
| `BUSHI-ZHENGZONG-0047` | `834fcfbc31881afd7aba78021a97a28d994db0e93f69d2eea01184dd425af8f4` | 十二月破交叉 |
| `BUSHI-ZHENGZONG-0095` | `c06f824c4b00d4bf1305922a0a95b2c988ac97e92ad2cf866822d59e88dae760` | 方位卦反吟和爻支相冲 |
| `BUSHI-ZHENGZONG-0097` | `5ef89ee43992127c1c0813094de00bd965c9a33a40882018e279949ae205efb7` | 八对进退变体 |

十六条 declared/computed hash 全部一致。

## 5. Fixed oldid 实证

| sourceRef | exact oldid | 独立命中的核心内容 |
|---|---:|---|
| `WS-ZENGSHAN-SEASONS-2100323` | `2100323` | 十二月月建、同五行次旺、月生为相、未月火与丑月水余气 |
| `WS-ZENGSHAN-MOVING-2100321` | `2100321` | “变出之爻能生克冲合本位之动爻，不能生克他爻” |
| `WS-ZENGSHAN-THREE-HARMONY-2100447` | `2100447` | 四组三合、初三/四六补局、明暗动、空破与入墓待成 |
| `WS-ZENGSHAN-DAY-2100338` | `2100338` | 冲旺静为暗动、冲衰静为日破，且旺衰不能机械等同 |
| `WS-ZENGSHAN-FAN-FU-2100458` | `2100458` | 内外卦可分别反伏、外卦反吟例、内外伏吟例 |
| `WS-ZENGSHAN-VOID-2100460` | `2100460` | 甲子至甲寅六旬各空两支 |
| `WS-ZENGSHAN-11` | `2100315` | 五行相生五边及回头生 |
| `WS-ZENGSHAN-12` | `2100316` | 五行相克五边及回头克 |
| `WS-ZENGSHAN-19` | `2100447` | 六合六对及六合卦定义 |
| `WS-ZENGSHAN-20` | `2100449` | 六冲六对、月破/暗动/日破/回头冲 |
| `WS-ZENGSHAN-GROWTH-2100461` | `2100461` | 金巳、木亥、水土申的墓绝表及动化墓绝 |

这些 Wikisource 分章页标记为约 50% 文本质量，只能支持固定电子文本的一致性，不能表述为人工权威校本。本地《卜筮正宗》还存在 `戍/戌`、`干/乾` 等 OCR/异体，候选使用标准字形并由精确表与交叉来源约束，没有把 OCR 字形当成新规则。

## 6. 月令、月破、旬空与日冲 profile

### 月令 12 × 12

独立 oracle 的优先级为“同支当令 → 同五行 → 月令生爻 → 未火/丑水余气 → 休囚”，与候选 144 格逐格比较，差异为 0：

| status | 格数 |
|---|---:|
| `commanding` | 12 |
| `same-element` | 20 |
| `generated-by-month` | 28 |
| `residual-qi` | 4 |
| `resting` | 80 |

未月巳午、丑月子亥恰为四个余气格；月支冲爻另输出月破，即使土支同时属于同元素，也把 `effectiveSupport` 降为 false。

### 旬空 60 × 12

硬编码六旬为空 `戌亥 / 申酉 / 午未 / 辰巳 / 寅卯 / 子丑`。六十甲子乘十二支共 `720` 格，候选实际 `is-void` 输出差异为 0；只把日柱旬空施加到本卦爻及真实化爻，静爻没有伪造 changed-side fact。

### 日冲分类

- 结构性的日支冲始终由 Task 4 `clashes` 保留。
- 只在静态本卦爻上分类；动爻不通过自身化爻再判暗动/日破。
- 月令当令、同五行或月生且不月破时，条件性输出暗动。
- 月破，或月克且没有白名单生扶时，条件性输出日破；日、月、其他真实动爻的生/比可阻止后一路径，年、时、单纯合与余气不在白名单。
- 两种分类互斥；其余情况只保留原始冲，不强判。

上述“无扶白名单”是候选明确声明的产品 profile 操作化，并非假称为古籍完整算法；`normalizationNote` 已进入 canonical artifact。针对强静、弱无扶、其余未决、月破、日/动爻生扶、年时/合/余气排除和动爻自身等案例的运行结果均与该 profile 一致。

## 7. 回头关系、进退与墓绝委派

### 回头方向与 Task 4 basis

回头关系固定 `changed → base`，只作用本位动爻。独立硬编码 oracle 与候选实际输出对比：

| oracle | 格数 | 命中计数 | 差异 |
|---|---:|---|---:|
| 五行 changed→base | 25 | 回头生 5、回头克 5 | 0 |
| 地支 changed→base | 144 | 回头冲 12、回头合 12 | 0 |

在完整 12 × 12 扫描中检查到 `80` 条回头 effect fact；每条恰有一个 `basisFactId`，全部指向当前 Task 4 同一行、同一 comparisonId 的 `transition|changed|base` 原始 fact，没有复制第二套生克冲合原语，也没有方向反转。

### 七对与八对进退

- 默认七进：亥→子、寅→卯、巳→午、申→酉、丑→辰、辰→未、未→戌；反向为七退。
- 《卜筮正宗》审计 profile 再加戌→丑，反向丑→戌。

两个 profile 共 288 格逐格复算，默认 7 进/7 退、审计 8 进/8 退，差异为 0。`bushi-eight-pair-audit-v1` 明确 `enabled: false`，默认上下文仍为 `yehe-seven-pair-v1`。

### 墓绝委派

五行 × 十二支共 60 格，候选没有复制第二套墓绝表，而是调用 `twelveStage(base.branchElement, changed.branch)`：

- `changes-to-tomb` 共 5 格；
- `changes-to-absolute` 共 5 格；
- 每条都携带 `evaluator=twelveStage` 和 growth artifact hash `e216e1d8…f129`；
- 土行命中的墓、绝两格保持 `certainty=disputed`，其余为 `computed`。

## 8. 受限三合与 blockers

四组三合硬编码为申子辰水、亥卯未木、寅午戌火、巳酉丑金。独立构造每组三支齐的明动与全静 fixture：四个明动例全部形成三合，四个全静例全部不形成，差异为 0。

候选只开放三种成员模式：

1. 本卦三支齐，且至少一员明动或暗动；
2. 内卦初、三同时明动，由其中一个本位化爻补齐；
3. 外卦四、六同时明动，由其中一个本位化爻补齐。

内初三和外四六的独立 fixture 均命中，非端点组合不命中。重复支会枚举所有已激活成员组合，优先未受阻组合，再按稳定 code-unit 顺序选择，并记录 alternatives；双候选 fixture 得到 `candidateCombinationCount=2` 和一条 alternative，没有丢失歧义。

五类 blocker 均用实际下游 fact ID 验证：

| blocker | 实际结果 |
|---|---|
| `is-void` | 降为 `has-three-harmony-candidate` |
| `is-month-break` | 降为 candidate |
| `is-day-break` | 降为 candidate |
| 日柱 `is-growth-stage=墓` | 降为 candidate；年/月/时墓不阻断 |
| `changes-to-tomb` | 降为 candidate |

这与 2100447 的“空破待填、入墓待冲”及当前命名 profile 的日墓/化墓边界一致。

## 9. 六合六冲、反吟伏吟与 64/4096 oracle

### 六十四卦集合

由六个六合支对、六个六冲支对和对应爻位 `1-4 / 2-5 / 3-6` 独立计算：

- 六合 8 卦：地雷复、地天泰、雷地豫、水泽节、泽水困、山火贲、火山旅、天地否；
- 六冲 10 卦：坤为地、震为雷、雷天大壮、坎为水、兑为泽、艮为山、离为火、巽为风、天雷无妄、乾为天。

候选 64 卦查表与这两个集合完全相等且无重叠。

### 四千零九十六状态

对每爻 `6/7/8/9` 的 4096 种组合，一边用独立硬编码支对 oracle，一边读取候选 lookup，再对实际 `deriveFormationsForReviewFixture` 输出计数：

| 指标 | 数量 |
|---|---:|
| base 六合 / 六冲 emitted | 512 / 640 |
| changed 纯 side lookup 六合 / 六冲 | 512 / 640 |
| changed 实际 emitted 六合 / 六冲 | 504 / 630 |
| innerFan / outerFan / anyFan / bothFan | 128 / 128 / 252 / 4 |
| innerFu / outerFu / anyFu / bothFu | 128 / 128 / 252 / 4 |

changed lookup 的 `512/640` 与 emitted 的 `504/630` 差值，恰是八个静态六合卦和十个静态六冲卦；候选正确执行 `changedSideRequiresMovingLine`，没有为静卦重复输出 changed-side formation。4096 状态中 candidate lookup、实际 emitted 与独立 oracle 的差异均为 0。

默认反吟/伏吟是命名 profile：内或外三条对应支全冲/全同，且该半卦至少一条真实动爻。2100458 以卦例支持内外分别反伏，但没有给出现代形式的完整算法；候选已用 `normalizationNote` 明示这是由例证提炼。`BUSHI-ZHENGZONG-0095` 明确给出方位对乾巽、坎离、艮坤、震兑；候选只把它保存为 `directional-trigram-fan-yin-v1` 且 `enabled: false`，没有混入默认 profile。

## 10. Profile、source 与生产门

- 默认 effects profile 精确绑定当前 artifact hash，并选择月令、静爻旺衰日冲、野鹤七对、土随水墓绝、受限三合和对应支反伏六项命名 policy。
- 十三个 required source 都已注册；十九条 effects rule 的全部 `sourceRefs` 都落在这十三项内。
- fixture gate 接受 `DEFAULT_RULE_CONTEXT`；伪造 profile、篡改 source、附加未知 source 和重复 source 均被拒绝。
- manifest 当前保持 `unverified + fixture-only + reviews=[]`；`assertProjectEnabledEffectsBundle()` 抛出“日月动变规则包未通过项目运行门”。
- 当前生产 `deriveFacts` 不输出 Task 5 候选关系；三个 fixture API 和内部 Task 4 derive API 均未从领域 barrel 导出。
- 运行门仍要求两份独立审阅的 reviewer、runId、reportPath、inputSourceRefs、checkedClaims 和 outcome 全部满足约束。本报告只给出 B 的 `matched`，未自行开启生产门。

## 11. 运行复核

- `node scripts/review-effects-candidate.mjs`：exit 0；输出同一 hash、`10092` bytes、十三 capsule、十六 entry、三依赖及候选关闭状态。
- `vitest` 定向运行 `calendar-effects.test.ts`、`moving-effects.test.ts`、`formations.test.ts`：3 files / 39 tests 全部通过。
- 独立命令行 oracle：月令 144 格、旬空 720 格、进退 288 格、五行回头 25 格、支回头 144 格、墓绝 60 格、64 卦和 4096 状态均为 0 mismatch。

## 12. 差异与限制清单

1. `2100323` 的正二月休囚句重复“火”并漏“水”；候选只按同章月令结构归一为“其余休囚”，且把该说明写入 capsule，未隐藏文本问题。
2. 暗动/日破的“无扶白名单”是保守产品 profile，不是古籍现成的完整算法；候选已明确标注，故来源与实现之间不存在冒充关系。
3. 对应支全冲/全同反伏是从 `2100458` 的内外卦例提炼；方位卦反吟属于《卜筮正宗》另一模型，候选正确隔离为关闭变体。
4. 两份本地电子文本含 OCR/异体；本报告验证的是固定 corpus entry、manifest hash 与 exact oldid 的一致性，没有进行纸本影像校勘。
5. `matched` 仅覆盖当前 hash、十三个输入来源和八项 checked claims；任何 canonical artifact 改动都必须重新审阅。

## 最终判定

`MATCHED`。当前 artifact `208ff324b2bc1a9dbdf45a848927d8bf6f0495152ab0ba6c45e477a7c5e742d6` 在本报告八项 checked claims 范围内通过独立来源审阅 B。该结论为 `automated-agent`，不能标记为人工审阅，也不会绕过 manifest 的完整双审生产门。
