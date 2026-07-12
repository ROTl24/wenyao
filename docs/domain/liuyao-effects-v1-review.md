# `liuyao_effects_v1` 生产审阅册

本文件汇总固定 artifact、两次独立自动审阅与生产门状态；它不是第三份独立审阅，更不冒充人工校勘。当前 manifest 固定为：

- `verificationLevel: independent-automated`
- `runtimeStatus: project-enabled`
- `reviews.length: 2`

生产 `deriveEffectsFacts` 只接受 `plate + ruleContext`，不接受外部传入 relation/growth facts。领域内核在同一轮内各计算一次 Task 4 与 Task 6，再把受信事实传给 calendar、moving、formations；`deriveFacts` 最终一次性稳定合并 Task 4、Task 6 与 Task 5。内部依赖入口不经领域 barrel 或 IPC 暴露。

## Artifact 冻结值

- bundle：`liuyao_effects_v1@1.0.0`
- canonical UTF-8 bytes：`10092`
- SHA-256：`208ff324b2bc1a9dbdf45a848927d8bf6f0495152ab0ba6c45e477a7c5e742d6`
- Task 3 依赖：`241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa`
- Task 4 依赖：`60a7d9f9e9d607c83ddfe191347c1b9e5f30a47d1ee53a3e70fe29976aea8608`
- Task 6 依赖：`e216e1d8a854972a1c5524bc8f73162e6eb2754144fd971152b795e24318f129`

## 固定来源与 capsule

| source id | 固定定位 | capsule SHA-256 |
| --- | --- | --- |
| `WS-ZENGSHAN-SEASONS-2100323` | `增删卜易/15又`, `oldid=2100323` | `81fd4baddc7171116e544a987a89cecf0c5c520134ff230c8750825b06bf705e` |
| `WS-ZENGSHAN-MOVING-2100321` | `增删卜易/15`, `oldid=2100321` | `8a3bd4cb3162a7260d0f33b9bb05616844335d96c46d0221c98ab36af180a641` |
| `WS-ZENGSHAN-THREE-HARMONY-2100447` | `增删卜易/19`, `oldid=2100447`，Task 5 专属三合 claim | `b4cca4a1168daddee1f1381c51cf8232ca0a74510ed0b74a1b2c25eef295a347` |
| `WS-ZENGSHAN-DAY-2100338` | `增删卜易/17`, `oldid=2100338` | `82da6f9676ad40a24d06b4eaf1f54fe7b13df88d3fb4fc18cec52c6bf65e21f9` |
| `WS-ZENGSHAN-FAN-FU-2100458` | `增删卜易/25`, `oldid=2100458` | `5f683b9e4bf080dbc9919973b279e63d38dca6d8217c1bf180c68e661cd5f048` |
| `WS-ZENGSHAN-VOID-2100460` | `增删卜易/26`, `oldid=2100460` | `4cf2d5f1acc0ea6cb532329dc7865fe733d97d4b18791f1e82a65802bc513646` |
| `CORPUS-ZENGSHAN-EFFECTS` | 本地 `ZENGSHAN-BUYI` | `218bf82923531754da057049700a42931f8f27b9e401832f85ac3e2f52f49267` |
| `CORPUS-BUSHI-EFFECTS` | 本地 `BUSHI-ZHENGZONG` | `1734bc45e5c7fdd50ccdd42534c3d59c6af8291ddcb83b6bf61e4810709d8e45` |
| `WS-ZENGSHAN-11` | 复用 Task 4 五行生 capsule | `f16f6336f4fb7df3dae731dbfbc409828edd1fe14dce9d6e11495b61ad0df50c` |
| `WS-ZENGSHAN-12` | 复用 Task 4 五行克 capsule | `1511a1abe713d5ac655b279cf3431f7c1adc05bac644d500c1b6f9dd83d5441a` |
| `WS-ZENGSHAN-19` | 复用 Task 4 六合 capsule，仅支撑六合/回头合 | `d79377f29e075dd8f6f2aa0d386f7e261fa4258d596709e2b0b4ebd0b8787721` |
| `WS-ZENGSHAN-20` | 复用 Task 4 六冲 capsule | `53e84f4b5c9b20b7364b7a482d590231f23e9eb0cc2d6bdab2c74836e302b546` |
| `WS-ZENGSHAN-GROWTH-2100461` | 按 source id 复用 Task 6 capsule | `e1fc94c03775c1f6be3c61869e184e9d653c99fbf12f9f2762293f86fd0d37da` |

本地书级绑定：

- `ZENGSHAN-BUYI`：`5a1bf59de04180d2f118ebe25abb84565b30aa731c986a83ace4898f5c0c04ae`
- `BUSHI-ZHENGZONG`：`e6ba468011293b3f4cd368a3f5c66c284334b1dcb96dd5530f9b749c84ba881b`

本地条目绑定由候选脚本逐条从 `resources/corpus.json` 实时复算：`ZENGSHAN-BUYI-0047/0048/0054/0056/0057/0058/0060/0062/0063/0064/0066/0079` 与 `BUSHI-ZHENGZONG-0046/0047/0095/0097`。

## 规则边界

- 月令状态为唯一分类，12×12 计数固定为当令 `12`、同五行 `20`、月生爻 `28`、余气 `4`、休囚 `80`。
- 旬空只取日柱，60 甲子×12 支共 720 格逐格核验，每日恰好两支空。
- 暗动/日破只分类静态本卦爻。生扶白名单只有月、日、其他明动本卦爻；年、时、单纯合、余气以及不可达的静爻化爻均不进入。
- 回头生克冲合固定 `changed → base`；进退固定 `base → changed`。默认七进七退；禁用的《卜筮正宗》审计 profile 为八进八退并自带来源。
- 化墓/化绝调用 Task 6 `twelveStage`，不复制表；5 元素×12 支中各有 `5` 个墓、`5` 个绝。
- 三合只接受完整本卦三支且有明动/暗动，或内初三、外四六两端同时明动并由其中一个本位化爻补局。空、月破、日破、日柱墓或化墓降为 candidate；年月时墓不阻断。
- 重复支先枚举所有 activated 组合，优先无阻断组合，再以 code-unit 顺序选最小成员集合，其余写入 `alternativeMemberEntityIds`；同一 `trineId + memberMode + half` 只出一条事实。
- 64 卦固定 `8` 六合、`10` 六冲。4096 状态计数固定：base 六合/六冲 `512/640`，changed `504/630`；内外反吟各 `128`、任一 `252`、双半 `4`，伏吟同数。
- 默认反伏按对应支全冲/全同且该半卦实动。禁用方位反吟只冻结 `乾↔巽、坎↔离、艮↔坤、震↔兑`，来源为本地 `BUSHI-ZHENGZONG-0095`。

## 转录与 profile 披露

- `2100323` 正二月休囚句存在重复“火”并漏“水”的转录现象；候选按同段旺相结构归一为“其余休囚”，丑月水余气则为原文直载。
- “无扶白名单”是产品 profile 对原文旺衰条件的操作化，不宣称是古籍给出的完整算法。
- “对应支全冲/全同 + 半卦实动”是从 `2100458` 例证提炼的命名 profile；方位法只存在于禁用的《卜筮正宗》variant。

## 双审绑定

| 审阅 | reviewer / kind | independent run | reviewed at | report | 结论 |
| --- | --- | --- | --- | --- | --- |
| A | `codex-source-reviewer-effects-a-24bcce01bb0c4f31` / `automated-agent` | `effects-a-20260712-115921-24bcce01bb0c4f318a377bbf47be82dd` | `2026-07-12T11:59:21+08:00` | `docs/domain/reviews/liuyao-effects-v1-review-a.md` | `matched` |
| B | `codex-corpus-matrix-effects-b` / `automated-agent` | `liuyao-effects-v1-b-a5d7cb2f-77da-4b82-bd23-2d9a9c5454c4` | `2026-07-12T12:00:40.9619972+08:00` | `docs/domain/reviews/liuyao-effects-v1-review-b.md` | `matched` |

两份记录绑定同一 artifact hash、同一组 13 个 `inputSourceRefs` 与 expectations 中同序的 8 个 `checkedClaims`。两位 reviewer 与 independent run 均不同；结论属于独立自动审阅，不等同于 `human-reviewed`。

## Phase B 差异限制

Phase B 不修改受审 artifact、canonical bytes、capsule payload/hash、Task 3/4/6 依赖 hash 或 A/B 报告正文。允许的生产化差异仅限：把两条真实审阅记录原样写入深冻结 manifest、打开严格 bundle/context gate、移除 fixture-only 旁路、增加受门保护的生产派生与可信单遍编排、更新测试/脚本/本汇总册。

## 生产复算

执行：

```text
npm run review:effects
```

脚本会先编译领域层，再复算 artifact/capsule、本地书与条目、月令/旬空/进退/墓绝/64 卦/4096 状态 oracle，并确认：

- manifest 为 `independent-automated + project-enabled + reviews=2`，双审字段与报告路径精确匹配；
- bundle/context production gate 均打开，伪造 profile、source、manifest 与公共依赖注入仍被拒绝；
- `deriveEffectsFacts` 在真实夹具中产生非零 calendar、transition、formation 事实，且全部进入生产 `deriveFacts`；
- 旧 review fixture API、可信依赖入口与内部关系管线均未从领域 barrel 导出。

本文件只汇总自动门与可复算事实；若未来获得人工定本审阅，必须另立真实 human review 记录后才能升级为 `human-reviewed`。
