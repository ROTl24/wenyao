# `growth_shensha_core_v1` 项目启用审阅册

> 状态：`PROJECT_ENABLED`
>
> manifest：`verificationLevel=independent-automated`、`runtimeStatus=project-enabled`、`reviews=2`
>
> 重要边界：两份审阅均由自动化代理独立完成，不是人工复核、专家背书或传统术数共识。

## 1. 启用标识

| 字段 | 值 |
|---|---|
| bundle | `growth_shensha_core_v1` |
| version | `1.0.0` |
| artifact schema | `liuyao-growth-shensha-core/v1` |
| artifactHash | `e216e1d8a854972a1c5524bc8f73162e6eb2754144fd971152b795e24318f129` |
| canonical UTF-8 bytes | `7050` |
| 结构依赖 | `wenwang_najia_v2@2.0.0` / `241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa` |

该 artifact 是独立叶子 bundle；没有修改 `wenwang_najia_v2` 或 `relation_core_v1` 的 canonical payload/hash。`growthProfile`、`sixSpiritProfile`、`shenShaProfile` 都绑定上表同一个 bundle/hash。

## 2. 固定来源与本地语料绑定

`RuleSourceRef.contentHash` 哈希代码中保存的 evidence capsule payload，不冒充远程网页原始字节哈希。前三个主来源 capsule 写入固定 `oldid`、normalized claim，并绑定用户提供《增删卜易》的全书与条目 SHA-256；两个分歧 capsule 使用固定 corpus URN，绑定《易冒》《易隐》的全书与条目 SHA-256。

| sourceId | fixed revision / locator | capsule hash |
|---|---|---|
| `WS-ZENGSHAN-GROWTH-2100461` | 《增删卜易·生旺墓绝章》，`oldid=2100461` | `e1fc94c03775c1f6be3c61869e184e9d653c99fbf12f9f2762293f86fd0d37da` |
| `WS-ZENGSHAN-SIX-SPIRIT-2101727` | 《增删卜易·六神章》，`oldid=2101727` | `bd01e879479702de5b4c9f32c333135bfa1b42b4077fc9da29f2a712c9101deb` |
| `WS-ZENGSHAN-SHEN-SHA-2572918` | 《增删卜易》星煞章整书修订，`oldid=2572918` | `77871a1861cfc355218ec276adec0a3c4562ef1241a993311e18db075e1550c4` |
| `CORPUS-YIMAO-VARIANTS` | 本地《易冒》`YIMAO-0017/0059/0074`，六神异体、土生分歧和逐月天喜 | `ac5ad0142b2026f192ed559f70d2a85a93e6bf9d44a415d3ef0d6806005805aa` |
| `CORPUS-YIYIN-VARIANTS` | 本地《易隐》`YIYIN-0047/0050/0061`，年支/逐月天喜和常见天乙表 | `2613cce3548683b1f6473632dfb965eeb45bd29935c4e1cc1a5c214b31fed8e8` |

本地语料绑定：

- corpus：`2026.07.11-user-books-1`
- 《增删卜易》source：`ZENGSHAN-BUYI`；全书 SHA-256：`5a1bf59de04180d2f118ebe25abb84565b30aa731c986a83ace4898f5c0c04ae`
- 六神条目：`ZENGSHAN-BUYI-0053` → `1e42a6bf57e0ddeb1f93e4afa25e5983bdb5009b1c69c1e32c2af2b6652c9434`
- 长生条目：`ZENGSHAN-BUYI-0066` → `a8187ed5badeb248a90637acca7eef99370e933bb16a0c4213182c2130ca103a`
- 长生分歧条目：`ZENGSHAN-BUYI-0067` → `133a03a5abcfd08bc5318b7fe4fb285d59f08100cfe5341bf7612f201f8cda04`
- 星煞条目：`ZENGSHAN-BUYI-0094` → `ed36de4a2b532c3669d34ffa6a60de506fd5331b69a0057a1e4a7b31862f5fea`
- 《易冒》source：`YIMAO`；全书 SHA-256：`ab7eb41549cc30b4de2bc1c81757a2f0fdcec8823592e3b05f29417591982642`
- 六神异体：`YIMAO-0017` → `3d37da2768559b3984ea0d0b1cd49015e43c42311dc8803780266c3db8521042`
- 土生分歧：`YIMAO-0059` → `e4f71865040e4abae52a2f2ae7259984bee0f1b7c479706b84cb97d6eb922f82`
- 逐月天喜：`YIMAO-0074` → `edfeacca55caaa43fecb87c1dc60427e2287216be7cbb7a4154810ac83276d4e`
- 《易隐》source：`YIYIN`；全书 SHA-256：`4595d55959dc61e9db879a60214ce2b4ceabb3a8eaab13c179aabdcdd68deab2`
- 年支天喜：`YIYIN-0047` → `382b1a6757bb79e5265cacbde92e67d6d3ff592c38e3195a97ded92b53a7e0ef`
- 逐月天喜：`YIYIN-0050` → `ac2cd273a56bb0a164b58a77d904d6b8419a6a0670bbbf4853de9296741c488e`
- 常见天乙表：`YIYIN-0061` → `9e44a176ad0f1cac1c14b42461c5672d19ceed1559aeb7b359fb41afdc498f60`

《易冒》《易隐》只作为禁用 variants 和异体映射的分歧来源，不进入默认 source-specific 表；《卜筮正宗》仍只留作后续交叉审阅。三者都没有被写成默认共识。

## 3. 十二长生真值

支序固定为 `子丑寅卯辰巳午未申酉戌亥`：

| 五行 | 子 | 丑 | 寅 | 卯 | 辰 | 巳 | 午 | 未 | 申 | 酉 | 戌 | 亥 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 木 | 沐浴 | 冠带 | 临官 | 帝旺 | 衰 | 病 | 死 | 墓 | 绝 | 胎 | 养 | 长生 |
| 火 | 胎 | 养 | 长生 | 沐浴 | 冠带 | 临官 | 帝旺 | 衰 | 病 | 死 | 墓 | 绝 |
| 土 | 帝旺 | 衰 | 病 | 死 | 墓 | 绝 | 胎 | 养 | 长生 | 沐浴 | 冠带 | 临官 |
| 金 | 死 | 墓 | 绝 | 胎 | 养 | 长生 | 沐浴 | 冠带 | 临官 | 帝旺 | 衰 | 病 |
| 水 | 帝旺 | 衰 | 病 | 死 | 墓 | 绝 | 胎 | 养 | 长生 | 沐浴 | 冠带 | 临官 |

默认是五行统一顺排，土从水、长生于申。土从水只是当前 profile 选择，因此全部土长生 facts 固定为 `profile-dependent + disputed`；木火金水为 `profile-dependent + computed`。土长生寅的完整替代行与十干分寄/顺逆说明均绑定 `CORPUS-YIMAO-VARIANTS`，保存在禁用 variant，不与五行矩阵混表。

十二阶段全部输出；只有长生、帝旺、墓、绝写 `interpretationWeight=primary`，其余写 `display-only`。唯一公共查表函数是 `twelveStage`，Task 5 的化墓、化绝必须依赖它和本 artifactHash，不得另建墓绝表。

## 4. 六神真值

序列固定为 `青龙→朱雀→勾陈→螣蛇→白虎→玄武`，从初爻排到上爻：

- 甲乙青龙起；丙丁朱雀起；戊勾陈起；己螣蛇起；庚辛白虎起；壬癸玄武起。
- 类型只定义 `SixSpirit`，事实关系沿既定 schema 使用 `is-six-beast`；没有新增重复的 `SixBeast` 类型。
- 规范异体映射完整保存：`青龙/靑龍`、`螣蛇/滕蛇/腾蛇`、`玄武/元武`，并绑定《增删》六神来源与 `CORPUS-YIMAO-VARIANTS`。
- 只输出本卦六行 6 条 facts；变卦同行复用，不重复造事实。

## 5. 四项神煞真值

- 天乙（原文题名太乙）：甲戊丑未、乙己子申、丙丁亥酉、庚辛午寅、壬癸卯巳。常见“甲戊庚牛羊”完整 10 干表绑定 `CORPUS-YIYIN-VARIANTS`，作为禁用 disputed variant。
- 禄神：甲寅、乙卯、丙戊巳、丁己午、庚申、辛酉、壬亥、癸子。
- 驿马：申子辰见寅、巳酉丑见亥、寅午戌见申、亥卯未见巳。
- 天喜：节令月支寅卯辰见戌、巳午未见丑、申酉戌见辰、亥子丑见未。逐月递进 12 支表绑定《易冒》《易隐》，年支 12 支表绑定《易隐》，均完整保存为禁用 disputed variants。

默认只运行 profile 启用的这四项，只匹配本卦明爻。变卦、真实化爻、伏神不生成神煞；天喜直接使用节令计算出的月柱支。所有命中固定为 `scope=auxiliary + authority=secondary + certainty=conditional`，不得进入旺衰评分或单独定吉凶。

## 6. 固定事实输出契约

- 长生：本卦 6 行和变卦 6 行分别对年/月/日/时四柱，固定 `12×4=48` 条 `is-growth-stage`；每个真实动爻额外 1 条 `scope=transition`。
- 六神：固定 6 条 `is-six-beast`，source 为日柱，target 为本卦行。
- 神煞：按四项表逐命中本卦明爻生成 `is-shen-sha`，数量取决于当前盘。
- 伏神不进入 48 条长生，也不进入神煞。
- 所有 fact ID 和排序由实体、scope、规则与 profile 决定；deep clone 和爻数组换序后保持相同，重复 ID 直接拒绝。

## 7. 独立双审与生产门

| 审阅 | reviewerId / independentRunId | reviewedAt | outcome | 固定报告 |
|---|---|---|---|---|
| A | `codex-wikisource-growth-shensha-a` / `growth-shensha-a-20260712-104749-9091214` | `2026-07-12T10:47:49.9091214+08:00` | `matched` | `docs/domain/reviews/growth-shensha-core-v1-review-a.md` |
| B | `codex-corpus-growth-shensha-b` / `growth-shensha-core-v1-b-2c89ce7f-8a84-4960-a5e0-71353952a59a` | `2026-07-12T10:50:40.9970624+08:00` | `matched` | `docs/domain/reviews/growth-shensha-core-v1-review-b.md` |

两份记录绑定同一个 artifactHash、完整 5 个 `inputSourceRefs`、固定 7 个 `checkedClaims` 和互不重复的 reviewer/run/reportPath。A 以 exact Wikisource oldid 与候选 capsule 为主，B 以本地三书、十条 corpus 绑定再交叉 exact oldid；两者都明确声明 `automated-agent`，manifest 没有冒充 `human-reviewed`。

`assertProjectEnabledGrowthShenShaBundle` 和 context gate 现已打开，同时仍拒绝单审、重复 reviewer/run、`disputed`、错误 hash、缺来源、缺 claims、错误报告路径、`fixture-only` 或 `unverified` 伪装。旧 `ForReviewFixture` 入口已删除，barrel 和编译模块都不存在生产旁路。

Plate gate 只比较结构包标识/版本、schema、历法字段和已登记结构来源；relation/growth/sixSpirit/shenSha/useGod profile 不由 Plate 消费。各 bundle 自己核对完整 profile 和来源子集，`RuleContext.sources` 仍拒绝未知、伪造或重复来源。

`deriveGrowthShenShaFacts` 已进入生产；主 `deriveFacts` 一次稳定合并 Task 4 关系 facts 与 Task 6 长生、六神、神煞 facts，再统一排序和拒绝重复 ID。

最终独立复算命令：

```bash
npm run build:domain
node scripts/review-growth-shensha-candidate.mjs
```

脚本现验证 `PROJECT_ENABLED` 最终契约：双审数量和状态、生产门打开、artifact/capsule/corpus hashes、默认及禁用表 oracle、48+m 长生、6 条六神、神煞 base-only 与全部元数据。脚本只读，不写或修改 A/B 报告。

## 8. 已披露差异与限制

1. 固定六神文本含 `靑龍/滕蛇/元武`，本地《易冒》含 `腾蛇`；artifact 统一为 `青龙/螣蛇/玄武`，通过显式、带来源的 aliases 保留差异。
2. 星煞原文章名使用“太乙贵人”，代码 ID 为 `tianyi`；默认表值按固定 oldid，不把名称规范化当成另一张表。
3. Wikisource 两个分章页面标注 50% 文本质量；本项目状态仅表示固定电子文本与实现经两次独立自动复算一致，不表示完成影印底本人工校勘。
4. 本地 `ZENGSHAN-BUYI-0094` 有 OCR 错字；默认表以 exact oldid 交叉纠正，本地条目只作为绑定材料。
5. 土起申/寅、阴阳顺逆、常见天乙、逐月与年支天喜均保持 `disputed` 或禁用 variant，不提升为默认共识。
6. `contentHash` 是本地规范化 evidence capsule payload hash，不是远程网页原始字节 hash；报告分别核了 capsule 与固定来源内容。
7. 三书全书 SHA-256 绑定来自 `corpus-manifest.json`；工作树没有原始 GB18030 书文件，十条实际 corpus 文本则已逐条重新哈希。
