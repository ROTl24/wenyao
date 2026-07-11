# 问爻

一款 Windows 优先的水墨六爻桌面应用。用户输入所占之事后，通过六轮三枚乾隆古币完成起卦，程序按文王纳甲规则排盘，再使用本地古籍证据与可配置的云端模型生成解读并支持继续追问。

## 已实现

- 合手、开手、三枚实时 3D 古币翻滚与逐爻确认
- 6/7/8/9、六十四卦、变卦、完整干支纳甲、变爻六亲、六神、世应、月日与旬空
- 每一轮自动保存；可从历史记录恢复未完成起卦
- 本地基础推演、古籍证据栏、云端 AI 分析与同卦追问
- 阿里 `qwen3.7-plus` 分阶段解卦、`text-embedding-v4` 语义召回、`qwen3-rerank` 专用重排适配
- API 密钥使用 Windows DPAPI 加密，历史、古籍、结构化索引和向量索引保存在本机
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
npm.cmd run eval:retrieval
npm.cmd run verify:models
npm.cmd run verify:retrieval
npm.cmd run build
```

安装包生成到 `release/WenYao-0.1.0-Setup.exe`。

## 古籍证据包

`resources/corpus.json` 已收入用户提供的《易隐》《卜筮正宗》《易冒》《火珠林》《增删卜易》五本纯文本古籍，共 1263 条原文证据。每条证据保留书名、章节标题和原始文本行号；`resources/corpus-manifest.json` 记录原文件名、SHA-256、编码、行数和条目数，便于复核与重建。

`resources/knowledge-index.json` 将原文进一步标注为 495 条规则、190 条占例和 578 条义理；`resources/corpus-vectors.f32` 是 1,263 条原文的 1024 维本地向量索引。桌面端检索采用关键词/BM25 类召回与向量召回的 RRF 融合，配置百炼业务空间重排地址后，再由 `qwen3-rerank` 对候选证据精排。

语料构建脚本会自动识别 UTF-8/GB18030、去除下载站广告、按章节和段落切分，并拒绝含乱码或重复证据 ID 的构建结果：

```powershell
npm.cmd run build:corpus -- "C:\path\易隐.txt" "C:\path\卜筮正宗.txt" "C:\path\易冒.txt" "C:\path\火珠林.txt" "C:\path\增删卜易.txt"
```

## 阿里模型设置

默认配置：

- 兼容 API：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- 解卦模型：`qwen3.7-plus`
- 向量模型：`text-embedding-v4`（1024 维）
- 重排模型：`qwen3-rerank`

`qwen3-rerank` 需要填写百炼业务空间专属的完整 `/compatible-api/v1/reranks` 地址；未填写时应用会明确显示“混合召回 + 融合排序”，不会假装已经调用重排模型。

首次重建向量索引会把古籍片段分批发送给阿里向量模型，并把生成结果保存在本机；发行包已经包含预构建向量，因此日常使用只需发送当前问题、只读排盘和少量候选证据。未配置密钥时，起卦、排盘、历史和本地基础推演仍可离线使用。
