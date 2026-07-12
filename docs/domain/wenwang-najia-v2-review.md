# `wenwang_najia_v2` 结构规则最终审查记录

状态：`independent-automated + project-enabled`

提取与规范化日期：2026-07-12（Asia/Shanghai）

规则包版本：`2.0.0`

最终 artifact SHA-256：`241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa`

本文固定最终结构表、来源定位、哈希口径及两次真实独立审查记录。两次均由自动化代理执行，不是人工底本审阅；因此 verificationLevel 如实保持 `independent-automated`。

## 1. Artifact 边界与复算

最终规范化结构位于 `src/domain/liuyao/rules/wenwang-najia-v2.ts` 的 `WENWANG_NAJIA_V2_ARTIFACT`，包含：

- 十天干、十二地支五行；
- 五行生克有向环；
- 八卦阴阳位、卦象、五行、内外卦纳甲；
- 64 卦的上卦、下卦、全名、短名、八宫、宫序、世应；
- “本卦明现六亲缺类 → 本宫首卦同位潜在伏神”的结构策略。

不进入 artifactHash 的内容：来源说明胶囊、manifest、审查记录、历法 profile、十二长生、六神、六合六冲和任何 Case hash。

Canonical payload 使用 `canonicalStringify(WENWANG_NAJIA_V2_ARTIFACT)`：对象键按 Unicode 码点升序，数组保留声明顺序，输出无额外空白的 UTF-8 JSON。当前 payload 为 13,192 字节。领域运行时只携带上面的预计算 SHA-256，不导入 `node:crypto`。

独立复算命令：

```powershell
cmd /c npm run build:domain
node scripts/review-wenwang-candidate.mjs
```

脚本必须输出 `declaredHash === computedHash` 且 `matched: true`。

## 2. `RuleSourceRef.contentHash` 的准确含义

`contentHash` **不是远程网页原始字节的哈希**，也不声称固定了 CText 页面全文。它是对应 `RULE_SOURCE_EVIDENCE_CAPSULES[n].payload` 这一段本地规范化证据说明的 UTF-8 SHA-256；payload 使用 LF 换行且末尾无换行。每段 payload 明列 sourceId、URL、定位和本项目据其核对的 normalizedClaim。这样可稳定识别“本次到底依据了哪项定位与主张”，不会伪造未保存的远程页面内容。

Wikisource 条目使用 `oldid` 固定修订；CText 条目使用书目 URN/章节定位，审查者仍须打开对应页面或扫描逐项比较，不能把本地胶囊哈希当成远程文本已被核真的证明。

| Source ID | 固定来源与定位 | 本地证据胶囊 SHA-256 |
|---|---|---|
| `WS-JING-7903767` | [《京氏易传》修订 7903767](https://zh.wikisource.org/w/index.php?title=%E4%BA%AC%E6%B0%8F%E6%98%93%E5%82%B3&oldid=7903767)，卷上至卷中 64 个上下卦/卦名标题 | `5de73e5085eeac3ddb5ad8e65ef07b2a082858a73ed4626bab42766e4fd1599f` |
| `WS-YIPI-760928` | [《易禆传（四库全书本）/外篇》修订 760928](https://zh.wikisource.org/w/index.php?title=%E6%98%93%E7%A6%86%E5%82%B3_(%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC)/%E5%A4%96%E7%AF%87&oldid=760928)，“八卦变”末段与“纳甲” | `a72e145219d07666ddcce98608adc2b8a3b8fa9e3dd9756bd5f7588c5d64b45f` |
| `WS-NAJIA1-2031149` | [《易学象数论/纳甲一》修订 2031149](https://zh.wikisource.org/w/index.php?title=%E6%98%93%E5%AD%B8%E8%B1%A1%E6%95%B8%E8%AB%96/%E7%B4%8D%E7%94%B2%E4%B8%80&oldid=2031149)，第 1 段 | `c84c34c9bfb51c7fd2aaff50d5dc44efd2c1828fe78031da5845d29c81389f0c` |
| `WS-NAJIA2-2031150` | [《易学象数论/纳甲二》修订 2031150](https://zh.wikisource.org/w/index.php?title=%E6%98%93%E5%AD%B8%E8%B1%A1%E6%95%B8%E8%AB%96/%E7%B4%8D%E7%94%B2%E4%BA%8C&oldid=2031150)，第 1 段“十二支六阳六阴……” | `e4d9223ed012da4f61c1bb8040a21bea6419859943e4a68dad125977e8f30aef` |
| `CTEXT-ZENGSHAN-1` | [CText《增删卜易》卷一](https://ctext.org/wiki.pl?chapter=950329&if=en)，条目 47–65 | `cabc19abff5dc855e8794a72977ba64bd25280926e8c17ceed7f8e2512e30efc` |
| `CTEXT-ZENGSHAN-2` | [CText《增删卜易》卷二](https://ctext.org/wiki.pl?chapter=157683&if=en&remap=gb)，条目 49–75 | `40cd8eb2840a9decf8ef30f2d2d4cc1ef3000f6aed8aed4e609cd928fce53c28` |
| `CTEXT-ZHENGZONG` | [CText《卜筮正宗》](https://ctext.org/wiki.pl?chapter=801184&if=gb)，条目 13–16、70–75 | `be1a1dcec0c65ea68f0eb673a41c3485562bfc5fe3d3ffcdf0f10aae0473b4a9` |

## 3. 64 卦与八宫逐项清单

每行严格按本宫、一世、二世、三世、四世、五世、游魂、归魂排列；逐项上下卦键、世应值见独立显式 fixture `src/domain/liuyao/__fixtures__/golden-hexagrams.ts`。

| 宫 | 五行 | 8 卦顺序 |
|---|---|---|
| 乾 | 金 | 乾为天、天风姤、天山遁、天地否、风地观、山地剥、火地晋、火天大有 |
| 坎 | 水 | 坎为水、水泽节、水雷屯、水火既济、泽火革、雷火丰、地火明夷、地水师 |
| 艮 | 土 | 艮为山、山火贲、山天大畜、山泽损、火泽睽、天泽履、风泽中孚、风山渐 |
| 震 | 木 | 震为雷、雷地豫、雷水解、雷风恒、地风升、水风井、泽风大过、泽雷随 |
| 巽 | 木 | 巽为风、风天小畜、风火家人、风雷益、天雷无妄、火雷噬嗑、山雷颐、山风蛊 |
| 离 | 火 | 离为火、火山旅、火风鼎、火水未济、山水蒙、风水涣、天水讼、天火同人 |
| 坤 | 土 | 坤为地、地雷复、地泽临、地天泰、雷天大壮、泽天夬、水天需、水地比 |
| 兑 | 金 | 兑为泽、泽水困、泽地萃、泽山咸、水山蹇、地山谦、雷山小过、雷泽归妹 |

世应固定表（初爻为 1）：

| 宫序 | 本宫 | 一世 | 二世 | 三世 | 四世 | 五世 | 游魂 | 归魂 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 世 | 6 | 1 | 2 | 3 | 4 | 5 | 4 | 3 |
| 应 | 3 | 4 | 5 | 6 | 1 | 2 | 1 | 6 |

## 4. 内外卦纳甲与六亲参照

每格均按下爻到上爻：

| 卦 | 内卦三爻 | 外卦三爻 |
|---|---|---|
| 乾 | 甲子、甲寅、甲辰 | 壬午、壬申、壬戌 |
| 兑 | 丁巳、丁卯、丁丑 | 丁亥、丁酉、丁未 |
| 离 | 己卯、己丑、己亥 | 己酉、己未、己巳 |
| 震 | 庚子、庚寅、庚辰 | 庚午、庚申、庚戌 |
| 巽 | 辛丑、辛亥、辛酉 | 辛未、辛巳、辛卯 |
| 坎 | 戊寅、戊辰、戊午 | 戊申、戊戌、戊子 |
| 艮 | 丙辰、丙午、丙申 | 丙戌、丙子、丙寅 |
| 坤 | 乙未、乙巳、乙卯 | 癸丑、癸亥、癸酉 |

完整 64×6 展开值独立列于 `src/domain/liuyao/__fixtures__/golden-najia.ts`。六亲以参照宫五行为“我”：同我为兄弟，生我为父母，我生为子孙，克我为官鬼，我克为妻财。

- 本卦 facet 的 `relationToBasePalace` 与 `relationToOwnPalace` 相同。
- 变卦 facet 的 `relationToBasePalace` 仍参照本卦宫，用于动变分析。
- 变卦 facet 的 `relationToOwnPalace` 参照变卦自己的宫，用于完整变卦查看。
- 变卦六行全部重新装甲；静爻也不复制本卦干支或世应。

乾六爻皆动变坤的六个黄金对照为：乙未父母/兄弟、乙巳官鬼/父母、乙卯妻财/官鬼、癸丑父母/兄弟、癸亥子孙/妻财、癸酉兄弟/子孙（斜线前后依次为 base/own 参照）。

## 5. 潜在伏神候选

结构语义只做三件事：找本卦明现六亲缺类；从所属宫首卦找到该六亲的唯一爻位；把该来源爻按同位挂到本卦宿主行并标 `status: 'potential'`。不判断何时启用，不考虑日月或变爻优先，不输出飞伏吉凶。

八宫黄金样例：

| 宫 | 本卦 | 潜在候选 |
|---|---|---|
| 乾 | 天风姤 | 二爻宿主辛亥；来源乾为天二爻甲寅；妻财 |
| 坎 | 水雷屯 | 三爻宿主庚辰；来源坎为水三爻戊午；妻财 |
| 艮 | 风泽中孚 | 三爻丙申子孙、五爻丙子妻财，均来自艮为山同位 |
| 震 | 雷风恒 | 二爻宿主辛亥；来源震为雷二爻庚寅；兄弟 |
| 巽 | 风天小畜 | 三爻宿主甲辰；来源巽为风三爻辛酉；官鬼 |
| 离 | 火山旅 | 初爻己卯父母、三爻己亥官鬼，均来自离为火同位 |
| 坤 | 地雷复 | 二爻宿主庚寅；来源坤为地二爻乙巳；父母 |
| 兑 | 地山谦 | 二爻宿主丙午；来源兑为泽二爻丁卯；妻财 |

全 64 卦复算共 56 个候选：父母 10、兄弟 6、妻财 16、子孙 16、官鬼 8；按宫为乾 8、坎 4、艮 10、震 10、巽 6、离 8、坤 4、兑 6。

明确排除：对宫互换、异宫整套、爻爻皆伏、伏神启用先后、日月提拔、变爻优先以及飞生伏/飞克伏的解释结论。

## 6. 最终运行门状态

最终 manifest 固定为：

```text
verificationLevel = independent-automated
runtimeStatus = project-enabled
reviews = [review-a, review-b]
```

`assertProjectEnabledRulePack` 验证两次不同 reviewerId、两次不同 independentRunId、同一已编译 artifactHash、全部 `matched`、无 disputed、精确 verificationLevel/runtimeStatus 与来源 ID 集合；还要求带时区可解析的 ISO reviewedAt、无首尾空白的身份/run、合法 reviewerKind、非空且唯一的输入 source refs/reportPath/checkedClaims，并拒绝重复报告路径。`buildPlateV2` 实际调用 context 运行门，继续严格比对 schemaVersion、calendar/relation/growth/shenSha/useGod 全部 profile 字段，以及 7 个 `RuleSourceRef` 的 id、title、URL、locator、contentHash；空 sources 的 `BASE_RULE_CONTEXT`、缺失/重复/伪造 source、伪造历法 ID 或边界、伪造任一 profile 均拒绝，只有深冻结 `DEFAULT_RULE_CONTEXT` 通过。

## 7. 两次真实独立自动化审查

两位审查者均针对同一最终 artifactHash 独立核对，彼此未读取对方结果。两次 outcome 都是 `matched`，差异清单均为空。

| 记录 | reviewerId | reviewerKind | independentRunId | reviewedAt | artifactHash | outcome | 差异 |
|---|---|---|---|---|---|---|---|
| A | `codex-ctext-audit-a` | `automated-agent` | `wenwang-final-a-20260712` | `2026-07-12T08:00:00+08:00` | `241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa` | `matched` | 空 |
| B | `codex-wikisource-audit-b` | `automated-agent` | `wenwang-final-b-20260712` | `2026-07-12T07:57:25.9273596+08:00` | `241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa` | `matched` | 空 |

以上记录已经原样深冻结进 `WENWANG_NAJIA_V2_MANIFEST.reviews`。它们只证明两次独立自动化核表一致，不提升为 `human-reviewed`。

每条 `RuleReviewRecord` 还绑定相同的 7 个 `inputSourceRefs` 与以下 checkedClaims：`hexagrams:64`、`najia-lines:384`、`review-assertions:25`、`qian-to-gou-full-changed-reinstall`、`qian-to-kun-dual-relations`、`hidden-spirit-candidates:56`。

- A 原始输出：[wenwang-najia-v2-review-a.md](reviews/wenwang-najia-v2-review-a.md)。A 的 CText live 请求为 HTTP 403，使用固定 Wikisource 修订与既有第一审计交叉，未读取第二审计。
- B 原始输出：[wenwang-najia-v2-review-b.md](reviews/wenwang-najia-v2-review-b.md)。B 被明确禁止读取 A，沿第二审计与固定修订独立核对。
