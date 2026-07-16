# ☯️ 问爻 · WenYao

[![GitHub](https://img.shields.io/badge/GitHub-ROTl24%2Fwenyao-24292f?logo=github)](https://github.com/ROTl24/wenyao)
[![Release](https://img.shields.io/github/v/release/ROTl24/wenyao?include_prereleases&label=Release)](https://github.com/ROTl24/wenyao/releases)
[![CI](https://github.com/ROTl24/wenyao/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ROTl24/wenyao/actions/workflows/ci.yml)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11%20x64-0078D4?logo=windows11&logoColor=white)](https://github.com/ROTl24/wenyao/releases)
[![Electron](https://img.shields.io/badge/Electron-43-47848f?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Tests](https://img.shields.io/badge/Tests-824%20passing-2da44e)](https://github.com/ROTl24/wenyao/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/License-暂未附加-lightgrey)

一款 Windows 优先的六爻桌面应用：用三枚乾隆通宝完成六次起卦，由确定性程序排盘，再结合本地古籍证据生成可追溯的解读。

**[下载 Windows x64 预览版](https://github.com/ROTl24/wenyao/releases/download/v0.1.0-preview.1/WenYao-0.1.0-preview.1-Setup.exe)**
· [查看 Releases](https://github.com/ROTl24/wenyao/releases)
· [提交问题](https://github.com/ROTl24/wenyao/issues)

## 📋 项目概述

问爻把一次完整占问拆成四个清晰阶段：明确问题、六轮起卦、确定性排盘、证据约束解读。

排盘真值由程序生成，包括本卦、变卦、动爻、四柱、旬空、六神、纳甲、六亲、世应和关系事实；AI 只在已经锁定的事实与候选证据范围内组织解读，不负责重新计算卦盘。

每个案例会保留问题、投币结果、规则版本、事实集合、证据引用和后续追问，方便回看与核对。

## ✨ 核心功能

- **实体铜钱起卦**：三枚 3D 乾隆通宝在盘中抛起、碰撞并落定，连续六次由初爻组成上爻。
- **完整本变卦盘**：展示本卦、动爻、变卦、四柱、旬空、六神、纳甲、六亲、伏神与世应。
- **确定性规则事实**：程序计算旺衰、生克、冲合、刑害破、月破、旬空、动变、进退、反吟、伏吟等事实。
- **可核对的结果页**：卦盘、事实分类、解读结论、置信度以及事实 / 规则 / 证据 ID 可在同一页面查看。
- **古籍证据检索**：支持关键词召回、本地向量召回、RRF 融合与可选模型重排，并展示来源、章节和原文位置。
- **本地历史与同卦追问**：案例保存在本机，可搜索、继续阅读或围绕同一卦例追问。
- **本地优先**：案例、设置和向量索引留在本机；API 密钥在 Windows 下通过 DPAPI 加密。
- **失败时不编造**：模型输出必须通过结构、事实和引用校验；校验失败会明确报错，不把自由文本当作可信结果保存。

## 🚀 快速开始

### Windows 安装（推荐）

普通用户无需安装 Node.js 或下载源码。

1. 下载 [WenYao-0.1.0-preview.1-Setup.exe](https://github.com/ROTl24/wenyao/releases/download/v0.1.0-preview.1/WenYao-0.1.0-preview.1-Setup.exe)。
2. 双击安装包，按向导选择安装目录。
3. 从桌面或开始菜单启动“问爻”。

| 项目 | 当前信息 |
| --- | --- |
| 版本 | `v0.1.0-preview.1` |
| 系统 | Windows 10/11 x64 |
| 安装包 | 约 145 MB |
| 代码签名 | 预览版暂未签名 |

安装包 SHA-256：

```text
59938799F3A940002E8F2F1E07B4898A767832798B4F243834397819A4C5404B
```

下载后可在 PowerShell 中校验：

```powershell
Get-FileHash .\WenYao-0.1.0-preview.1-Setup.exe -Algorithm SHA256
```

> 请只从本项目 Releases 下载安装包。预览版可能触发 SmartScreen，
> 确认下载来源与 SHA-256 后再决定是否运行。安装版以对应 Release 说明为准，
> `main` 分支可能包含尚未发布的改动。

### 从源码运行

环境要求：Windows 10/11、Node.js 24+、npm 11+。

```powershell
git clone https://github.com/ROTl24/wenyao.git
cd wenyao
npm.cmd ci
npm.cmd run dev
```

常用命令：

| 命令 | 用途 |
| --- | --- |
| `npm.cmd run typecheck` | TypeScript 全量检查 |
| `npm.cmd test` | 运行渲染层、领域层与 Electron 测试 |
| `npm.cmd run build:renderer` | 构建渲染层和领域层 |
| `npm.cmd run build` | 构建 Windows NSIS 安装包 |

## 🧭 使用流程

1. 写下一个具体问题，并选择事项类别。
2. 连续完成六次铜钱投掷，由初爻向上成卦。
3. 查看本卦、动爻、变卦、四柱与逐爻排盘。
4. 核对程序生成的规则事实与古籍证据。
5. 阅读本地或云端解读，并围绕当前卦例继续追问。

## 📚 古籍与检索

当前知识库由《易隐》《卜筮正宗》《易冒》《火珠林》《增删卜易》五种文本构建。

| 内容 | 数量 |
| --- | ---: |
| 可定位证据条目 | 1,263 |
| 规则条目 | 495 |
| 占例条目 | 190 |
| 义理条目 | 578 |

每条证据保留书名、章节和原始行号。`corpus-manifest.json` 同时记录来源文件摘要、编码、行数和条目数，便于重建与审计。

检索会根据当前运行条件明确使用以下模式之一：

- `hybrid-reranked`：关键词与向量混合召回，再执行模型重排；
- `hybrid-fused`：关键词与向量召回后进行融合排序；
- `lexical-fallback`：只使用 canonical 关键词召回。

## 🤖 模型配置

默认适配阿里云百炼兼容接口：

| 能力 | 默认模型 |
| --- | --- |
| 解读 | `qwen3.7-plus` |
| 向量 | `text-embedding-v4` |
| 重排 | `qwen3-rerank` |

`qwen3-rerank` 需要在设置中填写业务空间对应的完整 `/compatible-api/v1/reranks` 地址。未配置重排服务时，应用会显示实际检索模式，不会把普通融合排序标记成模型重排。

不配置 API 密钥也可以完成起卦、排盘、历史记录和本地证据分析；云端生成、在线向量构建与模型重排需要有效的百炼配置。

## 🏗️ 技术架构

### 核心技术栈

- **桌面容器**：Electron 43 + 严格 IPC 边界
- **渲染层**：React 19 + TypeScript 7 + Vite 8
- **铜钱场景**：React Three Fiber + Three.js + Rapier 物理引擎
- **领域层**：确定性六爻排盘、规则事实、取用与报告契约
- **本地存储**：原子化 JSON 案例存储 + 本地向量索引
- **安全能力**：Electron `safeStorage` + Windows DPAPI
- **模型服务**：阿里云百炼兼容接口

```text
React 界面
    │
    ├── 三枚铜钱物理场景 ── 六次投掷与成爻状态
    │
    └── Electron IPC
            ├── 六爻领域引擎 ── 排盘、规则事实、FactSet
            ├── 本地数据层 ──── 案例、设置、证据与向量索引
            └── 解读服务 ────── 检索、模型调用、结构与引用校验
```

### 项目结构

```text
src/components/      问事、铜钱起卦、结果、历史与设置界面
src/domain/liuyao/   六爻结构、规则包、事实与报告契约
src/lib/             桌面适配、会话、检索与展示数据转换
electron/services/   存储、检索、模型调用、迁移与安全边界
resources/           已构建的古籍条目、知识索引与评测数据
docs/domain/         规则来源、差异与双重审阅记录
```

## ✅ 质量保障

当前完整测试共 **824 条**：

- 43 个 Vitest 测试文件，735 条组件、领域与渲染层测试；
- 89 条 Electron / Node 服务、存储、检索和安全边界测试；
- 穷举 4,096 种六爻组合，并覆盖六十四卦、六十甲子旬空和完整纳甲表；
- 覆盖事实、规则、证据引用校验，以及历史迁移、并发写入和 IPC 边界。

GitHub Actions 在 Windows 环境依次执行类型检查、完整测试和渲染层构建。

## 📖 文档导航

| 文档 | 内容 |
| --- | --- |
| [解卦原理与流程](./docs/解卦原理与流程.md) | 结构真值、规则事实、证据检索和解读边界 |
| [文王纳甲审阅](./docs/domain/wenwang-najia-v2-review.md) | 六十四卦、纳甲、世应与来源审阅 |
| [用神规则审阅](./docs/domain/use-god-core-v1-review.md) | 取用候选、澄清与相关规则 |
| [关系事实审阅](./docs/domain/relation-core-v1-review.md) | 生克、冲合、刑害破等关系事实 |
| [十二长生与神煞审阅](./docs/domain/growth-shensha-core-v1-review.md) | 十二长生与受限神煞规则 |
| [最终验收记录](./docs/acceptance/2026-07-11-final-acceptance.md) | 功能、质量与发布验收记录 |

## ❓ 常见问题

### 不配置 API 密钥可以使用吗？

可以。起卦、排盘、历史记录、规则事实和本地证据分析不依赖云模型；云端解读、在线向量构建和模型重排不可用时会明确提示或降级。

### 数据会全部上传到云端吗？

不会。历史案例、设置和向量索引保存在本机。调用云模型时，只发送当前问题、已锁定的模型事实契约和命中的候选证据。

### 为什么安装时会出现 SmartScreen 提示？

当前预览版尚未进行 Windows 代码签名。请只从本项目 Releases 下载，并在安装前核对 SHA-256。

### macOS 或 Linux 可以直接安装吗？

目前只发布 Windows 10/11 x64 安装包，CI 也只在 Windows 环境验证。其他平台暂未提供正式安装包。

### 结果可以替代专业意见吗？

不可以。本项目用于传统文化研究、规则工程实验与个人反思，不构成医疗、法律、投资或其他专业建议。

## 🗺️ 路线图

- [x] 三枚乾隆通宝物理起卦与六次成爻流程
- [x] 文王纳甲、本变卦、四柱旬空与关系事实
- [x] 本地古籍证据检索与可追溯解读
- [x] 历史案例、同卦追问与数据迁移
- [x] Windows x64 NSIS 预览安装包
- [ ] Windows 代码签名与自动更新
- [ ] 案例导出、打印与脱敏分享
- [ ] 更多经过独立复核的规则 profile

## 🤝 参与项目

欢迎提交缺陷、规则差异、原文校勘、测试样例和交互建议。

1. Fork 本仓库。
2. 创建功能分支：`git checkout -b feature/your-feature`。
3. 完成修改并运行 `npm.cmd run typecheck` 与 `npm.cmd test`。
4. 推送分支并创建 Pull Request，说明问题、方案和验证结果。

涉及术数规则时，请尽量附上书名、版本、章节或页码；提交代码时，请勿包含真实 API Key、Token、个人案例或其他敏感数据。

## ⚖️ 使用边界与许可说明

- 本项目用于传统文化研究、规则工程实验与个人反思；
- 不构成医疗、法律、投资或其他专业建议；
- 仓库当前暂未附加开源许可证。公开可见不等于获得复制、修改或分发授权，除非后续另行明确授权。

---

_排盘由程序确定，解读以事实和证据为边界。_
