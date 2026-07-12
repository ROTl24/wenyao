# `growth_shensha_core_v1` 独立来源审阅 A

> 本报告由自动化代理独立生成，属于**非人工审阅**，不得表述为人工复核、专家背书或传统术数共识。

## 审阅记录

```yaml
reviewerId: codex-wikisource-growth-shensha-a
reviewerKind: automated-agent
independentRunId: growth-shensha-a-20260712-104749-9091214
reviewedAt: 2026-07-12T10:47:49.9091214+08:00
artifactHash: e216e1d8a854972a1c5524bc8f73162e6eb2754144fd971152b795e24318f129
outcome: matched
reportPath: docs/domain/reviews/growth-shensha-core-v1-review-a.md
inputSourceRefs:
  - WS-ZENGSHAN-GROWTH-2100461
  - WS-ZENGSHAN-SIX-SPIRIT-2101727
  - WS-ZENGSHAN-SHEN-SHA-2572918
  - CORPUS-YIMAO-VARIANTS
  - CORPUS-YIYIN-VARIANTS
checkedClaims:
  - artifact-hash-and-wenwang-dependency
  - five-by-twelve-growth-matrix-and-earth-dispute
  - ten-by-six-six-spirit-matrix-and-aliases
  - four-shen-sha-default-tables-and-disabled-variants
  - fact-count-scope-authority-and-certainty
  - local-corpus-and-fixed-oldid-bindings
  - profile-source-and-production-gates
```

独立性声明：本次运行从候选 artifact、固定来源和本地语料重新取证、复算，没有读取其他审阅者的结论。结论只适用于上述 artifactHash；任何 canonical payload、来源 capsule、依赖 hash 或 profile 变化都必须重新审阅。

## 结论

**MATCHED。** 未发现会使核心表、事实边界或运行门不可靠的差异。canonical payload 的 SHA-256、UTF-8 字节数、文王结构依赖、5 个 evidence capsule、本地语料绑定、独立查表 oracle、事实输出边界和 Phase A 门禁均与候选声明一致。`YIMAO-0017` 明载“腾蛇”，候选已将 `腾蛇→螣蛇` 纳入可追溯 alias，土长生分歧及天乙、天喜替代表也没有被伪装成默认共识，而是以禁用且 `disputed` 的 variant 保存。

## 1. artifact hash 与结构依赖

- 对 `GROWTH_SHENSHA_CORE_V1_CANONICAL_PAYLOAD` 重新执行 UTF-8 SHA-256，得到 `e216e1d8a854972a1c5524bc8f73162e6eb2754144fd971152b795e24318f129`，与声明值相同。
- canonical payload 为 `7050` UTF-8 bytes。
- artifact 的 `dependsOnWenwangArtifactHash` 为 `241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa`，与 Task 3 的 `WENWANG_NAJIA_V2_ARTIFACT_HASH` 相同。
- inventory 为 `5` 个 evidence capsules、`3` 本本地书、`10` 个本地条目绑定；5 个 capsule payload 的声明 SHA-256 与复算值逐一相同。

## 2. 固定 Wikisource 修订取证

本次通过 Wikisource MediaWiki API 按 `revids` 实际打开并读取了三个固定修订，而不是读取当前页或搜索摘要：

| sourceRef | 固定页与修订元数据 | 核对结果 |
|---|---|---|
| `WS-ZENGSHAN-GROWTH-2100461` | [《增刪卜易/26又1》oldid 2100461](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/26%E5%8F%881&oldid=2100461)；`revid=2100461`，`2022-01-20T19:31:02Z` | 原文列出十二阶段次序、金木水土的生旺墓绝，明确“土水长生在申，旺在子，墓在辰，绝在巳”，并记录土生申/土生寅分歧；与默认土从水及 disputed 标记相符。 |
| `WS-ZENGSHAN-SIX-SPIRIT-2101727` | [《增刪卜易/18》oldid 2101727](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/18&oldid=2101727)；`revid=2101727`，`2022-01-30T02:29:09Z` | 原文六列完整覆盖甲乙、丙丁、戊、己、庚辛、壬癸日，从初爻到上爻的六神次序与候选 10×6 矩阵相同；原文异体为“靑龍、滕蛇、元武”。 |
| `WS-ZENGSHAN-SHEN-SHA-2572918` | [《增刪卜易》oldid 2572918](https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93&oldid=2572918)；`revid=2572918`，`2025-06-25T11:25:59Z` | 星煞章逐项给出太乙贵人、禄神、驿马和“春戌夏丑秋辰冬未”；同时明确星煞不能独操祸福、需从属于用神旺衰，与 auxiliary/secondary/conditional 边界相符。 |

三个 `RuleSourceRef.contentHash` 哈希的是代码中保存的 normalized evidence capsule payload，并非远程网页原始字节；本次分别验证了“capsule payload hash 一致”和“固定 oldid 原文支持 normalized claim”，没有把二者混称为同一种哈希。

## 3. 五行 × 十二支长生矩阵与土分歧

支序为 `子丑寅卯辰巳午未申酉戌亥`。逐格复算结果如下，五行每行都恰好覆盖十二阶段一次：

| 五行 | 按固定支序的十二阶段 |
|---|---|
| 木 | 沐浴、冠带、临官、帝旺、衰、病、死、墓、绝、胎、养、长生 |
| 火 | 胎、养、长生、沐浴、冠带、临官、帝旺、衰、病、死、墓、绝 |
| 土 | 帝旺、衰、病、死、墓、绝、胎、养、长生、沐浴、冠带、临官 |
| 金 | 死、墓、绝、胎、养、长生、沐浴、冠带、临官、帝旺、衰、病 |
| 水 | 帝旺、衰、病、死、墓、绝、胎、养、长生、沐浴、冠带、临官 |

- 5×12 共 60 格全部匹配独立 oracle。
- 默认 profile 采用五行统一顺排、土从水、土长生于申。土行全部保持 `authority=profile-dependent`、`certainty=disputed`；木火金水为 `profile-dependent + computed`。
- “土长生于寅”和十干阴阳顺逆模型均完整保存在禁用 variant，没有混入默认五行矩阵。
- 原文只主张实际取用生/旺/墓/绝；候选仍展示全部十二阶段，但仅长生、帝旺、墓、绝为 `interpretationWeight=primary`，其余为 `display-only`，没有扩大原文权重。

## 4. 十日干 × 六爻六神矩阵与异体

规范序列为 `青龙→朱雀→勾陈→螣蛇→白虎→玄武`，从初爻排到上爻。逐格复算 10×6 全部匹配：

- 甲、乙：青龙起；
- 丙、丁：朱雀起；
- 戊：勾陈起；
- 己：螣蛇起；
- 庚、辛：白虎起；
- 壬、癸：玄武起。

异体归一核对为 `青龙/靑龍→青龙`、`螣蛇/滕蛇/腾蛇→螣蛇`、`玄武/元武→玄武`。其中固定 Wikisource 修订支持“滕蛇”，本地 `YIMAO-0017` 原文反复使用“腾蛇”；artifact 的 `aliasSourceRefs` 同时绑定 `WS-ZENGSHAN-SIX-SPIRIT-2101727` 与 `CORPUS-YIMAO-VARIANTS`。本卦六行固定生成 6 条 `is-six-beast`，变卦同行只复用显示，不重复造事实；其元数据逐条为 `scope=auxiliary`、`authority=secondary`、`certainty=computed`。

## 5. 四项默认神煞与禁用 variants

默认表逐格核对通过：

- 天乙（原文题名“太乙贵人”）：甲戊丑未、乙己子申、丙丁亥酉、庚辛午寅、壬癸卯巳，共 10 干各 2 支。
- 禄神：甲寅、乙卯、丙巳、丁午、戊巳、己午、庚申、辛酉、壬亥、癸子，共 10 干各 1 支。
- 驿马：子辰申见寅、丑巳酉见亥、寅午戌见申、卯未亥见巳，共 12 日支。
- 天喜：寅卯辰见戌、巳午未见丑、申酉戌见辰、亥子丑见未，共 12 个节令月支。

禁用表逐项核对为：

- 常见天乙表把庚并入“甲戊庚丑未”，绑定 `CORPUS-YIYIN-VARIANTS`，`enabled=false`、`disputed`。
- 逐月递进天喜表绑定《易冒》《易隐》，`enabled=false`、`disputed`。
- 年支天喜表绑定《易隐》，`enabled=false`、`disputed`。

默认只运行上述四项，只匹配本卦明爻；不对变卦、化爻、伏神生成神煞。所有命中均为 `scope=auxiliary`、`authority=secondary`、`certainty=conditional`，并保留“不可覆盖用神与旺衰”的条件。

## 6. 本地 corpus 绑定

corpus version 为 `2026.07.11-user-books-1`。artifact 中 3 本书的 SHA-256 与 `resources/corpus-manifest.json` 对应 source 逐项一致：

| sourceId | book SHA-256 | 结果 |
|---|---|---|
| `ZENGSHAN-BUYI` | `5a1bf59de04180d2f118ebe25abb84565b30aa731c986a83ace4898f5c0c04ae` | 绑定一致 |
| `YIMAO` | `ab7eb41549cc30b4de2bc1c81757a2f0fdcec8823592e3b05f29417591982642` | 绑定一致 |
| `YIYIN` | `4595d55959dc61e9db879a60214ce2b4ceabb3a8eaab13c179aabdcdd68deab2` | 绑定一致 |

候选复算枚举的 10 个条目绑定全部匹配。按照本次 A 的来源分工，对 variants 实际使用的《易冒》《易隐》6 个条目又从 `resources/corpus.json` 取出文本并独立执行 UTF-8 SHA-256：

| entry | computed text SHA-256 | 结果 |
|---|---|---|
| `YIMAO-0017` | `3d37da2768559b3984ea0d0b1cd49015e43c42311dc8803780266c3db8521042` | matched |
| `YIMAO-0059` | `e4f71865040e4abae52a2f2ae7259984bee0f1b7c479706b84cb97d6eb922f82` | matched |
| `YIMAO-0074` | `edfeacca55caaa43fecb87c1dc60427e2287216be7cbb7a4154810ac83276d4e` | matched |
| `YIYIN-0047` | `382b1a6757bb79e5265cacbde92e67d6d3ff592c38e3195a97ded92b53a7e0ef` | matched |
| `YIYIN-0050` | `ac2cd273a56bb0a164b58a77d904d6b8419a6a0670bbbf4853de9296741c488e` | matched |
| `YIYIN-0061` | `9e44a176ad0f1cac1c14b42461c5672d19ceed1559aeb7b359fb41afdc498f60` | matched |

这些本地材料只支撑异体或禁用分歧 variant，不被提升为默认共识来源。

## 7. 事实边界、元数据与门禁

固定复算盘 `tossValues=[9,8,7,6,7,8]` 有 2 个动爻，结果为：

- 十二长生 50 条：本卦/变卦 12 行 × 年月日时 4 柱固定 48 条 `scope=calendar`，另有 2 条真实动爻 `scope=transition`。
- 六神固定 6 条，只指向本卦六行。
- 该盘神煞命中 3 条，ID 顺序为 `tianyi、yima、tianxi`；全部只指向本卦明爻。该固定盘未命中禄神，但禄神 10 干表已通过穷举 oracle。
- 所有 fact ID 唯一；deep clone 和爻数组换序后 ID 与排序保持稳定。
- 长生、六神、神煞三类元数据分别符合本报告前述 scope/authority/certainty 契约。
- 3 个 profile 均绑定同一个 bundle/version/hash；伪造任一 profile 或其来源会被评审夹具拒绝。
- Plate gate 仅消费结构与历法依赖，并核对 `wenwang_najia_v2@2.0.0` 及其 hash；本 bundle 自己另行核对 profile 与来源子集。
- Phase A manifest 实测仍为 `verificationLevel=unverified`、`runtimeStatus=fixture-only`、`reviews=[]`。生产 `deriveGrowthShenShaFacts` 关闭并抛出 `长生神煞规则包未通过项目运行门`。

验证命令结果：

- `npm run build:domain`：通过。
- `node scripts/review-growth-shensha-candidate.mjs`：退出码 0，全部 oracle/hash/boundary/gate 为 matched/true。
- `npm run test:unit -- src/domain/liuyao/facts/growth-shensha.test.ts --reporter=verbose`：1 个测试文件、37 项全部通过。

## 8. 差异与限制清单

1. **字符规范化差异**：固定六神修订使用“靑龍、滕蛇、元武”，本地 `YIMAO-0017` 使用“青龙、腾蛇、元武”，artifact 使用“青龙、螣蛇、玄武”；显式 alias 表完整保留 `靑龍/滕蛇/腾蛇/元武` 的可追溯转换，因此不构成规则差异。
2. **名称差异**：固定星煞修订题名为“太乙贵人”，代码 ID 为 `tianyi`、显示概念为天乙；表值按原文逐干一致，不构成取值差异。
3. **全矩阵的推导边界**：固定长生修订直接给出十二阶段次序及主要落点，不逐字列出 60 格；非主要格由阶段次序和长生锚点确定性展开，标为 `computed`，土行因原文自载分歧而标为 `disputed`。
4. **解释权重差异**：原文说只验生旺墓绝；artifact 为完整展示输出十二阶段，但只给长生、帝旺、墓、绝 primary 权重，其余 display-only。该实现保留了原文边界。
5. **季节到月支的展开**：原文为“春戌夏丑秋辰冬未”，artifact 将每季确定性展开到三个月支；未混用逐月递进表或年支表。
6. **本地原书字节限制**：工作树只含 corpus 产物与 manifest，不含《易冒》《易隐》原始 GB18030 书文件，因此全书 SHA-256 只能核对 artifact 与 manifest 的固定绑定，不能在本次运行重新哈希原始书文件；6 个 variants 条目文本已从本地 corpus 独立重算并全部匹配。
7. **固定夹具覆盖限制**：固定盘没有禄神命中；禄神仍通过 10 日干全表穷举验证，故不影响表可靠性结论。
8. **来源质量与审阅性质**：两个分章 Wikisource 修订页面标注 `Textquality=50%`，且本报告为自动、非人工审阅；这限制了“人工校勘”层面的主张，但不影响本次对固定修订、候选 capsule、本地 variant 和运行契约的一致性判断。
9. **命令说明**：一次将目标 TypeScript 测试路径误传给包含 Electron `node --test` 的总测试命令，因源文件 `.js` 解析路径而失败；该调用不是有效的目标测试方式，已改用上方正确的 Vitest 命令并取得 37/37 通过，不计为 artifact 缺陷。

综上，现有差异均已被 artifact 以 alias、certainty、disabled variant、display-only 或门禁显式表达，没有发现未披露的默认表漂移或越权事实输出，因此本独立自动审阅 A 的 outcome 为 `matched`。
