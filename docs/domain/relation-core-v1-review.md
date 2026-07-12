# relation_core_v1 最终规则包审阅册

状态：`PROJECT_ENABLED`（`independent-automated`，不是人工底本复核）

## 1. 最终边界

- bundle：`relation_core_v1@1.0.0`
- artifact schema：`liuyao-relation-core/v1`
- canonical UTF-8 bytes：`3,476`
- artifactHash：`60a7d9f9e9d607c83ddfe191347c1b9e5f30a47d1ee53a3e70fe29976aea8608`
- 依赖的结构盘 artifactHash：`241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa`
- manifest：`independent-automated + project-enabled + reviews=2`

该 artifact 与 `wenwang_najia_v2` 分离；只通过 `dependsOnWenwangArtifactHash` 复用后者已经冻结的五行生克原语，不修改结构盘 canonical payload 或 hash。两份独立自动审阅均对相同 hash 和 exact oldid 来源复验为 `matched` 后，生产 `deriveFacts(DEFAULT_RULE_CONTEXT)` 已通过关系规则门；候选旁路不再对外暴露。

## 2. 受审表

### 2.1 五行矩阵

五种同元素为 `same-element`；复用结构包的五生、五克有向原语；其余十个有向格为空。完整 5×5 矩阵应得到：同元素 5、生 5、克 5、空 10。

### 2.2 地支关系

| 关系 | 受审表 | 权限 / 确定性 | profile |
|---|---|---|---|
| 六合 | 子丑、寅亥、卯戌、辰酉、巳申、午未 | `structural / computed` | `relation_core_v1` |
| 六冲 | 子午、丑未、寅申、卯酉、辰戌、巳亥 | `structural / computed` | `relation_core_v1` |
| 六害 | 子未、丑午、寅巳、卯辰、申亥、酉戌 | `profile-dependent / computed` | `liuren-six-harms-v1` |
| 六壬六破 | 子酉、丑辰、寅亥、卯午、巳申、未戌 | `profile-dependent / disputed` | `liuren-six-breaks-v1` |
| 五行精纪四破 | 子酉、丑辰、卯午、未戌 | `profile-dependent / disputed` | `wuxingjingji-four-breaks-v1` |
| 默认共同四破 | 子酉、丑辰、卯午、未戌 | `profile-dependent / disputed` | `cross-source-common-four-breaks-v1` |
| 有向三刑核心 | 寅→巳、巳→申、丑→戌、戌→未、子↔卯、辰午酉亥自刑 | `profile-dependent / disputed` | `liuren-directional-core-v1` |

默认 profile 不补 `申→寅`、`未→丑`，也不把六壬独有的寅亥、巳申两破混入共同四破。显式选择六壬六破 profile 时，同一支对的合、破、刑会全部保留，不能用 `if/else` 覆盖。

## 3. 来源登记与 hash 语义

| sourceId | 定位 | capsule contentHash | URL |
|---|---|---|---|
| `WS-ZENGSHAN-11` | 《增删卜易·五行相生章》，固定修订 2100315 | `f16f6336f4fb7df3dae731dbfbc409828edd1fe14dce9d6e11495b61ad0df50c` | https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/11&oldid=2100315 |
| `WS-ZENGSHAN-12` | 《增删卜易·五行相克章》，固定修订 2100316 | `1511a1abe713d5ac655b279cf3431f7c1adc05bac644d500c1b6f9dd83d5441a` | https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/12&oldid=2100316 |
| `WS-ZENGSHAN-19` | 《增删卜易·六合章》，固定修订 2100447 | `d79377f29e075dd8f6f2aa0d386f7e261fa4258d596709e2b0b4ebd0b8787721` | https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/19&oldid=2100447 |
| `WS-ZENGSHAN-20` | 《增删卜易·六冲章》，固定修订 2100449 | `53e84f4b5c9b20b7364b7a482d590231f23e9eb0cc2d6bdab2c74836e302b546` | https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/20&oldid=2100449 |
| `WS-LIUREN-DAQUAN-1` | 《六壬大全/卷一》“十二支破”“十二支害”“十二支刑”，固定修订 854569 | `cd27a67f0265fc79cc6683a17ce6bcd90d1a2c01d3657e4860823e46ef2c1ed4` | https://zh.wikisource.org/w/index.php?title=%E5%85%AD%E5%A3%AC%E5%A4%A7%E5%85%A8/1&oldid=854569 |
| `WS-WUXING-JINGJI` | 《五行精纪》“破杀”，固定修订 2352956 | `a0425df7a140eaaa0af02774092d3562c5d9deae8d54fd8ab47bcb0f283f2f41` | https://zh.wikisource.org/w/index.php?title=%E4%BA%94%E8%A1%8C%E7%B2%BE%E7%B4%80&oldid=2352956 |

`RuleSourceRef.contentHash` 只哈希代码中逐字保存的本地 evidence capsule payload，用来发现本项目规范化主张被静默改写；它不冒充远程网页原始字节 hash。A/B 已分别实际读取上述固定修订并复算 capsule 与 artifact，未把 normalized claim 反向当作远程证据。

## 4. 派生范围

受审比较集合固定为：

1. 四柱地支到本卦六爻，共 24 对；
2. 本卦六爻无序对中至少一端为动爻；动爻数 0–6 时为 0、5、9、12、14、15、15 对；
3. 每个动爻只比较本位 `changed→base`。

总比较数依次为 24、30、35、39、42、44、45。不会生成静爻—静爻、四柱—变卦、化爻—非本位爻。每对恰有一个定向五行事实，并可叠加所有命中的地支关系；事实仅记录结构关系、规则、profile、来源与条件，不记录吉凶文案。

## 5. 独立双审结论

| 审阅 | reviewer / run | 时间 | 结论 | 报告 |
|---|---|---|---|---|
| A | `codex-wikisource-relation-a` / `relation-core-a-rerun-20260712-093342-3136109` | `2026-07-12T09:33:42.3136109+08:00` | `matched` | `docs/domain/reviews/relation-core-v1-review-a.md` |
| B | `codex-corpus-relation-b` / `relation-core-v1-b-0656a5f5-e8e3-47e0-9df5-02d0fd919f8a` | `2026-07-12T09:34:19.2997047+08:00` | `matched` | `docs/domain/reviews/relation-core-v1-review-b.md` |

两份报告都绑定完整 6 个 `inputSourceRefs`、固定 7 个 `checkedClaims`、相同 artifactHash 与各自固定路径。A 以 Wikisource fixed revisions 和 MediaWiki revision API 为主；B 另以用户提供的《增删卜易》本地语料交叉五行、六合和六冲，但本地 corpus 不含《六壬大全》《五行精纪》。两条独立路径结构差异均为 0。

## 6. 差异与限制

- 《六壬大全/1》“害”横表有可见转录异常；A/B 都以同页连续正文的丑午正反解释校正，不复制错字。
- 《六壬大全》实际小标题为“破、害、刑”；locator 中“十二支”是内容范围说明。刑法存在更复杂推演，因此本包只登记明确有向核心并保持 `disputed`。
- 《五行精纪》明确只有四破；六壬文本为六破。默认只取来源交集，未宣称跨流派唯一规则。
- Wikisource《增删卜易》部分页面标示 50% 文本质量；两次审阅仍属于自动电子文本复验，没有人工逐页影像校勘，故 verificationLevel 只能是 `independent-automated`，不得写成 `human-reviewed`。
