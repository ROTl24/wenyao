# 问爻 macOS 零成本开源发行方案

> 调研基准日：2026-08-23

## 结论

问爻的 macOS 发行渠道为公开 GitHub Releases，发行预算为零。正式产物是同时支持 Intel 与 Apple Silicon 的 universal DMG，应用使用 ad-hoc signature 封装，不依赖 Apple Developer Program、Developer ID 或 Apple 公证服务。

这条路线可以让 Mac 用户安装并完整使用软件，但无法获得 Apple 的开发者身份背书。用户首次打开时会遇到 Gatekeeper 警告，需要在“系统设置 → 隐私与安全性”中点击“仍要打开”。Apple 官方允许用户对可信来源的软件执行这项单应用授权；应用之后通常可以直接双击运行。

零成本发行的产品承诺是：

- GitHub Releases 提供 `WenYao-<version>-universal.dmg` 和 SHA-256 校验值。
- macOS 13 及以上，Intel x86_64 与 Apple Silicon arm64 均为支持范围。
- 应用功能与 Windows 版保持同一业务核心，Mac 差异收敛在桌面平台层。
- 首次安装需要一次明确的 Gatekeeper 手动授权。
- Mac 版本采用手动更新：应用提示新版本并打开 GitHub Release，用户重新下载和覆盖安装。
- 每个版本保留可审计的源码 tag、CI 日志、构建产物和校验值。

## 平台事实与边界

Apple 的免费账号提供 Xcode 和个人设备开发能力，但 Developer ID 与 Mac 软件公证属于每年 99 美元的 Apple Developer Program。免费账号不能生成面向公众分发所需的 Developer ID 证书，也不能把应用提交至公证服务。

Electron 官方明确说明，未使用 Developer ID 签名和公证的应用仍可分发，但用户需要完成额外的手动授权。Apple 的 Gatekeeper 默认只信任 Mac App Store 或 Developer ID 软件，因此 ad-hoc signature 只能封装代码完整性，不能把发布者变成 Apple 已识别开发者，也不能消除首次打开警告。

项目不会要求用户全局关闭 Gatekeeper，也不会分发需要用户安装的自签根证书。安装指南只使用 Apple 提供的单应用“仍要打开”机制。命令行清理 quarantine 仅作为校验过 SHA-256 后的高级故障排查，不作为标准安装步骤。

## 仓库现状

| 领域 | 当前证据 | macOS 影响 |
| --- | --- | --- |
| 业务核心 | React、TypeScript、排盘、历史、古籍与 AI 编排没有 Windows 原生依赖 | 继续复用同一 renderer 和领域逻辑 |
| Electron 安全 | `contextIsolation`、`sandbox`、`webSecurity` 已启用，`nodeIntegration` 已关闭 | 保留现有安全基线 |
| 生命周期 | 已处理 Darwin 下关闭窗口不退出和 Dock `activate` 重建窗口 | 基础行为可复用 |
| 数据目录 | packaged 模式把 `userData`、`sessionData` 指向 `process.execPath` 旁的 `data` | Mac 会尝试写入 `.app/Contents/MacOS`，属于启动阻塞项 |
| 密钥 | 使用 Electron `safeStorage`，界面和错误文案写死为 Windows DPAPI | Mac 使用 Keychain，需要平台化状态和失败恢复 |
| 更新 | 更新器仅对 Windows 启用 | Mac 保持关闭，改用 GitHub Release 手动更新 |
| 打包 | 只有 Windows NSIS x64 | 增加 universal DMG 与 ad-hoc sealing |
| 发布 | Windows job 独立发布 stable | 改成多平台资产聚合后一次发布 |
| 标题栏 | 右侧为 Windows window controls 预留 142px | Mac 左侧 traffic lights 会发生布局冲突 |
| 图形 | WebGL 初始化没有可操作降级 | GPU 故障可能阻断核心起卦流程 |
| 内部脚本 | 多处写死 `electron.exe` | Mac runner 无法执行相同验证命令 |

## 产物设计

### 用户产物

| 产物 | 用途 |
| --- | --- |
| `WenYao-<version>-universal.dmg` | 用户下载、挂载并拖入 `/Applications` |
| `SHA256SUMS.txt` | 用户和维护者验证下载完整性 |
| GitHub 自动生成源码归档 | 对应发行 tag 的源码审计入口 |

DMG 是唯一面向普通用户的安装入口。ZIP 不承担自动更新，因此不进入必需资产清单。若后续出现便携分发需求，可增加 ZIP，但不能把两个入口同时作为默认下载项。

### ad-hoc signature

Mac 构建在 macOS runner 上完成。所有 Mach-O、Electron Framework、Helper 和主应用使用 `codesign --sign -` 生成 ad-hoc signature，再封装 DMG。它的作用是保证应用包内部代码具有一致的 seal，并满足 Apple Silicon 对可执行代码签名结构的要求；它不包含开发者身份，也不能用于 Apple 公证。

发布校验需要确认：

- `codesign --verify --deep --strict` 能验证应用内部 seal。
- `codesign -dv` 显示 ad-hoc signature，不得误报为 Developer ID 或 Apple 公证产物。
- `spctl --assess` 预计拒绝或标记 unidentified developer；这是零成本发行的预期边界，不得把它包装成通过 Gatekeeper。
- `lipo -archs` 对主程序和关键 Helper 同时返回 `x86_64 arm64`。
- `hdiutil verify` 验证 DMG 结构。
- 构建后的 `.app` 在启动前后内容不发生写入。

## 用户安装体验

标准安装说明固定为：

1. 从项目官方 GitHub Release 下载 DMG，并核对版本和 SHA-256。
2. 打开 DMG，把“问爻”拖入 `/Applications`。
3. 第一次双击时 macOS 会阻止打开并显示无法验证开发者或无法检查恶意软件。
4. 打开“系统设置 → 隐私与安全性”，在安全区域点击“仍要打开”。
5. 再次确认打开。macOS 会为这个应用保存例外，之后可以正常双击。

安装页需要同时说明：

- 警告产生于项目没有付费 Developer ID，并不表示 Apple 已完成恶意软件检测。
- 用户只应从项目官方 GitHub Release 下载，并在执行授权前核对 SHA-256。
- 企业受管 Mac 可能由管理员禁止“仍要打开”，该设备无法通过本方案安装。
- 如果系统明确提示应用已损坏或包含恶意内容，应停止操作并提交 issue，不把全局关闭安全功能当作解决方案。

## 桌面平台层

### 数据路径

新增 `electron/services/app-paths.cjs` 统一解析数据目录：

- Mac durable data 使用 Electron `app.getPath('userData')`，通常位于 `~/Library/Application Support/问爻`。
- Chromium `sessionData` 与可再生缓存分离，不放进 `.app` 或 DMG。
- 历史、AI 配置、用户语料和向量索引保持持久化；向量索引的重建可能触发付费 embedding，不放入系统可能自动清理的缓存目录。
- Windows 继续读取现有安装目录数据，避免破坏已有用户。
- 测试保证任何 packaged Mac 路径都不位于 `.app/Contents`。

### Keychain

新增 `electron/services/secret-store.cjs` 包装 `safeStorage`：

- preload 对 renderer 提供 Promise 接口和可恢复错误。
- UI 根据 runtime profile 显示“macOS 钥匙串”或“Windows DPAPI”。
- Keychain 锁定、拒绝、条目缺失或升级后无法解密时保留原密文，提示重新输入密钥。
- ad-hoc signature 的代码身份不具备 Developer ID 的跨版本稳定性，因此每个社区候选版本都必须验证覆盖安装后的密钥读取；失败时只影响 AI 密钥，不得损坏历史、排盘或语料。

### 窗口与系统交互

- Mac 使用左侧 traffic lights 安全区，Windows 的右侧 `titleBarOverlay` 不应用于 Darwin。
- 提供 About、Services、Hide、Quit、Edit、Window、Help 原生菜单。
- 验证 `Cmd+Q/W/M/,/C/V/A/Z`、关闭最后窗口、Dock 重开、全屏和分屏。
- 使用真正的 `.icns`，并检查 Dock、Finder 和小尺寸图标。
- 13 英寸屏幕、Retina、外接显示器、缩放与 Stage Manager 不得遮挡核心操作。

### 通用稳定性

- WebGL 初始化失败、上下文丢失或 GPU 子进程退出时切换到确定性 2D/文本投币表现，不能重新随机。
- 中文输入法 composition 期间按 Enter 只确认候选，不提交 AI 追问。
- 导入文件名统一为 Unicode NFC，覆盖 APFS NFD 文件名和大小写敏感卷。
- 数据增加根 schema 版本、迁移前备份、原子写入和未来 schema 拒绝写入。
- 睡眠、唤醒、网络切换和显示器切换不得重复发送 AI 请求。

## 更新策略

Mac 的 `electron-updater` 保持禁用。无稳定 Developer ID 身份的自动替换链难以提供可靠的签名连续性，也会把安全风险隐藏在后台更新中。

应用只提供显式的“检查新版本”操作：

1. 用户主动点击后读取 GitHub 最新 Release 版本号。
2. 有新版本时展示版本号、发布日期和变更摘要。
3. 点击下载后在默认浏览器打开对应 Release。
4. 用户下载新 DMG 并覆盖 `/Applications/问爻.app`。
5. 应用数据继续从 Application Support 读取；新版本不得把缺失 Keychain 权限误判为数据损坏。

不在后台轮询 GitHub，不使用未经认证的自建更新服务器，不在应用内绕过 Gatekeeper。

## 零成本 CI 与发布链

公开仓库可免费使用 GitHub 标准 macOS runner。工作流使用明确的 `macos-15` Apple Silicon 与 `macos-15-intel` 标签，不依赖架构可能变化的 `macos-latest`。

推荐拓扑：

```text
版本/tag 一致性检查
  -> Windows 测试与构建 --------+
  -> macOS ARM 测试 ------------+-> universal DMG 构建与校验
  -> macOS Intel 测试 ----------+-> 资产聚合校验 -> 唯一发布作业 -> stable
  -> Linux 大小写/路径检查 -----+
```

安全要求：

- PR job 与 release job 都不需要 Apple 证书、P12、API key 或公证秘密。
- job 权限默认 `contents: read`，只有最终发布 job 使用 `contents: write`。
- 构建 job 只上传 Actions artifact，不直接公开 Release。
- 最终 job 校验确切文件名、版本、架构、大小和 SHA-256 后一次发布。
- 第三方 action 固定完整 commit SHA；依赖安装使用 lockfile。
- Release notes 清楚标注“未经过 Apple 公证，首次启动需要手动授权”。

## 验证矩阵

### 自动化

- Windows：现有测试、类型检查、renderer build 和 NSIS 回归。
- macOS Apple Silicon：测试、类型检查、renderer build、universal 打包、ARM 原生启动冒烟。
- macOS Intel：测试和 x64 原生启动冒烟。
- Linux：路径大小写、Unicode 文件名和纯逻辑测试。
- 产物：`codesign` 内部 seal、`lipo` 双架构、`hdiutil`、版本、SHA-256、应用目录只读契约。

### 社区真机验收

GitHub runner 不能替代真实 Gatekeeper、Keychain、输入法和显示环境。发布候选通过 prerelease 提供给提出 Mac 需求的用户，issue 表单收集：

- Mac 型号、Intel/Apple Silicon、macOS 版本。
- DMG 下载、拖入 Applications、首次“仍要打开”的实际提示。
- 启动、四种起卦、动画与静态降级、历史重开。
- Keychain 保存和重启读取。
- TXT/MD 语料导入、中文文件名和拖放。
- AI provider、自定义 HTTPS endpoint、断网和失败恢复。
- Retina/外接屏、全屏/分屏、中文输入法和 VoiceOver。
- 从前一候选版本覆盖安装后的数据与密钥状态。

在 Intel、Apple Silicon 和最低 macOS 13 都获得真实通过记录之前，Release 标记为 prerelease。进入 stable 只表示项目已完成自身支持矩阵，不表示 Apple 已签名或公证该应用。

## 实施顺序

1. 修复 Mac 数据目录和平台无关 Electron 可执行文件解析。
2. 建立 runtime profile、Keychain adapter、Darwin 标题栏和原生菜单。
3. 增加 WebGL 降级、IME、Unicode、schema 和恢复测试。
4. 配置 universal DMG、ad-hoc sealing、SHA-256 与 Mac 产物验证脚本。
5. 重构 Windows/Mac 原子发布工作流，Mac 更新入口改为 GitHub Release。
6. 发布 prerelease，完成 Intel、Apple Silicon 和 macOS 13 社区验收。
7. 完成覆盖安装与数据保留验证后发布 stable。

## 完成定义

macOS 版本可以声明可用，需要同时满足：

- GitHub Release 产出 universal DMG 和 SHA-256，来源对应唯一 tag/commit。
- `.app` 的所有关键 Mach-O 同时包含 `x86_64 arm64` 并通过内部 ad-hoc seal 验证。
- 安装和运行期间没有文件写入 `.app`。
- Intel、Apple Silicon 和 macOS 13 真实用户完成 Apple 官方“仍要打开”流程并成功启动。
- 起卦、历史、Keychain、语料、AI、外链、窗口、输入法和 GPU 降级完成验收。
- 覆盖安装后用户数据保留，密钥异常可恢复且不删除密文。
- Windows 发行和 PWA 行为没有回归。
- Release notes 明确披露未经过 Apple 签名和公证，不能以“Apple 已验证”描述产物。

## 官方资料

- [Apple：会员类型与 Developer ID/公证费用边界](https://developer.apple.com/support/compare-memberships/)
- [Apple：安全打开未公证或未知开发者应用](https://support.apple.com/en-us/102445)
- [Apple：ad-hoc signature](https://developer.apple.com/documentation/security/seccodesignatureflags/adhoc)
- [Apple：macOS Code Signing In Depth](https://developer.apple.com/library/archive/technotes/tn2206/)
- [Electron：Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [Electron：safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Electron：Custom Window Interactions](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar)
- [electron-builder：macOS targets](https://www.electron.build/docs/mac/)
- [GitHub：公开仓库标准 runner](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job)
