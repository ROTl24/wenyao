# `use_god_core_v1` 独立来源审阅 A

## 审阅身份与隔离声明

- `reviewerId`: `codex-use-god-source-reviewer-a-7d3f8c2a`
- `reviewerKind`: `automated-agent`
- `independentRunId`: `use-god-a-db5a5320-6b33-4906-93d2-4bc7e867090e`
- `reviewedAt`: `2026-07-12T13:37:55.6866138+08:00`
- `artifactHash`: `22cd540d809875406c5c176e95abecbbf3287e3b64095f7bbf0f43e8e4414cfa`
- `outcome`: `matched`

本审阅从固定历史页、本地 corpus、候选 artifact 与运行时代码独立复算。审阅过程中未读取、未等待、未引用 `use-god-core-v1-review-b.md`，也未与审阅 B 沟通。结论属于独立自动审阅，不等同于人工定本审阅。

## 固定来源核验

通过 Jina Reader 直接读取七个固定 URL 的 `oldid` 版本，并对照 capsule 的 claim 边界：

| source id | 固定页核验 | 结论与边界 |
| --- | --- | --- |
| `WS-ZENGSHAN-ROLE-PRIMER-2100295` | `增删卜易/3&oldid=2100295`，标题为八卦各宫全图相关入门内容 | 原文支持装排世应、五行、六亲，自占先看世爻；该 capsule 明确没有单凭此页把应爻泛化成所有他人。疏远他人/行人的应爻规则另与整书固定页和本地 corpus 共同绑定。 |
| `WS-ZENGSHAN-USE-GOD-2100700` | `增删卜易/8&oldid=2100700`，正文标题“用神章第八” | 五类六亲所主对象核对一致：父母含文书契约、舟车衣服等，官鬼含功名官府与夫，妻财含财物与妻妾，子孙含晚辈医药六畜，兄弟含同辈及财事劫阻。 |
| `WS-ZENGSHAN-YUAN-JI-2100299` | `增删卜易/9&oldid=2100299`，正文标题“用神元神忌神仇神章第九” | 正文直接定义元神生用、忌神克用、仇神克元而生忌。页面正文后的现代编者按没有进入 capsule claim。 |
| `WS-ZENGSHAN-YUAN-JI-STRENGTH-2100301` | `增删卜易/10&oldid=2100301`，正文标题“元神忌神衰旺章第十”，页面标注 50% 文本质量 | 原文要求结合旺衰、日月、动变、空破、墓绝。候选包只冻结元忌仇身份，没有把该页转写为强弱分数，边界正确。 |
| `WS-ZENGSHAN-ELEMENT-GENERATES-2100315` | `增删卜易/11&oldid=2100315` | 金生水、水生木、木生火、火生土、土生金，与 capsule 及元素矩阵一致。 |
| `WS-ZENGSHAN-ELEMENT-CONTROLS-2100316` | `增删卜易/12&oldid=2100316` | 金克木、木克土、土克水、水克火、火克金，与 capsule 及元素矩阵一致。 |
| `WS-ZENGSHAN-LATE-VOLUMES-2572918` | `增删卜易&oldid=2572918` 固定整书，直接定位飞伏神章、两现章、出行章、行人章 | 原文同时保留“日月可先代用”“本宫首卦寻伏”“不用伏神而再占”等分支；亦明确真实变爻已有用神时不应越级寻伏、两现择法有反例、自占出行看世、疏远行人看应。候选把冲突分支设为 disabled variant，并把伏神降为末级 disputed，未冒充古籍单一共识。 |

## Artifact、capsule 与本地语料复算

使用 Node `crypto.createHash('sha256')` 对生成后的 canonical payload、每个 capsule payload 以及 `resources/corpus.json` 的每条原文重新计算，未调用候选评审脚本作为判断依据。

- canonical UTF-8 bytes：`16938`
- 声明与复算 SHA-256：均为 `22cd540d809875406c5c176e95abecbbf3287e3b64095f7bbf0f43e8e4414cfa`
- 四个依赖逐项匹配：
  - Wenwang/Task 3：`241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa`
  - Relation/Task 4：`60a7d9f9e9d607c83ddfe191347c1b9e5f30a47d1ee53a3e70fe29976aea8608`
  - Growth-Shensha/Task 6：`e216e1d8a854972a1c5524bc8f73162e6eb2754144fd971152b795e24318f129`
  - Effects/Task 5：`208ff324b2bc1a9dbdf45a848927d8bf6f0495152ab0ba6c45e477a7c5e742d6`

九个 capsule 均逐一匹配：

| source id | SHA-256 |
| --- | --- |
| `WS-ZENGSHAN-ROLE-PRIMER-2100295` | `c5a7d586a9e11415096e9414855572b947920bf070bd123512dba25f56b9c784` |
| `WS-ZENGSHAN-USE-GOD-2100700` | `8e6fcecd2287199231996f6df3c87f5ec818d800a43d1da6632040bc2d7af12e` |
| `WS-ZENGSHAN-YUAN-JI-2100299` | `291732fe0eeebe2180fc1bc8b8117c24f2690ec463271ba048311ef56175f9c6` |
| `WS-ZENGSHAN-YUAN-JI-STRENGTH-2100301` | `fa64600d91112c25a8568877a0dab70e82f806d89777f9b5b806268b7dacd28c` |
| `WS-ZENGSHAN-ELEMENT-GENERATES-2100315` | `cf17b667044cb3f8106dd3c6426966ba515cb6c9fc778d4a55137fe8c3fc11a7` |
| `WS-ZENGSHAN-ELEMENT-CONTROLS-2100316` | `7282583ca59be6ffb681ccf8a69cdef2bbc905b07e907fa0951dc0170445e689` |
| `WS-ZENGSHAN-LATE-VOLUMES-2572918` | `5420c497903a34c82cb722a7a9ca9a19d6ba8b9a37192b5b56e70a3446a0c2eb` |
| `CORPUS-ZENGSHAN-USE-GOD` | `4a0c3e9a6a607a3977e6151c3906a92210db20555525b81a0af44c9d0c6d1aa2` |
| `CORPUS-BUSHI-USE-GOD` | `c4514ff716f424e702429788590aa99d1bd9055361caf73c52f086261e0e5796` |

本地书级绑定与 `corpus-manifest.json` 一致：

- `ZENGSHAN-BUYI`：`5a1bf59de04180d2f118ebe25abb84565b30aa731c986a83ace4898f5c0c04ae`
- `BUSHI-ZHENGZONG`：`e6ba468011293b3f4cd368a3f5c66c284334b1dcb96dd5530f9b749c84ba881b`

逐条读取并复算 `13 + 14 = 27` 个本地 entry，全部文本 SHA-256 与 artifact 绑定一致，无缺失或重复。语义交叉核对包括：六亲分类、世应自他、飞伏四向、真实化爻优先、元忌仇定义、考试父母/官鬼、伏神分歧、两现反例、出行与行人取用。

## 独立行为 oracle

没有采用候选评审脚本的布尔结果，而是另写一次性内存 oracle 直接调用候选夹具入口：

- `17` 个 intent 全部逐项核对 category、selector 与 related relations；类别分布为 `3/1/3/2/2/3/2/1`。
- 多意图类别全部返回 `intent-required` 及精确 options；他人健康返回 `subject-relation-required`；`other.explicit` 返回 `explicit-target-required`。
- 世、应角色只取本卦侧；关系互动返回无 primary 的 `shi-ying-pair`；`distant-other` 落到应爻。
- 穷举 `4096` 个卦态 × `5` 种六亲，共 `20480` 次具体实体选择：
  - 首个非空层命中数：本卦显爻 `16896`、真实化爻 `1856`、宫首伏神 `1728`；
  - 结果为单候选 resolved `12512`、同层多候选 ambiguous `7968`；
  - 每个真实化爻都来自明动本位，每个伏神候选均为 `disputed`；
  - selection、candidate、features 均无 `score`，同层多候选没有自动裁决。
- 独立硬编码飞神 × 伏神 `5 × 5 = 25` 格方向 oracle，全部匹配四种生克方向及同元素。
- 独立硬编码五种用神元素的元/忌/仇表，`5` 行全部匹配。
- 元忌仇枚举只出现本卦爻、真实化爻、月、日及已选伏神；未出现年、时、静态化爻或未选伏神。伏神 primary 的派生事实全部继承 `disputed`。
- needs-input、ambiguous 与 pair 均不派生元忌仇事实。

## Profile、来源与生产门

- artifact、manifest、capsule、intent/rule 子项均为深冻结；所有 intent、rule、variant 的 source ref 都闭合于九个 capsule。
- 精确候选 context 通过夹具门；篡改 `multipleCandidates` 或任一来源 hash 均被拒绝。
- 候选 manifest 保持 `verificationLevel: unverified`、`runtimeStatus: fixture-only`、`reviews: []`。
- `assertProjectEnabledUseGodBundle`、生产 context 门和公共 `resolveUseGod` 均以“用神规则包未通过项目运行门”拒绝。
- `resolveUseGodForReviewFixture` 及两个 facts review fixture 没有经主 barrel 暴露；主 barrel 只保留受生产门保护的公共入口。

## 验证命令结果

- `npm run build:domain`：通过。
- 独立 Node hash/corpus/source/gate 复算：通过。
- 独立 4096×5 行为与 5×5/五元素 oracle：通过。
- `npx vitest run src/domain/liuyao/use-god.test.ts src/domain/liuyao/facts/use-god-effects.test.ts`：`2` 个文件、`44` 个测试全部通过。

## 结论

`outcome = matched`。候选 artifact 的固定来源、四依赖、九 capsule、两本书二十七条本地证据、十七问意、三层候选、世应/澄清、飞伏、元忌仇及候选生产门均与本次独立来源审阅一致。古籍存在分歧之处已以 disabled variant 或 `disputed` 显式披露，没有把项目保守 profile 伪装成古籍唯一结论。

## Manifest review record

```ts
{
  reviewerId: 'codex-use-god-source-reviewer-a-7d3f8c2a',
  reviewerKind: 'automated-agent',
  independentRunId: 'use-god-a-db5a5320-6b33-4906-93d2-4bc7e867090e',
  reviewedAt: '2026-07-12T13:37:55.6866138+08:00',
  artifactHash: '22cd540d809875406c5c176e95abecbbf3287e3b64095f7bbf0f43e8e4414cfa',
  outcome: 'matched',
  inputSourceRefs: [
    'WS-ZENGSHAN-ROLE-PRIMER-2100295',
    'WS-ZENGSHAN-USE-GOD-2100700',
    'WS-ZENGSHAN-YUAN-JI-2100299',
    'WS-ZENGSHAN-YUAN-JI-STRENGTH-2100301',
    'WS-ZENGSHAN-ELEMENT-GENERATES-2100315',
    'WS-ZENGSHAN-ELEMENT-CONTROLS-2100316',
    'WS-ZENGSHAN-LATE-VOLUMES-2572918',
    'CORPUS-ZENGSHAN-USE-GOD',
    'CORPUS-BUSHI-USE-GOD',
  ],
  reportPath: 'docs/domain/reviews/use-god-core-v1-review-a.md',
  checkedClaims: [
    'artifact-hash-and-four-bundle-dependencies',
    'intent-category-subject-and-explicit-target-mapping',
    'visible-changed-hidden-tiering-and-no-score',
    'shi-ying-role-pair-and-clarification-states',
    'five-by-five-flying-hidden-and-hidden-dispute',
    'five-element-source-avoid-enemy-and-eligible-scope',
    'local-corpus-and-fixed-oldid-bindings',
    'profile-source-and-production-gates',
  ],
}
```
