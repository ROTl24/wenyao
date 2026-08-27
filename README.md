# 问爻

一款本地优先的水墨六爻应用，提供 Windows、macOS 桌面版与可安装的手机 PWA。

用户输入所占之事后，可选择在线 3D 投掷、线下实体铜钱录入、安全随机一键成卦，或按北京时间使用梅花年月日时法成卦；程序统一按文王纳甲规则排盘。桌面版与受信任发布域名下的 PWA 都可结合本地古籍证据与用户自行配置的云端模型生成解读并支持继续追问。

## 在线体验

打开下方链接即可在浏览器中直接使用，无需下载安装：

**https://wenyao-9pu.pages.dev**

该地址为 PWA，首次完整加载后四种起卦、排盘、历史和内置古籍可离线使用。手机用户可按照下方说明将其安装到主屏幕。

## 下载桌面版

| 平台 | 安装包 | 说明 |
|------|--------|------|
| Windows x64 | `WenYao-*-Setup.exe` | NSIS 安装包，当前用户模式 |
| macOS 13+ | `WenYao-*-universal.dmg` | Intel + Apple Silicon 通用二进制 |

前往 [GitHub Releases](https://github.com/ROTl24/wenyao/releases) 下载最新版本。

## 主要功能

- **在线起卦** — 合手、开手、三枚实时 3D 模拟古币翻滚与逐爻确认
- **线下起卦** — 实体铜钱四种钱象人工录入、逐爻预览、六爻终审和北京时间校验
- **随机起卦** — 系统安全随机源一次生成六轮三钱结果，保留 6/7/8/9 的 1:3:3:1 概率
- **时间起卦** — 梅花年月日时法；农历年月日、地支年时数、子初换日，推导结果随会话保存可复核
- **完整排盘** — 六十四卦、变卦、干支纳甲、变爻六亲、六神、世应、月日与旬空、日冲分类、十二长生、神煞命中等
- **排盘复制** — 一键复制为纯文本、Markdown 或 JSON，附带《周易》经文和外部模型解卦约束
- **古籍证据** — 内置《易隐》《卜筮正宗》《易冒》《火珠林》《增删卜易》五本古籍共 1263 条原文证据
- **混合检索** — BM25 为基础，可选向量召回 + RRF 融合 + 专用重排，按配置逐级增强
- **AI 解读** — 三步连接向导配置主模型、向量模型与重排模型；支持阿里云百炼、SiliconFlow、DeepSeek 与自定义兼容接口
- **追问对话** — 同卦下继续追问，每条追问独立反馈
- **本地安全** — API 密钥使用 Windows DPAPI 或 macOS 钥匙串加密；历史、古籍与索引保存在本机
- **应用内更新** — 启动时及每 6 小时检查 GitHub Releases，确认后自动下载安装

## 手机安装（PWA）

手机版是与桌面版共用排盘和检索内核的静态 PWA，不需要账户或公共 AI 代理。

打开 **https://wenyao-9pu.pages.dev** 后：

- **Android Chrome** — 满足安装条件后会显示"安装到手机"，也可从浏览器菜单选择安装应用
- **iPhone / iPad** — 使用 Safari，点击"分享"，再选择"添加到主屏幕"

手机 PWA 支持四种起卦、完整排盘、日历、本机历史、内置古籍浏览和 BM25 检索。第一次使用需要联网完整打开应用，之后这些本地功能可以离线启动。历史只保存在当前浏览器或已安装 PWA 的站点存储中；清除站点数据、卸载应用或浏览器回收存储可能使历史丢失，当前不提供账户同步或云端备份。

受信任发布域名允许用户配置 AI 解读所需的主模型、向量与重排模型；密钥在刷新或关闭页面后清除。

## Windows 安装说明

普通用户无需安装 Node.js、npm 或下载源码：

1. 打开 [GitHub Releases](https://github.com/ROTl24/wenyao/releases)，选择最新版本。
2. 下载 `WenYao-*-Setup.exe`，双击后按向导选择安装目录。
3. 安装器会创建桌面和开始菜单中的"问爻"快捷方式，完成后可直接启动。

`v0.2.0` 及更早版本尚未包含更新模块，需要最后手动安装一次 `v0.3.0`。此后可在应用提示或"设置 → 软件更新"中完成升级。

问爻会把数据统一保存在所选安装目录的 `data\` 文件夹，不再使用 `%APPDATA%\liuyao-divination`。升级和卸载只替换或移除程序文件，`data\` 会原地保留；如需彻底清除个人数据，请在卸载后手动删除该文件夹。

安装器只为当前 Windows 用户安装。安装目录必须允许该用户写入；建议使用默认目录。不要以管理员身份安装到受保护目录，否则应用会明确停止启动。

当前版本尚未使用 Windows 代码签名，SmartScreen 可能显示"Windows 已保护你的电脑"。首次安装请只从本项目 Releases 下载。

## macOS 安装说明

Mac 版不进入 App Store，也不使用收费的 Apple Developer Program。`WenYao-*-universal.dmg` 同时支持 Intel 与 Apple Silicon；应用使用 ad-hoc signature，没有 Developer ID 身份，也未经 Apple 公证。

1. 从 [GitHub Releases](https://github.com/ROTl24/wenyao/releases) 下载 `WenYao-*-universal.dmg`，并按同一 Release 的 `SHA256SUMS.txt` 核对文件。
2. 打开 DMG，把"问爻"拖入"应用程序"。
3. 第一次双击时 macOS 会阻止打开。进入"系统设置 → 隐私与安全性"，在安全区域点击"仍要打开"，再确认一次。
4. 之后可正常从"应用程序"启动。升级时从设置页打开最新版 Release，下载新 DMG 并覆盖旧应用。

不要全局关闭 Gatekeeper，也不要安装来源不明的证书。若系统明确提示应用已损坏或含恶意内容，请停止运行并提交 issue。

Mac 的数据位于 Application Support 目录，API Key 由 macOS 钥匙串保护。

## AI 服务设置

第一次点击"开始解读"时，问爻会打开三步连接向导：

1. **主模型**（必填） — 负责最终回复。填写 API 地址和 Key 后可读取模型目录或手动填写模型名称。完成这一步即可开始生成解读。
2. **向量模型**（可选） — 用于从古籍中寻找语义相关证据，例如阿里云 `text-embedding-v4` 或 SiliconFlow `Qwen/Qwen3-Embedding-4B`。
3. **重排模型**（可选） — 例如阿里云 `qwen3-rerank` 或 SiliconFlow `Qwen/Qwen3-Reranker-8B`。

支持阿里云百炼、SiliconFlow、DeepSeek 与任何 OpenAI 兼容接口。API Key 是给软件调用 AI 的专用密码，不是服务商登录密码；问爻不会索取账号密码。调用费用由服务商直接收取。

## 古籍证据包

内置五本古籍共 1263 条原文证据，已标注为 495 条规则、190 条占例和 578 条义理。桌面端还提供"古籍书库"入口，用户可导入自有 `.txt` / `.md` 古籍文件。

检索链路：BM25 和用户问题为主 → 已配置的向量召回 40 条 → RRF 融合前 30 条 → 专用重排返回 16 条 → 自适应采用 8–16 条（通常 12 条），上下文约 9000 字。

语料构建：

```powershell
npm.cmd run build:corpus -- "C:\path\易隐.txt" "C:\path\卜筮正宗.txt" "C:\path\易冒.txt" "C:\path\火珠林.txt" "C:\path\增删卜易.txt"
```

排盘复制使用独立的六十四卦卦辞、三百八十四爻爻辞数据。经文来自固定修订的维基文库《周易》页面；来源与转录许可见 [`resources/classics/NOTICE.md`](resources/classics/NOTICE.md)。

## 本地开发

```powershell
npm.cmd install
node node_modules\electron\install.js
npm.cmd run dev
```

仅查看 PWA 响应式页面：

```powershell
npm.cmd run dev:web
```

质量检查与打包：

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

验证正式 PWA 产物：

```powershell
npm.cmd run build:renderer
npm.cmd run verify:web
npm.cmd run preview:web
```

三条 `verify:*` 命令（`verify:models`、`verify:retrieval`、`verify:analysis`）会使用真实配置并可能产生服务商费用；普通开发检查使用 `npm.cmd test` 与 `npm.cmd run typecheck` 即可。

Mac 构建必须在 macOS 上执行：

```bash
npm run build:macos
npm run verify:macos-release
```

仓库的 `Release desktop applications` 工作流可从 GitHub Actions 手动运行，只有与 `package.json` 版本一致的 `v*.*.*` 标签才会进入正式发布任务。

## 近期更新

- **v0.5.3** — 增加纯文本、Markdown 与 JSON 一键复制，附带可追溯的《周易》经文和外部模型解卦约束；发布逐能力 AI 配置、可降级混合检索与本地优先反馈闭环
- **v0.5.2** — 修复桌面版预加载桥接失效后误入网页版模式的问题，桌面端与 PWA 共用逐能力 AI 配置向导
- **v0.5.1** — 增加 macOS 13+ 通用桌面版，覆盖 Intel 与 Apple Silicon
- **v0.4.0** — 新增一站式多供应商 AI 连接向导，打包版数据保存在安装目录 `data\`
- **v0.3.0** — 支持应用内在线更新
