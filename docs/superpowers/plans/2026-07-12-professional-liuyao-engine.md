# Professional Liuyao Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立版本化、可复算的专业六爻排盘与事实图，完整展示本变卦和四柱，并让 AI 只能基于主进程重建的事实与古籍证据输出可校验报告。

**Architecture:** `src/domain/liuyao` 是唯一领域内核，纯 TypeScript 同时供渲染构建和 Electron 主进程编译产物使用；`reading-service.cjs` 只凭 `sessionId` 从本地会话重建 `DivinationCaseV2`。排盘结构事实、配置相关事实和辅助神煞分层，结果 UI 只渲染结构化对象，AI 只引用 `factId/ruleId/evidenceId`。

**Tech Stack:** TypeScript 7、Vitest 4、React 19、Electron 43、Node test runner、`lunar-javascript@1.7.7`、Zod 4、CSS。

## Global Constraints

- 默认时区固定 `Asia/Shanghai`；默认历法配置为立春换年、节令换月、23:00 子初换日。
- 默认规则 ID 固定 `wenwang_najia_v2`、`beijing_jieqi_zichu_v2`、`yehe_core_v1`。
- 领域纯函数不得读取系统时间、随机源、网络、文件或 Electron API。
- 有争议规则必须带 `profileId/ruleId/sourceRefs/certainty`；不得冒充跨流派共识。
- AI 主进程接口只接受 `sessionId` 和必要的用户澄清/追问文本，不接受渲染进程提供的 plate、facts、evidence 或 validation。
- 旧会话属于用户数据，迁移前备份；重建冲突时保留旧数据并标记人工复核。
- 五行不能只用颜色表达；天干和地支分别着色并带元素文字或可访问标签。
- 每个任务遵循红—绿—重构、完成独立评审并单独提交；不得跨任务顺手修改摇卦动画。

## 执行前审阅决议

- `回头生/回头克` 的方向以“化爻作用于原动爻”为准：原爻木、化爻水是回头生；原爻木、化爻金是回头克。不得把“原爻生化爻”误标为回头生。
- `wenwang-najia-v2-review.md` 中的“双重复核”指两个相互独立的审阅代理针对最终同一规则表 artifact 分别核表并留下真实身份类型、独立运行 ID、日期、输入来源、artifact hash 与结论；不得伪写成人工专家复核。两次自动审阅一致时只标 `independent-automated + project-enabled`；只有真实人工底本复核后才标 `human-reviewed`。两次不能一致则保持 `fixture-only`，不能进入默认上下文。
- `PlateV2` 只承载可复算结构：不预填十二长生、六神、六合/六冲或 `ruleContextHash`。十二长生与六神在 Task 6 生成 facts；Task 4 生成爻支之间的六合/六冲，Task 5 再生成卦级六合/六冲等 formations；`ruleContextHash` 在 Task 8 组装完整 Case 时计算。
- `yehe_core_v1` 对日冲采用保守分类：先始终输出结构性 `clashes`；只有月令同支、同五行或月令生爻且不存在月破时，才输出条件性 `is-dark-moving`；只有月破或月令克爻且没有任何已记录生扶时，才输出条件性 `is-day-break`；其余只保留日冲原始事实，不强判暗动或日破。这个阈值是产品 profile 对“旺相/休囚”的现代操作化，不得伪称古籍给出了同一算法。
- 受限神煞的取法必须登记为：天乙贵人、禄神以日干起；驿马以日支三合局起；`yehe-seasonal-tianxi` 依月令季节取春戌、夏丑、秋辰、冬未。按年支起红鸾天喜属于另一星命 profile，不得混入。四项都只能输出 `secondary + conditional`，不得进入旺衰评分或单独定吉凶。
- 事项类别不能替代问意。婚恋对象性别/角色、失物类型、代占行人身份等信息不足时必须 `needs-user-input`；Task 7 可扩充 `QuestionIntentId`，不得为满足旧联合类型而静默猜用神。

---

## 0. 文件结构与迁移顺序

```text
src/domain/liuyao/
  model.ts
  canonical.ts
  calendar.ts
  plate.ts
  case.ts
  index.ts
  rules/
    model.ts
    default-context.ts
    registry.ts
    tables.ts
    wenwang-najia-v2.ts
  facts/
    model.ts
    element-relations.ts
    branch-relations.ts
    calendar-effects.ts
    moving-effects.ts
    formations.ts
    growth-shensha.ts
    use-god-effects.ts
    derive.ts
  use-god.ts
  legacy.ts
  __fixtures__/
    golden-calendar.ts
    golden-hexagrams.ts
    golden-najia.ts

electron/services/
  reading-service.cjs
  reading-service.test.cjs
  migration.cjs
  migration.test.cjs
  ai.cjs
  ai.test.cjs

src/components/result/
  CaseHeader.tsx
  PillarGrid.tsx
  ElementText.tsx
  HexagramComparison.tsx
  FactExplorer.tsx
  UseGodPanel.tsx
  AnalysisReportV2.tsx
```

迁移严格按任务 1→12 顺序执行。Task 3 的 PlateV2 依赖 Task 2 的 CalendarSnapshot，因此不并行合并。旧 `buildPlate` 在任务 8 的数据迁移通过前不能删除；旧 `CATEGORY_FOCUS` 在任务 10 的本地和云端报告都切到 V2 后一次删除。

---

### Task 1: 建立共享领域工程与 V2 类型契约

**Files:**
- Create: `src/domain/liuyao/model.ts`
- Create: `src/domain/liuyao/rules/model.ts`
- Create: `src/domain/liuyao/rules/default-context.ts`
- Create: `src/domain/liuyao/index.ts`
- Create: `src/domain/liuyao/model.test.ts`
- Create: `tsconfig.domain.json`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: 设计规格中的 `RuleContext`、`CalendarPillar`、`PlateV2`、`DerivedFact`、`UseGodSelection`。
- Produces: 尚未通过生产审查门的 `BASE_RULE_CONTEXT`、全部 V2 类型、`npm run build:domain` 和 `electron/generated/domain/index.js`。

- [ ] **Step 1: 写类型与默认配置快照测试**

```ts
import { describe, expect, it } from 'vitest';
import { BASE_RULE_CONTEXT } from './index';

describe('V2 domain contract', () => {
  it('locks every interpretation choice into a versioned context', () => {
    expect(BASE_RULE_CONTEXT).toMatchObject({
      schemaVersion: '2.0.0',
      rulePackId: 'wenwang_najia_v2',
      calendarProfile: {
        id: 'beijing_jieqi_zichu_v2',
        timezone: 'Asia/Shanghai',
        dayBoundary: 'zi-hour-23',
      },
      growthProfile: {
        display: 'all-twelve',
        interpretationWeight: 'sheng-wang-mu-jue-only',
      },
      shenShaProfile: {
        enabled: ['tianyi', 'lushen', 'yima', 'tianxi'],
        authority: 'secondary',
      },
    });
    expect(Object.isFrozen(BASE_RULE_CONTEXT)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认红灯**

Run: `cmd /c npx vitest run src/domain/liuyao/model.test.ts`
Expected: FAIL，提示 `./index` 或 `BASE_RULE_CONTEXT` 不存在。

- [ ] **Step 3: 建立精确类型和只读默认配置**

把规格 4.1–4.6 中的类型逐字落实到 `model.ts` 与 `rules/model.ts`。`default-context.ts` 使用深冻结而不是只冻结第一层：

```ts
function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  }
  return value;
}

export const BASE_RULE_CONTEXT = deepFreeze({
  schemaVersion: '2.0.0',
  rulePackId: 'wenwang_najia_v2',
  rulePackVersion: '2.0.0',
  calendarProfile: {
    id: 'beijing_jieqi_zichu_v2',
    timezone: 'Asia/Shanghai',
    yearBoundary: 'li-chun-exact',
    monthBoundary: 'jie-exact',
    dayBoundary: 'zi-hour-23',
    library: 'lunar-javascript@1.7.7',
  },
  relationProfile: {
    id: 'yehe_core_v1',
    dayClashPolicy: 'strength-aware',
    changedRelationReference: 'base-palace',
  },
  growthProfile: {
    id: 'five-element-forward_v1',
    earthFollows: 'water',
    display: 'all-twelve',
    interpretationWeight: 'sheng-wang-mu-jue-only',
  },
  shenShaProfile: {
    id: 'yehe_limited_four_v1',
    enabled: ['tianyi', 'lushen', 'yima', 'tianxi'],
    authority: 'secondary',
  },
  useGodProfile: {
    id: 'explicit_intent_first_v1',
    ambiguousIntent: 'ask-user',
    multipleCandidates: 'retain-ranked-candidates',
  },
  sources: [],
} as const);
```

`BASE_RULE_CONTEXT.sources` 在此任务保持空数组，因此不能通过 Task 3 的生产审查门；它只让类型、历法配置和开发接口先冻结。Task 3 写入已核验来源并导出真正的 `DEFAULT_RULE_CONTEXT`。

- [ ] **Step 4: 配置领域双构建**

`tsconfig.domain.json`：

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src/domain/liuyao",
    "outDir": "electron/generated/domain",
    "noEmit": false,
    "declaration": true,
    "sourceMap": true,
    "isolatedModules": false
  },
  "include": [
    "src/domain/liuyao/**/*.ts",
    "src/types/lunar-javascript.d.ts"
  ],
  "exclude": ["src/domain/**/*.test.ts", "src/domain/**/__fixtures__/**"]
}
```

`package.json` 增加/调整：

```json
{
  "scripts": {
    "build:domain": "tsc -p tsconfig.domain.json",
    "watch:domain": "tsc -p tsconfig.domain.json --watch --preserveWatchOutput",
    "dev": "npm run build:domain && concurrently -k \"npm:watch:domain\" \"vite --host 127.0.0.1\" \"wait-on http://127.0.0.1:5173 && electron .\"",
    "test:electron": "npm run build:domain && node --test electron/services/*.test.cjs",
    "build:renderer": "npm run build:domain && tsc -b && vite build"
  }
}
```

`.gitignore` 增加 `electron/generated/`，打包仍由现有 `electron/**/*` 收录构建产物。

- [ ] **Step 5: 验证测试与双构建**

Run: `cmd /c npx vitest run src/domain/liuyao/model.test.ts && npm run build:domain && npm run typecheck`
Expected: 全部 PASS；`electron/generated/domain/index.js` 存在；Git 状态不包含 generated 文件。

- [ ] **Step 6: 提交**

```bash
git add package.json .gitignore tsconfig.domain.json src/domain/liuyao
git commit -m "feat(domain): 建立六爻 V2 领域契约与共享构建"
```

---

### Task 2: 实现上海时区四柱、旬与旬空

**Files:**
- Create: `src/domain/liuyao/calendar.ts`
- Create: `src/domain/liuyao/calendar.test.ts`
- Create: `src/domain/liuyao/__fixtures__/golden-calendar.ts`
- Modify: `src/types/lunar-javascript.d.ts`
- Modify: `src/domain/liuyao/index.ts`

**Interfaces:**
- Consumes: `RuleContext.calendarProfile`、ISO 时间字符串。
- Produces: `buildCalendarSnapshot(castAt, profile): CalendarSnapshot`、`getXunInfo(ganZhi)`。

- [ ] **Step 1: 写固定时刻、子初和六十甲子红灯测试**

```ts
import { describe, expect, it } from 'vitest';
import { buildCalendarSnapshot, getXunInfo } from './calendar';
import { BASE_RULE_CONTEXT } from './rules/default-context';
import { SIXTY_JIA_ZI_GOLDEN } from './__fixtures__/golden-calendar';

describe('calendar adapter', () => {
  it('builds four exact pillars in Asia/Shanghai', () => {
    const calendar = buildCalendarSnapshot(
      '2026-07-11T04:00:00.000Z',
      BASE_RULE_CONTEXT.calendarProfile,
    );
    expect(calendar.localDateTime).toBe('2026-07-11T12:00:00+08:00');
    expect(calendar.pillars.year.ganZhi).toBe('丙午');
    expect(calendar.pillars.month.ganZhi).toBe('乙未');
    expect(calendar.pillars.day.ganZhi).toBe('丙戌');
    expect(calendar.pillars.hour.ganZhi).toBe('甲午');
  });

  it('changes day at 23:00 under zi-hour profile', () => {
    const before = buildCalendarSnapshot('2026-07-11T14:59:00.000Z', BASE_RULE_CONTEXT.calendarProfile);
    const after = buildCalendarSnapshot('2026-07-11T15:00:00.000Z', BASE_RULE_CONTEXT.calendarProfile);
    expect(before.pillars.day.ganZhi).not.toBe(after.pillars.day.ganZhi);
  });

  it.each(SIXTY_JIA_ZI_GOLDEN)('%s has reviewed xun and void', (ganZhi, xun, voids) => {
    expect(getXunInfo(ganZhi)).toEqual({ xun, voidBranches: voids });
  });
});
```

- [ ] **Step 2: 运行红灯**

Run: `cmd /c npx vitest run src/domain/liuyao/calendar.test.ts`
Expected: FAIL，缺少 calendar 模块。

- [ ] **Step 3: 扩充真实库类型并实现适配器**

`src/types/lunar-javascript.d.ts` 必须声明实际调用的 `Solar.fromYmdHms`、年/月/日 exact、时柱方法。用 `Intl.DateTimeFormat` 先把 instant 转成上海本地年月日时分秒，再交给 `Solar.fromYmdHms`，禁止直接依赖 Windows 当前时区。

旬空独立按六十甲子算法复算：

```ts
const STEMS = [...'甲乙丙丁戊己庚辛壬癸'] as const;
const BRANCHES = [...'子丑寅卯辰巳午未申酉戌亥'] as const;

export function getXunInfo(ganZhi: string) {
  const stemIndex = STEMS.indexOf(ganZhi[0] as never);
  const branchIndex = BRANCHES.indexOf(ganZhi[1] as never);
  if (stemIndex < 0 || branchIndex < 0 || (branchIndex - stemIndex + 12) % 2 !== 0) {
    throw new TypeError('干支不属于六十甲子');
  }
  const jiaBranchIndex = (branchIndex - stemIndex + 12) % 12;
  const firstVoid = (jiaBranchIndex + 10) % 12;
  return {
    xun: `甲${BRANCHES[jiaBranchIndex]}旬`,
    voidBranches: [BRANCHES[firstVoid], BRANCHES[(firstVoid + 1) % 12]],
  } as const;
}
```

实现 `stemElement/branchElement` 映射，并给每个 `CalendarPillar` 写入干、支各自元素、旬、旬空。

- [ ] **Step 4: 加入边界黄金用例**

`golden-calendar.ts` 明列六旬各 10 个合法干支和对应旬空，不在测试中用被测函数生成 expected。再加入立春精确时刻前后、一个节交接前后、22:59/23:00、同一 instant 的 `Z/+08:00` 两种输入。

- [ ] **Step 5: 验证**

Run: `cmd /c npx vitest run src/domain/liuyao/calendar.test.ts && npm run build:domain && npm run typecheck`
Expected: 全部 PASS，四柱对象快照包含四个旬空对。

- [ ] **Step 6: 提交**

```bash
git add src/types/lunar-javascript.d.ts src/domain/liuyao
git commit -m "feat(domain): 计算四柱干支旬空与五行"
```

---

### Task 3: 冻结受审文王纳甲规则包并构建完整 PlateV2

**Files:**
- Create: `src/domain/liuyao/rules/registry.ts`
- Create: `src/domain/liuyao/rules/tables.ts`
- Create: `src/domain/liuyao/rules/wenwang-najia-v2.ts`
- Create: `src/domain/liuyao/plate.ts`
- Create: `src/domain/liuyao/plate.test.ts`
- Create: `src/domain/liuyao/__fixtures__/golden-hexagrams.ts`
- Create: `src/domain/liuyao/__fixtures__/golden-najia.ts`
- Create: `docs/domain/wenwang-najia-v2-review.md`
- Modify: `src/domain/liuyao/model.ts`
- Modify: `src/domain/liuyao/rules/model.ts`
- Modify: `src/domain/liuyao/rules/default-context.ts`
- Modify: `src/domain/liuyao/index.ts`

**Interfaces:**
- Consumes: `buildPlateV2({ plateId, sessionId, castAt, tossValues, ruleContext })`。
- Produces: 纯结构 `PlateV2`；本卦/变卦均有六行；`relationToBasePalace` 与 `relationToOwnPalace` 分离；规则包 manifest 与潜在伏神候选可审计。Plate 不含长生、六神、六合/六冲或 context hash 占位。

- [ ] **Step 1: 写黄金表与完整双盘红灯测试**

```ts
it('builds complete base and changed sides without conflating relations', () => {
  const plate = buildPlateV2({
    plateId: 'plate-fixed',
    sessionId: 'session-fixed',
    castAt: '2026-07-11T04:00:00.000Z',
    tossValues: [9, 7, 7, 7, 7, 7],
    ruleContext: DEFAULT_RULE_CONTEXT,
  });
  expect(plate.baseHexagram.name).toBe('乾为天');
  expect(plate.changedHexagram.name).toBe('天风姤');
  expect(plate.lines).toHaveLength(6);
  expect(plate.lines.every((line) => line.base && line.changed)).toBe(true);
  expect(plate.lines[0]).toMatchObject({
    id: 'line:1',
    moving: true,
    base: { ganZhi: '甲子', relationToBasePalace: '子孙' },
    changed: { ganZhi: '辛丑', relationToBasePalace: '父母' },
  });
});

it('covers every toss combination deterministically', () => {
  for (let encoded = 0; encoded < 4096; encoded += 1) {
    const tossValues = decodeFourBaseDigits(encoded);
    const first = buildFixturePlate(tossValues);
    const second = buildFixturePlate(tossValues);
    expect(first).toEqual(second);
    expect(first.lines).toHaveLength(6);
    first.lines.forEach((line) => {
      expect(line.base.yang !== line.changed.yang).toBe(line.moving);
      expect(line.transition === null).toBe(!line.moving);
    });
  }
});
```

- [ ] **Step 2: 运行红灯**

Run: `cmd /c npx vitest run src/domain/liuyao/plate.test.ts`
Expected: FAIL，`buildPlateV2` 不存在。

- [ ] **Step 3: 建立诚实的 artifact 审查门**

`RuleSourceRef` 只保存固定书目、定位和内容哈希，不再把来源本身标成含糊的 `approved`。`registry.ts` 对最终规范化规则表 manifest 验证：

```ts
export function assertProjectEnabledRulePack(manifest: RulePackManifest): void {
  const matched = manifest.reviews.filter((review) => review.outcome === 'matched');
  const reviewerIds = new Set(matched.map((review) => review.reviewerId));
  const runIds = new Set(matched.map((review) => review.independentRunId));
  const sameArtifact = matched.every((review) => review.artifactHash === manifest.artifactHash);
  const hasDisputed = manifest.reviews.some((review) => review.outcome === 'disputed');
  if (
    manifest.runtimeStatus !== 'project-enabled'
    || manifest.verificationLevel === 'unverified'
    || reviewerIds.size < 2
    || runIds.size < 2
    || !sameArtifact
    || hasDisputed
  ) throw new Error('结构规则包未通过项目运行门');
}
```

测试必须覆盖：单个审阅者、重复 reviewerId、重复 runId、不同 artifactHash、任一 disputed 均拒绝；两名独立自动审阅针对同一 hash 一致时允许运行，但 manifest 明确保持 `verificationLevel='independent-automated'`，不得出现“人工复核”字样。

`docs/domain/wenwang-najia-v2-review.md` 逐项记录 64 卦名、八宫次序、世应、内外卦纳甲、六亲参照、宫首卦同位伏神候选的来源 URL、固定修订、提取日期、规范化表 SHA-256 和两次独立复核记录。先实现最终表并冻结 artifact，再由两个独立审阅者核同一 hash；审阅旧代码不能替代最终 artifact 审阅。

审查通过后，把实际 source 与 manifest 写入规则包，导出深冻结 `DEFAULT_RULE_CONTEXT`。`BASE_RULE_CONTEXT` 继续保持 `fixture-only` 语义。运行门针对规则包及 artifact，而不是只检查 context 中是否出现几个 source ID。

- [ ] **Step 4: 从现有实现迁移结构表并逐表校验**

将当前 `src/lib/divination.ts` 中卦名、八宫、世应、纳甲干支迁入 `wenwang-najia-v2.ts`，不复制当前派生布尔值。实现顺序固定为：六爻阴阳→上下卦→64 卦→宫与世应→本卦纳甲→完整变卦纳甲→两种六亲参照→潜在伏神候选。

本任务同步修正 V2 契约：删除 `LineFacetV2.growthByPillar`、`PlateLineV2.beast`、`transition.growthIntoChanged`、`HexagramSideV2.harmonyForm` 和 `PlateV2.ruleContextHash`；把 `HiddenSpiritV2/hiddenSpirits` 改为带 `status:'potential'` 的 `HiddenSpiritCandidateV2/hiddenSpiritCandidates`；Plate 仅保存 `{ id, version, artifactHash }` 的 `rulePackRef`。不得用空对象、默认长生或假哈希填补任务顺序。

`buildPlateV2` 的签名不得有隐式时间和 ID：

```ts
export function buildPlateV2(input: {
  plateId: string;
  sessionId: string;
  castAt: string;
  tossValues: readonly [LineValue, LineValue, LineValue, LineValue, LineValue, LineValue];
  ruleContext: RuleContext;
}): PlateV2;
```

- [ ] **Step 5: 加入三组独立验证**

1. `golden-hexagrams.ts` 明列 64 卦的上下卦、宫、世应与游归魂；六合/六冲不进入结构盘，爻支关系归 Task 4 facts，卦级分类归 Task 5 facts。
2. `golden-najia.ts` 明列 64×6 的本卦纳甲，并抽取 16 个动变用例验证 `relationToBasePalace/relationToOwnPalace`。
3. 八宫各至少一个潜在伏神用例，验证宿主行、来源爻位、六亲、来源首卦和 `status:'potential'`；何时启用留给 Task 7。
4. 穷举 4096 组投币并验证本变卦组合唯一、仅动爻翻转、静爻仍按完整变卦重新装甲；加入乾六动变坤，防止两种六亲参照被同宫样例掩盖。

- [ ] **Step 6: 验证**

Run: `cmd /c npx vitest run src/domain/liuyao/plate.test.ts && npm run build:domain && npm run typecheck`
Expected: 全部 PASS；4096 循环无随机差异；规则审查文档不存在空字段；Plate JSON 不存在长生、六神、六合/六冲或 context hash 占位。

- [ ] **Step 7: 提交**

```bash
git add src/domain/liuyao docs/domain/wenwang-najia-v2-review.md
git commit -m "feat(domain): 构建受审本变卦与完整纳甲盘"
```

---

### Task 4: 建立稳定事实图与基础生克冲合刑害破

**Files:**
- Create: `src/domain/liuyao/facts/model.ts`
- Create: `src/domain/liuyao/facts/element-relations.ts`
- Create: `src/domain/liuyao/facts/branch-relations.ts`
- Create: `src/domain/liuyao/facts/relation-core-v1.ts`
- Create: `src/domain/liuyao/facts/relation-registry.ts`
- Create: `src/domain/liuyao/facts/derive.ts`
- Create: `src/domain/liuyao/facts/derive.test.ts`
- Create: `docs/domain/relation-core-v1-review.md`
- Create: `docs/domain/reviews/relation-core-v1-review-a.md`
- Create: `docs/domain/reviews/relation-core-v1-review-b.md`
- Create: `scripts/review-relation-candidate.mjs`
- Modify: `src/domain/liuyao/rules/model.ts`
- Modify: `src/domain/liuyao/rules/default-context.ts`
- Modify: `src/domain/liuyao/rules/registry.ts`
- Modify: `src/domain/liuyao/plate.test.ts`
- Modify: `src/domain/liuyao/index.ts`

**Interfaces:**
- Consumes: `PlateV2`、`RuleContext`、Task 3 已冻结的五行 `generates/controls` 原语。
- Produces: 独立受审的 `relation_core_v1` artifact/manifest、`deriveFacts({ plate, ruleContext, useGod? }): readonly DerivedFact[]`、稳定 `createFactId`。

**执行前决议：**

- Task 3 的 `wenwang_najia_v2` canonical payload/hash 已完成双审，Task 4 不得修改它。关系表使用独立 artifact；其中以 `dependsOnWenwangArtifactHash` 绑定五行原语，避免复制第二份五行真值。
- 六合、六冲为 `structural + computed`；六害为来源特定的 `profile-dependent + computed`；六破、三刑存在来源分歧，固定为 `profile-dependent + disputed`。
- 默认破只取两份来源共同的子酉、丑辰、卯午、未戌四对；默认刑为有向核心 `寅→巳→申`、`丑→戌→未` 的前两段、`子↔卯` 与辰午酉亥自刑，不补 `申→寅`、`未→丑`。
- `RuleContext.sources` 扩为各启用 bundle 来源并集；Task 3 Plate gate 改为核验自己 7 个必需来源的完整子集并允许其他已登记来源，仍拒绝重复 ID 或同 ID 伪造内容。

- [ ] **Step 1: 写矩阵和事实 ID 红灯测试**

```ts
it('covers the exact directional 5x5 element matrix', () => {
  const matrix = ELEMENTS.flatMap((source) => ELEMENTS.map((target) => elementRelation(source, target)));
  expect(matrix.filter((value) => value === 'same-element')).toHaveLength(5);
  expect(matrix.filter((value) => value === 'generates')).toHaveLength(5);
  expect(matrix.filter((value) => value === 'controls')).toHaveLength(5);
  expect(matrix.filter((value) => value === null)).toHaveLength(10);
});

it('keeps overlapping branch matches and their authority metadata', () => {
  expect(branchRelationMatches('寅', '亥', DEFAULT_RULE_CONTEXT.relationProfile))
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ relation: 'combines', authority: 'structural', certainty: 'computed' }),
      expect.objectContaining({ relation: 'breaks', authority: 'profile-dependent', certainty: 'disputed' }),
    ]));
  expect(branchRelationMatches('寅', '巳', DEFAULT_RULE_CONTEXT.relationProfile))
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ relation: 'harms' }),
      expect.objectContaining({ relation: 'punishes', direction: 'forward', certainty: 'disputed' }),
    ]));
});

it('keeps fact ids and ordering stable', () => {
  const first = deriveFacts({ plate: FIXTURE_PLATE, ruleContext: DEFAULT_RULE_CONTEXT });
  const second = deriveFacts({ plate: structuredClone(FIXTURE_PLATE), ruleContext: DEFAULT_RULE_CONTEXT });
  expect(first).toEqual(second);
  expect(new Set(first.map((fact) => fact.id)).size).toBe(first.length);
  expect(first.map((fact) => fact.id)).toEqual([...first.map((fact) => fact.id)].sort());
});
```

- [ ] **Step 2: 运行红灯**

Run: `cmd /c npx vitest run src/domain/liuyao/facts/derive.test.ts`
Expected: FAIL，facts 模块不存在。

- [ ] **Step 3: 冻结独立关系 artifact 并完成双审**

`relation-core-v1.ts` 的 canonical artifact 覆盖：Task 3 artifact 依赖 hash、六合/六冲/六害表、两套六破来源表及默认交集 profile、有向三刑来源表及默认 profile、每条规则的 authority/certainty/sourceRefs/version。不得把这些表加入 `WENWANG_NAJIA_V2_ARTIFACT`。

`RuleContext.relationProfile` 增加：

```ts
bundle: { id: 'relation_core_v1'; version: '1.0.0'; artifactHash: string };
harmPolicy: 'liuren-six-harms-v1';
breakPolicy: 'cross-source-common-four-breaks-v1';
punishmentPolicy: 'liuren-directional-core-v1';
```

来源至少逐项登记《增删卜易》五行生、克、六合、六冲，以及《六壬大全》害/破/刑和《五行精纪》四破的固定定位。先形成 `fixture-only` 候选和 SHA-256，再让两个互不读取结果的独立审阅者针对最终同一 artifactHash 核表；只允许记为 `independent-automated + project-enabled`，不得冒充人工。审阅报告、输入 sourceRefs、checkedClaims 和差异必须提交并绑定 manifest。

- [ ] **Step 4: 实现表驱动关系与稳定 ID**

`element-relations.ts` 从 Task 3 artifact 复用 `generates/controls`，只返回 `generates/controls/same-element/null`；方向由入参顺序表达。`branch-relations.ts` 返回带 `relation/ruleId/profileId/authority/certainty/sourceRefs/direction` 的所有匹配，不使用 `if/else` 覆盖多重命中。

```ts
export function createFactId(parts: readonly string[]): string {
  return ['fact', ...parts.map((part) => part.trim().toLowerCase().replaceAll(/\s+/g, '-'))].join(':');
}

export function stableFacts(facts: readonly DerivedFact[]): readonly DerivedFact[] {
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  if (byId.size !== facts.length) throw new Error('派生事实 ID 冲突');
  return Object.freeze([...byId.values()].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}
```

- [ ] **Step 5: 覆盖所有实体对但控制噪声**

比较对固定为：四柱地支→本卦六爻 24 对；本卦六爻中只比较“至少一端为动爻”的无序对；每个动爻再比较本位 `changed→base`。动爻数 `m=0..6` 时，本卦爻对数必须依次为 `0,5,9,12,14,15,15`，总比较对为 `24,30,35,39,42,44,45`。不生成静爻—静爻、四柱—变卦、化爻—非本位爻，也不重复 A→B/B→A 的对称关系。

四柱关系只用 `CalendarPillar.branch.element/branch.value`，不得误用天干。对每个实体对检查正反五行方向：若柱水克爻火，fact source 是柱；若爻木克柱土，fact source 是爻。transition 原始关系固定 `changed→base`。每条 fact 写入版本化 `ruleId/profileId/authority/certainty/sourceRefs`，不写吉凶文案。

- [ ] **Step 6: 加入完整矩阵、门禁与稳定性测试**

测试 12×12 矩阵：六合/六冲对称且 structural；六害对称但 profile-dependent；默认四破只命中四对并标 disputed；三刑按有向表输出，子卯双向、四自刑，不强行补全循环。专测寅亥、巳申、寅巳、辰辰多关系。测试 `m=0..6` 比较对公式、柱支而非柱干、transition 方向、深克隆/输入遍历顺序后的 fact ID 与顺序稳定、重复 ID 抛错、bundle hash/source 门禁失败。

关系 bundle 启用后，更新 `DEFAULT_RULE_CONTEXT.sources` 为两包来源并集；Plate gate 对自己的来源做子集核验，`buildPlateV2(DEFAULT_RULE_CONTEXT)` 继续通过，缺失或伪造 Task 3 必需来源仍拒绝。

- [ ] **Step 7: 验证与提交**

Run: `cmd /c npx vitest run src/domain/liuyao/facts/derive.test.ts src/domain/liuyao/plate.test.ts && npm run build:domain && npm run typecheck`
Expected: PASS；关系 artifact/review/hash 可独立复算，Task 3 artifactHash 完全不变。

```bash
git add src/domain/liuyao docs/domain/relation-core-v1-review.md docs/domain/reviews/relation-core-v1-review-a.md docs/domain/reviews/relation-core-v1-review-b.md scripts/review-relation-candidate.mjs
git commit -m "feat(domain): 建立可追溯六爻关系事实图"
```

---

### Task 5: 派生日月旺衰、动变与卦局条件事实

**Files:**
- Create: `src/domain/liuyao/facts/calendar-effects.ts`
- Create: `src/domain/liuyao/facts/calendar-effects.test.ts`
- Create: `src/domain/liuyao/facts/moving-effects.ts`
- Create: `src/domain/liuyao/facts/moving-effects.test.ts`
- Create: `src/domain/liuyao/facts/formations.ts`
- Create: `src/domain/liuyao/facts/formations.test.ts`
- Modify: `src/domain/liuyao/facts/derive.ts`
- Modify: `src/domain/liuyao/rules/registry.ts`

**Interfaces:**
- Consumes: `PlateV2`、四柱、基础关系 facts。
- Produces: 月破、旬空、日冲、暗动/日破、回头生克冲合、进退、墓绝、三合、六合六冲、反吟伏吟 facts。

- [ ] **Step 1: 写“日冲不等于一律日破”的红灯测试**

```ts
it('records raw clash and classifies dark-moving/day-break only with strength conditions', () => {
  const strong = deriveCalendarEffects(strongStaticLineFixture(), CALENDAR, DEFAULT_RULE_CONTEXT);
  expect(strong.map((fact) => fact.relation)).toContain('is-dark-moving');
  expect(strong.map((fact) => fact.relation)).not.toContain('is-day-break');

  const weak = deriveCalendarEffects(weakStaticLineFixture(), CALENDAR, DEFAULT_RULE_CONTEXT);
  expect(weak.map((fact) => fact.relation)).toContain('is-day-break');
  expect(weak.find((fact) => fact.relation === 'is-day-break')?.certainty).toBe('conditional');
});
```

fixture 明确给出月令、日辰、生扶/克制和动静输入，不由被测函数反推 expected。

- [ ] **Step 2: 写动化与卦局红灯测试**

```ts
it.each([
  ['木', '水', 'returns-generate'],
  ['木', '金', 'returns-control'],
])('classifies changed line relation', (baseElement, changedElement, relation) => {
  expect(deriveMovingEffects(movingFixture(baseElement, changedElement), DEFAULT_RULE_CONTEXT))
    .toEqual(expect.arrayContaining([expect.objectContaining({ relation })]));
});

it('does not form a three-harmony fact without the configured completion conditions', () => {
  expect(deriveFormations(incompleteThreeHarmonyPlate(), DEFAULT_RULE_CONTEXT))
    .not.toEqual(expect.arrayContaining([expect.objectContaining({ relation: 'forms-three-harmony' })]));
});
```

- [ ] **Step 3: 运行红灯**

Run: `cmd /c npx vitest run src/domain/liuyao/facts/calendar-effects.test.ts src/domain/liuyao/facts/moving-effects.test.ts src/domain/liuyao/facts/formations.test.ts`
Expected: FAIL，三个模块不存在。

- [ ] **Step 4: 分离原始事实与条件分类**

`clashes` 是 structural fact；`is-dark-moving/is-day-break` 是 `profile-dependent + conditional`。`is-void` 只使用日柱旬空。月柱、年柱、时柱旬空仍在 `CalendarPillar` 展示，但不自动变成核心空亡 fact。

`moving-effects.ts` 只处理动爻；静爻 `transition === null` 时返回空数组。进退、化墓绝以受审表和 profile 计算，不用字符串包含判断。

`formations.ts` 对三合、六合六冲、反吟伏吟分别产出 facts；六合/六冲静态分类表在本任务登记，不回写 `HexagramSideV2`。“形成某结构”和“该结构对本占吉凶”分开。

- [ ] **Step 5: 加入来源和条件断言**

```ts
expect(fact).toMatchObject({
  authority: 'profile-dependent',
  profileId: 'yehe_core_v1',
  certainty: 'conditional',
});
expect(fact.ruleId).not.toBe('');
expect(fact.sourceRefs.length).toBeGreaterThan(0);
```

- [ ] **Step 6: 验证与提交**

Run: `cmd /c npx vitest run src/domain/liuyao/facts && npm run typecheck`
Expected: PASS。

```bash
git add src/domain/liuyao
git commit -m "feat(domain): 派生日月动变与卦局条件事实"
```

---

### Task 6: 完整十二长生与受限神煞

**Files:**
- Create: `src/domain/liuyao/facts/growth-shensha.ts`
- Create: `src/domain/liuyao/facts/growth-shensha.test.ts`
- Modify: `src/domain/liuyao/facts/derive.ts`
- Modify: `src/domain/liuyao/rules/tables.ts`
- Modify: `src/domain/liuyao/rules/registry.ts`

**Interfaces:**
- Consumes: 爻五行、四柱地支、动爻化支、`growthProfile/shenShaProfile`。
- Produces: 全部 `is-growth-stage`、动爻化支长生、`is-six-beast` 与 `is-shen-sha` facts；不修改结构 Plate。

- [ ] **Step 1: 写五行×十二支轮转红灯测试**

```ts
it.each([
  ['木', '亥', '长生'],
  ['木', '卯', '帝旺'],
  ['木', '未', '墓'],
  ['木', '申', '绝'],
  ['金', '巳', '长生'],
  ['水', '申', '长生'],
  ['土', '申', '长生'],
])('%s at %s is %s under the default profile', (element, branch, expected) => {
  expect(twelveStage(element, branch, DEFAULT_RULE_CONTEXT.growthProfile)).toBe(expected);
});

it('covers exactly twelve distinct stages for every element', () => {
  for (const element of ELEMENTS) {
    expect(new Set(BRANCHES.map((branch) => twelveStage(element, branch, GROWTH_PROFILE))).size).toBe(12);
  }
});
```

- [ ] **Step 2: 写神煞权限红灯测试**

```ts
it('emits only the configured four shen-sha as secondary facts', () => {
  const facts = deriveShenSha(SHEN_SHA_FIXTURE, DEFAULT_RULE_CONTEXT);
  expect(new Set(facts.map((fact) => fact.values.shenShaId)))
    .toEqual(new Set(['tianyi', 'lushen', 'yima', 'tianxi']));
  expect(facts.every((fact) => fact.authority === 'secondary')).toBe(true);
});

it('emits one six-beast fact per base line from the day stem', () => {
  const facts = deriveSixBeasts(SHEN_SHA_FIXTURE.plate, DEFAULT_RULE_CONTEXT);
  expect(facts).toHaveLength(6);
  expect(facts.every((fact) => fact.relation === 'is-six-beast')).toBe(true);
  expect(facts.every((fact) => fact.authority === 'secondary')).toBe(true);
});
```

- [ ] **Step 3: 运行红灯**

Run: `cmd /c npx vitest run src/domain/liuyao/facts/growth-shensha.test.ts`
Expected: FAIL。

- [ ] **Step 4: 实现完整展示、有限解释**

`twelveStage` 完整返回 12 阶段；`is-growth-stage` facts 全部可供 UI 展示。默认 profile 只给长生、帝旺、墓、绝写入 `values.interpretationWeight = 'primary'`，其余写 `'display-only'`。这体现来源差异，不删除用户要求的十二长生。

固定输出本卦六爻和变卦六爻分别对年/月/日/时四柱的 48 条长生 facts；每个动爻另输出一条 `scope='transition'` 的化支长生 fact。六神按日干起例输出 6 条 `is-six-beast` facts，和神煞同属辅助层，但使用不同 relation，不能混成神煞或写入 Plate。

神煞规则按 profile 的 `enabled` 逐项计算，未启用项不运行。神煞 fact 的 `scope='auxiliary'`、`authority='secondary'`、`certainty='conditional'` 固定不可覆盖。

- [ ] **Step 5: 验证与提交**

Run: `cmd /c npx vitest run src/domain/liuyao/facts/growth-shensha.test.ts src/domain/liuyao/plate.test.ts && npm run typecheck`
Expected: PASS；固定盘有 48 条本变四柱长生 facts、每个动爻 1 条 transition 长生 fact、6 条六神 facts，Plate 无这些派生字段。

```bash
git add src/domain/liuyao
git commit -m "feat(domain): 展示十二长生并约束辅助神煞"
```

---

### Task 7: 以明确问意选择具体用神并派生元忌仇

**Files:**
- Create: `src/domain/liuyao/use-god.ts`
- Create: `src/domain/liuyao/use-god.test.ts`
- Create: `src/domain/liuyao/facts/use-god-effects.ts`
- Create: `src/domain/liuyao/facts/use-god-effects.test.ts`
- Modify: `src/domain/liuyao/facts/derive.ts`
- Modify: `src/domain/liuyao/rules/registry.ts`
- Modify: `src/domain/liuyao/index.ts`

**Interfaces:**
- Consumes: `resolveUseGod({ question, category, explicitIntentId, plate, ruleContext })`。
- Produces: `UseGodSelection`；只有 `resolved` 时才派生元神、忌神、仇神 facts。

- [ ] **Step 1: 写“学业功名不是用神”的红灯测试**

```ts
it('asks for clarification instead of returning 学业功名 as a use god', () => {
  const selection = resolveUseGod({
    question: '今年学业功名如何？',
    category: 'study',
    explicitIntentId: null,
    plate: STUDY_PLATE,
    ruleContext: DEFAULT_RULE_CONTEXT,
  });
  expect(selection.status).toBe('needs-user-input');
  expect(selection.primary).toBeNull();
  expect(selection.clarification?.options).toEqual([
    { intentId: 'study.learning-or-documents', label: '学习过程、课程或文书' },
    { intentId: 'study.exam-rank-or-admission', label: '考试名次、录取或功名' },
  ]);
  expect(JSON.stringify(selection)).not.toContain('"relation":"学业功名"');
});

it.each([
  ['study.learning-or-documents', '父母'],
  ['study.exam-rank-or-admission', '官鬼'],
])('maps explicit study intent %s to six-relation %s', (intentId, relation) => {
  const selection = resolveUseGod({
    question: '今年学习与考试如何？',
    category: 'study',
    explicitIntentId: intentId,
    plate: singleCandidatePlate(relation),
    ruleContext: DEFAULT_RULE_CONTEXT,
  });
  expect(selection.status).toBe('resolved');
  expect(selection.primary).toMatchObject({
    relation,
    entity: { type: 'line' },
  });
});
```

- [ ] **Step 2: 写明现、伏藏、多现测试**

```ts
it('uses a reviewed hidden spirit only when the target relation is absent from visible lines', () => {
  const selection = resolveUseGod(useGodFixture({ visible: [], hidden: ['妻财'] }));
  expect(selection.primary?.entity.type).toBe('hidden-spirit');
});

it('retains multiple candidates instead of letting AI silently choose', () => {
  const selection = resolveUseGod(useGodFixture({ visible: ['官鬼', '官鬼'], hidden: [] }));
  expect(selection.status).toBe('ambiguous');
  expect(selection.primary).toBeNull();
  expect(selection.candidates).toHaveLength(2);
});
```

- [ ] **Step 3: 运行红灯**

Run: `cmd /c npx vitest run src/domain/liuyao/use-god.test.ts src/domain/liuyao/facts/use-god-effects.test.ts`
Expected: FAIL。

- [ ] **Step 4: 实现先问意、后六亲、再具体爻**

`use-god.ts` 使用显式表，不返回自由文本 focus：

```ts
const INTENT_RULES = {
  'study.learning-or-documents': {
    primaryRelation: '父母',
    relatedRelations: ['官鬼'],
    ruleIds: ['use-god:study-documents:v1'],
  },
  'study.exam-rank-or-admission': {
    primaryRelation: '官鬼',
    relatedRelations: ['父母'],
    ruleIds: ['use-god:study-rank:v1'],
  },
  'career.rank-or-office': {
    primaryRelation: '官鬼',
    relatedRelations: ['父母'],
    ruleIds: ['use-god:career-office:v1'],
  },
  'wealth.income-or-asset': {
    primaryRelation: '妻财',
    relatedRelations: ['子孙', '兄弟'],
    ruleIds: ['use-god:wealth:v1'],
  },
} as const;
```

`study` 没有 `explicitIntentId` 时必须澄清。明爻候选先于伏神；只有一个候选才 `resolved`；多个候选在没有已受审“两现”规则时 `ambiguous`。候选评分固定为明爻 100、伏神 50，只表达可见性优先级，不被包装成旺衰吉凶。

- [ ] **Step 5: 派生元神、忌神、仇神**

`use-god-effects.ts` 根据已选用神元素建立：

- 生用神者 → `is-source-spirit`；
- 克用神者 → `is-avoid-spirit`；
- 生忌神且克元神者 → `is-enemy-spirit`；
- 飞神与伏神 → `flying-generates-hidden/flying-controls-hidden`。

`needs-user-input/ambiguous` 不产出元忌仇事实，避免对多个候选混算。

- [ ] **Step 6: 验证与提交**

Run: `cmd /c npx vitest run src/domain/liuyao/use-god.test.ts src/domain/liuyao/facts && npm run typecheck`
Expected: PASS；任何 `UseGodSelection.primary` 都指向具体 line 或 hidden-spirit。

```bash
git add src/domain/liuyao
git commit -m "feat(domain): 按问意选择具体用神与元忌仇"
```

---

### Task 8: 组装 DivinationCaseV2、稳定哈希与旧对象纯迁移

**Files:**
- Create: `src/domain/liuyao/canonical.ts`
- Create: `src/domain/liuyao/canonical.test.ts`
- Create: `src/domain/liuyao/case.ts`
- Create: `src/domain/liuyao/case.test.ts`
- Create: `src/domain/liuyao/legacy.ts`
- Create: `src/domain/liuyao/legacy.test.ts`
- Modify: `src/domain/liuyao/index.ts`
- Modify: `src/lib/session.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: `buildDivinationCase(input, ports)`，其中时间、ID 和 SHA-256 均显式注入。
- Produces: `DivinationCaseV2`、`ruleContextHash`、`factSetHash`、`migrateLegacySession(legacy, input): LegacyMigrationResult`。

- [ ] **Step 1: 写纯度、哈希与深冻结红灯测试**

```ts
const input = {
  sessionId: 'session-fixed',
  plateId: 'plate-fixed',
  question: '这次考试能否录取？',
  category: 'study',
  explicitIntentId: 'study.exam-rank-or-admission',
  castAt: '2026-07-11T04:00:00.000Z',
  builtAt: '2026-07-12T00:00:00.000Z',
  tossValues: [9, 7, 7, 7, 7, 7],
  ruleContext: DEFAULT_RULE_CONTEXT,
} as const;

it('is deeply deterministic for the same input and hash port', () => {
  const first = buildDivinationCase(input, { sha256: TEST_SHA256 });
  const second = buildDivinationCase(structuredClone(input), { sha256: TEST_SHA256 });
  expect(first).toEqual(second);
  expect(first.ruleContextHash).toBe(second.ruleContextHash);
  expect(first.factSetHash).toBe(second.factSetHash);
  expect(Object.isFrozen(first.facts)).toBe(true);
});

it('changes hash when a profile changes but not when builtAt changes', () => {
  const base = buildDivinationCase(input, { sha256: TEST_SHA256 });
  const rebuiltLater = buildDivinationCase(
    { ...input, builtAt: '2026-07-13T00:00:00.000Z' },
    { sha256: TEST_SHA256 },
  );
  const changedProfile = buildDivinationCase(
    { ...input, ruleContext: OTHER_DAY_BOUNDARY_CONTEXT },
    { sha256: TEST_SHA256 },
  );
  expect(rebuiltLater.factSetHash).toBe(base.factSetHash);
  expect(rebuiltLater.ruleContextHash).toBe(base.ruleContextHash);
  expect(changedProfile.ruleContextHash).not.toBe(base.ruleContextHash);
  expect(changedProfile.factSetHash).not.toBe(base.factSetHash);
});
```

- [ ] **Step 2: 写 legacy 迁移红灯测试**

```ts
it('rebuilds completed legacy data from six confirmed tosses, never from legacy plate booleans', () => {
  const legacy = legacySessionFixture({
    tossValues: [9, 7, 7, 7, 7, 7],
    forgedPlateName: '坤为地',
  });
  const result = migrateLegacySession(legacy, MIGRATION_INPUT);
  expect(result.state).toBe('migrated');
  expect(result.session.caseSnapshot?.plate.baseHexagram.name).toBe('乾为天');
  expect(result.audit.legacyDifferences).toContain('baseHexagram.name');
  expect(result.session.analysis?.validation.status).toBe('legacy-unverified');
});

it('does not overwrite a conflicting legacy session', () => {
  const result = migrateLegacySession(irreconcilableLegacyFixture(), MIGRATION_INPUT);
  expect(result.state).toBe('needs-review');
  expect(result.original).toEqual(irreconcilableLegacyFixture());
});
```

- [ ] **Step 3: 运行红灯**

Run: `cmd /c npx vitest run src/domain/liuyao/canonical.test.ts src/domain/liuyao/case.test.ts src/domain/liuyao/legacy.test.ts`
Expected: FAIL。

- [ ] **Step 4: 实现稳定序列化和注入式哈希**

`canonical.ts` 对对象键递归排序、数组保持领域顺序、拒绝 `undefined/NaN/Infinity/Date/function`。领域内核不导入 `node:crypto`：

```ts
export interface HashPort {
  sha256(value: string): string;
}

export function hashCasePayload(payload: unknown, port: HashPort): string {
  return port.sha256(canonicalStringify(payload));
}
```

先单独计算 `ruleContextHash = sha256(canonicalStringify(ruleContext))` 并写入 `DivinationCaseV2`。`factSetHash` payload 包含 question、intent、tosses、castAt、RuleContext、PlateV2、UseGodSelection、facts；明确排除 `builtAt` 和旧 analysis。两个哈希都不写入结构 Plate。

- [ ] **Step 5: 实现 Case 编排和 legacy 纯迁移**

`buildDivinationCase` 的固定顺序：验证输入→buildPlateV2→resolveUseGod→deriveFacts→canonical hash→深冻结。`legacy.ts` 只转换对象，不读写文件；通过六个 `TossRecord.value` 重建，不读取旧 plate 的派生字段。

`DivinationSession` 增加：

```ts
caseSnapshot?: DivinationCaseV2;
ruleContext?: RuleContext;
migrationVersion?: 2;
migrationState?: 'clean' | 'needs-review';
```

旧 analysis 联合类型增加 `legacy-unverified`，禁止类型上伪装成 validated V2。

- [ ] **Step 6: 验证与提交**

Run: `cmd /c npx vitest run src/domain/liuyao && npm run build:domain && npm run typecheck`
Expected: PASS；重复 100 次构建深值相同。

```bash
git add src/domain/liuyao src/lib/session.ts src/lib/types.ts
git commit -m "feat(domain): 组装可哈希卦例并纯迁移旧会话"
```

---

### Task 9: 把排盘、检索与会话写入收口到主进程

**Files:**
- Create: `electron/services/reading-service.cjs`
- Create: `electron/services/reading-service.test.cjs`
- Create: `electron/services/migration.cjs`
- Create: `electron/services/migration.test.cjs`
- Modify: `electron/services/store.cjs`
- Modify: `electron/services/store.test.cjs`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/types/desktop.d.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.confirm.test.tsx`

**Interfaces:**
- Consumes: `sessionId`、可选 `intentId`、追问文本；主进程内部依赖 store、domain、retrieval、AI。
- Produces: `reading.buildCase`、`reading.selectIntent`、`reading.analyze`、`reading.followUp`。

- [ ] **Step 1: 写伪造 renderer 数据不被信任的红灯测试**

```js
test('buildCase ignores renderer plate, facts, evidence and validation', async () => {
  const store = fixtureStore(completedSession());
  const service = createReadingService(fixturePorts({ store }));
  const actual = await service.buildCase({
    sessionId: 'session-1',
    plate: { baseHexagram: { name: '伪造卦' } },
    facts: [{ id: 'fake' }],
    evidence: [{ id: 'fake' }],
    validation: { status: 'validated' },
  });
  assert.equal(actual.plate.baseHexagram.name, '乾为天');
  assert.equal(actual.facts.some((fact) => fact.id === 'fake'), false);
});
```

再测试：

```js
test('renderer session save cannot overwrite authoritative case or analysis', () => {
  const store = seededJsonStore(validatedSession());
  store.saveRendererSession({
    ...store.getSession('session-1'),
    caseSnapshot: { factSetHash: 'fake' },
    analysis: { validation: { status: 'validated' } },
  });
  assert.notEqual(store.getSession('session-1').caseSnapshot.factSetHash, 'fake');
});
```

- [ ] **Step 2: 写文件备份和幂等迁移红灯测试**

测试临时目录中的 `app-data.json`：第一次迁移创建一个备份并写 `migrationVersion:2`；第二次运行不再创建备份且结果深值相同；模拟写入失败后原文件字节不变。

- [ ] **Step 3: 运行红灯**

Run: `cmd /c npm run build:domain && node --test electron/services/reading-service.test.cjs electron/services/migration.test.cjs electron/services/store.test.cjs`
Expected: FAIL，reading service 和 migration 不存在。

- [ ] **Step 4: 实现依赖注入的 ReadingService**

`reading-service.cjs` 动态加载同一领域产物，并注入生产 SHA-256：

```js
const crypto = require('node:crypto');
const domainPromise = import('../generated/domain/index.js');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createReadingService({ store, searchCorpus, analyze, followUp, now }) {
  async function buildCase({ sessionId, intentId }) {
    const domain = await domainPromise;
    const session = store.getSession(sessionId);
    if (!session) throw new Error('会话不存在');
    const caseSnapshot = domain.buildDivinationCase(
      caseInputFromSession(session, intentId, now()),
      { sha256 },
    );
    store.saveAuthoritativeCase(sessionId, caseSnapshot);
    return structuredClone(caseSnapshot);
  }
  return { buildCase };
}
```

测试通过工厂参数传 fake domain/clock/search/AI，不触网、不读真实用户目录。

- [ ] **Step 5: 收窄 Store 与 IPC**

`JsonStore` 分成：

- `saveRendererSession`：只允许 question/category/tosses/currentToss/messages 等用户与交互字段；保留已有 authoritative fields；
- `saveAuthoritativeCase`、`saveAuthoritativeAnalysis`：仅主进程服务调用；
- `replaceAllAfterMigration`：只接受已备份且验证通过的数据。

`preload.cjs` 暴露：

```js
reading: {
  buildCase: ({ sessionId, intentId }) => ipcRenderer.invoke('reading:build-case', { sessionId, intentId }),
  analyze: ({ sessionId }) => ipcRenderer.invoke('reading:analyze', { sessionId }),
  followUp: ({ sessionId, question }) => ipcRenderer.invoke('reading:follow-up', { sessionId, question }),
}
```

`main.cjs` 对 payload 只提取 allowlist 字段。删除 `ai:analyze` 接收 plate/evidence 的路径，但在 Task 10 完成前保留内部 AI 函数调用适配。

- [ ] **Step 6: 调整 App 的完成路径**

第六爻确认后仍由当前原子状态机完成 session 保存；随后调用 `reading.buildCase({ sessionId })`，用主进程返回快照替换本地只读视图。App 不再调用渲染端 `buildPlate` 作为权威结果。

- [ ] **Step 7: 验证与提交**

Run: `cmd /c npm run test:electron && npx vitest run src/App.confirm.test.tsx && npm run typecheck`
Expected: PASS；伪造字段测试被主进程忽略；第六爻仍只生成一次 case。

```bash
git add electron src/types/desktop.d.ts src/App.tsx src/App.confirm.test.tsx
git commit -m "feat(electron): 主进程权威重建排盘与事实"
```

---

### Task 10: 重写 AI 事实契约、逐条引用校验与本地报告

**Files:**
- Modify: `electron/services/ai.cjs`
- Modify: `electron/services/ai.test.cjs`
- Modify: `electron/services/reading-service.cjs`
- Modify: `electron/services/reading-service.test.cjs`
- Modify: `src/lib/types.ts`
- Delete: `src/lib/localAnalysis.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `analyzeCloudV2({ caseSnapshot, evidence, ... })`、`validateAnalysisReportV2(raw, contract, evidence, validatedAt)`。
- Produces: `AnalysisReportV2`；每条 claim 引用 fact/rule/evidence；`validation` 只能由 validator 创建。

- [ ] **Step 1: 写伪造事实与古例干支泄漏红灯测试**

```js
test('rejects fabricated fact and rule ids', () => {
  const raw = validRawReport();
  raw.claims[0].factIds = ['fact:fake'];
  raw.claims[0].ruleIds = ['rule:fake'];
  assert.throws(
    () => validateAnalysisReportV2(raw, FACT_CONTRACT, EVIDENCE, VALIDATED_AT),
    /事实|规则/,
  );
});

test('an old case stem-branch in evidence cannot masquerade as a current-case fact', () => {
  const evidence = [{ ...EVIDENCE[0], text: '旧例为甲子日。' }];
  const raw = validRawReport();
  raw.claims[0].text = '本卦甲子日，官鬼得令。';
  assert.throws(
    () => validateAnalysisReportV2(raw, FACT_CONTRACT, evidence, VALIDATED_AT),
    /当前排盘事实/,
  );
});

test('model cannot self-assert validation flags', () => {
  const raw = { ...validRawReport(), validation: { factCheckPassed: true } };
  assert.throws(
    () => validateAnalysisReportV2(raw, FACT_CONTRACT, EVIDENCE, VALIDATED_AT),
    /额外字段/,
  );
});
```

- [ ] **Step 2: 写“用神必须引用 UseGodSelection”的红灯测试**

用神 claim 引用 `fact:line:...` 和 `use-god:...` 规则才能通过；`caseSnapshot.useGod.status !== 'resolved'` 时禁止模型声称“以某爻为用神”，报告只能产生澄清 claim。

- [ ] **Step 3: 运行红灯**

Run: `cmd /c node --test electron/services/ai.test.cjs electron/services/reading-service.test.cjs`
Expected: FAIL。

- [ ] **Step 4: 用 claim 数组替换自由段落**

严格 JSON schema：

```js
const REPORT_V2_SCHEMA = {
  name: 'liuyao_analysis_report_v2',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      schemaVersion: { const: '2.0.0' },
      caseHash: { type: 'string' },
      claims: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            section: { enum: ['summary', 'use-god', 'calendar', 'moving', 'synthesis', 'guidance'] },
            text: { type: 'string' },
            factIds: { type: 'array', items: { type: 'string' } },
            ruleIds: { type: 'array', items: { type: 'string' } },
            evidenceIds: { type: 'array', items: { type: 'string' } },
            confidence: { enum: ['high', 'medium', 'low'] }
          },
          required: ['id', 'section', 'text', 'factIds', 'ruleIds', 'evidenceIds', 'confidence']
        }
      },
      uncertainties: { type: 'array', items: { type: 'string' } }
    },
    required: ['schemaVersion', 'caseHash', 'claims', 'uncertainties']
  }
};
```

模型不能输出 `validation/generatedAt`。validator 建立有效 ID 集合，逐 claim 校验；当前卦词元只允许来自该 claim 引用 facts 的结构化 values，不再合并 evidence 的干支。

- [ ] **Step 5: 本地报告使用同一事实图**

实现 `createLocalReportV2(contract, evidence, validatedAt)`，用固定模板把结构化 facts 渲染成 claims。删除 `CATEGORY_FOCUS`、`focusByCategory` 和 `src/lib/localAnalysis.ts`；云端/本地共用 `UseGodSelection`，不再维护两套取用表。

当 `useGod.status='needs-user-input'` 时，本地报告只说明需澄清并回传选项；当 facts 不足时把 claim confidence 设为 low，不写“已完成专业综合判断”。

- [ ] **Step 6: ReadingService 在主进程检索**

检索词由 question、intent、primary/related relations、moving facts 和 rule IDs 生成；renderer 不再先检索再把 evidence 发回。`reading.analyze` 返回 `{ caseSnapshot, report, evidence, retrievalDiagnostics }` 并一次持久化。

- [ ] **Step 7: 验证与提交**

Run: `cmd /c npm run test:electron && npm run test:unit && npm run typecheck`
Expected: PASS；测试中不存在硬编码 `factCheckPassed: true` 的生产路径。

```bash
git add electron src/App.tsx src/lib/types.ts src/lib/localAnalysis.ts
git commit -m "feat(ai): 以事实与证据引用校验专业解卦"
```

---

### Task 11: 重构完整本变卦结果页与五行可访问视觉

**Files:**
- Create: `src/components/result/CaseHeader.tsx`
- Create: `src/components/result/PillarGrid.tsx`
- Create: `src/components/result/ElementText.tsx`
- Create: `src/components/result/HexagramComparison.tsx`
- Create: `src/components/result/FactExplorer.tsx`
- Create: `src/components/result/UseGodPanel.tsx`
- Create: `src/components/result/AnalysisReportV2.tsx`
- Create: `src/components/result/ResultV2.test.tsx`
- Modify: `src/components/ResultScreen.tsx`
- Modify: `src/styles.css`
- Modify: `src/App.tsx`
- Modify: `src/types/desktop.d.ts`

**Interfaces:**
- Consumes: `DivinationCaseV2`、`AnalysisReportV2`、evidence、`onSelectIntent(intentId)`。
- Produces: 五层结果页面；本变六行、四柱旬空、关系事实、用神澄清、claim 引用展开。

- [ ] **Step 1: 写完整页面红灯测试**

```tsx
render(<ResultScreen {...resultProps({ caseSnapshot: COMPLETE_CASE })} />);

expect(screen.getByText(COMPLETE_CASE.question)).toBeInTheDocument();
expect(screen.getByText(/Asia\/Shanghai/)).toBeInTheDocument();
expect(screen.getAllByTestId(/^pillar-/)).toHaveLength(4);
expect(screen.getAllByTestId(/^base-line-/)).toHaveLength(6);
expect(screen.getAllByTestId(/^changed-line-/)).toHaveLength(6);
expect(screen.getByText('十二长生')).toBeInTheDocument();
expect(screen.getByText('辅助神煞')).toBeInTheDocument();
expect(screen.getByText('规则配置 yehe_core_v1')).toBeInTheDocument();
```

- [ ] **Step 2: 写干支分色与非颜色信息红灯测试**

```tsx
render(<ElementText stem="甲" branch="子" />);
expect(screen.getByText('甲')).toHaveAttribute('data-element', '木');
expect(screen.getByText('子')).toHaveAttribute('data-element', '水');
expect(screen.getByLabelText('天干甲，五行木')).toBeInTheDocument();
expect(screen.getByLabelText('地支子，五行水')).toBeInTheDocument();
```

再断言 `UseGodSelection.needs-user-input` 时显示两项澄清按钮，“学业功名”不出现在“已定用神”位置。

- [ ] **Step 3: 运行红灯**

Run: `cmd /c npx vitest run src/components/result/ResultV2.test.tsx`
Expected: FAIL。

- [ ] **Step 4: 实现五层组件**

1. `CaseHeader`：日期、占问、意图、时区、rule pack/profile。
2. `PillarGrid`：四柱各显示干、支、元素、旬、旬空。
3. `HexagramComparison`：领域数组反转为上爻到初爻显示；本/变各六行对齐；变卦静爻也显示；区分 `relationToBasePalace` 与 `relationToOwnPalace` 的标题。通过纯 selector 按 line/hexagram entity 聚合 `is-growth-stage/is-six-beast/is-six-harmony/is-six-clash` facts，不能假设这些字段存在于 Plate。
4. `UseGodPanel`：显示状态、具体候选 line/伏神、取用规则；需澄清时调用 `reading.buildCase({ sessionId, intentId })`。
5. `FactExplorer`：按 structural/profile-dependent/secondary 分组，条件与来源可展开。
6. `AnalysisReportV2`：按 section 排序 claims，每条可展开 fact/rule/evidence。

- [ ] **Step 5: 实现五行令牌与响应式双盘**

`styles.css`：

```css
:root {
  --element-wood: #2f6b45;
  --element-fire: #a63f32;
  --element-earth: #805a2b;
  --element-metal: #5f6670;
  --element-water: #285b8f;
}

[data-element="木"] { color: var(--element-wood); }
[data-element="火"] { color: var(--element-fire); }
[data-element="土"] { color: var(--element-earth); }
[data-element="金"] { color: var(--element-metal); }
[data-element="水"] { color: var(--element-water); }

.hexagram-comparison {
  display: grid;
  grid-template-columns: minmax(44rem, 1fr) minmax(44rem, 1fr);
  overflow-x: auto;
}
```

颜色节点旁显示元素短标签；`conditional/secondary` 有文字徽标。打印媒体保留占问、时间、四柱、本变盘和规则版本。

- [ ] **Step 6: 验证尺寸与键盘交互**

Run: `cmd /c npx vitest run src/components/result/ResultV2.test.tsx && npm run typecheck && npm run build:renderer`
Expected: PASS。随后在 1440×900、1120×720 检查：双盘可读、无覆盖、Tab 可到达每个展开按钮、焦点可见。

- [ ] **Step 7: 提交**

```bash
git add src/components src/styles.css src/App.tsx src/types/desktop.d.ts
git commit -m "feat(result): 完整展示四柱本变卦与关系事实"
```

---

### Task 12: 执行旧会话迁移、删除重复真值并做全链路验收

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/services/store.cjs`
- Modify: `electron/services/migration.cjs`
- Modify: `src/lib/divination.ts`
- Modify: `src/lib/divination.test.ts`
- Modify: `src/lib/session.ts`
- Modify: `src/App.tsx`
- Modify: `docs/acceptance/2026-07-11-final-acceptance.md`
- Create: `docs/acceptance/2026-07-12-professional-engine-acceptance.md`
- Create: `scripts/verify-professional-case.cjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: 完整 V2 领域、主进程服务、结果 UI。
- Produces: 幂等启动迁移、无重复领域真值、`npm run verify:professional-case`、真实 Electron 验收记录。

- [ ] **Step 1: 写启动迁移集成红灯测试**

准备四类临时 `app-data.json`：空库、未完成旧会话、可重建完成会话、冲突完成会话。启动迁移后断言：

- 只在首次发现 legacy 数据时创建一个备份；
- 未完成会话不生成 plate；
- 可重建会话写 V2 case；
- 冲突会话 `needs-review` 且旧 JSON 留存；
- 第二次运行字节级结果一致。

- [ ] **Step 2: 删除旧领域真值前跑依赖搜索**

Run:

```powershell
rg -n "buildPlate|upgradePlate|branchCalendarEffects|CATEGORY_FOCUS|focusByCategory|factCheckPassed:\s*true|citationCheckPassed:\s*true" src electron
```

Expected: 只剩待迁移 import、测试断言和 V2 validator 生成 validation 的位置。逐个迁移调用方后再删除 `src/lib/divination.ts` 中旧卦名、纳甲、日月布尔派生；保留铜钱 `createToss/randomToss` 时将它们转发到领域模块，不复制规则表。

- [ ] **Step 3: 增加无重复真值守卫**

`src/lib/divination.test.ts` 改为验证兼容导出指向 V2；`scripts/verify-professional-case.cjs` 构建固定 case 并断言：

```js
assert.equal(result.caseSnapshot.schemaVersion, '2.0.0');
assert.equal(result.caseSnapshot.plate.lines.length, 6);
assert.equal(Object.keys(result.caseSnapshot.plate.calendar.pillars).length, 4);
assert.ok(result.caseSnapshot.facts.every((fact) => fact.id && fact.ruleId));
assert.ok(result.report.claims.every(
  (claim) => claim.section === 'guidance' || claim.factIds.length > 0,
));
```

`package.json` 增加：

```json
{
  "scripts": {
    "verify:professional-case": "npm run build:domain && electron scripts/verify-professional-case.cjs"
  }
}
```

- [ ] **Step 4: 跑完整自动化门**

Run:

```powershell
cmd /c npm test
cmd /c npm run typecheck
cmd /c npm run build
cmd /c npm run verify:professional-case
```

Expected: 全部 exit 0；不存在 skipped/focused test；打包包含 `electron/generated/domain/index.js`。

- [ ] **Step 5: 做真实 Electron 六爻回归**

在非测试用户数据目录的副本上完成：

1. 问“今年学业功名如何”，完成六次摇卦；
2. 结果页先要求选择“学习文书”或“考试名次”，不把“学业功名”显示成用神；
3. 选择“考试名次”，确认用神候选为具体官鬼爻/伏神，并兼看父母；
4. 核对日期、占问、四柱干支、四柱旬空、完整本变六行、十二长生、神煞；
5. 随机展开 20 条关系事实，核对 source/target/rule/profile；
6. 运行本地报告和一次云端报告，随机展开 10 条 claim，所有 fact/rule/evidence 链接存在；
7. 刷新和重启，`caseHash` 不变；更换规则 profile 后旧报告显示需重算；
8. 打开迁移过的旧会话，历史文本标 `legacy-unverified`，重新分析后才变 validated。

- [ ] **Step 6: 记录验收与已知口径**

`docs/acceptance/2026-07-12-professional-engine-acceptance.md` 记录测试命令、数量、固定 caseHash、应用版本、默认 RuleContext、规则来源复核状态、迁移备份路径样例和人工检查截图路径。旧验收文档增加链接并撤销“当前已完整支持伏神/专业解卦”等超出旧运行时能力的表述。

- [ ] **Step 7: 最终提交**

```bash
git add electron src scripts package.json docs/acceptance
git commit -m "feat: 完成专业六爻排盘与可校验解卦迁移"
```

---

## 分阶段发布门

| 阶段 | 包含任务 | 可交付结果 | 不允许提前宣称 |
|---|---:|---|---|
| A. 领域真值 | 1–3 | 四柱、受审本变盘、完整纳甲与伏神 | 专业解卦 |
| B. 事实图 | 4–6 | 生克冲合、日月动变、十二长生、受限神煞 | 已确定用神 |
| C. 取用与 Case | 7–8 | 具体用神候选、元忌仇、稳定 caseHash、纯迁移 | AI 已校验 |
| D. 信任边界与 AI | 9–10 | 主进程重建、逐 claim 事实/证据校验 | 页面已完整展示 |
| E. 产品交付 | 11–12 | 完整结果 UI、旧会话迁移、打包验收 | 无来源的流派共识 |

## 自检结论

- 规格中的 `RuleContext/CalendarPillar/PlateV2/DerivedFact/UseGodSelection` 分别由任务 1、2、3、4–6、7 覆盖。
- 完整本变卦结果页由任务 11 覆盖，主进程信任边界由任务 9 覆盖，AI 事实契约由任务 10 覆盖。
- 流派差异在任务 1 的 profile、任务 3 的审查门、任务 5–7 的 conditional facts 中显式化。
- 60 甲子、64 卦、4096 投币组合、64×6 纳甲、地支矩阵、用神意图、IPC 伪造、旧会话迁移和真实 Electron 回归均有对应测试门。

## 执行方式

按 `superpowers:subagent-driven-development` 逐任务执行：每个任务使用新的实现代理，再由规格审查代理和代码质量审查代理分别通过后提交。十二个任务按编号顺序合并；资料摘录等只读工作可以并行，但不得绕过前一任务的完成门。
