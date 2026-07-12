# Task 3 完成报告

状态：完成

完成日期：2026-07-12（Asia/Shanghai）

最终 artifactHash：`241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa`

## 1. 交付结果

- 冻结 `wenwang_najia_v2` 最终结构 artifact：64 卦、八宫、世应、八卦内外纳甲、干支五行、生克六亲参照及宫首卦同位潜在伏神策略。
- `PlateV2` 仅保留结构真值，通过 `rulePackRef` 绑定最终 artifact；不含十二长生、六神、六合六冲或 context hash 占位。
- 完整生成本卦与变卦六行；静爻也按完整变卦重新装甲；changed facet 分离 `relationToBasePalace` 与 `relationToOwnPalace`，世应按变卦自身重算。
- 生成 `HiddenSpiritCandidateV2/hiddenSpiritCandidates/status:'potential'`；不提前判断伏神启用、日月/变爻优先或飞伏吉凶。
- 显式黄金 fixture 覆盖 64 卦和 64×6 纳甲；穷举 4096 投币状态；复算 56 个潜在伏神及六亲/八宫分布。
- 对最终 canonical payload 预计算 SHA-256；运行时不依赖 `node:crypto`，独立审查脚本可复算 artifact 与 7 个 evidence capsule。

## 2. 最终审查与运行许可

两次最终审查均针对同一 artifactHash 独立执行，彼此未读取对方结果；两次均为自动化代理审查，不是人工底本审阅，outcome 均为 `matched`、差异均为空：

| reviewerId | reviewerKind | independentRunId | reviewedAt |
|---|---|---|---|
| `codex-ctext-audit-a` | `automated-agent` | `wenwang-final-a-20260712` | `2026-07-12T08:00:00+08:00` |
| `codex-wikisource-audit-b` | `automated-agent` | `wenwang-final-b-20260712` | `2026-07-12T07:57:25.9273596+08:00` |

最终 manifest 已深冻结为 `independent-automated + project-enabled`，两条真实 records 也逐层冻结。每条 record 现在绑定输入 source IDs、已提交报告路径与 checkedClaims；原始报告分别为 `docs/domain/reviews/wenwang-najia-v2-review-a.md`、`wenwang-najia-v2-review-b.md`。

## 3. 生产上下文与强制运行门

- `BASE_RULE_CONTEXT` 保持空 sources，只用于 fixture/历法基础配置，调用生产 `buildPlateV2` 必须拒绝。
- `DEFAULT_RULE_CONTEXT` 深冻结并包含 7 个真实 `RuleSourceRef`。
- `buildPlateV2` 每次构建前实际执行 registry context gate，不存在“只导出但无人调用”的旁路。
- Gate 严格验证最终 manifest、artifactHash、精确 verificationLevel/reviewerKind、带时区可解析 reviewedAt、trim 后身份/run 唯一性、审阅输入/报告/checks、schemaVersion、所有 profile 字段，以及每个 source 的 id、title、URL、locator、contentHash。
- 缺失、重复或伪造 source，以及伪造 calendar ID/换日边界、relation/growth/shenSha/useGod profile，均在运行时拒绝；不依赖 TypeScript literal 类型保护边界。

## 4. TDD 证据

阶段 A 首个红灯为缺少 `./plate.js`；完整矩阵扩展后仍因缺少 registry 产生红灯，随后实现候选表与 Plate。

阶段 B 先把测试切换到尚不存在的 `DEFAULT_RULE_CONTEXT` 并要求真实 manifest records、BASE/伪造 source 拒绝，得到 43 个预期失败；接通 manifest、DEFAULT 和生产门后转绿。随后先增加伪造 schema/calendar/profile 的运行时测试，7 个用例均先失败，再补严格 profile gate 后转绿。

最终代码审查的 4 个 Important 先得到 23 个目标红灯：缺少可追溯审阅字段/报告、伪造 verificationLevel 与日期/trim 身份、JS 入口无效 input/ID。补齐后目标测试转绿；4096 穷举新增的 changed 六行纳甲与世应黄金断言直接验证了现有实现，不改变 artifact。

## 5. 验证结果

| 命令 | 结果 |
|---|---|
| `npx vitest run src/domain/liuyao/plate.test.ts` | 89 tests 通过 |
| `npm run test:unit` | 24 files、309 tests 通过 |
| `npm run build:domain` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run test:electron` | 19 tests 通过 |
| `npm run build:renderer` | 通过；仅保留既有大 chunk 警告 |
| `node scripts/review-wenwang-candidate.mjs` | artifact 与 7 个 evidence capsule 全部 matched |
| `git diff --check` | 通过 |

## 6. 范围与遗留关注

- 本任务没有实现 facts、UI 或 AI，也没有修改旧 `src/lib/divination.ts`。
- Artifact canonical payload 保持 13,192 UTF-8 字节，阶段 B 只改变 manifest/context/docs，hash 与两次审查对象完全一致。
- `RuleSourceRef.contentHash` 哈希的是代码中逐字保存的本地 evidence capsule，不冒充远程网页原始字节；最终审查文档已明确此边界。
- Renderer build 的大 chunk 提示与本任务无关，构建仍成功。
