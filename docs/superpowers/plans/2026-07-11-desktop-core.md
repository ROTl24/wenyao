# 桌面基础与确定性六爻核心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个可安装运行的 Windows Tauri 桌面骨架，用户能输入问题、完成六次静态铜钱起卦、得到版本化排盘并在进程中断后恢复。

**Architecture:** Rust 工作区承载六爻真值与 SQLite 持久化，React/XState 只编排交互并通过窄 Tauri Command 调用核心。第一阶段使用静态铜钱与基础排盘页面，不接古籍、AI 和最终水墨资源；后续计划只依赖这里冻结的 `DivinationPlate`、Repository 和 IPC 接口。

**Tech Stack:** Tauri 2、Rust stable、React、TypeScript、Vite、XState v5、SQLite/SQLx、Vitest、Testing Library、Playwright。

## Global Constraints

- 只支持 Windows x64，桌面壳固定为 Tauri 2 + WebView2 Evergreen。
- 铜钱约定固定为 `qianlong_text2_reverse3_v1`：汉字面 2、背面 3；6 老阴、7 少阳、8 少阴、9 老阳。
- 规则包固定为 `wenwang_najia_v1`，历法规则固定为 `beijing_jieqi_zichu_v1`，时区固定为 `Asia/Shanghai`。
- 动画开始前必须先持久化逻辑结果与 `visual_seed`；重播不能改变两者。
- `DivinationPlate` 创建后不可更新；更正只能废弃原会话并重新起卦。
- 错误文案必须说明原因、数据是否安全和可执行下一步，禁止笼统显示“内部服务错误”。
- 每个任务遵循测试先行并单独提交；所有 Rust、TypeScript 和 E2E 测试通过后才能进入下一份计划。

## File Structure

```text
Cargo.toml
package.json
rust-toolchain.toml
apps/desktop/
  package.json
  vite.config.ts
  src/
    app/App.tsx
    app/router.tsx
    features/casting/castingMachine.ts
    features/casting/CastingPage.tsx
    features/casting/castingMachine.test.ts
    features/plate/PlatePage.tsx
    features/history/HistoryPage.tsx
    lib/commands.ts
    lib/contracts.ts
    test/setup.ts
  src-tauri/
    Cargo.toml
    tauri.conf.json
    capabilities/default.json
    src/lib.rs
    src/main.rs
    src/commands/casting.rs
crates/liuyao-core/
  Cargo.toml
  src/lib.rs
  src/coin.rs
  src/hexagram.rs
  src/calendar.rs
  src/plate.rs
  src/rule_pack.rs
  rule-packs/wenwang_najia_v1.json
  tests/coin_exhaustive.rs
  tests/plate_fixtures.rs
  tests/rule_pack_validation.rs
crates/liuyao-storage/
  Cargo.toml
  migrations/0001_sessions.sql
  src/lib.rs
  src/session_repository.rs
  tests/session_repository.rs
tests/e2e/casting.spec.ts
playwright.config.ts
```

`liuyao-core` 不依赖 Tauri、SQLite、网络或系统时钟。`liuyao-storage` 只接受核心类型，不包含排盘规则。Tauri Command 是唯一跨进程入口，前端不能自行计算铜钱和排盘。

---

### Task 1: 初始化工作区与最小桌面壳

**Files:**
- Create: `package.json`
- Create: `Cargo.toml`
- Create: `rust-toolchain.toml`
- Create: `apps/desktop/**`
- Create: `playwright.config.ts`
- Create: `apps/desktop/src/app/App.test.tsx`

**Interfaces:**
- Produces: 根级 `npm.cmd test`、`cargo test --workspace`、`npm.cmd run test:e2e` 三个统一质量入口。
- Produces: Tauri 应用标识 `com.liuyao.divination` 和窗口标题 `六爻`。

- [ ] **Step 1: 创建根工作区清单**

```json
{
  "name": "liuyao-divination",
  "private": true,
  "workspaces": ["apps/*"],
  "scripts": {
    "dev": "npm run tauri:dev --workspace @liuyao/desktop",
    "test": "npm run test --workspaces --if-present && cargo test --workspace",
    "test:e2e": "playwright test",
    "build": "npm run tauri:build --workspace @liuyao/desktop"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0"
  }
}
```

```toml
# Cargo.toml
[workspace]
resolver = "2"
members = [
  "apps/desktop/src-tauri",
  "crates/liuyao-core",
  "crates/liuyao-storage"
]

[workspace.package]
edition = "2024"
license = "UNLICENSED"

[workspace.dependencies]
anyhow = "1"
chrono = { version = "0.4", features = ["serde"] }
chrono-tz = "0.10"
rand = "0.9"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"
uuid = { version = "1", features = ["v4", "serde"] }
```

```toml
# rust-toolchain.toml
[toolchain]
channel = "stable"
components = ["clippy", "rustfmt"]
targets = ["x86_64-pc-windows-msvc"]
profile = "minimal"
```

- [ ] **Step 2: 生成 React/Tauri 2 应用并安装测试依赖**

Run:

```powershell
npm.cmd create tauri-app@latest apps/desktop -- --template react-ts --manager npm --tauri-version 2 --yes
npm.cmd install
npm.cmd install --workspace @liuyao/desktop xstate @xstate/react react-router-dom
npm.cmd install --workspace @liuyao/desktop -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

将生成的 `apps/desktop/package.json` 的 `name` 改为 `@liuyao/desktop`，并保留生成器写入的 Tauri/React 依赖版本。Expected: `apps/desktop/src-tauri/tauri.conf.json` 存在，`npm.cmd run dev` 能启动 Tauri 窗口。

- [ ] **Step 3: 先写失败的应用壳测试**

```tsx
// apps/desktop/src/app/App.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows the divination question entry', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '心有所问' })).toBeInTheDocument();
    expect(screen.getByLabelText('所占之事')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: 运行测试并确认失败**

Run: `npm.cmd test --workspace @liuyao/desktop -- --run`

Expected: FAIL，提示 `Cannot find module './App'` 或缺少“心有所问”。

- [ ] **Step 5: 实现最小应用壳与测试配置**

```tsx
// apps/desktop/src/app/App.tsx
export function App() {
  return (
    <main>
      <h1>心有所问</h1>
      <label htmlFor="question">所占之事</label>
      <textarea id="question" minLength={10} maxLength={500} />
      <button type="button" disabled>开始起卦</button>
    </main>
  );
}
```

```ts
// apps/desktop/src/test/setup.ts
import '@testing-library/jest-dom/vitest';
```

在 `vite.config.ts` 添加：

```ts
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts']
}
```

- [ ] **Step 6: 验证工作区**

Run:

```powershell
npm.cmd test --workspace @liuyao/desktop -- --run
cargo test --workspace
npm.cmd run tauri:build --workspace @liuyao/desktop -- --debug
```

Expected: 前端测试 PASS；Rust 空工作区测试 PASS；生成 debug Windows 安装/可执行产物。

- [ ] **Step 7: 提交**

```powershell
git add package.json package-lock.json Cargo.toml Cargo.lock rust-toolchain.toml apps/desktop playwright.config.ts
git commit -m "chore: 初始化 Tauri 六爻桌面工作区"
```

---

### Task 2: 实现铜钱、爻值和动变真值

**Files:**
- Create: `crates/liuyao-core/Cargo.toml`
- Create: `crates/liuyao-core/src/lib.rs`
- Create: `crates/liuyao-core/src/coin.rs`
- Create: `crates/liuyao-core/tests/coin_exhaustive.rs`

**Interfaces:**
- Produces: `CoinFace::{Text, Reverse}`。
- Produces: `Toss::from_faces([CoinFace; 3]) -> Toss`。
- Produces: `LineKind::{OldYin, YoungYang, YoungYin, OldYang}` 与 `is_moving()`、`base_is_yang()`、`changed_is_yang()`。

- [ ] **Step 1: 写失败的铜钱约定测试**

```rust
// crates/liuyao-core/tests/coin_exhaustive.rs
use liuyao_core::{CoinFace, LineKind, Toss};

#[test]
fn maps_qianlong_faces_to_six_seven_eight_nine() {
    use CoinFace::{Reverse as R, Text as T};
    assert_eq!(Toss::from_faces([T, T, T]).kind, LineKind::OldYin);
    assert_eq!(Toss::from_faces([T, T, R]).kind, LineKind::YoungYang);
    assert_eq!(Toss::from_faces([T, R, R]).kind, LineKind::YoungYin);
    assert_eq!(Toss::from_faces([R, R, R]).kind, LineKind::OldYang);
}

#[test]
fn only_old_lines_change() {
    for kind in [LineKind::OldYin, LineKind::YoungYang, LineKind::YoungYin, LineKind::OldYang] {
        assert_eq!(kind.base_is_yang() != kind.changed_is_yang(), kind.is_moving());
    }
}
```

- [ ] **Step 2: 运行并确认失败**

Run: `cargo test -p liuyao-core --test coin_exhaustive`

Expected: FAIL，提示 crate 或类型不存在。

- [ ] **Step 3: 实现完整铜钱领域类型**

```rust
// crates/liuyao-core/src/coin.rs
use serde::{Deserialize, Serialize};

pub const COIN_CONVENTION_ID: &str = "qianlong_text2_reverse3_v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CoinFace { Text, Reverse }

impl CoinFace {
    pub const fn value(self) -> u8 {
        match self { Self::Text => 2, Self::Reverse => 3 }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LineKind { OldYin, YoungYang, YoungYin, OldYang }

impl LineKind {
    pub const fn value(self) -> u8 {
        match self { Self::OldYin => 6, Self::YoungYang => 7, Self::YoungYin => 8, Self::OldYang => 9 }
    }
    pub const fn is_moving(self) -> bool { matches!(self, Self::OldYin | Self::OldYang) }
    pub const fn base_is_yang(self) -> bool { matches!(self, Self::YoungYang | Self::OldYang) }
    pub const fn changed_is_yang(self) -> bool {
        if self.is_moving() { !self.base_is_yang() } else { self.base_is_yang() }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Toss { pub faces: [CoinFace; 3], pub value: u8, pub kind: LineKind }

impl Toss {
    pub fn from_faces(faces: [CoinFace; 3]) -> Self {
        let value = faces.into_iter().map(CoinFace::value).sum();
        let kind = match value {
            6 => LineKind::OldYin,
            7 => LineKind::YoungYang,
            8 => LineKind::YoungYin,
            9 => LineKind::OldYang,
            _ => unreachable!("three 2/3-valued coins always sum to 6..=9"),
        };
        Self { faces, value, kind }
    }
}
```

```rust
// crates/liuyao-core/src/lib.rs
mod coin;
pub use coin::*;
```

- [ ] **Step 4: 增加八种正反组合穷举断言并运行**

在测试中循环 `0..8` 生成三枚面，断言每组只映射到 6、7、8、9，并断言组合数量分布为 `1,3,3,1`。

Run: `cargo test -p liuyao-core --test coin_exhaustive`

Expected: 3 tests PASS。

- [ ] **Step 5: 提交**

```powershell
git add crates/liuyao-core
git commit -m "feat(core): 建立乾隆铜钱与动爻真值模型"
```

---

### Task 3: 建立受审规则包与不可变排盘

**Files:**
- Create: `crates/liuyao-core/src/hexagram.rs`
- Create: `crates/liuyao-core/src/calendar.rs`
- Create: `crates/liuyao-core/src/rule_pack.rs`
- Create: `crates/liuyao-core/src/plate.rs`
- Create: `crates/liuyao-core/rule-packs/wenwang_najia_v1.json`
- Create: `crates/liuyao-core/tests/rule_pack_validation.rs`
- Create: `crates/liuyao-core/tests/plate_fixtures.rs`
- Create: `docs/domain/wenwang_najia_v1-review.md`

**Interfaces:**
- Consumes: `Toss`、`LineKind`。
- Produces: `RulePack::load_embedded() -> Result<RulePack, RulePackError>`。
- Produces: `build_plate(plate_id, session_id, cast_at, [Toss; 6], &RulePack) -> Result<DivinationPlate, CoreError>`。
- Produces: JSON 序列化稳定的 `DivinationPlate`；后续计划不得重定义字段。

- [ ] **Step 1: 先写规则包完整性测试**

```rust
// crates/liuyao-core/tests/rule_pack_validation.rs
use liuyao_core::RulePack;

#[test]
fn embedded_rule_pack_is_complete_and_approved() {
    let pack = RulePack::load_embedded().expect("valid embedded rule pack");
    assert_eq!(pack.id, "wenwang_najia_v1");
    assert_eq!(pack.review_status, "approved");
    assert_eq!(pack.hexagrams.len(), 64);
    assert_eq!(pack.trigrams.len(), 8);
    assert!(pack.hexagrams.iter().all(|h| h.lines.len() == 6));
}
```

在同一测试文件定义 helper：`fixture_tosses` 将 6/7/8/9 分别映射为 `[T,T,T]`、`[T,T,R]`、`[T,R,R]`、`[R,R,R]`；`build_fixture_plate` 使用固定 `plate_id`、`session_id`、`2026-07-11T12:00:00+08:00` 和已批准规则包调用 `build_plate`。不得从系统时钟或随机源生成测试 fixture。

- [ ] **Step 2: 运行并确认失败**

Run: `cargo test -p liuyao-core --test rule_pack_validation`

Expected: FAIL，提示 `RulePack` 不存在。

- [ ] **Step 3: 定义规则包 Schema 与拒绝条件**

```rust
// crates/liuyao-core/src/rule_pack.rs
#[derive(Debug, Clone, serde::Deserialize)]
pub struct RulePack {
    pub id: String,
    pub review_status: String,
    pub source_sha256: String,
    pub trigrams: Vec<TrigramRule>,
    pub hexagrams: Vec<HexagramRule>,
}

impl RulePack {
    pub fn load_embedded() -> Result<Self, RulePackError> {
        let pack: Self = serde_json::from_str(include_str!("../rule-packs/wenwang_najia_v1.json"))?;
        pack.validate()?;
        Ok(pack)
    }

    fn validate(&self) -> Result<(), RulePackError> {
        if self.id != "wenwang_najia_v1" { return Err(RulePackError::WrongId); }
        if self.review_status != "approved" { return Err(RulePackError::NotApproved); }
        if self.trigrams.len() != 8 || self.hexagrams.len() != 64 { return Err(RulePackError::Incomplete); }
        Ok(())
    }
}
```

规则包数据不能从模型记忆直接填写。执行本任务时，从用户提供的第一本包含完整纳甲、世应和伏神表的原书提取，并在 `docs/domain/wenwang_najia_v1-review.md` 记录书名、版本、页码、提取者、复核者、差异与 SHA-256；只有复核结论为“通过”才把 JSON 的 `review_status` 设为 `approved`。这是执行输入门，不是待实现功能。

- [ ] **Step 4: 写排盘不变量测试**

```rust
#[test]
fn changed_hexagram_flips_only_moving_lines() {
    let tosses = fixture_tosses([6, 7, 8, 9, 7, 8]);
    let plate = build_fixture_plate(tosses);
    for index in 0..6 {
        let changed = plate.base_lines[index] != plate.changed_lines[index];
        assert_eq!(changed, plate.lines[index].kind.is_moving());
    }
}
```

- [ ] **Step 5: 实现 `DivinationPlate` 与 4096 组合测试**

`DivinationPlate` 必须包含 `plate_id`、`session_id`、规格中的全部版本字段、原始六次投币、本卦、变卦、动爻、上下卦、逐爻详情、月建、日干支和旬空。历法函数显式接收 `DateTime<FixedOffset>`，不得在核心内部读取系统时间。

测试用 `for encoded in 0..4096` 将每两位映射为 6/7/8/9，构建 Plate 并断言：六爻数量为 6、动爻集合准确、只翻动爻、所有卦键存在于受审规则包。

Run: `cargo test -p liuyao-core`

Expected: 规则包测试、黄金用例和 4096 组合测试全部 PASS。

- [ ] **Step 6: 提交**

```powershell
git add crates/liuyao-core docs/domain
git commit -m "feat(core): 实现受审纳甲规则包与不可变排盘"
```

---

### Task 4: 持久化会话、投币与崩溃恢复

**Files:**
- Create: `crates/liuyao-storage/Cargo.toml`
- Create: `crates/liuyao-storage/migrations/0001_sessions.sql`
- Create: `crates/liuyao-storage/src/lib.rs`
- Create: `crates/liuyao-storage/src/session_repository.rs`
- Create: `crates/liuyao-storage/tests/session_repository.rs`

**Interfaces:**
- Produces: `SessionRepository::create_session(NewSession) -> Session`。
- Produces: `prepare_toss(session_id) -> PreparedToss`，在事务中写入 faces、line value、`visual_seed` 与状态。
- Produces: `confirm_toss(session_id, toss_id) -> SessionSnapshot`，幂等确认且最多六爻。
- Produces: `save_plate(session_id, &DivinationPlate)` 与 `resume_session(session_id)`。

- [ ] **Step 1: 写事务与幂等失败测试**

```rust
#[tokio::test]
async fn confirming_the_same_toss_twice_does_not_add_two_lines() {
    let repo = test_repository().await;
    let session = repo.create_session(new_session()).await.unwrap();
    let toss = repo.prepare_toss(session.id).await.unwrap();
    repo.confirm_toss(session.id, toss.id).await.unwrap();
    let snapshot = repo.confirm_toss(session.id, toss.id).await.unwrap();
    assert_eq!(snapshot.confirmed_lines.len(), 1);
}
```

- [ ] **Step 2: 运行并确认失败**

Run: `cargo test -p liuyao-storage`

Expected: FAIL，Repository 不存在。

- [ ] **Step 3: 创建数据库模式**

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL CHECK(length(question) BETWEEN 10 AND 500),
  category TEXT NOT NULL,
  cast_at_utc TEXT NOT NULL,
  timezone TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

CREATE TABLE tosses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  line_index INTEGER NOT NULL CHECK(line_index BETWEEN 0 AND 5),
  faces_json TEXT NOT NULL,
  line_value INTEGER NOT NULL CHECK(line_value BETWEEN 6 AND 9),
  visual_seed TEXT NOT NULL,
  confirmed_at_utc TEXT,
  UNIQUE(session_id, line_index)
);

CREATE TABLE plates (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  plate_json TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  created_at_utc TEXT NOT NULL
);
```

- [ ] **Step 4: 实现 Repository 事务**

`prepare_toss` 必须先查询当前未确认 toss；若存在则原样返回，若不存在且已确认少于六爻才使用 OS 随机源生成 faces 与 128-bit `visual_seed` 并在一个事务中插入。`confirm_toss` 使用条件更新和唯一约束保证幂等。

数据库启动时执行 SQLx migrations。发现模式升级时先复制 `app.sqlite`、`-wal`、`-shm` 到带时间戳备份目录，再在事务中迁移；迁移失败恢复备份并以只读错误状态启动，禁止半迁移继续写入。

- [ ] **Step 5: 运行并覆盖恢复场景**

增加测试：准备后未确认重启返回同一 toss；确认六次后拒绝第七次；保存 Plate 后不可覆盖；删除 session 级联清理。

Run: `cargo test -p liuyao-storage`

Expected: 所有 Repository 测试 PASS。

- [ ] **Step 6: 提交**

```powershell
git add crates/liuyao-storage
git commit -m "feat(storage): 持久化起卦会话与幂等恢复"
```

---

### Task 5: 打通 Tauri Command 与 XState 起卦状态机

**Files:**
- Create: `apps/desktop/src-tauri/src/commands/casting.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Create: `apps/desktop/src/lib/contracts.ts`
- Create: `apps/desktop/src/lib/commands.ts`
- Create: `apps/desktop/src/features/casting/castingMachine.ts`
- Create: `apps/desktop/src/features/casting/castingMachine.test.ts`

**Interfaces:**
- Produces Commands: `create_session`、`prepare_toss`、`confirm_toss`、`build_plate`、`resume_session`。
- Produces Events: 前端本地事件 `ANIMATION_DONE`、`CONFIRM`、`RETRY`；Rust 不接收动画帧事件。

所有 IPC DTO 在 Rust 使用 `#[serde(rename_all = "camelCase")]`；因此 Rust 领域字段 `visual_seed`、`line_value`、`plate_id` 在 TypeScript 中固定为 `visualSeed`、`lineValue`、`plateId`。

- [ ] **Step 1: 写状态机拒绝非法确认的失败测试**

```ts
it('ignores CONFIRM before coins settle', () => {
  const actor = createActor(castingMachine, { input: fixtureSession() }).start();
  actor.send({ type: 'START_CAST' });
  actor.send({ type: 'CONFIRM' });
  expect(actor.getSnapshot().context.confirmedLines).toHaveLength(0);
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `npm.cmd test --workspace @liuyao/desktop -- castingMachine.test.ts --run`

Expected: FAIL，状态机不存在。

- [ ] **Step 3: 实现窄 Command 适配器**

```rust
#[tauri::command]
pub async fn prepare_toss(
    state: tauri::State<'_, AppState>,
    session_id: uuid::Uuid,
) -> Result<PreparedTossDto, CommandError> {
    state.sessions.prepare_toss(session_id).await.map(Into::into).map_err(Into::into)
}
```

所有 Command 返回带稳定 `code`、`message`、`data_safe`、`next_action` 的错误对象。不得向前端返回 Rust debug 字符串或数据库 SQL。

- [ ] **Step 4: 实现 XState 状态与服务调用**

`START_CAST` 调用 `prepare_toss`；成功后依次进入手部、飞行、落定状态；只有 `awaitingConfirmation` 的 `CONFIRM` 调用 `confirm_toss`。第六爻确认后调用 `build_plate` 并进入 `plateReady`。

- [ ] **Step 5: 测试连点、失败与恢复**

使用 mock Commands 覆盖：动画中确认被忽略；连续 CONFIRM 只调用一次；`prepare_toss` 失败进入可重试状态；恢复未确认 toss 使用同一 faces/seed；第六爻后只构建一次 Plate。

Run: `npm.cmd test --workspace @liuyao/desktop -- --run`

Expected: 状态机测试全部 PASS。

- [ ] **Step 6: 提交**

```powershell
git add apps/desktop/src-tauri apps/desktop/src/lib apps/desktop/src/features/casting
git commit -m "feat(desktop): 打通起卦命令与防连点状态机"
```

---

### Task 6: 交付静态起卦闭环、排盘页与 E2E

**Files:**
- Modify: `apps/desktop/src/app/App.tsx`
- Create: `apps/desktop/src/features/casting/CastingPage.tsx`
- Create: `apps/desktop/src/features/plate/PlatePage.tsx`
- Create: `apps/desktop/src/features/history/HistoryPage.tsx`
- Create: `tests/e2e/casting.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**
- Consumes: Task 5 Commands 与状态机。
- Produces: 后续视觉计划可替换的 `RitualStage` 插槽和稳定 `data-testid`。
- Produces: 后续 AI 计划可挂载的 `AnalysisPanel` 插槽。
- Produces: 可按问题、事项类型、本卦、变卦搜索并恢复/删除的本地历史页。

- [ ] **Step 1: 写失败的六轮用户旅程测试**

```ts
test('casts six lines and opens the immutable plate', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('所占之事').fill('近期事业是否会出现新的发展机会？');
  await page.getByLabel('事项类型').selectOption('career');
  await page.getByRole('button', { name: '开始起卦' }).click();
  for (let line = 1; line <= 6; line += 1) {
    await expect(page.getByText(`第 ${line} 爻`)).toBeVisible();
    await page.getByRole('button', { name: '定此爻' }).click();
  }
  await expect(page.getByRole('heading', { name: '排盘' })).toBeVisible();
  await expect(page.getByTestId('base-hexagram')).toBeVisible();
  await expect(page.getByTestId('changed-hexagram')).toBeVisible();
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `npm.cmd run test:e2e -- casting.spec.ts`

Expected: FAIL，事项类型或起卦页面不存在。

- [ ] **Step 3: 实现静态 UI**

首页对 `question` 使用 10–500 字符校验；API 未配置不阻止起卦。CastingPage 使用静态铜钱圆片显示 `text/reverse` 和 6/7/8/9，按钮只在状态机允许时启用。PlatePage 使用 DOM 展示六爻、本卦、变卦、动爻、纳甲、六亲、世应、月日和旬空。HistoryPage 按起卦时间倒序展示，支持问题、事项类型、本卦和变卦搜索；恢复进入最后持久化状态，删除执行二次确认并调用 Repository 级联事务。

- [ ] **Step 4: 添加崩溃恢复 E2E**

测试完成三爻后刷新页面，断言仍显示三条已确认爻并继续第四爻；在铜钱落定但未确认时刷新，断言 faces 与 `visual_seed` 对应的静态落点未改变。再创建一个已完成会话，断言历史搜索可找到、打开后 Plate 不重算、删除后相关 toss/plate 均不存在。

- [ ] **Step 5: 运行全部质量门**

Run:

```powershell
npm.cmd test
npm.cmd run test:e2e
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
npm.cmd run build
```

Expected: 全部 PASS；生成 Windows debug 安装产物；工作区无警告。

- [ ] **Step 6: 提交**

```powershell
git add apps/desktop tests playwright.config.ts
git commit -m "feat(desktop): 交付可恢复的六爻排盘闭环"
```

## Completion Gate

只有以下条件全部满足才能进入古籍计划：

- 4096 组合与规则包黄金用例全绿。
- 六次确认严格生成六爻，连点和重启不改变结果。
- `DivinationPlate` JSON 已冻结并生成一份版本化快照测试。
- 静态 UI 能完整起卦、排盘、查看历史会话。
- Windows debug 安装包能在干净测试账户启动。
