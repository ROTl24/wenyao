<p align="center">
  <img src="build/icon.png" alt="问爻" width="128" height="128">
</p>

<h1 align="center">问爻</h1>

<p align="center">
  <strong>心有所问，掷钱成卦，古籍为证，AI 解爻</strong>
</p>

<p align="center">
  <a href="https://github.com/ROTl24/wenyao/releases/latest"><img src="https://img.shields.io/github/v/release/ROTl24/wenyao?style=flat-square&color=d4483b&label=%E6%9C%80%E6%96%B0%E7%89%88%E6%9C%AC" alt="Latest Release"></a>
  <a href="https://github.com/ROTl24/wenyao/releases"><img src="https://img.shields.io/github/downloads/ROTl24/wenyao/total?style=flat-square&color=4a7c59&label=%E4%B8%8B%E8%BD%BD%E9%87%8F" alt="Downloads"></a>
  <a href="https://wenyao-9pu.pages.dev"><img src="https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%93%E9%AA%8C-PWA-blue?style=flat-square" alt="在线体验"></a>
  <img src="https://img.shields.io/badge/%E5%B9%B3%E5%8F%B0-Windows%20%7C%20macOS%20%7C%20PWA-8B6914?style=flat-square" alt="Platforms">
</p>

<p align="center">
  一款本地优先的水墨六爻应用<br>
  提供 Windows、macOS 桌面版与可安装的手机 PWA
</p>

---

<p align="center">
  <a href="https://wenyao-9pu.pages.dev">
    <img src="https://img.shields.io/badge/%F0%9F%94%AE_%E7%AB%8B%E5%8D%B3%E4%BD%93%E9%AA%8C-wenyao--9pu.pages.dev-d4483b?style=for-the-badge" alt="立即体验">
  </a>
</p>

---

<p align="center">
  <img src="docs/design/liuyao-ui-reference.png" alt="问爻界面" width="100%">
</p>

<p align="center"><sub>① 问题输入界面 &nbsp;·&nbsp; ② 掷币起卦界面 &nbsp;·&nbsp; ③ 排盘与解读界面</sub></p>

## ✨ 特性一览

<table>
<tr>
<td width="50%">

### 🪙 四种起卦方式

- **在线投掷** — 合手、开手、三枚 3D 古币实时翻滚
- **线下录入** — 实体铜钱四种钱象逐爻确认
- **安全随机** — 系统随机源，1:3:3:1 概率
- **时间成卦** — 梅花年月日时法，农历推演

</td>
<td width="50%">

### 📜 完整纳甲排盘

- 六十四卦 · 变卦 · 干支纳甲
- 变爻六亲 · 六神 · 世应
- 月日与旬空 · 日冲分类
- 十二长生 · 神煞命中

</td>
</tr>
<tr>
<td width="50%">

### 🤖 AI 古籍解读

- 三步连接向导：主模型 + 向量 + 重排
- 阿里云百炼 / SiliconFlow / DeepSeek
- 任意 OpenAI 兼容接口
- 同卦追问，每条独立反馈

</td>
<td width="50%">

### 📚 五部古籍证据

- 《易隐》《卜筮正宗》《易冒》《火珠林》《增删卜易》
- **1263** 条原文 → **495** 规则 + **190** 占例 + **578** 义理
- BM25 + 向量召回 + RRF 融合 + 专用重排
- 排盘一键复制附带《周易》经文

</td>
</tr>
<tr>
<td width="50%">

### 🔒 本地优先 · 隐私安全

- Windows DPAPI / macOS 钥匙串加密密钥
- 历史、古籍、索引全部保存在本机
- PWA 密钥仅存于页面隔离内存
- 起卦排盘可完全离线使用

</td>
<td width="50%">

### 📱 全平台覆盖

- 🖥️ **Windows** x64 桌面版
- 🍎 **macOS** 13+ Intel / Apple Silicon
- 📱 **手机 PWA** 安装到主屏幕
- 🔄 应用内自动更新

</td>
</tr>
</table>

## 📥 下载安装

<p align="center">
  <a href="https://github.com/ROTl24/wenyao/releases/latest">
    <img src="https://img.shields.io/badge/Windows_x64-下载安装包-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Windows Download">
  </a>
  &nbsp;&nbsp;
  <a href="https://github.com/ROTl24/wenyao/releases/latest">
    <img src="https://img.shields.io/badge/macOS_13+-下载_DMG-000000?style=for-the-badge&logo=apple&logoColor=white" alt="macOS Download">
  </a>
  &nbsp;&nbsp;
  <a href="https://wenyao-9pu.pages.dev">
    <img src="https://img.shields.io/badge/手机_PWA-在线使用-FF6F00?style=for-the-badge&logo=googlechrome&logoColor=white" alt="PWA">
  </a>
</p>

| 平台 | 安装包 | 说明 |
|:---:|--------|------|
| <img src="https://img.shields.io/badge/-Windows-0078D4?logo=windows&logoColor=white&style=flat-square"> | `WenYao-*-Setup.exe` | NSIS 安装包，当前用户模式 |
| <img src="https://img.shields.io/badge/-macOS-000000?logo=apple&logoColor=white&style=flat-square"> | `WenYao-*-universal.dmg` | Intel + Apple Silicon 通用二进制 |
| <img src="https://img.shields.io/badge/-PWA-FF6F00?logo=googlechrome&logoColor=white&style=flat-square"> | 浏览器直接访问 | 首次加载后可离线使用 |

> 前往 **[GitHub Releases](https://github.com/ROTl24/wenyao/releases)** 下载最新版本

## 📱 手机安装（PWA）

打开 **https://wenyao-9pu.pages.dev** 后：

| 平台 | 安装方式 |
|:---:|---------|
| **Android Chrome** | 满足条件后自动提示"安装到手机"，或从浏览器菜单手动安装 |
| **iPhone / iPad** | 使用 Safari → 点击"分享" → 选择"添加到主屏幕" |

手机 PWA 支持四种起卦、完整排盘、日历、本机历史、内置古籍浏览和 BM25 检索。第一次使用需联网完整打开应用，之后本地功能可离线启动。

受信任发布域名允许用户配置 AI 解读所需的主模型、向量与重排模型；密钥在刷新或关闭页面后清除。

<details>
<summary><b>🖥️ Windows 安装说明</b></summary>
<br>

普通用户无需安装 Node.js、npm 或下载源码：

1. 打开 [GitHub Releases](https://github.com/ROTl24/wenyao/releases)，选择最新版本。
2. 下载 `WenYao-*-Setup.exe`，双击后按向导选择安装目录。
3. 安装器会创建桌面和开始菜单中的"问爻"快捷方式，完成后可直接启动。

`v0.2.0` 及更早版本尚未包含更新模块，需要最后手动安装一次 `v0.3.0`。此后可在应用提示或"设置 → 软件更新"中完成升级。

数据统一保存在所选安装目录的 `data\` 文件夹。升级和卸载只替换或移除程序文件，`data\` 原地保留。

> ⚠️ 当前版本尚未使用 Windows 代码签名，SmartScreen 可能显示"Windows 已保护你的电脑"。首次安装请只从本项目 Releases 下载。

</details>

<details>
<summary><b>🍎 macOS 安装说明</b></summary>
<br>

Mac 版不进入 App Store，使用 ad-hoc signature，没有 Developer ID，未经 Apple 公证。

1. 从 [GitHub Releases](https://github.com/ROTl24/wenyao/releases) 下载 `WenYao-*-universal.dmg`，按 `SHA256SUMS.txt` 核对文件。
2. 打开 DMG，把"问爻"拖入"应用程序"。
3. 第一次双击时 macOS 会阻止打开 → "系统设置 → 隐私与安全性" → "仍要打开"。
4. 之后可正常启动。升级时下载新 DMG 覆盖旧应用。

数据位于 Application Support 目录，API Key 由 macOS 钥匙串保护。

> ⚠️ 不要全局关闭 Gatekeeper。若系统提示应用已损坏或含恶意内容，请停止运行并提交 issue。

</details>

## 🤖 AI 服务设置

第一次点击"开始解读"时，问爻会打开三步连接向导：

| 步骤 | 能力 | 必填 | 示例 |
|:---:|------|:---:|------|
| **1** | 主模型（生成解读） | ✅ | DeepSeek Chat、通义千问 |
| **2** | 向量模型（语义检索） | ⬜ | `text-embedding-v4`、`Qwen3-Embedding-4B` |
| **3** | 重排模型（精排证据） | ⬜ | `qwen3-rerank`、`Qwen3-Reranker-8B` |

支持 **阿里云百炼** / **SiliconFlow** / **DeepSeek** 与任何 OpenAI 兼容接口。

API Key 是给软件调用 AI 的专用密码，不是服务商登录密码。调用费用由服务商直接收取。

## 📚 古籍证据包

内置五本古籍共 **1263** 条原文证据，标注为 **495** 条规则、**190** 条占例和 **578** 条义理。

```
检索链路：BM25 → 向量召回 40 条 → RRF 融合前 30 条 → 专用重排 16 条 → 自适应 8–16 条（≈12 条，≈9000 字）
```

桌面端还提供"古籍书库"入口，用户可导入自有 `.txt` / `.md` 古籍文件。排盘复制附带的经文来自固定修订的维基文库《周易》页面；来源与许可见 [`resources/classics/NOTICE.md`](resources/classics/NOTICE.md)。

<details>
<summary><b>🛠️ 本地开发</b></summary>
<br>

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

三条 `verify:*` 命令（`verify:models`、`verify:retrieval`、`verify:analysis`）会使用真实配置并可能产生服务商费用。

Mac 构建必须在 macOS 上执行：

```bash
npm run build:macos
npm run verify:macos-release
```

仓库的 `Release desktop applications` 工作流可从 GitHub Actions 手动运行，只有与 `package.json` 版本一致的 `v*.*.*` 标签才会进入正式发布任务。

</details>

## 📋 更新日志

| 版本 | 更新内容 |
|:---:|---------|
| **v0.5.3** | 排盘一键复制（纯文本 / Markdown / JSON）+ 《周易》经文约束；逐能力 AI 配置、可降级混合检索、本地优先反馈闭环 |
| **v0.5.2** | 修复桌面版预加载桥接失效；桌面端与 PWA 共用逐能力 AI 配置向导 |
| **v0.5.1** | macOS 13+ 通用桌面版（Intel + Apple Silicon） |
| **v0.4.0** | 一站式多供应商 AI 连接向导；打包版数据保存在安装目录 `data\` |
| **v0.3.0** | 应用内在线更新 |

---

<p align="center">
  <sub>静心片刻，心诚则灵</sub>
</p>
