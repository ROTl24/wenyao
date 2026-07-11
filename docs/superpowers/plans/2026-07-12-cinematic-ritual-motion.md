# 问爻电影级摇卦动效 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在当前 Electron/React 工程中重构单轮摇卦，实现可重复、可跳过、同步且稳定的 GSAP 仪式时间轴，交付真实方孔乾隆通宝技术样片，并建立可无缝替换正式逐帧手掌资产的接口。

**Architecture:** 持久化投币结果继续由 `DivinationSession` 管理；瞬时动画由携带 `tossId` 的纯状态机和唯一 GSAP Timeline 管理。R3F 只负责相机、灯光、真实方孔古钱与对象引用，GSAP 直接驱动 Object3D；手掌层通过 manifest 选择当前“墨幕遮挡切镜”适配器或未来正式视频适配器。

**Tech Stack:** React 19、TypeScript 7、GSAP 3.15、React Three Fiber 9、Three.js 0.185、Vitest 4、Testing Library。

## Global Constraints

- 不覆盖或回退用户当前在 `src/App.test.tsx`、`src/App.tsx`、`src/components/HomeScreen.tsx`、`src/lib/session.ts` 中的既有修改。
- 三枚铜钱的逻辑 `faces` 在动画前已经锁定；动画、跳过、帧率和材质均不得改变结果。
- 第一爻目标总时长 3.20 秒，第二至第六爻目标总时长 2.20 秒；减少动态模式在 200 毫秒内到达同一最终状态。
- 同一 `(tossId, visualSeed)` 的重播逐帧一致；不同 `tossId` 即使三枚 `faces` 完全相同也必须重新播放。
- 当前两张不透明 PNG 只允许在墨幕完全遮挡下切换，禁止直接交叉淡化。
- 正式手掌资产未交付前只能称为“运行时技术样片”，不能宣称电影级最终手部动画已经完成。
- 1080p 平衡档目标 60 FPS；古钱落定后停止持续 Float、Sparkles 和无意义渲染。

## File Structure

```text
src/features/ritual/
  ritualTiming.ts              唯一阶段与时长常量
  ritualMachine.ts             纯动画状态机
  ritualMachine.test.ts
  coinTrajectory.ts            seeded 轨迹与采样纯函数
  coinTrajectory.test.ts
  coinGeometry.ts              真实方孔、倒角与共享几何
  coinGeometry.test.ts
  coinTextures.ts              正反面、边缘高清程序纹理
  QianlongCoin.tsx             单枚古钱场景对象
  CoinRig.tsx                  三枚对象引用与 GSAP 适配器
  createRitualTimeline.ts      唯一 GSAP 主时间轴
  createRitualTimeline.test.ts
  useRitualController.ts       React 生命周期、skip 与旧事件清理
  InkHands.tsx                 静态墨幕/正式视频统一入口
  ritualAssets.ts              manifest 类型与默认资源
  ritualAssets.test.ts
  index.ts                     稳定导出边界
public/ritual/
  manifest.json
src/components/
  CoinScene.tsx                改为 Canvas/灯光/rig 容器
  RitualScreen.tsx             改为语义 UI 和控制器消费者
  RitualScreen.test.tsx
src/lib/
  session.ts                   新增 expectedTossId 原子确认保护
  session.test.ts
src/styles.css                 舞台、墨幕和固定按钮槽位
docs/quality/
  ritual-art-asset-brief.md    正式手掌与 GLB 美术交付单
  ritual-runtime-review.md     逐帧与性能验收记录
```

---

### Task 1: 冻结阶段、状态机和投币原子确认

**Files:**
- Create: `src/features/ritual/ritualTiming.ts`
- Create: `src/features/ritual/ritualMachine.ts`
- Test: `src/features/ritual/ritualMachine.test.ts`
- Modify: `src/lib/session.ts`
- Modify: `src/lib/session.test.ts`

**Interfaces:**
- Produces: `RitualPhase`、`RitualEvent`、`ritualReducer(state, event)`。
- Produces: `advanceCurrentToss(session, expectedTossId, nextToss?, nextVisualSeed?)`，重复或过期 `tossId` 返回原对象。

- [ ] **Step 1: 写动画状态机失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { initialRitualState, ritualReducer } from './ritualMachine';

describe('摇卦动画状态机', () => {
  it('丢弃旧轮次回调并锁住重复确认', () => {
    let state = ritualReducer(initialRitualState, { type: 'TOSS_CHANGED', tossId: 'toss-a' });
    state = ritualReducer(state, { type: 'SCENE_READY', tossId: 'toss-a' });
    expect(state.phase).toBe('held');
    expect(ritualReducer(state, { type: 'TIMELINE_DONE', tossId: 'old' })).toEqual(state);
    state = ritualReducer(state, { type: 'TIMELINE_DONE', tossId: 'toss-a' });
    state = ritualReducer(state, { type: 'CONFIRM', tossId: 'toss-a' });
    expect(state.phase).toBe('confirming');
    expect(ritualReducer(state, { type: 'CONFIRM', tossId: 'toss-a' })).toEqual(state);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm.cmd run test:unit -- src/features/ritual/ritualMachine.test.ts`

Expected: FAIL，提示模块不存在。

- [ ] **Step 3: 实现唯一阶段模型**

```ts
export type RitualPhase =
  | 'awaiting-scene' | 'held' | 'release' | 'airborne'
  | 'landing' | 'reveal' | 'ready' | 'confirming';

export interface RitualState { tossId: string | null; phase: RitualPhase }

export type RitualEvent =
  | { type: 'TOSS_CHANGED'; tossId: string }
  | { type: 'SCENE_READY'; tossId: string }
  | { type: 'PHASE_AT'; tossId: string; phase: Exclude<RitualPhase, 'awaiting-scene' | 'confirming'> }
  | { type: 'TIMELINE_DONE'; tossId: string }
  | { type: 'CONFIRM'; tossId: string };

export const initialRitualState: RitualState = { tossId: null, phase: 'awaiting-scene' };
```

Reducer 必须先比较事件 `tossId`；只有 `TOSS_CHANGED` 可以替换当前 ID。`CONFIRM` 只允许 `ready → confirming`。

- [ ] **Step 4: 写原子确认失败测试**

```ts
it('同一 tossId 只能确认一次', () => {
  const prepared = prepareToss(createSession('考试是否通过', 'study'), createToss(['text', 'text', 'reverse']), 'seed-a');
  const first = advanceCurrentToss(prepared, prepared.currentToss!.id);
  const repeated = advanceCurrentToss(first, prepared.currentToss!.id);
  expect(first.tosses).toHaveLength(1);
  expect(repeated).toBe(first);
});
```

- [ ] **Step 5: 实现 expectedTossId 保护并跑测试**

`advanceCurrentToss` 在 `session.currentToss?.id !== expectedTossId` 时直接返回原 session；匹配时调用现有确认逻辑。先不在该函数中生成随机结果，避免把动画重构扩大为随机源重构。

Run: `npm.cmd run test:unit -- src/features/ritual/ritualMachine.test.ts src/lib/session.test.ts`

Expected: PASS。

- [ ] **Step 6: 提交独立增量**

```powershell
git add src/features/ritual/ritualTiming.ts src/features/ritual/ritualMachine.ts src/features/ritual/ritualMachine.test.ts src/lib/session.ts src/lib/session.test.ts
git commit -m "refactor(ritual): 建立可验证的摇卦状态机与原子确认"
```

---

### Task 2: 实现视觉种子与确定性古钱轨迹

**Files:**
- Create: `src/features/ritual/coinTrajectory.ts`
- Test: `src/features/ritual/coinTrajectory.test.ts`

**Interfaces:**
- Consumes: `{ tossId, visualSeed, faces, lineIndex }`。
- Produces: `createCoinTracks(input): readonly [CoinTrack, CoinTrack, CoinTrack]`。
- Produces: `sampleCoinTrack(track, progress): CoinPose`。

- [ ] **Step 1: 写确定性、错峰和最终朝向失败测试**

```ts
it('同种子逐帧一致，新 tossId 会重播但最终面不变', () => {
  const input = { tossId: 'a', visualSeed: 'seed', lineIndex: 1, faces: ['text', 'reverse', 'text'] as const };
  const a = createCoinTracks(input);
  const b = createCoinTracks(input);
  expect([0, .25, .5, .75, 1].map(t => a.map(track => sampleCoinTrack(track, t))))
    .toEqual([0, .25, .5, .75, 1].map(t => b.map(track => sampleCoinTrack(track, t))));
  const c = createCoinTracks({ ...input, tossId: 'b' });
  expect(sampleCoinTrack(a[0], .5)).not.toEqual(sampleCoinTrack(c[0], .5));
  expect(c.map(track => sampleCoinTrack(track, 1).face)).toEqual(input.faces);
  const impacts = a.map(track => track.impactAt).sort();
  expect(impacts[1] - impacts[0]).toBeGreaterThanOrEqual(.06);
  expect(impacts[2] - impacts[1]).toBeLessThanOrEqual(.14);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm.cmd run test:unit -- src/features/ritual/coinTrajectory.test.ts`

Expected: FAIL，提示模块不存在。

- [ ] **Step 3: 实现纯函数轨迹**

实现内容必须包括：

- FNV-1a 字符串哈希与 Mulberry32 PRNG，不依赖 `Math.random()`。
- 0–72% 三次贝塞尔飞行。
- 72–90% 两至三次指数衰减反弹。
- 90–100% 阻尼正弦摇摆。
- `progress` 钳制到 `[0, 1]`。
- `progress === 1` 直接返回精确落点和最终四元数，避免浮点残差露出错误面。

```ts
export interface CoinPose {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  face: CoinFace;
  contact: boolean;
}
```

- [ ] **Step 4: 覆盖八种组合和边界时间**

测试全部 `2³ = 8` 个正反面组合，在 `-1、0、0.72、0.9、1、2` 采样，断言无 `NaN`、末帧正确且落点两两距离大于 0.9 场景单位。

- [ ] **Step 5: 运行并提交**

Run: `npm.cmd run test:unit -- src/features/ritual/coinTrajectory.test.ts`

Expected: PASS。

```powershell
git add src/features/ritual/coinTrajectory.ts src/features/ritual/coinTrajectory.test.ts
git commit -m "feat(ritual): 实现可复现的三枚古钱轨迹"
```

---

### Task 3: 重制真实方孔乾隆通宝技术资产

**Files:**
- Create: `src/features/ritual/coinGeometry.ts`
- Create: `src/features/ritual/coinGeometry.test.ts`
- Create: `src/features/ritual/coinTextures.ts`
- Create: `src/features/ritual/QianlongCoin.tsx`
- Create: `src/features/ritual/CoinRig.tsx`
- Modify: `src/components/CoinScene.tsx`

**Interfaces:**
- Produces: `createQianlongCoinGeometry()`，三枚实例共享同一 `BufferGeometry`。
- Produces: `createQianlongTextureSet(renderer, quality)`，同时包含正面、背面和边缘材质。
- Produces: `CoinRigHandle { prepare, setProgress, snapToEnd, invalidate }`；GSAP 通过该接口写入 Object3D，不使用 R3F `useFrame` 计时。

- [ ] **Step 1: 写真实方孔失败测试**

```ts
it('中心射线不会命中币面且方孔贯穿', () => {
  const geometry = createQianlongCoinGeometry();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, -1));
  expect(raycaster.intersectObject(mesh)).toHaveLength(0);
  const offCenter = new THREE.Raycaster(new THREE.Vector3(.45, 0, 2), new THREE.Vector3(0, 0, -1));
  expect(offCenter.intersectObject(mesh).length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm.cmd run test:unit -- src/features/ritual/coinGeometry.test.ts`

Expected: FAIL。

- [ ] **Step 3: 实现带孔挤出几何**

使用 `THREE.Shape` 创建 128 段外圆，向 `shape.holes` 添加顺序正确的四边形 `Path`，再使用：

```ts
new THREE.ExtrudeGeometry(shape, {
  depth: 0.16,
  steps: 1,
  bevelEnabled: true,
  bevelSegments: 4,
  bevelSize: 0.025,
  bevelThickness: 0.025,
  curveSegments: 128,
});
```

完成后居中到 Z 轴、计算法线，并对正面、背面、外缘和孔壁分组。禁止运行时 CSG。

- [ ] **Step 4: 生成高清正反面与边缘材质**

每一面使用 2048×2048 CanvasTexture，包含：

- 汉字面“乾、隆、通、宝”上、下、右、左布局；
- 背面独立铸文图层，不再根据最终 `face` 生成单张贴图；
- 细粒度氧化斑、边缘磨损、方孔内壁暗化；
- sRGB Base Color 与线性 bump/roughness；
- `metalness` 0.88–0.96、`roughness` 0.38–0.72，移除 emissive；
- renderer 允许的最大 anisotropy。

技术资产必须在代码注释和美术交付单中标明：满文精确字形与微距浮雕仍需正式 GLB/人工校对资产替换。

- [ ] **Step 5: 重写 CoinScene**

删除当前 `cylinderGeometry`、基于 `face` 的 512 贴图、`Float`、持续 `Sparkles` 和 `elapsedTime` 动画。`CoinScene` 新签名：

```ts
interface CoinSceneProps {
  tossId: string;
  visualSeed: string;
  faces: readonly [CoinFace, CoinFace, CoinFace];
  lineIndex: number;
  active: boolean;
  onRigReady(rig: CoinRigHandle): void;
}
```

测试模式仍输出三个可访问节点，但必须同时输出 `data-toss-id`，用于验证相同 faces 的新轮次已经更新。

- [ ] **Step 6: 验证并提交**

Run:

```powershell
npm.cmd run test:unit -- src/features/ritual/coinGeometry.test.ts src/features/ritual/coinTrajectory.test.ts
npm.cmd run typecheck
```

Expected: PASS。

```powershell
git add src/features/ritual/coinGeometry.ts src/features/ritual/coinGeometry.test.ts src/features/ritual/coinTextures.ts src/features/ritual/QianlongCoin.tsx src/features/ritual/CoinRig.tsx src/components/CoinScene.tsx
git commit -m "feat(ritual): 重制真实方孔乾隆通宝技术资产"
```

---

### Task 4: 建立唯一 GSAP 时间轴与可替换手掌层

**Files:**
- Create: `src/features/ritual/createRitualTimeline.ts`
- Create: `src/features/ritual/createRitualTimeline.test.ts`
- Create: `src/features/ritual/useRitualController.ts`
- Create: `src/features/ritual/ritualAssets.ts`
- Create: `src/features/ritual/ritualAssets.test.ts`
- Create: `src/features/ritual/InkHands.tsx`
- Create: `src/features/ritual/index.ts`
- Create: `public/ritual/manifest.json`

**Interfaces:**
- Produces: `createRitualTimeline(targets, options): RitualTimelineController`。
- Produces: `useRitualController({ toss, lineIndex, onReady })`。
- Produces: `RitualHandsManifest`，支持 `still-occlusion-cut | opaque-video | alpha-video | image-sequence`。

- [ ] **Step 1: 写 seek、旧回调与 reduced motion 失败测试**

```ts
it('finish 将所有目标推进到同一最终状态且只完成一次', () => {
  const completed = vi.fn();
  const targets = fixtureTargets();
  const controller = createRitualTimeline(targets, { firstLine: false, reducedMotion: false, onComplete: completed });
  controller.play();
  controller.finish();
  controller.finish();
  expect(controller.getProgress()).toBe(1);
  expect(targets.openHands.style.opacity).toBe('1');
  expect(completed).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm.cmd run test:unit -- src/features/ritual/createRitualTimeline.test.ts src/features/ritual/ritualAssets.test.ts`

Expected: FAIL。

- [ ] **Step 3: 实现 manifest 与静态墨幕适配器**

默认 manifest：

```json
{
  "id": "wenyao-ritual-stills-v1",
  "version": 1,
  "mode": "still-occlusion-cut",
  "closedPoster": "/images/ritual-hands-closed.png",
  "openPoster": "/images/ritual-hands.png",
  "width": 1672,
  "height": 941,
  "colorSpace": "srgb",
  "alphaMode": "none"
}
```

`InkHands` 使用两个独立 DOM 层和一个墨幕层。第一爻只有在墨幕 opacity 达到 1 后才把 closed 设为 0、open 设为 1；后五爻直接从 open 开始，不重复展示合掌。

- [ ] **Step 4: 实现唯一主时间轴**

时间轴必须包含标签：`start`、`inkCover`、`release`、`coinsAirborne`、`firstImpact`、`lastImpact`、`settled`、`reveal`、`confirmable`。

第一爻使用 3.20 秒；短流程 2.20 秒。时间轴从 release 标签开始 tween 内部 progress proxy，并在 `onUpdate` 调用 `CoinRigHandle.setProgress()`。`finish()` 使用 `timeline.progress(1, false)` 或等价实现，并以内部布尔值保证完成回调只执行一次。

- [ ] **Step 5: 实现 React 生命周期**

`useRitualController` 必须：

- 等待手掌 DOM 和 CoinRig 同时 ready 才创建 timeline；
- `tossId` 变化先 kill 旧 timeline 再清空状态；
- 所有回调携带创建时的 `tossId`，过期回调不 dispatch；
- 监听 `matchMedia('(prefers-reduced-motion: reduce)')` 的初值和 change；
- reduced 模式直接 snap 到末帧，不加载视频、不播放 R3F 飞行动画；
- 返回 `skip()`、`confirmable`、`phase`、`getProgress()` 和 `active`。

- [ ] **Step 6: 验证并提交**

Run: `npm.cmd run test:unit -- src/features/ritual/createRitualTimeline.test.ts src/features/ritual/ritualAssets.test.ts`

Expected: PASS。

```powershell
git add src/features/ritual public/ritual/manifest.json
git commit -m "feat(ritual): 统一手掌古钱与交互时间轴"
```

---

### Task 5: 接入 RitualScreen 并彻底修复按钮位移和跳过分裂

**Files:**
- Modify: `src/components/RitualScreen.tsx`
- Create: `src/components/RitualScreen.test.tsx`
- Modify: `src/styles.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: Task 4 的 `useRitualController` 与 Task 1 的原子确认。
- Produces: 连续六轮只有 `ready` 可确认，skip 后 DOM 与 3D 同帧落定。

- [ ] **Step 1: 写重复 faces、skip 和按钮锁定失败测试**

```tsx
it('相同 faces 的新 tossId 会重新锁定并允许跳到新末帧', async () => {
  const { rerender } = render(<RitualScreen session={preparedSession('toss-a')} onConfirm={vi.fn()} />);
  expect(screen.getByRole('button', { name: '定此爻' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /起卦动画/ }));
  expect(screen.getByRole('button', { name: '定此爻' })).toBeEnabled();
  rerender(<RitualScreen session={preparedSession('toss-b')} onConfirm={vi.fn()} />);
  expect(screen.getByRole('button', { name: '定此爻' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /起卦动画/ }));
  expect(screen.getByRole('button', { name: '定此爻' })).toBeEnabled();
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm.cmd run test:unit -- src/components/RitualScreen.test.tsx`

Expected: FAIL。

- [ ] **Step 3: 改造 RitualScreen**

删除 `opened/settled` 和全部 `setTimeout`。把完整 `current.id`、`current.visualSeed`、`current.faces`、`current.lineIndex` 传给 CoinScene；点击舞台只调用 `skip()`。结果与按钮只由状态机 `ready` 决定。

- [ ] **Step 4: 改造确认调用**

`RitualScreen` 的 `onConfirm` 签名改为 `(expectedTossId: string) => void`；`App.tsx` 使用该 ID 调用 `advanceCurrentToss`。保留用户已经修改的问题校验和分类逻辑，不改动相邻 HomeScreen 行为。

- [ ] **Step 5: 固定按钮槽位**

```css
.ritual-confirm-slot {
  position: absolute;
  z-index: 9;
  left: 50%;
  bottom: 35px;
  transform: translateX(-50%);
}
.ritual-confirm-slot .ritual-confirm {
  position: static;
  transform: none;
  margin: 0;
}
.ritual-confirm-slot .ritual-confirm:hover:not(:disabled) {
  transform: translateY(-1px);
}
```

移除旧 `.ritual-confirm` 上的 left/translateX。墨幕切镜不得再让 closed/open 两张图同时长时间可见。

- [ ] **Step 6: 跑组件与会话测试**

Run:

```powershell
npm.cmd run test:unit -- src/components/RitualScreen.test.tsx src/lib/session.test.ts src/App.test.tsx
npm.cmd run typecheck
```

Expected: PASS，且不改变用户当前简短问题校验预期。

- [ ] **Step 7: 提交独立增量**

```powershell
git add src/components/RitualScreen.tsx src/components/RitualScreen.test.tsx src/styles.css src/App.tsx
git commit -m "fix(ritual): 同步跳过确认并消除定爻按钮位移"
```

---

### Task 6: 建立正式美术资产契约与质量闸门

**Files:**
- Create: `docs/quality/ritual-art-asset-brief.md`
- Create: `docs/quality/ritual-runtime-review.md`
- Modify: `public/ritual/manifest.json`

**Interfaces:**
- Produces: 动画师/三维美术可直接执行的 12 姿势、分辨率、帧数、遮挡、handoff 和授权清单。
- Produces: 运行时技术样片与最终电影级资产之间不可混淆的验收状态。

- [ ] **Step 1: 写正式手掌资产交付单**

交付单必须逐项包含：

- 3840×2160、24 FPS 母版，运行时 1920×1080；
- 完整片段 60–72 帧，短片段 24–34 帧；
- 12 个关键姿势名称和帧号；
- OpenEXR straight-alpha 母版、不透明 VP9 WebM 主交付、首帧/交接帧/尾帧 PNG；
- 相机 FOV、三枚币位置/四元数、灯光、曝光、色彩空间、背景 ID 的 `handoff.json`；
- 手前景、前后遮挡、三枚币 Object ID matte；
- 源工程、工具版本、许可与 SHA-256。

- [ ] **Step 2: 写运行时审查表**

固定检查：正常速度、0.25×、逐帧；八种币面组合各三次；1280×720、1920×1080、2560×1440；按钮 hover 中心偏差；P95 帧时间；六轮后显存；落定后 GPU 空闲。

- [ ] **Step 3: 标注当前 manifest 状态**

在 manifest 增加：

```json
"qualityStatus": "technical-preview",
"finalAssetRequired": true
```

只有正式视频/GLB 通过交付单和用户实际运行验收后才改为 `final-approved`。

- [ ] **Step 4: 提交**

```powershell
git add docs/quality/ritual-art-asset-brief.md docs/quality/ritual-runtime-review.md public/ritual/manifest.json
git commit -m "docs(ritual): 建立电影级美术资产与验收契约"
```

---

### Task 7: 全量验证与实际运行样片审查

**Files:**
- Modify: `docs/quality/ritual-runtime-review.md`

**Interfaces:**
- Consumes: Tasks 1–6 全部增量。
- Produces: 自动化输出、实际 Electron 截图、性能数据和未完成的美术缺口。

- [ ] **Step 1: 跑全量自动化**

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build:renderer
```

Expected: 当前全部 Vitest 和 Electron tests PASS，TypeScript 无错误，Vite 构建成功。

- [ ] **Step 2: 在真实 Electron 中连续完成六爻**

每轮至少执行一次正常播放和一次跳过；特意覆盖相同币面连续出现，确认三个币全部重播。检查确认按钮 hover/focus/pressed 均不横跳，双击只新增一爻。

- [ ] **Step 3: 固定帧视觉审查**

分别截取 `release`、`firstImpact`、`lastImpact`、`settled`，记录文件路径。使用实际截图确认方孔贯穿、正反面清晰、币缘可见、落点不重叠、墨幕切镜不出现四只手重影。

- [ ] **Step 4: 性能与资源检查**

记录 Chrome Performance 60 秒帧时间和 `renderer.info`。目标：1080p P95 ≤ 16.7ms、峰值 draw calls ≤ 45、三币总三角面 ≤ 105k；落定 2 秒后无持续 Float/Sparkles 更新。

- [ ] **Step 5: 如实确定状态**

- 若程序轨迹、真实方孔、同步、按钮和性能全部通过，但正式手掌/GLB 未交付：状态保持 `technical-preview`，继续推进美术资产，不标记目标完成。
- 只有正式手掌和 GLB 通过逐帧验收、manifest 为 `final-approved`，且用户审阅实际运行样片通过，才可宣称电影级动效目标完成。

## Self-Review

- **规格覆盖：** Tasks 1–5 覆盖状态、跳过、重复轮次、古钱几何/材质、手掌适配与按钮；Task 6 覆盖正式资产；Task 7 覆盖实际运行和性能。
- **占位符扫描：** 无 `TBD`、`TODO` 或“稍后实现”；正式资产所需内容、格式和验收值均已明确。
- **类型一致性：** `tossId`、`visualSeed`、`faces`、`lineIndex` 从 session 贯穿轨迹、CoinScene、timeline 和测试；`ready` 是唯一确认许可。
- **工作树保护：** 新测试单独建立，避免把用户对 `App.test.tsx` 的现有修改混入动效测试；修改 `App.tsx/session.ts` 时只触及 expectedTossId 确认链。

## Completion Gate

- 当前技术样片必须先解决重复摇卦不动、定时不同步、跳过分裂、Float 不停和按钮横跳五个已证实缺陷。
- 真实方孔、正反面、币缘和确定性落定全部可在实际运行画面验证。
- 静态手图不再直接交叉淡化；正式视频接口可以无业务代码改动替换。
- 自动化、类型检查、构建、六轮实际操作和性能记录全部通过。
- 正式手掌逐帧资产及正式古钱 GLB 未通过审查前，不得把总体目标标记完成。
