# Task 6 真实浏览器动效修复报告

## 结果

- 状态：DONE
- 基线：`b2d595ea3f679bafe3b96d0c74814e0f19284f7b`
- 提交：本报告所在提交
- 提交信息：`fix(ritual): 修复蓄力释钱与古钱越界`
- 范围：仅摇卦动效、CoinRig/静态降级可见性、轨迹、阴影配置及测试；未改结果页与领域规则。

## 根因与修复

### 全轮次闭手、墨幕、开手

- 原实现只让首爻走闭手与墨幕切镜；后续爻在 `held` 阶段直接显示开手终态。
- 所有非 reduced-motion 轮次现在都以闭手首帧开始；首爻仍为 3.20 秒，后续仍为 2.20 秒。
- 后续爻冻结标签为 `inkCover=.44`、`release=.46`、`coinsAirborne=.68`；墨幕先升到完全不透明，再原子切换闭/开手，随后揭幕。
- `InkHands` 自身的非 reduced 初始 DOM 也统一为闭手，避免时间轴绑定前出现一帧开手闪烁。

### CoinRig 唯一 visibility 时钟

- `CoinRigHandle` 新增 `setVisible()`。真实 Three Object3D 创建时即隐藏；同一 Canvas 跨 toss 的 `prepare()` 会先原子隐藏，再写新轨迹首帧。
- GSAP 主时间轴在创建、release、seek、seekProgress、finish、restart 和 target rebind 时统一同步 visibility；release 前始终隐藏，release 写可见后才发布 phase。
- `snapToEnd()` 同时保证末帧姿态与可见；skip、reduced motion、ready 后真实 rig 迟到均得到同一结果。
- Suspense/WebGL 静态 fallback 实现同一 `CoinRigHandle` 接口，DOM 首帧内联 hidden，`prepare/release/snap` 与真实 rig 语义一致；未增加 CSS transition、timeout、RAF 或第二时钟。

### 掌心安全轨迹

- 起点 y 从 `2.25–2.65` 降至 `0.40–0.70`，控制点增量收敛为 `0.40–0.50` 与 `0.30–0.40`。
- 48 组确定性种子、每币 91 个飞行采样验证：控制点 y 不超过 `1.25/1.15`，实际飞行 y 不超过 `1.08`，并限制 x/z 视口边界。
- 既有 tossId、visualSeed、lineIndex 确定性、接触错峰、反弹与最终币面测试保持通过。

### Three 阴影与依赖 warning

- Canvas 从默认 `shadows` 改为 R3F 9 支持的 `shadows="basic"`，不再选择 Three r185 已弃用的 `PCFSoftShadowMap`；没有屏蔽 console。
- `THREE.Clock` 弃用提示来自 `@react-three/fiber/dist/events-*.js` 创建的内部 `new THREE.Clock()`；本项目动效不读取该 clock，仍由 GSAP 单时间轴驱动 CoinRig。按要求未 monkey patch 依赖。

## TDD 红灯证据

- 轨迹测试先得到起点 `2.4979 > 0.8`，证明顶部裁切路径被捕获；收紧控制点时又得到 `1.3116 > 1.25`，实现后通过。
- 时间轴测试先得到后续爻 `inkCover=0`、闭手 opacity `0`、visibility 无调用；实现后全绿。
- CoinRig 跨 toss 测试先证明上一爻 snap 后再次 `prepare()` 仍保持 visible；原子隐藏后通过。
- 静态 fallback 测试先证明 release 前未 hidden；统一适配器后 skip 前 hidden、skip 后 visible。
- 阴影配置测试先得到导出值 `undefined`，改用 basic shadow 后通过。

## 验证

最终聚焦矩阵：

```text
npm.cmd run test:unit -- src/features/ritual/coinTrajectory.test.ts src/features/ritual/CoinRig.test.ts src/features/ritual/createRitualTimeline.test.ts src/features/ritual/useRitualController.test.tsx src/features/ritual/InkHands.test.tsx src/components/CoinScene.test.tsx src/components/RitualScreen.test.tsx
```

结果：7 files、58 tests 全部通过。

整合后的全量 unit：21 files、125 tests 全部通过。显式 `npm.cmd run typecheck` 退出码 0；`npm.cmd run build:renderer` 转换 1,819 modules 并成功产出。构建仅保留既有的大 chunk 非阻断 warning。最终提交后由主线程在合并 HEAD 再跑一次全矩阵。
