---
reviewerId: codex-source-reviewer-effects-a-24bcce01bb0c4f31
independentRunId: effects-a-20260712-115921-24bcce01bb0c4f318a377bbf47be82dd
reviewedAt: 2026-07-12T11:59:21+08:00
artifactId: liuyao_effects_v1
artifactHash: 208ff324b2bc1a9dbdf45a848927d8bf6f0495152ab0ba6c45e477a7c5e742d6
artifactBytes: 10092
outcome: matched
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
---

# `liuyao_effects_v1` 独立来源复审 A

## 结论

**matched**。

候选规则包的 canonical payload、三项依赖、13 个来源胶囊、固定 Wikisource 版本、本地语料绑定、日月动变规则、三合限制、六合六冲与反伏枚举结果，均与本轮独立复算和逐项来源核对一致。候选对原文未直接给出的产品化口径保留了明确披露，未把这些口径伪装成原文逐字规则。

本结论只表示“候选内容与所列来源及其声明的 profile 一致”，不是人类术数专家背书，也不授权进入生产。审查时规则包 manifest 仍为 `unverified`、`fixture-only`、`reviews=[]`；生产门保持关闭。本轮独立完成，未接触另一份并行审查报告。

## 1. 候选身份与依赖

| 检查项 | 独立复算结果 |
| --- | --- |
| artifact id | `liuyao_effects_v1` |
| canonical SHA-256 | `208ff324b2bc1a9dbdf45a848927d8bf6f0495152ab0ba6c45e477a7c5e742d6` |
| canonical UTF-8 bytes | `10092` |
| `wenwang_najia_v2` | `241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa` |
| `relation_core_v1` | `60a7d9f9e9d607c83ddfe191347c1b9e5f30a47d1ee53a3e70fe29976aea8608` |
| `growth_shensha_core_v1` | `e216e1d8a854972a1c5524bc8f73162e6eb2754144fd971152b795e24318f129` |

候选声明值与从 canonical payload 独立计算出的值完全相同；三个依赖哈希也与当前被引用规则包相同。审查过程中没有修改候选源码、manifest 或依赖。

## 2. 固定 Wikisource 版本核对

通过 MediaWiki revision API 对固定 `oldid` 逐项核对标题、时间戳、revision SHA-1，并另以渲染正文核验规则语义。`2100447` 同时支撑候选自有三合胶囊和继承的六合关系胶囊，因此 13 个 source ref 对应 10 个唯一远端 revision 与 2 个本地语料源。

| 固定版本 | revision SHA-1 | 时间戳（UTC） | 本轮核对的范围 |
| --- | --- | --- | --- |
| [《增删卜易》/11 oldid 2100315](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/11&oldid=2100315) | `55dac55f2a7b3a46d8588001755f3913e9473c10` | `2022-01-20T03:07:47Z` | 五行相生、回头生的关系基础 |
| [《增删卜易》/12 oldid 2100316](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/12&oldid=2100316) | `a0290ff965b9c30d307917d4ad259d71bac2dc25` | `2022-01-20T03:09:47Z` | 五行相克、回头克的关系基础 |
| [《增删卜易》/15 oldid 2100321](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/15&oldid=2100321) | `729f68a1fbd164e17a9a118a0c9744ce71401c49` | `2022-01-20T03:14:32Z` | 变爻回头作用于本位动爻的方向 |
| [《增删卜易》/15又 oldid 2100323](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/15%E5%8F%88&oldid=2100323) | `a226f44442e2a41de6fb19f8cbad70f20cd0e527` | `2022-01-20T03:16:20Z` | 四时旺相、余气与休囚 |
| [《增删卜易》/17 oldid 2100338](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/17&oldid=2100338) | `ec40f7ab39bcf30ad60cc1d1aa3be17a98aeba98` | `2022-01-20T03:42:37Z` | 静旺逢日冲为暗动、休囚逢日冲为日破 |
| [《增删卜易》/19 oldid 2100447](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/19&oldid=2100447) | `6dee0a09b634c622731dfb55be598c6c43cec6dc` | `2022-01-20T06:41:17Z` | 六合、四组三合、成局方式及空破墓阻断 |
| [《增删卜易》/20 oldid 2100449](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/20&oldid=2100449) | `2c34c3725692308ae6ded7be797e66d4b03b6798` | `2022-01-20T06:43:06Z` | 地支冲与六冲卦基础 |
| [《增删卜易》/25 oldid 2100458](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/25&oldid=2100458) | `2ad20d740cc8b09cb06421f560f81645d05c78b9` | `2022-01-20T06:50:15Z` | 内外卦反吟、伏吟及半卦变化例证 |
| [《增删卜易》/26 oldid 2100460](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/26&oldid=2100460) | `137cf0e60060630016f801e0be0a7229aa9ba68e` | `2022-01-20T06:51:46Z` | 六旬各空两支 |
| [《增删卜易》/26又1 oldid 2100461](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/26%E5%8F%881&oldid=2100461) | `c98ffd70527b3e119c981ab09e2d96d411c06e43` | `2022-01-20T06:52:42Z` | 十二长生、墓与绝的委托基础 |

### 来源披露判断

- 四时旺相固定源必须是 `2100323`；`2100321` 是动变生克冲合，不是四时旺相。候选绑定正确。
- `2100323` 的正、二月休囚句在电子转录中重复“火”而漏“水”。候选没有隐瞒，明确记录按同段旺相结构归一为“其余休囚”；“丑月水余气”则是原文直载。
- 日冲的“无扶白名单”是产品 profile 的操作化，不是原文完整算法；候选在胶囊和规则字段中均明确披露。
- 对应三支全冲/全同并要求半卦实动的反伏判定，是从 `2100458` 例证提炼的命名 profile；候选明确披露，未声称这是原文给出的完整形式定义。
- Wikisource 页面显示为电子转录文本，文本质量标记为 50%，不能把此次机器核对描述成人工校勘或专家审定。

## 3. 13 个来源胶囊

下列 `contentHash` 均按候选定义的规范化 capsule payload 独立复算，并非远端网页原始字节哈希。

| 顺序 | source ref | capsule payload SHA-256 | 核对结果 |
| ---: | --- | --- | --- |
| 1 | `WS-ZENGSHAN-SEASONS-2100323` | `81fd4baddc7171116e544a987a89cecf0c5c520134ff230c8750825b06bf705e` | 一致 |
| 2 | `WS-ZENGSHAN-MOVING-2100321` | `8a3bd4cb3162a7260d0f33b9bb05616844335d96c46d0221c98ab36af180a641` | 一致 |
| 3 | `WS-ZENGSHAN-THREE-HARMONY-2100447` | `b4cca4a1168daddee1f1381c51cf8232ca0a74510ed0b74a1b2c25eef295a347` | 一致 |
| 4 | `WS-ZENGSHAN-DAY-2100338` | `82da6f9676ad40a24d06b4eaf1f54fe7b13df88d3fb4fc18cec52c6bf65e21f9` | 一致 |
| 5 | `WS-ZENGSHAN-FAN-FU-2100458` | `5f683b9e4bf080dbc9919973b279e63d38dca6d8217c1bf180c68e661cd5f048` | 一致 |
| 6 | `WS-ZENGSHAN-VOID-2100460` | `4cf2d5f1acc0ea6cb532329dc7865fe733d97d4b18791f1e82a65802bc513646` | 一致 |
| 7 | `CORPUS-ZENGSHAN-EFFECTS` | `218bf82923531754da057049700a42931f8f27b9e401832f85ac3e2f52f49267` | 一致 |
| 8 | `CORPUS-BUSHI-EFFECTS` | `1734bc45e5c7fdd50ccdd42534c3d59c6af8291ddcb83b6bf61e4810709d8e45` | 一致 |
| 9 | `WS-ZENGSHAN-11` | `f16f6336f4fb7df3dae731dbfbc409828edd1fe14dce9d6e11495b61ad0df50c` | 一致 |
| 10 | `WS-ZENGSHAN-12` | `1511a1abe713d5ac655b279cf3431f7c1adc05bac644d500c1b6f9dd83d5441a` | 一致 |
| 11 | `WS-ZENGSHAN-19` | `d79377f29e075dd8f6f2aa0d386f7e261fa4258d596709e2b0b4ebd0b8787721` | 一致 |
| 12 | `WS-ZENGSHAN-20` | `53e84f4b5c9b20b7364b7a482d590231f23e9eb0cc2d6bdab2c74836e302b546` | 一致 |
| 13 | `WS-ZENGSHAN-GROWTH-2100461` | `e1fc94c03775c1f6be3c61869e184e9d653c99fbf12f9f2762293f86fd0d37da` | 一致 |

顺序与候选 `sourceRefs` 完全相同，没有遗漏、调序或以当前页面替代固定 revision。

## 4. 日月、月破、旬空与日冲 profile

### 月令状态

对 12 月支 × 12 爻支共 144 个组合穷举，按候选优先级得到：

| 状态 | 数量 |
| --- | ---: |
| `commanding` | 12 |
| `same-element` | 20 |
| `generated-by-month` | 28 |
| `residual-qi` | 4 |
| `resting` | 80 |

四个余气组合为未月巳、未月午、丑月子、丑月亥。月令同支、同五行、月生、余气、其余休囚的优先级与候选声明一致；月破由月支与爻支的结构性相冲另行判定，不被“同属土”掩盖。

### 旬空

独立穷举 60 日 × 12 支共 720 个格：恰有 120 个 `is-void`，每一日恰好两支为空，六旬分别为戌亥、申酉、午未、辰巳、寅卯、子丑。候选与 `2100460` 及本地《卜筮正宗》旬空条目一致。

### 日冲、暗动与日破

- 只对静态本卦爻分类；动爻不会借自己的变爻形成“外援”后被重新归类。
- 原始日冲先作为结构事实保留，再互斥分类为暗动或日破。
- 允许的有效生扶来源仅为月、日、其他动爻的本爻；关系仅限生与同五行。
- 年、时、仅合、余气和自己变爻不在白名单中。
- 暗动要求原始日冲、非月破且有有效月令/白名单生扶；日破要求月破，或月克且无白名单生扶。

以上是明确命名的 `yehe_effects_v1` 产品 profile；它与日辰章的强弱分流方向相符，但不应扩张表述为古籍给出的唯一完整算法。

## 5. 动变、进退与墓绝委托

### 回头关系

回头生、克、冲、合的统一方向为“变爻 → 本位动爻”。候选分别复用既有关系基础事实，并输出：

- `returns-generate`
- `returns-control`
- `returns-clash`
- `returns-combine`

5×5 五行生克表、12×12 地支冲合表及重叠情形均经穷举通过。输出事实携带相应 basis fact id，没有再制造第二套原始五行或地支关系；“回头”不会误判为本爻作用于变爻。

### 进神、退神

默认七对进神为：亥→子、寅→卯、巳→午、申→酉、丑→辰、辰→未、未→戌；退神按反方向判定。候选另保留含戌→丑的八对《卜筮正宗》审计 variant，但 `enabled=false`，不会混入默认七对。该差异同时由本地 `ZENGSHAN-BUYI-0079` 与 `BUSHI-ZHENGZONG-0097` 固定绑定，来源边界清楚。

### 化墓、化绝

候选没有复制第二张五行—地支表，而是委托 `growth_shensha_core_v1` 的十二长生 evaluator；输入为本爻支所属五行与变爻支。独立穷举得到：木墓未绝申、火墓戌绝亥、土墓辰绝巳、金墓丑绝寅、水墓辰绝巳。关系分别输出 `changes-to-tomb`、`changes-to-absolute`。土变巳可同时出现化绝与回头生，这是两类不同事实，不应互相覆盖。

## 6. 受限三合与阻断

四组三合固定为申子辰水、亥卯未木、寅午戌火、巳酉丑金。候选只允许三类成员模式：

1. 本卦三支齐全，且至少一员明动或暗动；
2. 内卦初、三爻同时明动，由其中一个本位化爻补足第三支；
3. 外卦四、六爻同时明动，由其中一个本位化爻补足第三支。

重复支与双端都能补局时，候选先枚举全部已激活成员组合，再优先无阻断组合，以成员实体 id 的 code-unit 最小值稳定裁决，并把未选中的有效组合记录为 alternatives。独立用重复支、双端补局和四组三合案例验证，结果稳定且没有遗漏替代组合。

阻断条件为旬空、月破、日破、日墓、化墓。这里的日墓只读取日柱十二长生“墓”，明确排除年、月、时柱；化墓是动变 transition 的 `changes-to-tomb`，两者不是同一来源。存在阻断时只输出 `has-three-harmony-candidate`，无阻断才输出 `forms-three-harmony`。

固定源还记有“一明一暗”可作两动的语义。候选对特殊初三/四六补局采用“两端均明动”的更窄产品 profile，而本卦三支齐全模式仍接受明动/暗动；这是可识别的保守限制，不是对古籍原句的扩大声称。

## 7. 六合、六冲与反吟伏吟

64 卦穷举确认：

- 六合 8 卦：地雷复、地天泰、雷地豫、水泽节、泽水困、山火贲、火山旅、天地否；
- 六冲 10 卦：坤为地、震为雷、雷天大壮、坎为水、兑为泽、艮为山、离为火、巽为风、天雷无妄、乾为天。

对 64 本卦 × 64 变卦共 4096 组合独立穷举，得到：

| 事实 | 数量 | 事实 | 数量 |
| --- | ---: | --- | ---: |
| base harmony | 512 | base clash | 640 |
| changed harmony | 504 | changed clash | 630 |
| inner fan | 128 | outer fan | 128 |
| any fan | 252 | both fan | 4 |
| inner fu | 128 | outer fu | 128 |
| any fu | 252 | both fu | 4 |

变卦侧事实要求相应侧至少有实际动爻。默认反吟为三组对应支全冲，默认伏吟为三组对应支全同，并按内外卦分别输出。另有乾↔巽、坎↔离、艮↔坤、震↔兑的方位反吟表，但它只存在于 `directional-trigram-fan-yin-v1`，且 `enabled=false`；候选没有把两套体系混用。

## 8. 本地语料绑定

候选声明的本地语料版本为 `2026.07.11-user-books-1`：

- `ZENGSHAN-BUYI` book SHA-256：`5a1bf59de04180d2f118ebe25abb84565b30aa731c986a83ace4898f5c0c04ae`
- `BUSHI-ZHENGZONG` book SHA-256：`e6ba468011293b3f4cd368a3f5c66c284334b1dcb96dd5530f9b749c84ba881b`

本轮逐条读取并重新计算了候选绑定的 16 个 entry payload：

| entry id | SHA-256 |
| --- | --- |
| `ZENGSHAN-BUYI-0047` | `13f51c0e23bd25d99ad0887fcfae4eeb4dbe423596438a6299edb5e337a524d7` |
| `ZENGSHAN-BUYI-0048` | `8093a8de4643f9d7baa0c6a29797686c88dbc96e29ef0b0cc87d2a174d6cf61b` |
| `ZENGSHAN-BUYI-0054` | `0f2009f48b1eb2cd1bbe5bcceda7c07c0d505dfbcfdcde0effd3ce4de244ab8e` |
| `ZENGSHAN-BUYI-0056` | `1d818e39a2f6d1510b87dfe8e0b0dcf87386c9676ab9faccc02db518dd6d332c` |
| `ZENGSHAN-BUYI-0057` | `8ca5e3329fe5ae98aed5703878e6c54ab6c1c7095881694aa5b6923ef01d51ce` |
| `ZENGSHAN-BUYI-0058` | `13ddbbf4040c7bd90c1ba93779b2c529353d02ca110dce5dea0ce50eb5dd9d64` |
| `ZENGSHAN-BUYI-0060` | `e8afac171243393b25858f37925fb3e686be259276022aeb2f98d079ee16b932` |
| `ZENGSHAN-BUYI-0062` | `34c393656661ebd31df4eb2d80e9e178896b6abdc2f734acada67f2cfe37eda8` |
| `ZENGSHAN-BUYI-0063` | `dad94225c5a75e4abba8e7acc26915c6a75dc370232b6f9fe409cf97ce41e286` |
| `ZENGSHAN-BUYI-0064` | `032e33e83153b4217aa75a552ebd1a8b92feff66d806096280baca0bb7f19732` |
| `ZENGSHAN-BUYI-0066` | `a8187ed5badeb248a90637acca7eef99370e933bb16a0c4213182c2130ca103a` |
| `ZENGSHAN-BUYI-0079` | `cd41af7f1ef51b05290badd128e7b656ae4baaed200f01f45a2af5bbd618809d` |
| `BUSHI-ZHENGZONG-0046` | `d863150cbda9a39ba1a2d5d24e5ec24b4792a6ba0f1b34c82f38b3af1790b86b` |
| `BUSHI-ZHENGZONG-0047` | `834fcfbc31881afd7aba78021a97a28d994db0e93f69d2eea01184dd425af8f4` |
| `BUSHI-ZHENGZONG-0095` | `c06f824c4b00d4bf1305922a0a95b2c988ac97e92ad2cf866822d59e88dae760` |
| `BUSHI-ZHENGZONG-0097` | `5ef89ee43992127c1c0813094de00bd965c9a33a40882018e279949ae205efb7` |

语义覆盖分别落在动变方向、四时旺相、六合/三合及阻断、六冲、日冲强弱、反吟、伏吟、旬空、十二长生、七对进退，以及《卜筮正宗》的旬空、月破、方位反吟、八对进退。当前工作树中没有可供再次计算“整本原始文件字节”的独立书籍文件，因此两个 book SHA-256 只能交叉核对候选与语料 manifest；上述 16 个实际绑定 entry 则已逐条独立复算。这一限制不影响本轮对候选所消费 payload 的一致性结论，但必须保留披露。

## 9. 运行时、测试与生产门

执行候选审计脚本后，artifact 哈希、10092 字节、三依赖、13 胶囊、16 本地条目、144 月令格、720 旬空格、七/八进退、五墓五绝、64 卦与 4096 组合全部通过。另以不复用候选审计脚本断言逻辑的独立 ESM 审计再次得到同样结果。

执行：

```text
node scripts/review-effects-candidate.mjs
cmd /c npx vitest run src/domain/liuyao/facts/calendar-effects.test.ts src/domain/liuyao/facts/moving-effects.test.ts src/domain/liuyao/facts/formations.test.ts --reporter=verbose
```

结果为 3 个测试文件、39 个测试全部通过。测试覆盖静态日冲白名单正反例、变爻不得自扶、完整 changed-to-base oracle、basis fact id、墓绝重叠、四组三合、重复成员与 alternatives、限定初三/四六模式、只认日墓、化墓阻断、64/4096 穷举及反伏内外卦。

生产约束保持不变：

- manifest：`status=unverified`；
- authority：`fixture-only`；
- reviews：`[]`；
- 生产规则入口不含 Task 5 候选关系；
- review fixture API 未从公共 barrel 导出；
- 当前生产门明确拒绝该规则包。

因此，本报告的 `matched` 只满足独立来源复审 A 的内容一致性要求；在另一份独立复审、manifest 晋级与项目规定的生产门步骤完成前，不得把该候选描述为已验证或已上线。
