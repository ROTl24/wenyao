# 问爻

一款 Windows 优先的水墨六爻桌面应用。用户输入所占之事后，通过六轮三枚乾隆古币完成起卦，程序按文王纳甲规则排盘，再使用本地古籍证据与可配置的云端模型生成解读并支持继续追问。

## 已实现

- 合手、开手、三枚实时 3D 古币翻滚与逐爻确认
- 6/7/8/9、六十四卦、变卦、纳甲、六亲、六神、世应、月日与旬空
- 每一轮自动保存；可从历史记录恢复未完成起卦
- 本地基础推演、古籍证据栏、云端 AI 分析与同卦追问
- API 密钥使用 Windows DPAPI 加密，整本古籍不会发送到云端
- 历史搜索、恢复和二次确认删除
- Windows NSIS 安装包与免安装目录

## 本地开发

```powershell
npm.cmd install
node node_modules\electron\install.js
npm.cmd run dev
```

质量检查与打包：

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

安装包生成到 `release/WenYao-0.1.0-Setup.exe`。

## 古籍证据包

`resources/corpus.json` 已收入用户提供的《易隐》《卜筮正宗》《易冒》《火珠林》《增删卜易》五本纯文本古籍，共 1263 条原文证据。每条证据保留书名、章节标题和原始文本行号；`resources/corpus-manifest.json` 记录原文件名、SHA-256、编码、行数和条目数，便于复核与重建。

语料构建脚本会自动识别 UTF-8/GB18030、去除下载站广告、按章节和段落切分，并拒绝含乱码或重复证据 ID 的构建结果：

```powershell
npm.cmd run build:corpus -- "C:\path\易隐.txt" "C:\path\卜筮正宗.txt" "C:\path\易冒.txt" "C:\path\火珠林.txt" "C:\path\增删卜易.txt"
```

## AI 设置

应用兼容 OpenAI Chat Completions 风格接口。在“设置”中填写 HTTPS API 地址、模型名称和 API 密钥；未配置时，起卦、排盘、历史和本地基础推演仍可完全离线使用。
