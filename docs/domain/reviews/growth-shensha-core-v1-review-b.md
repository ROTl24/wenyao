# growth_shensha_core_v1 独立来源审阅 B

## 审阅记录

- reviewerId: `codex-corpus-growth-shensha-b`
- reviewerKind: `automated-agent`
- independentRunId: `growth-shensha-core-v1-b-2c89ce7f-8a84-4960-a5e0-71353952a59a`
- reviewedAt: `2026-07-12T10:50:40.9970624+08:00`
- artifactHash: `e216e1d8a854972a1c5524bc8f73162e6eb2754144fd971152b795e24318f129`
- outcome: `matched`
- reportPath: `docs/domain/reviews/growth-shensha-core-v1-review-b.md`
- humanReviewed: `false`
- independence: 本次为自动化代理独立审阅；未读取审阅 A，未询问或接收审阅 A 的判断。

### inputSourceRefs

1. `WS-ZENGSHAN-GROWTH-2100461`
2. `WS-ZENGSHAN-SIX-SPIRIT-2101727`
3. `WS-ZENGSHAN-SHEN-SHA-2572918`
4. `CORPUS-YIMAO-VARIANTS`
5. `CORPUS-YIYIN-VARIANTS`

### checkedClaims

1. `artifact-hash-and-wenwang-dependency`
2. `five-by-twelve-growth-matrix-and-earth-dispute`
3. `ten-by-six-six-spirit-matrix-and-aliases`
4. `four-shen-sha-default-tables-and-disabled-variants`
5. `fact-count-scope-authority-and-certainty`
6. `local-corpus-and-fixed-oldid-bindings`
7. `profile-source-and-production-gates`

## 结论

总体结论为 `MATCHED`。候选 artifact 的 canonical hash、Task 3 依赖、五行十二长生矩阵、十干六神排布及完整别名、四神煞默认表与禁用变体、事实边界和运行门均能独立复算或回溯到绑定来源。上一轮阻断项 `腾蛇 -> 螣蛇` 已真实进入 canonical payload、编译后运行时 artifact 和独立 oracle；本轮没有发现新的来源差异或实现差异。该结论只认可当前 hash，不能外推到后续 artifact。

## 独立核验路径

本次先以本地 `resources/corpus.json` 与 `resources/corpus-manifest.json` 核对 `ZENGSHAN-BUYI`、`YIMAO`、`YIYIN` 三书全书 hash 及十条绑定条目，再独立打开三个 exact Wikisource oldid 交叉。候选 review script 仅作为待审对象运行；hash、矩阵、来源文本和别名覆盖另行复算，没有把脚本的布尔结果直接当作结论。

### 本地三书全书 hash

| sourceId | 复算 SHA-256 | manifest | 结果 |
|---|---|---|---|
| `ZENGSHAN-BUYI` | `5a1bf59de04180d2f118ebe25abb84565b30aa731c986a83ace4898f5c0c04ae` | 同值 | MATCHED |
| `YIMAO` | `ab7eb41549cc30b4de2bc1c81757a2f0fdcec8823592e3b05f29417591982642` | 同值 | MATCHED |
| `YIYIN` | `4595d55959dc61e9db879a60214ce2b4ceabb3a8eaab13c179aabdcdd68deab2` | 同值 | MATCHED |

### 本地十条绑定文本 hash

| corpus entry | 复算 SHA-256 | 结果 | 用于核验 |
|---|---|---|---|
| `ZENGSHAN-BUYI-0053` | `1e42a6bf57e0ddeb1f93e4afa25e5983bdb5009b1c69c1e32c2af2b6652c9434` | MATCHED | 六神起例及 `元武`、`滕蛇` |
| `ZENGSHAN-BUYI-0066` | `a8187ed5badeb248a90637acca7eef99370e933bb16a0c4213182c2130ca103a` | MATCHED | 十二长生次序与五行起点 |
| `ZENGSHAN-BUYI-0067` | `133a03a5abcfd08bc5318b7fe4fb285d59f08100cfe5341bf7612f201f8cda04` | MATCHED | 土随水起申、土起寅争议及主用阶段 |
| `ZENGSHAN-BUYI-0094` | `ed36de4a2b532c3669d34ffa6a60de506fd5331b69a0057a1e4a7b31862f5fea` | MATCHED | 天乙、禄神、驿马、天喜四神煞 |
| `YIMAO-0017` | `3d37da2768559b3984ea0d0b1cd49015e43c42311dc8803780266c3db8521042` | MATCHED | 六神起例及 `元武`、`腾蛇` |
| `YIMAO-0059` | `e4f71865040e4abae52a2f2ae7259984bee0f1b7c479706b84cb97d6eb922f82` | MATCHED | 土生申、戊生寅、己生酉与十干分寄争议 |
| `YIMAO-0074` | `edfeacca55caaa43fecb87c1dc60427e2287216be7cbb7a4154810ac83276d4e` | MATCHED | 逐月天喜及四季天喜并列 |
| `YIYIN-0047` | `382b1a6757bb79e5265cacbde92e67d6d3ff592c38e3195a97ded92b53a7e0ef` | MATCHED | 年支天喜变体 |
| `YIYIN-0050` | `ac2cd273a56bb0a164b58a77d904d6b8419a6a0670bbbf4853de9296741c488e` | MATCHED | 月支天喜变体 |
| `YIYIN-0061` | `9e44a176ad0f1cac1c14b42461c5672d19ceed1559aeb7b359fb41afdc498f60` | MATCHED | 常见天乙贵人变体 |

### exact Wikisource oldid 交叉

| inputSourceRef | exact oldid | 独立核验结果 | 来源限制 |
|---|---:|---|---|
| `WS-ZENGSHAN-GROWTH-2100461` | `2100461` | 支持十二阶段顺序、金巳木亥水土申火寅、土申与土寅争议，以及长生/帝旺/墓/绝的主用边界 | 页面为固定旧版本；文本质量标记为 50% |
| `WS-ZENGSHAN-SIX-SPIRIT-2101727` | `2101727` | 支持甲乙青龙、丙丁朱雀、戊勾陈、己螣蛇、庚辛白虎、壬癸玄武的起例，并出现 `靑龍`、`滕蛇`、`元武` | 页面为固定旧版本；文本质量标记为 50% |
| `WS-ZENGSHAN-SHEN-SHA-2572918` | `2572918` | 支持候选采用的天乙、禄神、驿马与四季天喜四张默认表，并明确神煞仅作辅助 | 固定旧版本纠正了本地条目中的 `乙巳/丙戌/秋畏` OCR，原文对应 `乙己/丙戊/秋辰` |

## 分项复算

### 1. artifact hash 与 WenWang 依赖：MATCHED

- 以候选 canonical serializer 独立重算，UTF-8 canonical payload 为 `7050` bytes。
- declared/computed artifact SHA-256 均为 `e216e1d8a854972a1c5524bc8f73162e6eb2754144fd971152b795e24318f129`。
- 候选声明的 WenWang Task 3 依赖 hash 与当前规则包一致，均为 `241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa`。
- 五个 evidence capsule 的 payload hash 逐一复算一致：

| inputSourceRef | SHA-256 |
|---|---|
| `WS-ZENGSHAN-GROWTH-2100461` | `e1fc94c03775c1f6be3c61869e184e9d653c99fbf12f9f2762293f86fd0d37da` |
| `WS-ZENGSHAN-SIX-SPIRIT-2101727` | `bd01e879479702de5b4c9f32c333135bfa1b42b4077fc9da29f2a712c9101deb` |
| `WS-ZENGSHAN-SHEN-SHA-2572918` | `77871a1861cfc355218ec276adec0a3c4562ef1241a993311e18db075e1550c4` |
| `CORPUS-YIMAO-VARIANTS` | `ac5ad0142b2026f192ed559f70d2a85a93e6bf9d44a415d3ef0d6806005805aa` |
| `CORPUS-YIYIN-VARIANTS` | `2613cce3548683b1f6473632dfb965eeb45bd29935c4e1cc1a5c214b31fed8e8` |

### 2. 五行 × 十二支长生矩阵及土行争议：MATCHED

列顺序为 `子丑寅卯辰巳午未申酉戌亥`，逐格复算结果如下：

| 五行 | 子 | 丑 | 寅 | 卯 | 辰 | 巳 | 午 | 未 | 申 | 酉 | 戌 | 亥 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 木 | 沐浴 | 冠带 | 临官 | 帝旺 | 衰 | 病 | 死 | 墓 | 绝 | 胎 | 养 | 长生 |
| 火 | 胎 | 养 | 长生 | 沐浴 | 冠带 | 临官 | 帝旺 | 衰 | 病 | 死 | 墓 | 绝 |
| 土 | 帝旺 | 衰 | 病 | 死 | 墓 | 绝 | 胎 | 养 | 长生 | 沐浴 | 冠带 | 临官 |
| 金 | 死 | 墓 | 绝 | 胎 | 养 | 长生 | 沐浴 | 冠带 | 临官 | 帝旺 | 衰 | 病 |
| 水 | 帝旺 | 衰 | 病 | 死 | 墓 | 绝 | 胎 | 养 | 长生 | 沐浴 | 冠带 | 临官 |

默认 `earthStartsAtShen` 开启且土随水；`earthStartsAtYin` 保留为关闭且土随火；十干阴逆模型保持关闭，不与五行顺排矩阵混表。土行 certainty 为 `disputed`，其余四行是 `computed`；主要解释阶段限定为长生、帝旺、墓、绝。候选处理与两组绑定来源一致。

### 3. 十干 × 六爻六神矩阵及别名：MATCHED

初爻至上爻的 10 × 6 排布逐格复算一致：

| 日干 | 初爻 | 二爻 | 三爻 | 四爻 | 五爻 | 上爻 |
|---|---|---|---|---|---|---|
| 甲 | 青龙 | 朱雀 | 勾陈 | 螣蛇 | 白虎 | 玄武 |
| 乙 | 青龙 | 朱雀 | 勾陈 | 螣蛇 | 白虎 | 玄武 |
| 丙 | 朱雀 | 勾陈 | 螣蛇 | 白虎 | 玄武 | 青龙 |
| 丁 | 朱雀 | 勾陈 | 螣蛇 | 白虎 | 玄武 | 青龙 |
| 戊 | 勾陈 | 螣蛇 | 白虎 | 玄武 | 青龙 | 朱雀 |
| 己 | 螣蛇 | 白虎 | 玄武 | 青龙 | 朱雀 | 勾陈 |
| 庚 | 白虎 | 玄武 | 青龙 | 朱雀 | 勾陈 | 螣蛇 |
| 辛 | 白虎 | 玄武 | 青龙 | 朱雀 | 勾陈 | 螣蛇 |
| 壬 | 玄武 | 青龙 | 朱雀 | 勾陈 | 螣蛇 | 白虎 |
| 癸 | 玄武 | 青龙 | 朱雀 | 勾陈 | 螣蛇 | 白虎 |

别名覆盖也逐项匹配：

- `YIMAO-0017` 的绑定原文使用 `腾蛇`；`CORPUS-YIMAO-VARIANTS` 的 normalized claim 明确写为“六神异体元武与腾蛇”。
- 当前 `sixSpirit.aliases` 完整包含 `青龙/靑龍 -> 青龙`、`螣蛇/滕蛇/腾蛇 -> 螣蛇`、`玄武/元武 -> 玄武`。
- 对编译后的运行时模块取值，`GROWTH_SHENSHA_CORE_V1_ARTIFACT.sixSpirit.aliases['腾蛇']` 实际返回 `螣蛇`；canonical payload 也实际包含 `"腾蛇":"螣蛇"`，并非只修改说明文档。
- 候选 review script 的别名输入集合与期望对象都已纳入 `腾蛇`。另行构造、不复用该脚本常量的独立 oracle 对七个词形逐项比较，全部通过。

### 4. 四神煞默认表与关闭变体：MATCHED

- 天乙默认：`甲戊 -> 丑未`，`乙己 -> 子申`，`丙丁 -> 亥酉`，`庚辛 -> 午寅`，`壬癸 -> 卯巳`。
- 禄神默认：`甲寅、乙卯、丙巳、丁午、戊巳、己午、庚申、辛酉、壬亥、癸子`。
- 驿马默认：`申子辰 -> 寅`，`巳酉丑 -> 亥`，`寅午戌 -> 申`，`亥卯未 -> 巳`。
- 天喜默认：`寅卯辰 -> 戌`，`巳午未 -> 丑`，`申酉戌 -> 辰`，`亥子丑 -> 未`。
- 常见天乙变体保持关闭：`甲戊庚 -> 丑未`、`乙己 -> 子申`、`丙丁 -> 亥酉`、`辛 -> 午寅`、`壬癸 -> 巳卯`。
- 逐月天喜变体保持关闭：正月至十二月为 `戌亥子丑寅卯辰巳午未申酉`。
- 年支天喜变体保持关闭：子至亥为 `酉申未午巳辰卯寅丑子亥戌`。

默认表和三个关闭变体都与各自绑定来源逐项一致；候选没有把冲突模型静默合并。

### 5. facts 数量、边界、authority 与 certainty：MATCHED

固定审阅 plate 有两条动爻。独立运行候选 fixture 得到：

- 长生 facts 共 `50`：四柱 × 六爻 × 本/变卦的固定 facts 为 `48`，另有两条动爻的 transition facts；transition 以本爻五行在变支处取十二阶段。
- 六神 facts 共 `6`：只按日干生成，仅附本卦六爻，authority 为 `secondary`。
- 该 fixture 命中的神煞 facts 为 `3`；候选只开放天乙、禄神、驿马、天喜四种查询，神煞仅命中本卦可见爻，authority 为 `secondary`、certainty 为 `conditional`，并明确不得覆盖用神强弱。
- 长生 rule authority 为 `profile-dependent`；土行 certainty 保持 `disputed`，其他元素为 `computed`。
- fixture facts 的 ID 唯一、来源与规则 metadata 完整，神煞没有扩展到变卦或隐藏爻。

### 6. 本地 corpus 与 fixed oldid 绑定：MATCHED（有来源质量限制）

三书全书 hash、十条本地文本 hash、五个 evidence capsule hash 均逐项匹配；三个远端页面也通过 exact oldid 打开，未使用漂移的最新页替代。来源质量限制如下：

- 两个分章 Wikisource oldid 标记为 50% 校对质量，只能作为固定文本证据，不能被描述为现代权威校本。
- 本地 `ZENGSHAN-BUYI-0094` 有可见 OCR 错字，四神煞默认表应以绑定的 exact oldid 纠正文本交叉；候选当前采用的表与 fixed oldid 一致。
- YIMAO 与 YIYIN 提供的是冲突/变体证据，不能提升为默认运行模型；候选当前保持关闭，处理正确。

### 7. profile、source 与生产门：MATCHED

- 默认 profile 精确绑定 `five-element-forward_v1`、`yehe-day-stem-six-spirit-v1`、`yehe_limited_four_v1`，土随水、六神按日干且仅本卦、神煞只开放四项并保持辅助边界。
- required sources 为本报告列出的完整五个 `inputSourceRefs`，上下文门执行精确 profile payload 与注册来源比对。
- manifest 当前是 `unverified`、`fixture-only`、`reviews.length = 0`；生产调用确实被拒绝，错误为 `长生神煞规则包未通过项目运行门`。
- 运行门要求两份独立审阅在 reviewer、run、reportPath、输入来源集合与 checked claims 集合上满足约束且 outcome 均为 `matched`。本报告仅给出 B 的 `matched` 结论；当前候选 manifest 仍保持关门状态，本次审阅未修改 manifest，也未自行断言另一份审阅的结果。

## 差异与限制清单

1. **已闭环的前次差异：** `腾蛇 -> 螣蛇` 已同时进入 canonical artifact、编译后运行时代码和独立 oracle，本轮不再构成争议。
2. **来源质量：** 两个 Wikisource 分章 oldid 为 50% 校对质量；本地神煞条目有 OCR 错字，已用第三个 exact oldid 交叉纠正。
3. **模型边界：** 土行起点、常见天乙、逐月/年支天喜和十干阴逆均是显式争议或变体，当前只能关闭保存，不能与默认表合并。
4. **运行边界：** `matched` 是来源与实现一致性的审阅结论，不会绕过 manifest 双审门；当前生产门仍关闭。
5. **审阅性质：** 本报告由自动化代理生成，不是人工审阅；结论只覆盖列明 artifact hash、五个输入来源和七项 checked claims。

## 最终判定

`MATCHED`。当前 artifact `e216e1d8a854972a1c5524bc8f73162e6eb2754144fd971152b795e24318f129` 在本报告七项 checked claims 范围内通过独立来源复审；是否进入项目运行态仍须由 manifest 的完整双审门单独决定。
