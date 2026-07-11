# 专业六爻排盘与可校验解卦引擎设计规格

**状态：** 待实现
**日期：** 2026-07-12
**目标版本：** `DivinationCaseV2 / PlateV2`
**默认规则配置：** `wenwang_najia_v2 + beijing_jieqi_zichu_v2 + yehe_core_v1`

## 1. 目标与验收口径

本规格把当前“能排出基础卦盘、再让 AI 自由组织文字”的实现，升级为“程序先生成完整、可追溯、可复算的六爻事实图，AI 只能引用事实与古籍证据进行解释”的专业架构。

完成后必须同时满足：

1. 结果页显示起卦日期、占问原文、时区、规则配置和年/月/日/时四柱；每柱显示天干、地支、各自五行、所属旬和旬空。
2. 本卦与变卦都以完整六行对齐展示，不再只给变卦名称或只显示动爻的变值。
3. 每一爻可查看六神、世应、纳甲、六亲、伏神、十二长生、空破、日月作用、动变关系及生克冲合刑害破等程序事实。
4. “学业功名”只能是问题意图或事项标签，不能作为用神。`UseGodSelection` 必须落到父母、官鬼等六亲及具体明爻/伏神候选，并保留取用理由。
5. AI 不得接收并信任渲染进程传来的 `plate`、`facts` 或 `evidence`；主进程只接受 `sessionId`，从本地会话重新构建权威事实。
6. 每条 AI 判断引用存在的 `factId`；涉及古籍规则、占例或义理的判断还必须引用存在的 `evidenceId`。校验失败的报告不能标记“已校验”。
7. 不把有争议的流派口径写死为“六爻唯一规则”。所有解释性规则带 `ruleId`、配置版本、来源和确定性级别。

本阶段不承诺“程序替代职业断卦者”，也不自动给医疗、法律、投资等高风险结论。目标是排盘事实完整、规则来源透明、AI 推理输入可靠。

## 2. 经典来源与使用边界

默认规则配置以公开电子文本为起点，但电子文本不是免复核的权威数据库。进入 `approved` 的静态表必须记录版本、提取人、复核人和内容哈希。

- [《增删卜易·六亲歌章》](https://zh.wikisource.org/zh-hans/增删卜易/5)：六亲按本宫五行生克装配，变爻六亲仍以正卦宫五行为参照。
- [《增删卜易·用神章》](https://zh.wikisource.org/zh-hans/增删卜易/8)：父母、官鬼、兄弟、妻财、子孙所主事项。它说明“功名”可取官鬼，“文书、书馆、文契”等可取父母，不能把宽泛的“学业功名”直接当用神。
- [《增删卜易·五行相生章》](https://zh.wikisource.org/zh-hans/增删卜易/11) 与 [《五行相克章》](https://zh.wikisource.org/zh-hans/增删卜易/12)：用神、元神、忌神及日月动变的生克关系。
- [《增删卜易·日辰章》](https://zh.wikisource.org/zh-hans/增删卜易/17)：日冲旺静爻与衰静爻不能机械地得到同一结论，暗动、日破属于带条件的派生判断。
- [《增删卜易·六合章》](https://zh.wikisource.org/zh-hans/增删卜易/19)：六合事实与其条件性解释；“合”不能脱离用神有气与否直接判吉。
- [《增删卜易·反伏章》](https://zh.wikisource.org/zh-hans/增删卜易/25)：反吟、伏吟及回头冲克的条件性判断。
- [《增删卜易·旬空章》](https://zh.wikisource.org/zh-hans/增删卜易/26)：六旬旬空表，并明确旬空不能一概解释为无用。
- [《增删卜易·生旺墓绝章》](https://zh.wikisource.org/zh-hans/增删卜易/26又1)：列十二长生，但该文本默认解释重点为生、旺、墓、绝；因此 UI 可完整展示十二阶段，默认解释配置只提升生旺墓绝的权重。
- [《增删卜易》总目及星煞相关文本](https://zh.wikisource.org/zh-hans/增删卜易)：该文本只保留有限神煞经验，并明确神煞不能越过用神旺衰独断祸福。
- [《卜筮正宗》电子文本](https://ctext.org/wiki.pl?chapter=801184&if=gb&remap=gb)：用于交叉核对用神、元忌、生克制化、十二长生和神煞批评，不用于自动抹平与《增删卜易》的差异。

来源分为三类：

| 层级 | 含义 | 示例 | 运行时处理 |
|---|---|---|---|
| `structural` | 可由输入和明确静态表直接复算 | 铜钱值、阴阳动静、卦名、纳甲、旬空表 | 无流派话术，必须确定性输出 |
| `profile-dependent` | 事实表相对稳定，但解释权重或适用条件依配置而变 | 十二长生、暗动、进退、三合局成立条件 | 必须携带 `profileId/ruleId` |
| `secondary` | 只作辅助，不得覆盖核心生克结论 | 六神、贵人、禄神、驿马、天喜 | UI 明示“辅助”，AI 不得单独据此定吉凶 |

## 3. 系统边界

### 3.1 单一权威领域内核

新增 `src/domain/liuyao/` 作为唯一六爻领域内核。它是纯 TypeScript：

- 不依赖 React、Electron、网络、文件系统或模型；
- 不读取 `Date.now()`、`new Date()`、`crypto.randomUUID()` 或随机数；
- 所有时间、ID、投币、问题意图和规则配置从参数传入；
- 同一输入必须产生深值完全相同的结果；
- 编译为 ESM 给 Electron 主进程动态加载，渲染进程只复用类型、格式化器和测试夹具，不能作为权威写入者。

`electron/services/reading-service.cjs` 是主进程应用服务。它从 `JsonStore` 取会话，调用领域内核，执行检索与 AI 校验并持久化结果。渲染进程通过窄 IPC 获取只读快照。

`src/lib/divination.ts` 在迁移期间只保留旧会话解析和旧 import 的薄转发；所有调用方迁移后删除其中重复的排盘规则。

### 3.2 依赖方向

```text
React Result UI
  -> preload 只读 IPC
    -> reading-service.cjs
       -> JsonStore（权威会话）
       -> src/domain/liuyao（唯一排盘与事实内核）
       -> retrieval.cjs（主进程检索）
       -> ai.cjs（只消费事实契约）

src/domain/liuyao
  -> lunar-javascript 日历适配器
  -> 受审静态规则包
  -X React / Electron / JsonStore / fetch / AI
```

## 4. 版本化核心契约

### 4.1 RuleContext

```ts
export type RuleAuthority = 'structural' | 'profile-dependent' | 'secondary';

export interface RuleSourceRef {
  id: string;
  title: string;
  url: string;
  locator: string;
  contentHash: string;
  reviewStatus: 'draft' | 'reviewed' | 'approved';
}

export interface RuleContext {
  schemaVersion: '2.0.0';
  rulePackId: 'wenwang_najia_v2';
  rulePackVersion: string;
  calendarProfile: {
    id: 'beijing_jieqi_zichu_v2';
    timezone: 'Asia/Shanghai';
    yearBoundary: 'li-chun-exact';
    monthBoundary: 'jie-exact';
    dayBoundary: 'zi-hour-23';
    library: 'lunar-javascript@1.7.7';
  };
  relationProfile: {
    id: 'yehe_core_v1';
    dayClashPolicy: 'strength-aware';
    changedRelationReference: 'base-palace';
  };
  growthProfile: {
    id: 'five-element-forward_v1';
    earthFollows: 'water';
    display: 'all-twelve';
    interpretationWeight: 'sheng-wang-mu-jue-only';
  };
  shenShaProfile: {
    id: 'yehe_limited_four_v1';
    enabled: readonly ['tianyi', 'lushen', 'yima', 'tianxi'];
    authority: 'secondary';
  };
  useGodProfile: {
    id: 'explicit_intent_first_v1';
    ambiguousIntent: 'ask-user';
    multipleCandidates: 'retain-ranked-candidates';
  };
  sources: readonly RuleSourceRef[];
}
```

这里的默认值是本产品的受审选择，不宣称为所有流派共识。以后增加其他流派时必须新增 profile，不允许原地改变旧 profile 的语义。

### 4.2 CalendarPillar

```ts
export type Stem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';
export type Branch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥';
export type Element = '木' | '火' | '土' | '金' | '水';
export type PillarKind = 'year' | 'month' | 'day' | 'hour';
export type GanZhi = `${Stem}${Branch}`;
export type XunName = '甲子旬' | '甲戌旬' | '甲申旬' | '甲午旬' | '甲辰旬' | '甲寅旬';

export interface CalendarPillar {
  kind: PillarKind;
  ganZhi: GanZhi;
  stem: { value: Stem; element: Element };
  branch: { value: Branch; element: Element };
  xun: XunName;
  voidBranches: readonly [Branch, Branch];
}

export interface CalendarSnapshot {
  timezone: 'Asia/Shanghai';
  localDateTime: string;
  pillars: {
    year: CalendarPillar;
    month: CalendarPillar;
    day: CalendarPillar;
    hour: CalendarPillar;
  };
}
```

四柱都计算本柱所属旬与旬空用于完整展示；默认 `yehe_core_v1` 只把日柱旬空用于爻的核心“旬空”事实。年、月、时柱旬空不能自动等同于日旬空效力。

时间边界固定记录在 `RuleContext`。当前默认配置延续现有 `getDayInGanZhiExact()` 的子初换日，即 23:00 换日；另一口径必须使用新 calendar profile。

### 4.3 PlateV2 与完整本变卦

```ts
export type SixRelation = '父母' | '兄弟' | '子孙' | '妻财' | '官鬼';
export type TwelveStage =
  | '长生' | '沐浴' | '冠带' | '临官' | '帝旺' | '衰'
  | '病' | '死' | '墓' | '绝' | '胎' | '养';

export interface HexagramSideV2 {
  key: string;
  name: string;
  shortName: string;
  upperTrigram: string;
  lowerTrigram: string;
  palace: string;
  palaceElement: Element;
  generation: string;
  shiLine: 1 | 2 | 3 | 4 | 5 | 6;
  yingLine: 1 | 2 | 3 | 4 | 5 | 6;
  harmonyForm: 'six-harmony' | 'six-clash' | 'neither';
}

export interface LineFacetV2 {
  yang: boolean;
  stem: Stem;
  branch: Branch;
  ganZhi: string;
  stemElement: Element;
  branchElement: Element;
  relationToBasePalace: SixRelation;
  relationToOwnPalace: SixRelation;
  role: '世' | '应' | null;
  growthByPillar: Record<PillarKind, TwelveStage>;
}

export interface HiddenSpiritV2 {
  id: string;
  hostLineId: string;
  relation: SixRelation;
  stem: Stem;
  branch: Branch;
  ganZhi: string;
  element: Element;
  sourceHexagram: string;
}

export interface PlateLineV2 {
  id: string;
  position: 1 | 2 | 3 | 4 | 5 | 6;
  tossValue: 6 | 7 | 8 | 9;
  moving: boolean;
  beast: '青龙' | '朱雀' | '勾陈' | '腾蛇' | '白虎' | '玄武';
  base: LineFacetV2;
  changed: LineFacetV2;
  transition: null | {
    fromLineId: string;
    toLineId: string;
    growthIntoChanged: TwelveStage;
  };
  hiddenSpirits: readonly HiddenSpiritV2[];
}

export interface PlateV2 {
  schemaVersion: '2.0.0';
  id: string;
  sessionId: string;
  castAt: string;
  calendar: CalendarSnapshot;
  ruleContextHash: string;
  rawTosses: readonly [6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9];
  baseHexagram: HexagramSideV2;
  changedHexagram: HexagramSideV2;
  movingLines: readonly (1 | 2 | 3 | 4 | 5 | 6)[];
  lines: readonly [PlateLineV2, PlateLineV2, PlateLineV2, PlateLineV2, PlateLineV2, PlateLineV2];
}
```

关键语义：

- `changed` 对静爻也始终存在，所以变卦能完整显示六行。
- `relationToBasePalace` 用于动爻化爻分析；`relationToOwnPalace` 仅用于把变卦作为完整卦体查看。UI 必须用明确列名区分，不能把两者混成一个“变卦六亲”。
- 伏神按受审规则包生成，缺失就是空数组，不由 AI 补齐。
- 十二长生完整计算，但“展示一个阶段”和“据此下吉凶结论”是两件事。

### 4.4 DerivedFact 事实图

```ts
export type EntityRef =
  | { type: 'pillar'; id: PillarKind }
  | { type: 'hexagram'; id: 'base' | 'changed' }
  | { type: 'line'; id: string; side: 'base' | 'changed' }
  | { type: 'hidden-spirit'; id: string }
  | { type: 'use-god'; id: 'primary' };

export type UseGodEntityRef = Extract<EntityRef, { type: 'line' | 'hidden-spirit' }>;

export type FactRelation =
  | 'generates' | 'controls' | 'same-element'
  | 'clashes' | 'combines' | 'punishes' | 'harms' | 'breaks'
  | 'is-void' | 'is-month-break' | 'is-day-break' | 'is-dark-moving'
  | 'returns-generate' | 'returns-control' | 'returns-clash' | 'returns-combine'
  | 'advances' | 'retreats' | 'forms-three-harmony'
  | 'is-six-harmony' | 'is-six-clash' | 'is-fan-yin' | 'is-fu-yin'
  | 'is-growth-stage' | 'is-shen-sha'
  | 'is-source-spirit' | 'is-avoid-spirit' | 'is-enemy-spirit'
  | 'flying-generates-hidden' | 'flying-controls-hidden'
  | 'holds-shi' | 'holds-ying';

export interface DerivedFact {
  id: string;
  relation: FactRelation;
  source: EntityRef;
  target?: EntityRef;
  scope: 'calendar' | 'base' | 'changed' | 'transition' | 'formation' | 'use-god' | 'auxiliary';
  authority: RuleAuthority;
  ruleId: string;
  profileId: string;
  certainty: 'computed' | 'conditional' | 'disputed';
  conditions: readonly string[];
  values: Readonly<Record<string, string | number | boolean | readonly string[]>>;
  sourceRefs: readonly string[];
}
```

事实 ID 必须由实体、关系、规则版本确定，例如 `fact:line:1:base:day:clashes:v2`，不得用随机 UUID。相同 `DivinationCaseV2` 重算后事实 ID 和顺序都一致。

基础引擎至少输出：

1. 年/月/日/时与各爻的五行生克、比和及地支冲合刑害破事实；
2. 月破、日冲、日破/暗动的条件事实，日破与暗动不得只靠“被日支冲”决定；
3. 动爻对静爻、动爻对动爻的生克冲合；
4. 动爻化爻的回头生、回头克、回头冲、回头合、进神、退神、化墓、化绝；
5. 三合局、六冲卦、六合卦、反吟、伏吟；
6. 飞伏关系；
7. 选定用神后的元神、忌神、仇神；
8. 十二长生事实；
9. 受限神煞事实，统一标为 `secondary`。

`DerivedFact` 描述关系，不预存“吉/凶”字符串。吉凶倾向必须是依用神、旺衰、问意和 profile 生成的解释 claim。

### 4.5 UseGodSelection

```ts
export type QuestionIntentId =
  | 'career.rank-or-office'
  | 'study.learning-or-documents'
  | 'study.exam-rank-or-admission'
  | 'wealth.income-or-asset'
  | 'relationship.partner'
  | 'health.self'
  | 'lost-item.object'
  | 'travel.self'
  | 'other.explicit';

export interface UseGodCandidate {
  entity: UseGodEntityRef;
  relation: SixRelation;
  role: 'primary' | 'secondary' | 'supporting';
  score: number;
  reasonRuleIds: readonly string[];
}

export interface UseGodSelection {
  status: 'resolved' | 'ambiguous' | 'needs-user-input';
  intent: {
    id: QuestionIntentId;
    label: string;
    selectedBy: 'explicit-user-choice' | 'deterministic-rule';
  } | null;
  primary: UseGodCandidate | null;
  candidates: readonly UseGodCandidate[];
  relatedRelations: readonly SixRelation[];
  clarification?: {
    prompt: string;
    options: readonly { intentId: QuestionIntentId; label: string }[];
  };
  ruleIds: readonly string[];
}
```

取用流程固定为：

1. 先确定“谁问谁、问什么结果”，再映射六亲；类别只能缩小意图范围，不能直接产出用神。
2. `study` 至少区分“学习/文书”和“考试名次/录取”。前者候选父母，后者候选官鬼并兼看父母；用户只写“学业功名”时返回 `needs-user-input`。
3. 在本卦明爻中寻找目标六亲；未现时按受审飞伏规则寻找伏神。
4. 多现时保留所有候选和评分依据；没有足够受审规则拉开差异时返回 `ambiguous`，不能让 AI 猜一个。
5. `primary.entity` 必须是具体 `line` 或 `hidden-spirit`；“官鬼”“父母”只是六亲类型，仍不能代替具体候选。
6. AI 可以解释 `UseGodSelection`，不能修改它。

### 4.6 DivinationCaseV2

```ts
export interface DivinationCaseV2 {
  schemaVersion: '2.0.0';
  sessionId: string;
  question: string;
  category: string;
  ruleContext: RuleContext;
  plate: PlateV2;
  useGod: UseGodSelection;
  facts: readonly DerivedFact[];
  factSetHash: string;
  builtAt: string;
}
```

`builtAt` 由调用方传入，只用于审计，不参与领域判断。`factSetHash` 覆盖问题、意图、投币、起卦时刻、RuleContext、PlateV2、UseGodSelection 和有序 facts。

## 5. 规则配置与争议管理

### 5.1 默认配置不是隐形全局常量

每条规则必须在规则登记表中包含：

```ts
export interface RuleDefinition {
  id: string;
  version: string;
  authority: RuleAuthority;
  description: string;
  sourceRefs: readonly string[];
  reviewStatus: 'draft' | 'reviewed' | 'approved';
}
```

运行时只允许加载 `approved` 的结构性规则。`reviewed` 的解释性规则可以展示，但事实标为 `conditional`；`draft` 不能进入正式报告。

### 5.2 明确隔离的口径

- 年柱以立春还是农历正月切换；
- 月柱以节还是农历月切换；
- 日柱午夜还是子初换日；
- 十二长生阴阳顺逆、土从水还是另立；
- 暗动、日破、三合局、进退、反吟伏吟的成立条件；
- 用神两现如何排序；
- 神煞集合与权重。

本规格默认：立春精确时刻、节令精确时刻、子初 23:00 换日；五行十二长生顺排且土从水；解释重点为生旺墓绝；神煞限贵人、禄神、驿马、天喜且只能辅助。切换任何一项都必须产生不同的 profile ID 和 `factSetHash`。

## 6. 完整结果页

结果页分五层，顺序固定：

1. **占问头部：** 起卦日期时间、时区、占问原文、事项意图、规则包版本。
2. **四柱卡：** 年/月/日/时；每柱分别给天干及其五行、地支及其五行、所属旬、旬空。颜色之外必须显示“木/火/土/金/水”文字或可访问标签。
3. **本变卦双盘：** 六行自上而下显示，但领域数组仍保持初爻到上爻；每行对齐六神、伏神、本卦六亲/纳甲/五行/世应/动静、变卦六亲/纳甲/五行/世应。静爻的变卦列也必须存在。
4. **程序事实：** 用神选择、元忌仇、旺衰、日月作用、动变、冲合刑害破、三合/反伏、十二长生、神煞；按 `authority` 分组，条件事实显示条件。
5. **AI 与古籍证据：** 每条判断可展开查看 `factIds`、`ruleIds`、`evidenceIds`；证据不足或用神待澄清时明确降级。

五行视觉令牌：

```ts
export const ELEMENT_TOKENS = {
  木: { color: '#2F6B45', label: '木' },
  火: { color: '#A63F32', label: '火' },
  土: { color: '#805A2B', label: '土' },
  金: { color: '#5F6670', label: '金' },
  水: { color: '#285B8F', label: '水' },
} as const;
```

天干、地支分别着色，因为同一干支中的干与支可以属于不同五行。禁止给整段 `甲子` 只套一个颜色。移动端允许横向滚动双盘，但不能删掉变卦列或用省略号隐藏关键事实。

## 7. AI 事实契约与信任边界

### 7.1 主进程权威重建

新的 IPC：

```ts
reading.buildCase({ sessionId: string, intentId?: QuestionIntentId }): Promise<DivinationCaseV2>
reading.analyze({ sessionId: string }): Promise<ValidatedAnalysisBundleV2>
reading.followUp({ sessionId: string, question: string }): Promise<ValidatedFollowUpV2>
```

主进程处理 `reading.analyze` 时：

1. 从 `JsonStore` 读取 session；
2. 校验恰好六个已确认 toss、`castAt` 和问题；
3. 使用当前 session 锁定的 `RuleContext` 重建 `DivinationCaseV2`；
4. 在主进程根据 question、intent、用神和 facts 生成检索词并检索；
5. 向模型发送最小 `FactContractV2` 和 allowlist evidence；
6. 校验结构、fact/rule/evidence 引用和当前事实词元；
7. 只有全部通过才持久化为 `validated` 报告。

渲染进程传来的同名字段一律丢弃。`sessions:save` 也不能允许渲染进程覆盖 `caseSnapshot`、`analysis.validation` 或主进程生成的哈希。

### 7.2 模型输入

```ts
export interface FactContractV2 {
  schemaVersion: '2.0.0';
  caseHash: string;
  question: string;
  intent: UseGodSelection['intent'];
  plateSummary: {
    baseHexagram: string;
    changedHexagram: string;
    movingLines: readonly number[];
    pillars: CalendarSnapshot['pillars'];
  };
  useGod: UseGodSelection;
  facts: readonly Pick<DerivedFact, 'id' | 'relation' | 'source' | 'target' | 'authority' | 'ruleId' | 'certainty' | 'conditions' | 'values'>[];
}
```

只传有助于本次问题的事实子图，但 `caseHash` 指向完整事实集。证据文本是数据，不能当系统指令。

### 7.3 模型输出与校验

```ts
export interface AnalysisClaimV2 {
  id: string;
  section: 'summary' | 'use-god' | 'calendar' | 'moving' | 'synthesis' | 'guidance';
  text: string;
  factIds: readonly string[];
  ruleIds: readonly string[];
  evidenceIds: readonly string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface AnalysisReportV2 {
  schemaVersion: '2.0.0';
  caseHash: string;
  claims: readonly AnalysisClaimV2[];
  uncertainties: readonly string[];
  validation: {
    status: 'validated';
    factCheckPassed: true;
    citationCheckPassed: true;
    validatedAt: string;
  };
}
```

校验规则：

- `caseHash` 必须等于当前重建 case；
- 每条非纯行动建议 claim 至少有一个 `factId`；
- `factId/ruleId/evidenceId` 必须存在于本次 allowlist；
- 涉及古籍规则、占例或义理的 claim 至少有一个 `evidenceId`；
- 报告中的当前卦名、爻位、干支、旬空、六亲、世应和动静词元，只能来自该 claim 引用的 facts，不能因为它出现在某条古例 evidence 中就被放行；
- `factCheckPassed/citationCheckPassed` 由校验器产生，输入模型不能设置；
- 任一失败返回结构化错误，原始模型文本只进诊断日志，不能显示为“已校验”；
- 本地报告也由同一 facts 和模板生成，删除渲染端与主进程中重复的 `CATEGORY_FOCUS/focusByCategory`。

## 8. 旧会话迁移

旧 `DivinationPlate` 没有 schemaVersion、四柱、完整事实图和用神对象，不能直接补字段后冒充 V2。

迁移规则：

1. 读取时识别 legacy session；先原子复制 `app-data.json` 为带时间戳备份。
2. 未完成会话保留 toss 和 `currentToss`，不生成 PlateV2。
3. 已完成且有六个 toss 的会话，用原始 toss、`castAt`、问题和 category 重建 V2；旧 plate 只用于差异审计，不作为输入事实。
4. 若重建出的卦名、动爻或已确认投币与旧数据冲突，标记 `migrationState: 'needs-review'`，保留旧 JSON，不自动覆盖。
5. 旧 analysis 标记 `legacy-unverified`；结果页可以查看历史文字，但不能显示“事实已校验”，并提供“按 V2 重新解卦”。
6. 迁移写入临时文件后 rename，重复执行结果相同；`migrationVersion` 防止二次迁移。

## 9. 测试矩阵

### 9.1 领域纯函数

| 领域 | 最低覆盖 |
|---|---|
| 四柱边界 | 立春前后、每个节交接前后、22:59/23:00、23:59/00:00、不同时区输入指向同一上海本地时刻 |
| 六十甲子 | 60 个干支的旬与旬空全表；每旬恰好 10 个干支、2 个旬空 |
| 六十四卦 | 64 卦名称、上下卦、宫、世应、六合/六冲黄金表 |
| 4096 组合 | 六爻 6/7/8/9 的 4096 种组合；只翻动爻；本变各六行；ID 稳定 |
| 纳甲六亲 | 64 卦 × 6 爻黄金表；变爻 `relationToBasePalace` 与变卦 `relationToOwnPalace` 分开验证 |
| 飞伏 | 每宫缺失六亲、宿主行、飞生伏/飞克伏 |
| 地支矩阵 | 冲、合、刑、害、破对称性及无自造边；三合局组合 |
| 动变 | 回头生克冲合、进退、化墓绝、静爻无 transition |
| 十二长生 | 五行 × 12 地支完整轮转；默认解释只提升生旺墓绝 |
| 神煞 | 受限四项命中表；全部 facts 为 `secondary` |
| 用神 | 学习文书、考试名次、宽泛“学业功名”、求财、婚恋、健康、失物、出行；明现、伏藏、多现、无可判定 |
| 纯度 | 冻结输入后重复 100 次深值相等；不得调用系统时钟、随机源或网络 |

### 9.2 边界与安全

- 渲染进程伪造 Plate、fact、evidence、validation 均不能改变主进程结果；
- 旧古例 evidence 中的干支不能白名单化为当前卦事实；
- 伪造 factId/evidenceId/ruleId、错卦名、错动爻、错旬空、错用神候选全部拒绝；
- StrictMode 与重复 IPC 只生成一次同 `caseHash` 的报告；
- 迁移中断保留原文件和备份，重启后可幂等重试；
- 修改 profile 后 `factSetHash` 必变，旧报告自动显示“规则版本不一致，需重算”。

### 9.3 UI 与可访问性

- 四柱与本变六行完整渲染，1440×900 和 1120×720 不遮挡；
- 天干和地支按各自元素着色，并同时提供元素文字或 `aria-label`；
- 键盘可展开每个事实与引用；
- 条件事实、争议事实、辅助神煞有不同文本标签，不能只靠颜色；
- 打印/截图模式不丢占问、日期、四柱、旬空、本变卦和规则版本。

## 10. 完成门

以下全部满足才可称“专业排盘/解卦架构完成”：

- `PlateV2`、`RuleContext`、`CalendarPillar`、`DerivedFact`、`UseGodSelection` 通过版本化快照测试；
- 4096 投币组合、64 卦黄金表、60 甲子旬空表全部通过；
- 结果页完整显示四柱、本变六行、十二长生、神煞与关系事实；
- “学业功名”用例返回澄清或具体六亲候选，不再作为 focus 文本冒充用神；
- 主进程只凭 `sessionId` 重建事实，伪造渲染数据的安全测试通过；
- 所有显示为“已校验”的 AI claim 都能展开到有效 fact/rule/evidence；
- 旧会话完成备份、幂等迁移和差异审计；
- `npm test`、`npm run typecheck`、`npm run build` 全部通过，并完成一次打包 Electron 的真实会话回归。
