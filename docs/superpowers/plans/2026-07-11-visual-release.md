# 水墨视觉、性能与 Windows 发布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已验证的起卦、排盘、古籍和 AI 闭环上交付水墨手影、实时乾隆古币、声音、成卦转场、画质降级与 Windows 安装更新，使首版达到可内部交付状态。

**Architecture:** WebGL Canvas 只渲染水墨手影交接、三枚古币、粒子、灯光和短转场；所有文字和操作保留在 DOM。XState 是仪式时序唯一真值，GSAP Timeline 只执行状态进入后的动画。质量控制器依据设备与帧时间选择高/平衡/低档，WebGL 或视频失败时回退到静态 DOM 起卦，不影响逻辑结果。

**Tech Stack:** React Three Fiber、Three.js WebGLRenderer、GSAP、react-postprocessing、Web Audio、KTX2/GLB/WebM、Playwright、Vitest、Tauri NSIS/Updater、Windows Authenticode。

## Global Constraints

- 视觉固定为“水墨玄境 + 水墨手影 + 沉浸式分幕”，禁止高饱和蓝紫仙侠光和常驻重后期。
- 逻辑 faces 与 `visual_seed` 来自持久化层；任何动画、物理或帧率不得改变卦象。
- 第一爻 3.2–3.8 秒，第二至第六爻每轮 1.8–2.4 秒。
- 1080p 平衡档目标为 Iris Xe 级集显 60 FPS；低档稳定 30 FPS。
- 3D 非动画状态使用按需渲染，4K 窗口内部 3D 最大约 2560×1440。
- 支持完全静音、`prefers-reduced-motion`、键盘完成全流程和 WebGL 静态回退。
- 稳定分发版必须同时具备 Authenticode 签名和独立 Tauri 更新签名；两套密钥均不得进入仓库。

## File Structure

```text
apps/desktop/src/features/ritual/
  RitualStage.tsx
  RitualStage.test.tsx
  scene/RitualCanvas.tsx
  scene/Coin.tsx
  scene/CoinChoreography.ts
  scene/CoinChoreography.test.ts
  scene/HandsVideoLayer.tsx
  scene/handoff.ts
  scene/handoff.test.ts
  scene/Particles.tsx
  scene/PostEffects.tsx
  audio/AudioBus.ts
  audio/useRitualAudio.ts
  quality/QualityController.ts
  quality/QualityController.test.ts
  fallback/StaticRitual.tsx
  transition/HexagramAssembly.tsx
assets/ritual/
  handoff.schema.json
  qianlong-coin.glb
  qianlong-coin.ktx2
  hands-first.webm
  hands-short.webm
  audio/*.ogg
  manifest.json
assets/source/
  qianlong-coin.blend
  hands-water-ink.blend
  audio-session/
  licenses.json
tools/assets/validate-ritual-assets.mjs
tests/performance/ritual.perf.spec.ts
tests/e2e/accessibility.spec.ts
apps/desktop/src-tauri/tauri.conf.json
apps/desktop/src-tauri/capabilities/default.json
scripts/release/verify-package.ps1
docs/release/windows.md
```

---

### Task 1: 冻结视觉资源契约与代理资源

**Files:**
- Create: `assets/ritual/handoff.schema.json`
- Create: `assets/ritual/manifest.json`
- Create: `tools/assets/validate-ritual-assets.mjs`
- Create: `apps/desktop/src/features/ritual/scene/handoff.ts`
- Create: `apps/desktop/src/features/ritual/scene/handoff.test.ts`

**Interfaces:**
- Produces: `RitualAssetManifest` 与 `HandoffPose`。
- Produces: `npm.cmd run assets:validate`，在资源缺失、超预算或 handoff 不一致时失败。

- [ ] **Step 1: 写 handoff Schema 失败测试**

```ts
it('rejects handoff without all three coin poses', () => {
  const invalid = { camera: fixtureCamera(), coins: [fixturePose(), fixturePose()] };
  expect(() => parseHandoff(invalid)).toThrow(/three coin poses/);
});
```

- [ ] **Step 2: 定义完整 handoff 数据**

```json
{
  "version": 1,
  "handoffTimeMs": 1840,
  "camera": {"fov": 34, "position": [0, 2.4, 6.8], "quaternion": [0, 0, 0, 1]},
  "coins": [
    {"position": [-0.8, 0.9, 0], "quaternion": [0, 0, 0, 1]},
    {"position": [0, 1.2, 0.1], "quaternion": [0, 0, 0, 1]},
    {"position": [0.8, 0.85, -0.1], "quaternion": [0, 0, 0, 1]}
  ],
  "lighting": {"keyIntensity": 2.2, "fillIntensity": 0.45, "exposure": 1.0},
  "toneMapping": "aces"
}
```

- [ ] **Step 3: 实现资源预算校验**

Validator 检查：GLB+纹理不超过 30MB、两段手视频合计不超过 15MB、三枚 handoff 位姿齐全、音频清单完整、所有路径采用相对 URL。提交前先使用代理 GLB/视频，最终资源替换不得修改契约。

- [ ] **Step 4: 验证并提交**

```powershell
npm.cmd run assets:validate
npm.cmd test --workspace @liuyao/desktop -- handoff.test.ts --run
git add assets/ritual tools/assets apps/desktop/src/features/ritual/scene/handoff*
git commit -m "feat(visual): 冻结水墨仪式资源与交接契约"
```

---

### Task 2: 生产乾隆古币、水墨手影与声音资产

**Files:**
- Create: `.gitattributes`
- Create: `assets/source/qianlong-coin.blend`
- Create: `assets/source/hands-water-ink.blend`
- Create: `assets/source/licenses.json`
- Create: `assets/ritual/qianlong-coin.glb`
- Create: `assets/ritual/qianlong-coin.ktx2`
- Create: `assets/ritual/hands-first.webm`
- Create: `assets/ritual/hands-short.webm`
- Create: `assets/ritual/audio/*.ogg`
- Create: `docs/quality/ritual-art-review.md`

**Interfaces:**
- Consumes: Task 1 的 manifest、handoff Schema、体积预算和已确认水墨视觉方向。
- Produces: 具备明确来源、授权、可再制作源文件和运行时压缩产物的最终资源集。

- [ ] **Step 1: 配置二进制源文件版本管理**

```gitattributes
*.blend filter=lfs diff=lfs merge=lfs -text
*.glb filter=lfs diff=lfs merge=lfs -text
*.webm filter=lfs diff=lfs merge=lfs -text
*.ogg filter=lfs diff=lfs merge=lfs -text
```

Run: `git lfs install`

Expected: Git LFS 可用；若当前远端不支持 LFS，源文件转存到受控制品库并在 `licenses.json` 记录不可变 SHA-256，运行时压缩文件仍由构建流程拉取并校验。

- [ ] **Step 2: 制作并审查乾隆古币**

Blender 源文件包含正面汉字、背面、方孔、边缘和单一可复用材质。运行时网格为 20k–30k 三角面；2K 贴图包含 baseColor、normal、roughness、metalness、AO。文字可读但不使用高面数浮雕；磨损主要烘焙。导出 GLB 后使用 glTF Transform/Meshopt 与 KTX2 压缩。

验收截图固定为正面、背面、45° 边缘和水墨场景四张，记录在 `docs/quality/ritual-art-review.md`；三枚实例共用 geometry/material，任一面朝上时方孔和字向无镜像错误。

- [ ] **Step 3: 制作水墨手影与交接帧**

`hands-water-ink.blend` 使用真实手部骨骼动作或合法授权动作数据，渲染不透明水墨背景。完整片段 2.5–3 秒、短片段 1–1.4 秒，镜头和灯光严格读取 handoff 数据；结尾三枚币姿态与 `handoff.json` 一致。输出 VP9 WebM，交接帧另存 lossless PNG 用于像素对比。

- [ ] **Step 4: 录制并整理音频**

交付至少三组摇币、轻中重碰撞、左右声像样本、定爻、成卦、环境和衣料声音。所有录音或素材在 `licenses.json` 记录作者、来源、授权、修改和 SHA-256；无法证明授权的资源不得进入安装包。

- [ ] **Step 5: 运行资源审查与提交**

```powershell
npm.cmd run assets:validate
git lfs status
git add .gitattributes assets/source assets/ritual docs/quality/ritual-art-review.md
git commit -m "feat(assets): 交付水墨手影乾隆古币与声音资源"
```

Expected: 资源预算全部通过；交接静帧与 3D 首帧位置偏差低于 2px、平均亮度差低于 3%；授权清单无缺项。

---

### Task 3: 实现可复现的实时古币编舞

**Files:**
- Create: `apps/desktop/src/features/ritual/scene/Coin.tsx`
- Create: `apps/desktop/src/features/ritual/scene/CoinChoreography.ts`
- Create: `apps/desktop/src/features/ritual/scene/CoinChoreography.test.ts`
- Create: `apps/desktop/src/features/ritual/scene/RitualCanvas.tsx`

**Interfaces:**
- Consumes: `PreparedToss { faces, lineValue, visualSeed }`。
- Produces: `createCoinTracks(toss, handoff) -> [CoinTrack; 3]`。
- Produces: `CoinTrack.sample(progress) -> position/quaternion/contactEvents`。

- [ ] **Step 1: 写确定性和最终朝向测试**

```ts
it('same seed produces identical tracks and final faces', () => {
  const a = createCoinTracks(fixtureToss('seed-1'), fixtureHandoff());
  const b = createCoinTracks(fixtureToss('seed-1'), fixtureHandoff());
  expect(a).toEqual(b);
  expect(a.map(track => track.sample(1).face)).toEqual(fixtureToss('seed-1').faces);
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `npm.cmd test --workspace @liuyao/desktop -- CoinChoreography.test.ts --run`

Expected: FAIL。

- [ ] **Step 3: 实现 seeded PRNG、贝塞尔与阻尼落定**

每币从 handoff pose 出发，visualSeed 派生横向偏移、6–12 圈旋转、第一次接触时间和落点。0–0.72 使用三次贝塞尔，0.72–0.9 使用两至三次衰减反弹，0.9–1.0 使用阻尼正弦；最后一帧直接赋值目标四元数，避免浮点残差露出错误面。

- [ ] **Step 4: 实现 R3F Coin**

`useFrame` 只修改 Three Object，不调用 React setState。三枚币复用 geometry/material/texture，每个币独立 transform。接触事件通过队列发送音频和粒子，不影响状态机。

- [ ] **Step 5: 验证并提交**

```powershell
npm.cmd test --workspace @liuyao/desktop -- CoinChoreography.test.ts --run
git add apps/desktop/src/features/ritual/scene
git commit -m "feat(visual): 实现确定性乾隆古币实时编舞"
```

---

### Task 4: 水墨手影视频与 3D 无缝交接

**Files:**
- Create: `apps/desktop/src/features/ritual/scene/HandsVideoLayer.tsx`
- Create: `apps/desktop/src/features/ritual/RitualStage.tsx`
- Create: `apps/desktop/src/features/ritual/RitualStage.test.tsx`

**Interfaces:**
- Produces: `onHandoff`、`onVideoFailure`、`onSequenceComplete`。
- Consumes: XState 当前爻序号和 motion preference。

- [ ] **Step 1: 写视频失败回退测试**

```tsx
it('falls back without changing the prepared toss when video fails', async () => {
  render(<RitualStage toss={fixtureToss()} video={failingVideo()} />);
  expect(await screen.findByTestId('ritual-canvas')).toBeVisible();
  expect(screen.getByText('两字一背')).toBeVisible();
  expect(onPrepareToss).toHaveBeenCalledTimes(0);
});
```

- [ ] **Step 2: 实现双层预热与交叉淡化**

视频作为 Canvas 上方 DOM layer；Three 场景在下方完成模型、纹理和 shader 预热。到 `handoffTimeMs` 时开始 6–8 帧交叉淡化，同时启动古币 track；视频 `ended/error/stalled` 都必须产生明确状态事件。

- [ ] **Step 3: 区分第一爻与后五爻节奏**

lineIndex 0 使用 `hands-first.webm`；1–5 使用 `hands-short.webm`。减少动态模式不加载视频，使用 150–250ms 淡化直接进入落定结果。

- [ ] **Step 4: 验证并提交**

```powershell
npm.cmd test --workspace @liuyao/desktop -- RitualStage.test.tsx --run
git add apps/desktop/src/features/ritual
git commit -m "feat(visual): 衔接水墨手影与实时古币"
```

---

### Task 5: 粒子、音频、后期与成卦转场

**Files:**
- Create: `apps/desktop/src/features/ritual/scene/Particles.tsx`
- Create: `apps/desktop/src/features/ritual/scene/PostEffects.tsx`
- Create: `apps/desktop/src/features/ritual/audio/AudioBus.ts`
- Create: `apps/desktop/src/features/ritual/audio/useRitualAudio.ts`
- Create: `apps/desktop/src/features/ritual/transition/HexagramAssembly.tsx`

**Interfaces:**
- Consumes: Coin contact events 与 XState `committingLine/hexagramAssembling`。
- Produces: 分组音量 `master/ambient/effects` 和可取消成卦 Timeline。

- [ ] **Step 1: 写音频分组和静音测试**

```ts
it('master mute prevents every scheduled sound', () => {
  const bus = new AudioBus(fakeContext());
  bus.setMasterMuted(true);
  bus.play('coin-heavy');
  expect(fakeContext().startedSources).toHaveLength(0);
});
```

- [ ] **Step 2: 实现单一 AudioContext 与事件采样**

用户首次交互后 resume AudioContext。摇币至少三组变体；接触按轻中重和左右声像选择样本；同类声音设置 40ms 防抖，防止三个币同帧产生爆音。

- [ ] **Step 3: 实现轻量粒子与后期**

粒子使用 Points/InstancedMesh；平衡档 2k–3k。后期只保留半分辨率选择性 Bloom、极弱 vignette/film grain 和一次色彩分级；不常驻 SSAO、God Rays、Glitch 或强色差。

- [ ] **Step 4: 实现第六爻成卦 Timeline**

铜钱退向两侧，六爻线放大，动爻使用朱砂强调，随后拆分本卦/变卦并交还 DOM 排盘页。Timeline 完成只发送 `ANIMATION_DONE`，不得生成或修改 Plate。

- [ ] **Step 5: 验证并提交**

```powershell
npm.cmd test --workspace @liuyao/desktop -- --run
git add apps/desktop/src/features/ritual
git commit -m "feat(visual): 完成水墨粒子音频与成卦转场"
```

---

### Task 6: 画质控制、减少动态与静态回退

**Files:**
- Create: `apps/desktop/src/features/ritual/quality/QualityController.ts`
- Create: `apps/desktop/src/features/ritual/quality/QualityController.test.ts`
- Create: `apps/desktop/src/features/ritual/fallback/StaticRitual.tsx`
- Create: `tests/e2e/accessibility.spec.ts`

**Interfaces:**
- Produces: `QualityTier = high|balanced|low|static`。
- Produces: DPR、粒子、Bloom、阴影、视频和 frameloop 配置。

- [ ] **Step 1: 写降级顺序测试**

```ts
it('degrades in the approved order after sustained slow frames', () => {
  const controller = new QualityController('balanced');
  controller.observe(repeat(24, 180));
  expect(controller.settings()).toMatchObject({ dprMax: 1.25, particleCount: 800 });
});
```

- [ ] **Step 2: 实现持续窗口而非单帧降级**

连续 3 秒 P95 帧时超过 20ms 才降一级；连续 20 秒稳定后最多恢复一级，防止档位抖动。顺序固定为 DPR、粒子、Bloom、动态阴影、景深/噪点、视频、static。

- [ ] **Step 3: 实现 reduced motion 与 WebGL 失败回退**

StaticRitual 使用 DOM 铜钱、明确正反文字和“定此爻”按钮；逻辑仍调用同一 Tauri Commands。键盘 Enter/Space 完成流程，`aria-live="polite"` 宣告每爻结果。

- [ ] **Step 4: E2E 验证**

Playwright 模拟 reduced-motion、禁用 WebGL、静音和只用键盘，六轮起卦与排盘全部完成。

Run: `npm.cmd run test:e2e -- accessibility.spec.ts`

Expected: PASS。

- [ ] **Step 5: 提交**

```powershell
git add apps/desktop/src/features/ritual/quality apps/desktop/src/features/ritual/fallback tests/e2e/accessibility.spec.ts
git commit -m "feat(visual): 支持动态画质与无障碍静态回退"
```

---

### Task 7: 性能测量与资源预算门

**Files:**
- Create: `tests/performance/ritual.perf.spec.ts`
- Create: `docs/quality/visual-performance.md`
- Modify: `tools/assets/validate-ritual-assets.mjs`

**Interfaces:**
- Produces: 帧时间、draw calls、三角面、纹理内存估算、首交互时间报告。

- [ ] **Step 1: 写性能测试脚本**

通过测试构建暴露的只读 telemetry 采样 10 秒第一爻和 5 次短仪式，记录 P50/P95 frame time、renderer.info、Long Tasks 和首交互时间；测试构建之外不暴露该接口。

- [ ] **Step 2: 在目标集显机器运行**

Run: `npm.cmd run test:e2e -- tests/performance/ritual.perf.spec.ts --project=windows-balanced`

Expected: 1080p 平衡档 P95 ≤ 16.7ms、draw calls 峰值 ≤ 80、三角面 ≤ 300k、首次可交互 ≤ 2.5s。

- [ ] **Step 3: 记录真实基线并设 CI 静态门**

硬件性能测试结果写入 `docs/quality/visual-performance.md`；普通 CI 至少执行资源大小、draw-call fixture 和无持续 render-loop 的静态断言。

- [ ] **Step 4: 提交**

```powershell
git add tests/performance tools/assets docs/quality/visual-performance.md
git commit -m "perf: 建立水墨起卦性能与资源预算"
```

---

### Task 8: Windows NSIS、签名与安全更新

**Files:**
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `apps/desktop/src-tauri/capabilities/default.json`
- Create: `scripts/release/verify-package.ps1`
- Create: `docs/release/windows.md`

**Interfaces:**
- Produces: x64 NSIS 用户级安装程序。
- Produces: 已签名 updater artifact 和更新 manifest。
- Produces: `verify-package.ps1` 检查签名、架构、版本、密钥泄漏和升级保留数据。

- [ ] **Step 1: 写发布校验脚本失败测试**

对未签名假安装包运行脚本，Expected: FAIL 并明确显示 `AUTHENTICODE_MISSING`；对包含 `api_key` fixture 的解包目录，Expected: FAIL 显示 `SECRET_PATTERN_FOUND`。

- [ ] **Step 2: 配置 NSIS 与 WebView2 Evergreen**

应用标识固定 `com.liuyao.divination`，安装范围为 currentUser，目标 x86_64，数据目录与安装目录分离。升级不得删除或覆盖 `app.sqlite` 和 corpus 用户版本。

- [ ] **Step 3: 配置两套独立签名输入**

Authenticode 证书通过 Windows 证书库或 CI secret 提供；Tauri updater 私钥通过 release 环境变量提供。仓库只提交公钥和操作说明，不提交 PFX、密码或 updater 私钥。内部 unsigned 构建必须明确标记 `-internal-unsigned`，不能发布到 stable channel。

- [ ] **Step 4: 构建并验证升级**

Run:

```powershell
npm.cmd run build
powershell -ExecutionPolicy Bypass -File scripts/release/verify-package.ps1 -BundleDir apps/desktop/src-tauri/target/release/bundle
```

Expected: stable 构建签名有效、x64、无密钥模式；从上一内部版本升级后历史与 corpus 版本均保留。

- [ ] **Step 5: 提交**

```powershell
git add apps/desktop/src-tauri scripts/release docs/release/windows.md
git commit -m "build: 配置 Windows 安装签名与安全更新"
```

---

### Task 9: 最终桌面验收与发布候选

**Files:**
- Create: `docs/quality/release-candidate-checklist.md`
- Create: `docs/release/changelog-v0.1.0.md`

**Interfaces:**
- Produces: `v0.1.0-rc.1` 内部发布候选和可复核验收记录。

- [ ] **Step 1: 跑全量自动化**

```powershell
npm.cmd test
npm.cmd run test:e2e
cargo test --workspace
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
npm.cmd run assets:validate
npm.cmd run build
```

Expected: 全部 PASS。

- [ ] **Step 2: 手工完成真实设备矩阵**

在 Windows 干净账户、目标集显、4K 显示器、断网、静音、减少动态、WebGL 回退、AI 401/429/超时、进程中断恢复和版本升级场景逐项记录结果。

- [ ] **Step 3: 完成业务验收**

随机抽取至少 20 次完整起卦，核对动画 faces、数据库 toss 和 Plate 完全一致；随机抽取至少 30 条 AI 古籍判断，逐条打开书页确认引用；专家复核报告与追问保持同卦。

- [ ] **Step 4: 创建发布候选提交与标签**

```powershell
git add docs/quality/release-candidate-checklist.md docs/release/changelog-v0.1.0.md
git commit -m "release: 完成六爻桌面应用首版候选验收"
git tag -a v0.1.0-rc.1 -m "六爻桌面应用 v0.1.0-rc.1"
```

## Completion Gate

- 水墨手影与古币交接无明显位移、亮度或色差跳变。
- 动画 faces、数据库 toss 和 Plate 在所有测试中完全一致。
- 1080p 平衡档与低档达到性能预算，非动画状态不持续占用 GPU。
- reduced motion、静音、键盘与 WebGL 静态回退均完成六爻。
- NSIS 安装、升级、卸载和安全更新验证通过，稳定构建签名有效。
- 完整产品满足设计规格第 16 节全部最终验收定义。
