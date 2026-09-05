# Agent Note: 桌面稳定版本通过可验证发布元数据驱动 Windows 在线更新

Status: implemented

## Problem

Web 与仓库主分支可以先于桌面正式版本包含修复。只推送源码或上传一个新安装包不会让既有 Windows 客户端发现更新，因为更新器依赖 GitHub 最新稳定 Release 的版本元数据、安装包地址和内容摘要。既有 macOS 免费发行版不运行原生更新器，后续版本无法远程改变已经安装的软件行为。

## Decision

正式桌面版本使用与 `package.json` 完全一致的 `v*.*.*` 标签触发 GitHub Actions。Windows 构建发布 NSIS 安装包、blockmap 和 `latest.yml`；发布任务先在草稿状态核对所有资产的大小与摘要，再切换为最新稳定 Release。打包版在启动时和每六小时检查 `latest` 通道，发现新版本后提示用户确认下载，下载完成后在用户主动重启或正常退出时安装。

Windows 更新通道保持用户确认下载，不进行静默强制更新。macOS 免费发行版继续提供通用 DMG 与 SHA-256 校验，并通过应用设置打开 GitHub Releases 手动更新；在没有 Developer ID、公证和旧客户端原生更新能力的条件下，不把发布新版本描述为旧 macOS 客户端自动更新。

## Alternatives considered

- 只更新 GitHub 源码和安装包：旧 Windows 客户端没有可消费的稳定 `latest.yml`，无法形成可靠的版本发现和完整性校验链路。
- 开启静默自动下载：会在用户未确认时消耗网络并改变退出行为，不符合现有更新界面的明确授权边界。
- 宣称旧 macOS 客户端也会自动更新：`0.5.3` 的运行时配置是手动更新，后续 Release 无法修改已经安装的旧代码。

## Consequences

Windows `0.5.3` 及后续正式安装版能够发现更高版本的最新稳定 Release，用户不需要手动卸载重装。更新是否真正生效必须同时验证标签、Release 稳定状态、`latest.yml`、安装包、blockmap 和远端摘要，不能用 Actions 成功或安装包存在代替。macOS 用户继续覆盖安装，Application Support 中的历史和语料不随应用包替换而删除。

## Verification

- `electron/services/update-manager.test.cjs` 覆盖启动检查、六小时间隔、下载确认、进度、退出安装和安全错误信息。
- `scripts/verify-release.mjs` 验证版本、安装包路径、SHA-512、GitHub 更新提供方和正式发布工作流资产契约。
- `.github/workflows/release-desktop.yml` 在版本标签上运行全量测试，分别构建并验证 Windows、Apple Silicon 和 Intel 产物，资产摘要一致后才发布稳定 Release。
- `0.5.4` 本地验收通过 245 项 Renderer 测试和 134 项 Electron 测试；Windows 安装包为 151,282,377 字节，打包后的主 Bundle、AI 地址核心、Chat 响应核心、古籍分类核心与 Electron Provider 均和当前源码构建逐字节一致。
- `0.5.6` 通过 266 项 Renderer 测试和 140 项 Electron 测试；GitHub Actions `33490650166` 完成 Windows、macOS Apple Silicon、Intel 运行时与发布任务，最新稳定 Release 的五项资产、`latest.yml` 和 DMG SHA-256 清单均有效。
- 正式发布验收比较远端 `latest.yml` 与 Release 资产，并从旧版本号验证稳定通道选择新版本。

- `0.5.7` 发布源码 `b22c0c8`，GitHub Actions `33990404576` 的 Windows、Apple Silicon、Intel 和 publish 全部成功；最新稳定 Release 的五项公开资产下载后大小与 SHA-256 一致，Windows `latest.yml` SHA-512 和 DMG 清单匹配。网站运行资产与发布构建一致，旧 Worker 控制的验收页关闭重开后实际载入新版。
