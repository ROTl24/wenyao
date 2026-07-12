# use_god_core_v1 规则包审阅总册

## 范围

本规则包只负责三件事：先把占问落实为明确 intent，再映射到六亲/世应 selector，最后在当前 `PlateV2` 中定位具体本卦爻、真实化爻或伏神候选。它不把“学业功名、事业、感情”等事项标签冒充用神，也不计算一套脱离事实图的吉凶分数。

固定候选层级为：本卦明爻 → 真实动爻的化爻 → 宫首伏神。上一层非空即停止；同层只有一个候选才 `resolved`，多个候选全部保留为 `ambiguous`。动静、世应、空破与旺衰可成为后续事实，但默认不据此自动淘汰同层候选。伏神只作前两层皆空时的 `disputed` 最后候选；书内“采用伏神”与“再占不用伏神”的分歧被保留为禁用 variant。

只有 `resolved + single + primary` 才派生元神、忌神、仇神。运行时通过五行关系计算：生用神者为元神，克用神者为忌神，同时生忌、克元者为仇神。默认候选作用域限本卦、真实化爻、月日柱和已选伏神；年时、静态 changed facet 与未选伏神不进入元忌仇。

## 固定依赖与证据

候选 artifact 同时绑定 `wenwang_najia_v2`、`relation_core_v1`、`growth_shensha_core_v1`、`liuyao_effects_v1` 四个已启用 artifact hash。证据由 7 个固定 Wikisource 修订 capsule 和 2 个本地 corpus capsule 组成，共绑定 27 个逐条文本 hash。

`oldid=2100295` 固定到《八宫图第三》，只作为装排世应、六亲及自占先看世爻的入门证据；`oldid=2100700` 才固定到《用神章第八》，用于五类六亲主事。疏远他人取应、行人/代占、飞伏与两现规则还必须共同引用整书固定修订或本地 corpus，不能从 2100295 单独外推。

## 双审与生产启用

Phase A 审阅期间保持：

- `verificationLevel: unverified`
- `runtimeStatus: fixture-only`
- `reviews: []`
- 生产 `resolveUseGod`、生产用神 facts 和正式 `deriveFacts` 均拒绝进入；
- 仅 direct-module 的 `ForReviewFixture` 入口供两次独立审阅使用，主 barrel、IPC 和生产服务均不可见。

候选自检命令：

```powershell
cmd /c npm run build:domain
cmd /c node scripts/review-use-god-candidate.mjs
```

两个审阅者已在互不读取对方报告的前提下，复算同一 canonical artifact hash、9 个 capsule hash、2 本书 hash、27 个条目 hash，并独立核对 17 个 intent、三层候选、5×5 飞伏矩阵、五元素元忌仇矩阵与生产门；A/B 结果均为 `matched`。

Phase B 只把两条真实审阅记录写入 manifest，切换为 `independent-automated + project-enabled`，并删除 direct-module 的全部 `ForReviewFixture` 入口。受审 artifact、canonical bytes、来源 capsule、四个依赖 hash 和 A/B 报告正文均未改动。正式复验仍使用同一脚本，但期望状态改为生产门打开、两份报告存在、审阅记录精确匹配且编译产物不存在夹具旁路。
