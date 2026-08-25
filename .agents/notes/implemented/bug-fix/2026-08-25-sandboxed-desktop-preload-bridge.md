# Agent Note: 沙箱预加载脚本自包含桌面桥接

Status: implemented

## Problem

Electron 渲染器启用沙箱时，预加载脚本只能加载 Electron 暴露的受限模块。预加载入口一旦依赖仓库内的 CommonJS 文件，`window.wenyao` 桥接会在 Windows 与 macOS 上整体缺失，渲染层继而按浏览器运行时启动，桌面应用因此显示“网页版”并隐藏 AI 配置能力。

## Decision

桌面预加载入口保持单文件自包含，只加载 `electron`，并在隔离世界内直接完成运行时参数校验与会话 IPC 白名单清洗。主进程继续在自身信任边界内执行同等强度的校验；预加载层的独立清洗用于限制渲染器能够跨越桥接提交的数据形状。

## Alternatives considered

- 关闭渲染器沙箱会恢复本地模块加载，但削弱处理 AI 访问密钥和本地会话时的进程隔离，不满足桌面安全边界。
- 为预加载入口增加独立打包流水线可以复用源模块，但会引入生成产物、构建顺序和依赖同步约束。当前桥接规模适合由可执行回归测试保护的自包含入口；当预加载逻辑显著增长时再重新评估打包。

## Consequences

Windows 与 macOS 共用的预加载入口能够在沙箱限制下暴露真实 Electron 运行时，应用设置据此展示 AI 服务连接与高级配置。运行时参数和会话白名单在主进程与预加载层各有一份实现，调整相关契约时必须同步更新两侧及其测试。回归测试限制预加载入口只能加载 `electron`，并执行桥接暴露、运行时识别和 IPC 清洗行为，防止本地模块依赖再次进入入口。

## Verification

- [Electron Process Sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox#preload-scripts) 明确限定沙箱预加载可加载的模块，并说明 CommonJS 文件不能直接拆分加载。
- `npm.cmd test`：35 个 Vitest 文件、222 项测试和 120 项 Electron 服务测试通过。
- `npm.cmd run typecheck`：通过。
- `npm.cmd run build:renderer`：生产渲染构建通过。
- `npm.cmd run build:windows` 与 `npm.cmd run verify:release`：生成并验收 151,235,519 字节的 `WenYao-0.5.1-Setup.exe`、blockmap、更新元数据与 SHA-512；打包后的 `app.asar` 预加载入口只有一个 `electron` 模块依赖，并包含运行时与 AI 配置桥接。
- Windows 安装包未安装、未签名且未发布。macOS DMG 必须由 macOS 构建机生成，并继续通过通用二进制、ad-hoc 签名、Gatekeeper 预期拒绝和双架构启动验收。
