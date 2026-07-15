# 问爻

一款 Windows 优先的水墨六爻桌面应用。用户输入所占之事后，通过六轮三枚乾隆古币完成起卦，程序按文王纳甲规则排盘，再使用本地古籍证据与可配置的云端模型生成解读并支持继续追问。

## 已实现

- 合手、开手、三枚实时 3D 古币翻滚与逐爻确认
- 6/7/8/9、六十四卦、变卦、完整干支纳甲、变爻六亲、六神、世应、月日与旬空
- 每一轮自动保存；可从历史记录恢复未完成起卦
- 本地基础推演、古籍证据栏、Markdown 云端 AI 解读与同卦追问
- 阿里云百炼 `qwen3.7-plus` 与 `text-embedding-v4` 检索栈、DeepSeek 官方 `deepseek-v4-pro` 分阶段解卦
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

`resources/knowledge-index.json` 将原文进一步标注为 495 条规则、190 条占例和 578 条义理；`resources/corpus-vectors.f32` 是 1,263 条原文的 1024 维本地向量索引。桌面端检索采用关键词/BM25 类召回与向量召回的 RRF 融合，再由阿里云 qwen3-rerank 业务空间接口（配置后）对候选证据精排。

语料构建脚本会自动识别 UTF-8/GB18030、去除下载站广告、按章节和段落切分，并拒绝含乱码或重复证据 ID 的构建结果：

```powershell
npm.cmd run build:corpus -- "C:\path\易隐.txt" "C:\path\卜筮正宗.txt" "C:\path\易冒.txt" "C:\path\火珠林.txt" "C:\path\增删卜易.txt"
```

## 双 provider 模型设置

阿里云百炼负责千问连通性、古籍向量召回和可选重排：

- 官方兼容 API：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- 千问模型：`qwen3.7-plus`
- 向量模型：`text-embedding-v4`（1024 维）
- 重排模型：`qwen3-rerank`（需要填写阿里云 Workspace 专属重排地址）

DeepSeek 官方接口只负责 AI 解读与同一卦象追问：

- 官方 API：`https://api.deepseek.com`
- 解读模型：`deepseek-v4-pro`
- 主报告与追问直接返回严格 11 节 Markdown，固定使用“占问主题”到“最终一句话结论”的章节顺序；界面支持标题、列表与引用，并禁用模型输出中的原始 HTML
- 每个判断、事实、条件、应期和最终结论句末都要求紧跟行内引用标签：盘面事实使用 `#plate-facts`，古籍规则使用真实的 `#evidence-ID`
- 运行时按 Markdown 语义校验 11 节结构、句末引用、当前排盘事实与证据 ID；首次草稿不合格时只允许重写一次，引用标签可点击回看盘面或证据卡片

两套 API Key 分别由 Windows DPAPI 加密保存。首次重建向量索引会把古籍片段分批发送给阿里云向量模型并把生成结果保存在本机；更换向量模型后必须重新构建索引，旧模型的向量不能混用。未配置 DeepSeek 密钥时，起卦、排盘、历史和本地基础推演仍可离线使用。
