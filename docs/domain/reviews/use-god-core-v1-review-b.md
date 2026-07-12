# use_god_core_v1 独立来源审阅 B

## 审阅记录

- reviewerId: `codex-corpus-matrix-use-god-b-bb24d3c9`
- reviewerKind: `automated-agent`
- independentRunId: `use-god-core-v1-b-bb24d3c9-0d28-497a-b54d-8b518689957e`
- reviewedAt: `2026-07-12T13:45:28.8202434+08:00`
- artifactHash: `22cd540d809875406c5c176e95abecbbf3287e3b64095f7bbf0f43e8e4414cfa`
- outcome: `matched`
- reportPath: `docs/domain/reviews/use-god-core-v1-review-b.md`
- humanReviewed: `false`
- independence: 本次为语料/矩阵优先的自动化代理独立审阅；未读取、未等待、未询问或接收审阅 A 的报告与判断。

### inputSourceRefs

1. `WS-ZENGSHAN-ROLE-PRIMER-2100295`
2. `WS-ZENGSHAN-USE-GOD-2100700`
3. `WS-ZENGSHAN-YUAN-JI-2100299`
4. `WS-ZENGSHAN-YUAN-JI-STRENGTH-2100301`
5. `WS-ZENGSHAN-ELEMENT-GENERATES-2100315`
6. `WS-ZENGSHAN-ELEMENT-CONTROLS-2100316`
7. `WS-ZENGSHAN-LATE-VOLUMES-2572918`
8. `CORPUS-ZENGSHAN-USE-GOD`
9. `CORPUS-BUSHI-USE-GOD`

### checkedClaims

1. `artifact-hash-and-four-bundle-dependencies`
2. `intent-category-subject-and-explicit-target-mapping`
3. `visible-changed-hidden-tiering-and-no-score`
4. `shi-ying-role-pair-and-clarification-states`
5. `five-by-five-flying-hidden-and-hidden-dispute`
6. `five-element-source-avoid-enemy-and-eligible-scope`
7. `local-corpus-and-fixed-oldid-bindings`
8. `profile-source-and-production-gates`

## 结论

总体结论为 `MATCHED`。候选 artifact 的 canonical hash、四项 bundle 依赖、九个来源胶囊、两本书绑定与二十七条语料文本、十七类问意、候选层级、世应/配对/澄清、飞伏 5×5、元忌仇五行矩阵、依赖事实边界及生产门均经独立复算或逐项核验，未发现来源、声明或运行实现差异。该结论只覆盖本报告列明的 artifact hash 与八项 checked claims。

## 独立核验路径

本次没有把候选 review script 的布尔结果作为结论。核验顺序为：先从 `resources/corpus.json` 与 `resources/corpus-manifest.json` 重算语料文本 SHA-256 并比对 artifact 绑定；再通过 agent-reach 的 Web/Jina Reader 路径独立打开 exact Wikisource oldid；最后编译领域模块，以不复用候选 review script 常量的 Node oracle 逐格检查问意、候选层级、飞伏、元忌仇和事实边界。审阅 A 从未被读取或等待。

## 分项复算

### 1. artifact、四项依赖与九个 evidence capsule：MATCHED

- canonical payload UTF-8 长度为 `16938` bytes。
- 独立 SHA-256、候选声明与期望值三者均为 `22cd540d809875406c5c176e95abecbbf3287e3b64095f7bbf0f43e8e4414cfa`。
- artifact 的四项 `dependsOn` 与各当前 bundle 导出逐项一致：

| dependency | SHA-256 |
|---|---|
| WenWang | `241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa` |
| relation | `60a7d9f9e9d607c83ddfe191347c1b9e5f30a47d1ee53a3e70fe29976aea8608` |
| growth/shensha | `e216e1d8a854972a1c5524bc8f73162e6eb2754144fd971152b795e24318f129` |
| effects | `208ff324b2bc1a9dbdf45a848927d8bf6f0495152ab0ba6c45e477a7c5e742d6` |

九个 evidence capsule 的 payload 均重新计算 SHA-256，且与各自 `contentHash` 相同：

| inputSourceRef | SHA-256 |
|---|---|
| `WS-ZENGSHAN-ROLE-PRIMER-2100295` | `c5a7d586a9e11415096e9414855572b947920bf070bd123512dba25f56b9c784` |
| `WS-ZENGSHAN-USE-GOD-2100700` | `8e6fcecd2287199231996f6df3c87f5ec818d800a43d1da6632040bc2d7af12e` |
| `WS-ZENGSHAN-YUAN-JI-2100299` | `291732fe0eeebe2180fc1bc8b8117c24f2690ec463271ba048311ef56175f9c6` |
| `WS-ZENGSHAN-YUAN-JI-STRENGTH-2100301` | `fa64600d91112c25a8568877a0dab70e82f806d89777f9b5b806268b7dacd28c` |
| `WS-ZENGSHAN-ELEMENT-GENERATES-2100315` | `cf17b667044cb3f8106dd3c6426966ba515cb6c9fc778d4a55137fe8c3fc11a7` |
| `WS-ZENGSHAN-ELEMENT-CONTROLS-2100316` | `7282583ca59be6ffb681ccf8a69cdef2bbc905b07e907fa0951dc0170445e689` |
| `WS-ZENGSHAN-LATE-VOLUMES-2572918` | `5420c497903a34c82cb722a7a9ca9a19d6ba8b9a37192b5b56e70a3446a0c2eb` |
| `CORPUS-ZENGSHAN-USE-GOD` | `4a0c3e9a6a607a3977e6151c3906a92210db20555525b81a0af44c9d0c6d1aa2` |
| `CORPUS-BUSHI-USE-GOD` | `c4514ff716f424e702429788590aa99d1bd9055361caf73c52f086261e0e5796` |

### 2. 十七类问意、关系与显式目标：MATCHED

独立 oracle 共检查 `17` 个显式 intent。官职/考试取官鬼并关联父母，文书/合同取父母，财物/项目收益取妻财，女方取妻财、男方取官鬼，自身健康与自身出行取本卦世爻，关系动态取本卦世应 pair；他人健康/行人按父母、兄弟、子孙、妻财、官鬼五类关系取用，`distant-other` 固定映射本卦应爻；`other.explicit` 只接受明确的六亲、角色、世应 pair 或当前盘实体。所有 target selector、category 与 related relations 均逐项匹配，序列化结果没有 `score` 或“学业功名”伪六亲。

### 3. 三层候选、无评分与静态变爻排除：MATCHED

- 层级固定为本卦可见爻 `tier 0`、真实动爻之变爻 `tier 1`、宫首潜在伏神 `tier 2`，命中首个非空层即停止。
- 同层多候选保留为 `ambiguous`，`primary = null`，没有自动旺衰排序，也没有 `score`/`candidateScore`。
- 独立 plate 覆盖了本卦优先、真实化爻次之、伏神最后、同层两候选，以及“静爻的 changed facet 与目标六亲相同仍不得进入 tier 1”。
- 伏神仅在前两层均为空时进入，certainty 为 `disputed`，conditions 为 `visible-and-true-changed-tiers-empty` 与 `hidden-use-disputed`。

### 4. 世应角色、pair 与澄清状态：MATCHED

- 角色选择只读本卦世应；即使变卦世应位置改变，自身仍取本卦世爻，疏远他人仍取本卦应爻。
- 关系动态输出 `selectionMode = shi-ying-pair`，包含本卦世、应两个 focus entity，`primary = null` 且 `candidates = []`。
- career、relationship、health、study、lost_item、travel 六类多问意类别在 intent 缺失时返回 typed clarification；health/travel 的他人占在关系缺失时返回 subject clarification；other 在目标缺失时返回 explicit-target clarification；wealth 唯一问意可确定性补全。

### 5. 飞伏 5×5 与伏神争议继承：MATCHED

行是飞神、列是伏神，元素次序均为 `木火土金水`。二十五格独立 oracle 如下：

| 飞\\伏 | 木 | 火 | 土 | 金 | 水 |
|---|---|---|---|---|---|
| 木 | 同行 | 飞生伏 | 飞克伏 | 伏克飞 | 伏生飞 |
| 火 | 伏生飞 | 同行 | 飞生伏 | 飞克伏 | 伏克飞 |
| 土 | 伏克飞 | 伏生飞 | 同行 | 飞生伏 | 飞克伏 |
| 金 | 飞克伏 | 伏克飞 | 伏生飞 | 同行 | 飞生伏 |
| 水 | 飞生伏 | 飞克伏 | 伏克飞 | 伏生飞 | 同行 |

五种关系各出现 `5` 格，方向与 `reverse` 标记逐格一致。每个有效 plate 固定生成一条 `holds-shi`、一条 `holds-ying`，并为每个潜在伏神恰好生成一条飞伏关系事实。伏神 primary 派生的元忌仇事实全部继承 `disputed` 与 `selected-hidden-primary-disputed`。

### 6. 元神、忌神、仇神与 eligible scope：MATCHED

| 用神五行 | 元神 | 忌神 | 仇神 |
|---|---|---|---|
| 木 | 水 | 金 | 土 |
| 火 | 木 | 水 | 金 |
| 土 | 火 | 木 | 水 |
| 金 | 土 | 火 | 木 |
| 水 | 金 | 土 | 火 |

独立事实 oracle 只允许本卦六爻、真实化爻、月、日，以及规则声明中的已选伏神范围；事实均指向 canonical single primary。专门构造“土为用神、火为元神”的 plate 后，年柱、时柱、静态变爻和未选伏神都实际为火，但四者均没有产生元神事实，证明排除不是偶然由五行不匹配造成。`needs-user-input`、`ambiguous` 与 `shi-ying-pair` 三种无单一 primary 状态均返回零条依赖事实。

### 7. 本地 corpus 与 exact oldid：MATCHED

corpus version 在 manifest、artifact 与审阅期望中均为 `2026.07.11-user-books-1`。两本书 hash 与 `corpus-manifest.json`、artifact 绑定相同：

| sourceId | SHA-256 |
|---|---|
| `ZENGSHAN-BUYI` | `5a1bf59de04180d2f118ebe25abb84565b30aa731c986a83ace4898f5c0c04ae` |
| `BUSHI-ZHENGZONG` | `e6ba468011293b3f4cd368a3f5c66c284334b1dcb96dd5530f9b749c84ba881b` |

artifact 绑定的 `13` 条《增删卜易》和 `14` 条《卜筮正宗》条目全部存在；对 `resources/corpus.json` 中每条 `text` 独立计算 UTF-8 SHA-256，`27/27` 与 artifact 条目 hash 相同。条目内容覆盖五类六亲、考试父官并看、世应自他、真实化爻优先、飞伏四向、伏神采用/再占分歧、两现反例、元忌仇、出行取世与行人按关系取用。

通过 exact oldid 独立打开的结果如下：

| oldid | 固定页面 | 独立核验重点 |
|---:|---|---|
| `2100295` | `/3`《八卦各宫全图》 | 世应、六亲及自占先看世爻；不是用神章 |
| `2100700` | `/8`《用神章第八》 | 父母、官鬼、兄弟、妻财、子孙分类；不是八宫图 |
| `2100299` | `/9`《用神元神忌神仇神章第九》 | 元神生用、忌神克用、仇神克元生忌 |
| `2100301` | `/10`《元神忌神衰旺章第十》 | 元忌结合日月、动变、空破墓绝 |
| `2100315` | `/11`《五行相生章第十一》 | 木火土金水相生闭环 |
| `2100316` | `/12`《五行相克章第十二》 | 木土水火金相克闭环 |
| `2572918` | 《增删卜易》固定整书 | 飞伏神、两现、出行、行人及代占疾病段落 |

因此 `2100295` 与 `2100700` 的绑定明确没有倒置。分章 Wikisource 页面是固定旧版本，部分页面标有较低校对质量；本地 OCR 与 exact oldid 被用作相互校验，而非把单一来源提升为无争议现代校本。

### 8. profile、来源注册与生产门：MATCHED

- 默认 `useGodProfile` 精确绑定 `explicit_intent_first_v1`、当前 artifact hash、三层候选、同层保留全部与 `yehe-last-resort-disputed-v1`。
- manifest 在本次审阅期间保持 `verificationLevel = unverified`、`runtimeStatus = fixture-only`、`reviews = []`，本报告没有修改 manifest。
- 生产 `resolveUseGod` 和 bundle gate 均实际拒绝调用，错误为 `用神规则包未通过项目运行门`。
- `ForReviewFixture` 不存在于源码主 barrel 或编译后 barrel 的任何导出；fixture 只能经内部直接模块路径使用。

## 验证命令与结果

- `npm run build:domain`：通过。
- 两个独立 stdin Node oracle：十七 intent/层级/角色/澄清全部匹配；飞伏 `25/25`、元忌仇 `5/5`、事实 scope 与四类排除全部匹配。
- corpus 独立 hash oracle：两本书绑定 `2/2`、条目文本 `27/27`、artifact 条目绑定 `27/27` 匹配。
- `npx vitest run src/domain/liuyao/use-god.test.ts src/domain/liuyao/facts/use-god-effects.test.ts`：`2` files、`44` tests 全部通过。

## 最终判定

`MATCHED`。当前 artifact `22cd540d809875406c5c176e95abecbbf3287e3b64095f7bbf0f43e8e4414cfa` 在本报告八项 checked claims 范围内通过独立来源与运行复审。该结论不绕过双审 manifest 门；生产状态仍须由后续 manifest 记录完整、相互独立的审阅结果后另行决定。

