# 问爻 macOS 桌面版适配与发布调研

> 调研基准日：2026-08-23
> 资料范围：Apple Developer、Electron、electron-builder 与 GitHub Actions 官方资料，以及本仓库代码、依赖清单和发布脚本。文中的外部制度与平台行为均以基准日可查的一手资料为准。

## 结论

问爻适合先发布 **Developer ID 签名的 universal macOS 应用，并以完成公证与票据装订的 DMG 分发**，通过现有 GitHub Releases 交付。DMG 内的 `.app` 同样保持有效签名和已装订公证票据：

- 面向用户提供 `DMG`，供拖入 `/Applications` 安装；同时生成并上传 `ZIP` 与 `latest-mac.yml`，供 `electron-updater` 更新。
- 一个 universal 应用同时包含 `x86_64` 与 `arm64`，避免维护两个下载入口和两个更新通道。生产依赖树没有发现本机 `.node` 扩展，合并风险较低，但仍须分别在 Intel 与 Apple Silicon 上做原生启动验证。
- 最低系统版本声明为 **macOS 13.0**。Electron 43 尚可覆盖 macOS 12，但 Electron 44 将移除 macOS 12；选择 13.0 可以避免发布后立刻收窄兼容范围。基准日继续使用稳定的 Electron 43，并先升级到该主版本的最新补丁，不能以尚未稳定的 44 作为首发基础。
- Mac App Store 不是同一产物换一个上传位置，而是独立的 `mas` 变体：必须启用 App Sandbox、使用商店证书与描述文件、禁用应用内自更新，并处理当前外部充值/购买链接带来的审核风险。它可以在直发版稳定后并行维护，但不应阻塞直发版。

当前首要阻塞不是打包命令，而是持久化路径：已打包应用会把数据写到 `process.execPath` 旁的 `data`。标准 Mac 安装位置位于只读、受签名保护的 `.app` 包内，这会导致首次启动失败或破坏代码签名。macOS 必须使用 Electron 默认的 `userData` 路径；Mac App Store 构建则使用系统容器路径。Windows 的安装目录数据策略可以保留为显式的平台行为。

## 状态口径

- **implemented**：仓库已有可核验实现；不表示已在 Mac 真机通过验收。
- **proposed**：为完成 macOS 发布需要实现或配置的方案。
- **unknown**：无法从仓库或公开资料确认，必须由开发者账号、目标用户或真机证据补齐。

## 仓库现状与 macOS 影响

| 领域 | 状态 | 仓库证据 | 结论 |
| --- | --- | --- | --- |
| Electron 安全基线 | implemented | `BrowserWindow` 已启用 `contextIsolation`、`sandbox`、`webSecurity`，关闭 `nodeIntegration`；导航受限，外链交给系统浏览器 | 可以沿用；发布前仍应随 Electron 安全清单复核 |
| macOS 生命周期 | implemented | `activate` 会重建窗口，`window-all-closed` 在 Darwin 不退出 | 符合 macOS 常见生命周期 |
| 包标识 | implemented / unknown | `appId` 为 `com.liuyao.divination` | 配置已存在，但是否已在 Apple 团队中注册并归属当前账号未知；首次发布前必须固定并验证，发布后不应随意改变 |
| 架构与目标 | proposed | 仅有 Windows `nsis/x64`；没有 `mac`、`mas` 或 arch 配置 | 增加 direct universal 的 `dmg + zip`；商店使用单独 `mas` 配置 |
| 图标 | proposed | 只有 `build/icon.png`，没有 `.icns` | 从原始矢量/高分辨率母版生成并人工检查 macOS 小尺寸图标；不要把现有 PNG 当作最终商店素材 |
| 代码签名与公证 | proposed | 没有 Mac 证书、Hardened Runtime、entitlements 或 notarization 配置 | Developer ID 直发版必须完成签名、公证和票据装订；CI 必须在缺少签名时失败 |
| 数据目录 | implemented but incompatible | `install-data.cjs` 将 `userData` 与 `sessionData` 指向可执行文件旁的 `data`，并强制写探针 | macOS 不得写 `.app/Contents/MacOS`；改用用户 Library/商店容器。这是发布阻塞项 |
| 密钥保护 | implemented with platform wording gap | API 密钥通过 Electron `safeStorage` 加密，但错误文案写死为 Windows DPAPI | macOS 会使用 Keychain；文案应平台化，并验证锁屏、首次授权和迁移行为。渲染层使用异步密钥接口，避免把同步实现细节固化进 UI 契约 |
| 自动更新 | implemented only on Windows | 更新器仅在 `app.isPackaged && process.platform === 'win32'` 时启用 | 直发 Mac 构建启用 `darwin && !process.mas`；商店构建完全交给 App Store 更新 |
| 发布流水线 | implemented only on Windows | tag 工作流构建 Windows 资产、上传并立即将 draft 发布为 stable | Mac 不能另建一个也会独立发布的 tag 工作流；应由一个聚合发布作业在 Windows、Mac 全部资产验证后一次发布 |
| 发布校验 | implemented only on Windows | `verify-release.mjs` 面向 NSIS；发布资产列表写死 `.exe/.blockmap/latest.yml` | 增加 Mac 元数据、架构、签名、公证、Gatekeeper 与装订校验 |
| 命令行验证 | implemented but incompatible | `verify-stack.cjs` 写死 `node_modules/electron/dist/electron.exe` | 改为平台无关地解析 Electron 可执行文件，否则同一验证命令无法在 Mac 运行 |
| 标题栏 | implemented for Windows visual model | 使用 `titleBarStyle: hidden`、右侧 `titleBarOverlay` 与右侧留白，菜单栏被隐藏 | Mac 红黄绿按钮位于左侧，overlay 颜色参数并不提供同等的 Mac 控制；需要 Darwin 布局和原生菜单 |
| 文件权限 | implemented | 语料导入通过系统 `showOpenDialog` 选择 TXT/MD，再读入应用数据 | 直发版不需要 App Sandbox 文件 entitlement；MAS 默认只申请 user-selected read-only，只有证明确需修改原文件时才扩大权限 |
| 网络权限 | implemented | AI 提供商及自定义 API 使用 HTTPS 出站请求 | 直发版无需网络 entitlement；MAS 需要 network client entitlement |
| 硬件隐私权限 | implemented as absent | 未发现调用摄像头、麦克风、定位或屏幕录制的产品代码 | 不添加相应 entitlement 或用途说明；未来新增能力时再按真实用途最小授权 |

## 分发路线

| 维度 | Developer ID 直发 | Mac App Store |
| --- | --- | --- |
| 用户获取 | GitHub Releases 下载 DMG | App Store |
| 签名身份 | Developer ID Application；DMG 分发不需要 Installer 证书 | Apple Distribution/Mac App Distribution + provisioning profile；上传包需 Installer 身份 |
| 安全门 | Hardened Runtime、Apple notarization、stapling、Gatekeeper | App Sandbox、App Store Connect 校验与 App Review；无需另做 Developer ID 公证流程 |
| 更新 | universal ZIP + `latest-mac.yml` + `electron-updater` | App Store 更新，应用内 updater 禁用 |
| 文件/网络 | 不受 App Sandbox entitlement 限制，仍遵守最小权限 | 必须显式声明 user-selected file 与 network client 等 entitlement |
| 现有 AI 计费外链 | 可保留 | 存在 3.1.1 审核风险，MAS 变体应移除购买 CTA |
| 发布节奏 | 团队验收后可自行发布 | 受资料准备与 Apple 审核影响 |
| 本项目定位 | **推荐的首发和主要渠道** | 独立可选渠道，是否经营仍为 unknown |

### Developer ID 直发版：推荐的正式发布路线

Apple 将 Developer ID 用于 Mac App Store 之外的软件分发。应用使用 **Developer ID Application** 证书签名，经 Apple 公证服务检查并把票据 stapled 到产物后，Gatekeeper 可以确认开发者身份和公证状态。若发布 `PKG` 安装器才需要 Developer ID Installer；本方案使用 DMG，不需要额外引入 PKG。

目标产物：

| 产物 | 用途 | 是否对发布完整性关键 |
| --- | --- | --- |
| `WenYao-<version>-universal.dmg` | 用户下载、挂载并拖入 `/Applications`；最终容器签名、公证并 stapled | 是 |
| universal ZIP | `electron-updater` 的 macOS 更新载荷 | 是，不能只上传 DMG |
| `latest-mac.yml` | 更新版本、文件和 SHA-512 元数据 | 是，必须校验其中引用的每个文件都已上传 |
| 可选 blockmap | 差分更新支持，具体是否生成由当前 builder 结果决定 | 若被更新元数据引用则必须上传 |

推荐 `electron-builder` 方向如下，最终字段应由实现时的配置模式校验，而不是直接复制为未验证配置：

```jsonc
{
  "mac": {
    "target": [
      { "target": "dmg", "arch": ["universal"] },
      { "target": "zip", "arch": ["universal"] }
    ],
    "minimumSystemVersion": "13.0",
    "hardenedRuntime": true,
    "forceCodeSigning": true,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.inherit.plist"
  }
}
```

`hardenedRuntime` 在当前 electron-builder 中默认开启，但仍建议显式声明，因为这是发布安全约束；`forceCodeSigning` 防止 CI 找不到证书时悄悄产出未签名应用。直发版 entitlement 从 `com.apple.security.cs.allow-jit` 开始。Electron 官方指出 Electron 12 及以后通常不需要 `com.apple.security.cs.allow-unsigned-executable-memory`，而该权限会扩大攻击面；只有签名后的 universal 产物出现可复现的启动故障，且诊断证明确实需要时才加入。不得包含 `get-task-allow` 或任何 DYLD 调试 entitlement，也不应预先加入 `disable-library-validation`。其他权限同样只按实际验证结果增加。

### Mac App Store：独立的受沙箱变体

Mac App Store 构建使用 Electron 的 `mas` 目标，只能通过商店渠道运行和更新。它需要：

- Apple Distribution（或 Apple 当前账号页面显示的等价 Mac App Distribution）应用签名证书；上传的安装包使用 Mac Installer Distribution；
- 显式 App ID、App Store provisioning profile，并把 profile 嵌入应用；
- 主应用 entitlement 至少包含 App Sandbox、出站网络和用户选择文件只读；helper 使用 sandbox/inherit 配置；只有产品确实需要修改用户选中的原文件时才改为读写权限；
- `process.mas` 分支关闭 `electron-updater`。Electron 的 MAS 构建禁用自身 `autoUpdater`，App Store 负责更新；
- App Store Connect 产品信息、隐私政策 URL、隐私标签、审核账号/说明和截图；
- 对 Electron MAS 特有差异做回归：沙箱文件访问、辅助进程、视频/无障碍/DNS 行为不能用直发版结果代替。

当前界面可打开 AI 提供商的 API Key 与充值/计费页面。Apple 的 3.1.1 规则要求应用内解锁数字功能使用 IAP；“免费的独立伴侣应用”例外又要求应用内没有购买或引导到外部购买。即使问爻本身不代收费用，这些外部 CTA 仍构成审核风险。MAS 变体应移除充值、购买与外部购买引导，只允许用户填写已拥有的密钥，并在审核备注中说明 BYO API Key 数据流；最终是否接受仍属于 **unknown**，不能在上线计划中当作确定事实。

直发版没有这项 App Review 约束，适合保留现有提供商选择与外链体验。因此两条路线应共用业务核心，但分别维护分发策略、entitlements、更新器和商店合规 UI，不能尝试用一个二进制同时覆盖。

## Apple 账号、证书与成本

| 项目 | 官方要求或成本 | 本项目状态 |
| --- | --- | --- |
| Apple Developer Program | 99 美元/年或当地等值价格；包含 Developer ID 与公证服务能力 | unknown：账号是否已激活、个人或组织类型、续费状态未知 |
| 组织注册 | 组织以法定名称作为 seller，需要 D‑U‑N‑S 等身份资料 | unknown：发布主体未知 |
| Developer ID Application | 直发 `.app` 的签名身份；Account Holder 可创建 Developer ID 证书，Apple 帮助页说明每类最多 5 个 | unknown：现有证书、私钥保管人与轮换机制未知 |
| Apple Distribution / Mac Installer Distribution | MAS 应用与上传安装包的签名身份 | proposed，仅在决定经营 MAS 渠道后创建 |
| App Store Connect Team API Key | 可由 `notarytool` 用于自动公证；Apple 明确说明 individual API key 不能用于 `notarytool` | proposed，优先于把 Apple ID 密码放入 CI |
| 公证 | Apple Developer Program 能力的一部分，官方没有公布按构建收取的额外费用 | proposed |
| Mac App Store 抽成 | 免费下载没有下载抽成；收费应用/IAP 适用商店佣金，符合 Small Business Program 的开发者可为 15% | 取决于未来是否收费，unknown |
| GitHub-hosted 标准 Mac runner | 公开仓库可免费使用标准 runner；超出私有仓库额度时 Mac 标准 runner 标价为 0.062 美元/分钟，larger runner 另计 | implemented：仓库公开；仍应避免无价值重复构建 |

首次签名之前需要账号持有人确认：Team ID、组织/个人主体、证书所有者、`com.liuyao.divination` 的 App ID 归属、App Store Connect API key 的访问范围，以及证书到期提醒。私钥只能进入受保护的发布环境，不得提交到仓库。

## 签名、公证、stapling 与 Gatekeeper

直发版的可信链路应固定为：

```text
构建 universal .app
  -> 对所有嵌套可执行文件、framework、helper 与主应用使用同一 Team 的 Developer ID 签名
  -> 开启 Hardened Runtime、secure timestamp，应用最小 entitlements
  -> 由 electron-builder/notarytool 工作流把 .app 作为临时归档提交，等待 Accepted 并 staple app
  -> 由该 .app 生成并签名最终 DMG/ZIP
  -> 使用 notarytool 公证最终 DMG、等待 Accepted 并 staple
  -> 验证签名、票据、Gatekeeper 与两种 CPU slice
  -> 上传 draft
  -> 从浏览器下载 draft/canary 产物做带 quarantine 的干净机验证
  -> Windows 与 Mac 全部资产一致后发布 stable
```

Apple 自 2023-11-01 起不再接受 `altool` 公证上传，自动化必须使用 `notarytool`。成功响应本身不等于交付成功：还要保存 submission id、检查 Accepted 日志、执行 stapling，并在最终发布容器上复验。建议的验收命令为：

```bash
codesign --verify --deep --strict --verbose=2 "问爻.app"
codesign -d --entitlements :- --verbose=4 "问爻.app"
xcrun stapler validate "问爻.app"
spctl -a -t exec -vv "问爻.app"
lipo -archs "问爻.app/Contents/MacOS/问爻"
xcrun stapler validate "WenYao-<version>-universal.dmg"
spctl -a -t open --context context:primary-signature -vv "WenYao-<version>-universal.dmg"
```

`lipo` 必须输出 `x86_64 arm64`。还应递归抽查 Electron Framework、helper 与其他 Mach-O 文件，避免只验证最外层 app。DMG 与其内部最终安装的 `.app` 都必须通过 `stapler validate`；ZIP 无法单独 stapled，因此必须在把 app 打入 ZIP 前完成 app 公证和票据装订。

本机直接双击 CI 目录下的文件不能充分代表 Gatekeeper。真实验收要由浏览器下载发布候选，让系统附加 quarantine，再在另一台 Mac 或至少一个新的标准用户账户中安装。断网首次启动可以验证 stapled ticket 是否真正生效。

## universal、Intel 与 Apple Silicon

electron-builder 支持 `x64`、`arm64` 与 `universal`。Universal 构建把两套 Electron/Mach-O slice 合并进一个 app；若包含本机模块，模块本身也必须提供两个架构。仓库生产依赖检查未发现声明的本机 `.node` addon，Rapier 使用兼容的 JS/WASM 包，因此 universal 是合理默认值，但这只是静态证据。

发布验收仍需要：

- 在 Intel Mac 上原生启动，不以 Apple Silicon 的 Rosetta 模式替代；
- 在 Apple Silicon 上原生启动，并用活动监视器或 `arch`/Mach-O 证据确认不是 Rosetta；
- 对打包后关键路径做冒烟：启动、投掷动画、历史读写、API 密钥加解密、联网请求、语料导入、外链、关闭/重开；
- 检查 universal 合并后的 `app.asar` 与 `app.asar.unpacked`，确认没有只存在于某一架构的文件；
- 记录产物体积。只有实际下载/带宽数据证明 universal 代价不可接受时，才改为 x64/arm64 双产物与架构感知更新元数据。

## 最低系统版本与 Electron 生命周期

基准日仓库锁定 Electron `43.1.0`，而官方发布记录已提供 `43.4.1`（2026-08-19）。Electron 官方只支持最新三个稳定主版本，并只维护每个稳定主版本的最新 minor/patch。发布 Mac 版前应升级至 **43.x 最新稳定补丁**并回归，不要把 43.1.0 作为长期安全基线。

Electron 44 稳定版日程为 2026-08-25，基准日仍不是稳定版本；其 breaking changes 明确移除 macOS 12，最低为 macOS 13。因而本项目在 43 上主动声明 macOS 13.0，可以在 44 稳定并通过回归后升级，而无需改变用户支持承诺。macOS 13 的用户覆盖是否满足真实目标人群属于 **unknown**，发布前应由用户数据确认；若业务明确要求 macOS 12，需要接受停留在即将结束支持的 Electron 主版本这一安全成本，不能仅删除最低版本声明。

## 自动更新契约

直发版沿用 `electron-updater` 和 GitHub provider，但 macOS 必须满足以下完整契约：

1. `dmg` 与 `zip` 同时构建；ZIP 是 Squirrel.Mac/electron-updater 所需的更新载荷。
2. 上传 `latest-mac.yml` 以及它引用的每个文件，逐项核对文件名、大小和 SHA-512。
3. 初始版本与更新版本使用同一个 Bundle ID 和 Developer ID Team/签名身份；更新应用必须通过签名校验。
4. 代码中仅对 `app.isPackaged && process.platform === 'darwin' && !process.mas` 启用更新器；开发环境和 MAS 不连接更新服务。
5. 进行真实的 `n -> n+1` canary：检查下载、校验、安装、重启、版本号、历史/密钥/语料保留与回滚提示。只验证 `checkForUpdates()` 返回不算通过。
6. Stable GitHub Release 只能在 Windows 的 `latest.yml` 与 Mac 的 `latest-mac.yml` 及全部载荷都已验证后发布，避免任一平台读到不完整更新。

MAS 构建不携带自更新行为，也不上传给直发通道的更新元数据；版本由 App Store Connect 处理。两个渠道即使版本号相同，也应按渠道独立验证升级。

## CI 架构与秘密管理

基准日 GitHub 官方 runner 表提供显式 Intel 与 Apple Silicon 标签。发布作业应固定明确的 runner 标签（例如基准日可用的 `macos-15-intel` 与 Apple Silicon `macos-15`），不要依赖会迁移系统版本和架构的 `macos-latest`。`macos-14` 已进入弃用计划，不适合作为新发布线基础。

建议工作流拓扑：

```text
tag 与 package version 一致性检查
  -> Windows 测试/构建/本地验签 -----------+
  -> macOS 无秘密测试（Intel + ARM） ------+-> 聚合资产与元数据校验 -> 唯一发布作业 -> stable
  -> 受保护环境的 Mac 签名/公证/构建 -----+
```

现有 Windows job 会自行创建 draft、上传并立即解除 draft。若新增独立 Mac tag workflow，会出现 Windows 先发布、Mac 更新元数据尚未上传的竞态。正确结构是各平台只产出并上传 workflow artifact，一个具有 `needs` 依赖的单一发布 job 创建/更新 draft、校验完整资产清单，再一次性发布 stable。

安全边界：

- 测试与普通 PR job 不接触任何 Apple 秘密；fork PR 默认也取不到仓库 secrets，不得设计绕过。
- 签名 job 仅由受保护 tag 进入受保护 GitHub Environment，启用必要的人工审批；环境 secrets 至少包括 P12/密码或 `CSC_LINK`/`CSC_KEY_PASSWORD`，以及 App Store Connect `.p8` 内容、key id、issuer id。job 把 `.p8` 写入临时受限文件，再把文件路径赋给 `APPLE_API_KEY`，并设置 `APPLE_API_KEY_ID`、`APPLE_API_ISSUER`。
- 优先使用最小权限的 App Store Connect **Team API key** 做公证；individual API key 不支持 `notarytool`。密钥可撤销、定期轮换，不在日志打印或作为 artifact 上传。
- 临时 keychain 在 job 内创建，导入证书后只授权必要工具，在 `always()` 清理 keychain、P12 与 `.p8` 临时文件。GitHub-hosted runner 是一次性环境，但清理仍能防止同一 job 后续步骤误用；如果未来使用 self-hosted runner，清理是硬性要求。
- 将 `permissions` 缩到 job 级：构建 job `contents: read`，只有最终发布 job `contents: write`。第三方 action 使用完整 commit SHA 固定；官方 action 也应逐步固定 SHA并由依赖更新工具维护。
- GitHub 明确提醒 secrets 经转换后不保证自动脱敏；禁止把证书、base64 私钥、API key 或签名命令完整环境打印到日志。
- 发布产物验证后再授予发布权限。公证失败、签名缺失、元数据引用缺失、hash 不一致或任一架构冒烟失败都必须保持 draft。

## macOS 应用行为适配

### 数据与 Keychain

Direct 应用使用 Electron 默认 `app.getPath('userData')`，通常位于用户 Library 的 Application Support；`sessionData` 可以保持默认或放在明确的缓存路径，不应与应用本体同目录。MAS 使用系统沙箱容器返回的路径，不拼装绝对路径。应用升级必须原地读取旧版本数据；卸载应用不应自动删除用户数据。

`safeStorage` 在 macOS 使用 Keychain。现有加密格式可以继续作为存储层，但用户可见的“Windows DPAPI”文案必须改为平台中性描述。Electron 提醒 macOS Keychain 调用可能等待用户输入且同步 API 会阻塞线程；测试应覆盖首次访问、Keychain 锁定、拒绝授权和密码变更。preload 对渲染层从一开始就提供 Promise 接口和可恢复错误，避免 UI 依赖同步调用；底层仍只能在主进程调用 `safeStorage`，若真机观察到可见冻结，再基于调用耗时和 Electron 进程约束单独设计隔离方案。

### 标题栏、菜单与快捷键

macOS `titleBarStyle: hidden` 会保留左侧 traffic lights，Windows/Linux 的 `titleBarOverlay` 定制不等价适用。渲染层需根据 preload 已暴露的 `platform` 为 Darwin 预留左侧可拖拽安全区，避免品牌、返回按钮或可点击控件与 traffic lights 重叠；全屏和分屏状态下重新检查。

Mac 应提供标准应用菜单角色：About、Services、Hide、Hide Others、Quit、Edit 下的 Undo/Redo/Cut/Copy/Paste/Select All，以及 Window/Help。不能把 `setMenuBarVisibility(false)` 当作 Mac 菜单方案。快捷键显示应使用 `CommandOrControl`，人工验证 `Cmd+C/V/A/Z/W/Q`、菜单项和 VoiceOver 可达性。

### 文件、网络与隐私权限

直发版没有 App Sandbox 约束，现有系统文件选择器足够；仍只应读取用户主动选择的 TXT/MD。MAS entitlement 最小集合为：

- `com.apple.security.app-sandbox = true`
- `com.apple.security.network.client = true`
- `com.apple.security.files.user-selected.read-only = true`

当前导入流程只读取用户选择的源文件，并把管理后的内容写入应用自身数据目录，因此不需要修改原文件。若后续出现明确的“原地编辑并写回”产品能力，才升级到 read-write。不要增加 Downloads 全盘、Pictures、摄像头、麦克风、定位、通讯录或 Apple Events 权限。

问爻会把用户输入的占问内容、上下文和生成请求发送给用户选择的第三方 AI 服务或自定义端点。即便开发者服务器不接收这些内容，这也是离开设备的数据流。MAS 必须提供隐私政策 URL 和应用内可访问的隐私政策，并依据每个 AI 提供商实际保留策略填写 App Privacy。Apple 将“传出设备并由开发者或第三方合作方保留超过实时服务所需时间”视为 collected；自由文本可能落入 Other User Content。是否保留、是否关联身份、是否用于训练不能从代码得出，均为 **unknown**，发布材料不得猜测。直发版也应以相同标准向用户说明发送对象、字段、目的和提供商政策。

## 验证矩阵

### 自动化与 runner 验证

| 环境 | 目的 | 必须通过 |
| --- | --- | --- |
| `macos-15` Apple Silicon 标准 runner | 主构建、ARM 原生测试、universal 打包 | `npm ci`、测试、类型检查、renderer 构建、签名/公证、ARM 启动冒烟 |
| `macos-15-intel` 标准 runner | Intel 原生测试 | 测试、x64/通用包启动冒烟；不能仅在 Rosetta 下替代 |
| 当前 macOS 26 Apple Silicon runner/真机 | 当前系统前向兼容 | 安装、启动、网络、更新和 UI 冒烟 |
| Windows runner | 确认 Mac 适配没有破坏现有发布 | 现有测试、NSIS 签名与 Windows 更新资产校验 |

GitHub runner 不能覆盖最低 macOS 13 的运行时，因此最低版本必须由真机或合法可复现的 VM 补齐。

### 干净环境验收

| 设备/系统 | 安装路径 | 重点 |
| --- | --- | --- |
| Intel Mac + macOS 13 | 浏览器下载 DMG，拖入 `/Applications` | x64 原生启动、Gatekeeper、最小系统承诺、Keychain、更新 |
| Apple Silicon + macOS 13 | 同上 | arm64 原生启动、最小系统承诺、图形/动画 |
| Apple Silicon + 当前 macOS 26 | 同上 | 当前系统兼容、窗口/全屏/菜单、更新 |
| 新建标准用户、首次断网 | 已下载并保留 quarantine 的 DMG | stapled ticket 离线验证、应用目录不写入、用户数据目录权限 |
| MAS development/TestFlight 等效环境 | 商店沙箱包 | 文件选择、出站网络、helper、Keychain/容器、应用内无自更新和购买 CTA |

每个 direct 场景至少执行：

1. 下载、挂载、拖入 `/Applications`，首次启动没有“已损坏/无法验证”提示。
2. 确认 `.app` 内容在运行后没有修改，历史、密钥、session 均写入用户目录。
3. 创建占问、播放完整 WebGL/物理动画、查看与重开历史。
4. 保存并重新读取至少两个 AI 提供商 API key；验证 Keychain 拒绝/锁定时有可恢复错误。
5. 导入 TXT 与 MD 语料，取消选择、拒绝权限和文件被移动时不会崩溃。
6. 验证官方提供商与自定义 HTTPS endpoint，网络失败和证书失败不泄露密钥。
7. 验证 provider 外链、traffic lights、拖动区、全屏/分屏、标准菜单与 Cmd 快捷键。
8. 从已发布的签名版本完成 `n -> n+1` 自动更新，重启后版本正确且用户数据保留。
9. 运行 codesign、stapler、spctl、lipo 与更新元数据 hash 校验，并保存可审计输出。

## 可执行实施顺序与验收门

这不是按日历拆分的延期清单，而是由依赖关系决定的实现顺序：

1. **平台运行基线**：修正 macOS 数据目录、平台化 Keychain 文案与 Electron 可执行文件解析；在未签名的 Intel/ARM 开发环境通过测试和启动冒烟。
2. **Mac 产品体验**：实现 Darwin 标题栏安全区、原生菜单、Command 快捷键和 `.icns`；完成 Intel/ARM UI 与核心功能回归。
3. **直发打包**：增加 universal `dmg + zip`、macOS 13 minimum、最小 entitlements、签名强制与 direct updater；本地/CI 产物通过架构和更新元数据校验。
4. **受保护发布**：配置 Developer ID 与 Team API key，完成签名、公证、stapling 和 Gatekeeper 干净机验证；重构为跨平台资产聚合后一次发布。
5. **更新 canary**：用真实 draft/release 完成一个版本到下一版本的自动更新，确认数据保留；之后才把 Mac 资产纳入 stable 通道。
6. **MAS 变体（若经营决策成立）**：单独配置沙箱、profile、商店更新、隐私材料和合规 UI，经商店等效环境验收后提交审核。

直发版发布完成的判定是：同一 stable release 同时拥有经签名验证的 Windows 资产，以及 universal DMG、ZIP、`latest-mac.yml` 和其引用的全部文件；Mac app 与最终 DMG 均已 Accepted、stapled，Gatekeeper 通过，在 Intel 与 Apple Silicon 原生运行，并完成真实更新。仅能在开发机 `npm start`、成功生成 DMG、或公证接口返回 HTTP 成功都不构成完成。

## 仍需确认的外部事实

- Apple Developer Program 是否有效，账号类型、Team ID 与证书权限。
- `com.liuyao.divination` 是否已注册并归当前 Team；若不可用，应在首次发布前一次性确定新标识。
- 是否有可用于最低 macOS 13 的 Intel 与 Apple Silicon 真机/VM，以及当前系统真机。
- 目标用户中 macOS 12 及更早版本的比例；没有数据时按 macOS 13.0 发布。
- 现有 AI 提供商对请求内容、日志、账号标识和训练用途的保留政策；这决定隐私标签与政策文本。
- 是否确实需要 Mac App Store，以及是否接受移除外部购买 CTA、维护独立 MAS 变体和承担审核不确定性。
- 证书、API key 的持有人、轮换周期、紧急吊销责任与受保护环境审批人。

## 官方资料

### Apple Developer

- [Choosing a Membership](https://developer.apple.com/support/compare-memberships/) 与 [Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment)：会员资格、99 美元年费、个人/组织要求。
- [Developer ID](https://developer.apple.com/support/developer-id/)、[Create Developer ID certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates) 与 [Certificates overview](https://developer.apple.com/help/account/certificates/certificates-overview)：直发签名用途、证书类型与创建权限。
- [Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)、[Customizing the notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow) 与 [Packaging Mac software for distribution](https://developer.apple.com/documentation/xcode/packaging-mac-software-for-distribution)：Hardened Runtime、签名、公证、notarytool、stapling。
- [Technical Note TN2206: macOS Code Signing In Depth](https://developer.apple.com/library/archive/technotes/tn2206/)：`codesign`、`spctl`、最终容器和另一台 Mac/账户验证方法。
- [App Sandbox](https://developer.apple.com/documentation/security/app-sandbox)、[User-selected file entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.files.user-selected.read-write)、[Network client entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.network.client) 与 [Accessing files from the macOS App Sandbox](https://developer.apple.com/documentation/security/accessing-files-from-the-macos-app-sandbox)：MAS 沙箱与最小权限。
- [Create an App Store provisioning profile](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile) 与 [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds)：MAS profile、签名与上传。
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)：macOS 沙箱、自更新限制、IAP/外部购买规则与隐私要求；页面基准日标注更新于 2026-06-08。
- [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy) 与 [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)：隐私政策、数据类型和 collected 定义。
- [Creating API keys for App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api)：Team/individual API key 及 `notarytool` 边界。
- [App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/)：符合条件开发者的 15% 佣金。

### Electron 与 electron-builder

- [Electron Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing) 与 [Mac App Store submission guide](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide/)：Developer ID/MAS 两条签名路线、MAS sandbox 与模块差异。
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)：macOS Keychain 与同步调用阻塞风险。
- [Custom Window Interactions](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar)：macOS traffic lights 与 title bar overlay 的平台差异。
- [Electron Breaking Changes](https://www.electronjs.org/docs/latest/breaking-changes)、[Release schedule](https://releases.electronjs.org/schedule)、[Electron 43.4.1 release](https://releases.electronjs.org/release/v43.4.1) 与 [Versioning policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)：macOS 12 支持边界、43 的最新补丁、44 日程和受支持版本规则。
- [Electron process](https://www.electronjs.org/docs/latest/api/process) 与 [autoUpdater](https://www.electronjs.org/docs/latest/api/auto-updater/)：`process.mas` 与 MAS/签名更新边界。
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)：Electron 应用安全清单。
- [electron-builder macOS options](https://www.electron.build/docs/mac/)、[Multi Platform Build](https://www.electron.build/docs/architecture/) 与 [Targets](https://www.electron.build/docs/targets/)：x64/arm64/universal、DMG/ZIP/MAS 和 Mac 配置。
- [electron-builder Auto Update](https://www.electron.build/docs/features/auto-update/)：ZIP、`latest-mac.yml` 与 macOS 签名更新要求。
- [electron-builder Notarization](https://www.electron.build/docs/notarization/) 与 [macOS Code Signing](https://www.electron.build/docs/features/code-signing/code-signing-mac/)：公证环境变量、CI 证书和签名失败策略。
- [electron-builder MAS](https://www.electron.build/docs/mas/)：MAS target、entitlements 与 provisioning profile。

### GitHub Actions

- [GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) 与 [actions/runner-images](https://github.com/actions/runner-images)：基准日的 Intel/Apple Silicon 标签、系统镜像与弃用信息。
- [Signing Xcode applications](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications)：P12、provisioning profile 与临时 keychain 的官方工作流。
- [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)、[Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) 与 [Using secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)：action SHA 固定、最小权限、fork 与 secret 日志边界。
- [Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing) 与 [GitHub plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)：标准 Mac runner 单价与公开仓库额度。
