# 六爻桌面应用实施路线索引

本索引连接四份实施计划，固定执行顺序、跨计划接口和外部输入。不得并行实现依赖尚未冻结的下游模块。

## 执行顺序

1. [桌面基础与确定性六爻核心](./2026-07-11-desktop-core.md)
2. [古籍证据包与混合检索](./2026-07-11-corpus-retrieval.md)
3. [AI 解卦报告与追问](./2026-07-11-ai-analysis-chat.md)
4. [水墨视觉、性能与 Windows 发布](./2026-07-11-visual-release.md)

前一份计划的 Completion Gate 全部通过后，才能执行下一份。视觉资源契约可以在第二、三份计划期间单独制作，但视觉运行时代码不得在 `PreparedToss`、`DivinationPlate` 和状态机接口冻结前合并。

## 冻结接口

### Rust 领域与 IPC 命名

- Rust 领域字段使用 snake_case：`plate_id`、`session_id`、`visual_seed`、`line_value`、`evidence_id`。
- Tauri DTO 使用 `#[serde(rename_all = "camelCase")]`。
- TypeScript 固定使用 `plateId`、`sessionId`、`visualSeed`、`lineValue`、`evidenceId`。
- 数据库列保持 snake_case。
- 任一计划不得新增第二套同义名称。

### 核心对象

```text
PreparedToss
  id / sessionId / lineIndex / faces[3] / lineValue / lineKind / visualSeed

DivinationPlate
  plateId / sessionId / engineVersion / coinConventionId / rulePackId
  calendarRuleId / timezone / castAt / rawTosses[6] / baseHexagram
  changedHexagram / movingLines / trigrams / lineDetails[6]
  monthBranch / dayStemBranch / voidBranches / computedFacts

EvidencePack
  id / sessionId / plateId / queryHash / items[<=12] / createdAt

AnalysisReport
  plateSummary / yongshenAnalysis / strengthAndRelations
  movingLineAnalysis / classicalClaims / synthesis
  uncertainties / actionableGuidance
```

`PreparedToss` 在动画前持久化；`DivinationPlate` 和 `EvidencePack` 创建后不可变；`AnalysisReport` 只有校验通过后才成为正式报告。

## 外部执行输入

以下内容必须在对应任务执行时真实提供，不允许用模型猜测、演示值或未授权素材代替：

- 用户提供的约 10 本古籍源文件、书名、版本和来源。
- 至少一本能够复核纳甲、世应、伏神和历法规则的原书页面；规则包必须记录页码与 SHA-256。
- 可调用 Chat 和 Embedding 的真实云端 Provider 配置。
- 最终水墨手影、乾隆古币与声音的合法源文件或可证明授权的制作产物。
- 稳定版 Authenticode 证书与 Tauri updater 私钥；两者只通过发布环境提供。
- 至少两名懂六爻的业务评审者，用于规则表、检索与 AI 报告验收。

这些输入都有确定的校验流程和拒绝条件，因此不是计划占位符。缺少输入时，只能完成输入前的可测试任务，不能伪造数据跨过质量门。

## 统一质量命令

```powershell
npm.cmd test
npm.cmd run test:e2e
cargo test --workspace
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
tools\corpus-builder\.venv\Scripts\python.exe -m pytest tools/corpus-builder/tests -v
npm.cmd run assets:validate
npm.cmd run build
```

首次计划尚未创建某个工作区时，只运行已经存在的命令；从第四份计划开始，以上命令必须全部执行并通过。

## 测试 Fixture 约定

计划代码片段中的 `fixture_*`、`mock_*`、`fake_*` 和 `test_*` helper 必须与首次使用它的测试一起创建，放在同一测试文件或相邻 `tests/support`。它们只返回本索引定义的核心对象，使用固定 UUID、固定 `2026-07-11T12:00:00+08:00`、固定 evidence ID 和字面量数据；不得读取系统时间、随机源、真实密钥、网络或生产数据库。生产代码不得依赖这些 helper。

## 提交纪律

- 每个 Task 一个独立中文 Conventional Commit。
- 提交前只暂存该 Task 声明的文件。
- 任何 golden fixture、规则包、语料 manifest 或视觉基线变更必须在提交说明中写明原因。
- 不提交 `.env`、API Key、PFX、updater 私钥、`corpus/source/`、`corpus/build/` 或视觉伴侣临时文件。
- 不在质量门失败时通过跳过测试、降低断言或吞掉错误继续执行。
