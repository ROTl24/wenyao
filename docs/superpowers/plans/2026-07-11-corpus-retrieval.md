# 古籍证据包与混合检索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把用户提供的约 10 本可复制文档与竖排繁体扫描古籍构建为只读、可校订、可回到原页坐标的证据包，并在桌面应用中交付关键词与语义混合检索及原页高亮。

**Architecture:** Python 离线工具负责登记、页面渲染、OCR、校订、语义切分和索引构建，运行时不随桌面应用启动。构建产物是 `corpus.sqlite + pages + manifest.json`；Rust 运行时以只读方式打开证据包，执行 FTS5、向量、RRF 融合和证据回链，React 只负责查看结果。

**Tech Stack:** Python 3.12、PyMuPDF、PaddleOCR、Pydantic、Typer、OpenCC、SQLite FTS5、NumPy、pytest、Rust/SQLx、React、Vitest。

## Global Constraints

- 原始文件、OCR 原文、人工校订文和搜索归一化文本必须分层保存，任何派生处理不得覆盖原文。
- 每个引用必须能落到书名、版本、卷章、PDF 页/原书叶码和页面 `bbox`。
- 语义块只能按完整规则、卦例、注解和术语边界切分，不能跨卦例机械拼接。
- 用户提供的书目是执行输入，源文件只放在被 Git 忽略的 `corpus/source/`，不得提交到仓库或上传到第三方。
- 首批金标准至少 100 页；关键字“世、应、官、财、伏、冲、合”单独统计准确率。
- 运行时查询向量失败时必须退化到 FTS5；证据包损坏时禁止 AI 分析但不影响起卦排盘。
- 每个任务测试先行并单独提交。

## File Structure

```text
tools/corpus-builder/
  pyproject.toml
  src/liuyao_corpus/
    cli.py
    models.py
    manifest.py
    pdf_ingest.py
    ocr.py
    reading_order.py
    corrections.py
    chunking.py
    indexer.py
    embeddings.py
    validate.py
  tests/
    fixtures/
    test_manifest.py
    test_pdf_ingest.py
    test_reading_order.py
    test_corrections.py
    test_chunking.py
    test_indexer.py
corpus/
  source/                 本地输入，不提交
  corrections/            可审阅校订补丁，提交
  catalog.yaml             书目与版本，提交
  build/                   构建输出，不提交
  eval/ocr_gold.jsonl      人工金标准，提交
  eval/retrieval_gold.jsonl
crates/liuyao-retrieval/
  Cargo.toml
  src/lib.rs
  src/corpus.rs
  src/fts.rs
  src/vector.rs
  src/fusion.rs
  tests/retrieval.rs
apps/desktop/src/features/evidence/
  EvidenceViewer.tsx
  EvidenceViewer.test.tsx
```

---

### Task 1: 建立可复现书目、Manifest 与数据 Schema

**Files:**
- Create: `tools/corpus-builder/pyproject.toml`
- Create: `tools/corpus-builder/src/liuyao_corpus/models.py`
- Create: `tools/corpus-builder/src/liuyao_corpus/manifest.py`
- Create: `tools/corpus-builder/tests/test_manifest.py`
- Create: `corpus/catalog.yaml`

**Interfaces:**
- Produces: `build_manifest(catalog_path, source_dir) -> CorpusManifest`。
- Produces: `manifest.json`，包含 corpus 版本、构建时间、工具版本、每本书 SHA-256 和页数。
- Produces: Pydantic 模型 `Book`、`Page`、`TextSpan`、`Chunk`、`ChunkEvidence`。

- [ ] **Step 1: 写失败的稳定 Manifest 测试**

```python
def test_manifest_hash_changes_when_source_changes(tmp_path):
    source = tmp_path / "book.pdf"
    source.write_bytes(b"version-1")
    catalog = write_catalog(tmp_path, source.name)
    first = build_manifest(catalog, tmp_path)
    source.write_bytes(b"version-2")
    second = build_manifest(catalog, tmp_path)
    assert first.books[0].sha256 != second.books[0].sha256
```

- [ ] **Step 2: 创建 Python 环境并确认失败**

Run:

```powershell
py -3.12 -m venv tools/corpus-builder/.venv
tools\corpus-builder\.venv\Scripts\python.exe -m pip install -e "tools/corpus-builder[dev]"
tools\corpus-builder\.venv\Scripts\python.exe -m pytest tools/corpus-builder/tests/test_manifest.py -v
```

Expected: FAIL，`build_manifest` 不存在。

- [ ] **Step 3: 实现严格数据模型**

```python
class TextSpan(BaseModel):
    id: str
    page_id: str
    bbox: tuple[float, float, float, float]
    column_id: int
    reading_order: int
    ocr_raw: str
    corrected_text: str
    confidence: float = Field(ge=0, le=1)
    model_version: str

class Chunk(BaseModel):
    id: str
    type: Literal["rule", "case", "commentary", "glossary"]
    original_text: str
    punctuated_text: str
    search_alias: str
    section_path: list[str]
    parent_id: str | None
    school: str | None
    tags: list[str]
    review_status: Literal["machine", "reviewed", "approved"]
    evidence_span_ids: list[str]
```

Manifest 使用排序后的 UTF-8 JSON 计算自身内容哈希，构建时间不参与可重复内容哈希。

- [ ] **Step 4: 验证**

Run: `tools\corpus-builder\.venv\Scripts\python.exe -m pytest tools/corpus-builder/tests/test_manifest.py -v`

Expected: PASS；同输入得到同一内容哈希，修改源文件后哈希变化。

- [ ] **Step 5: 提交**

```powershell
git add tools/corpus-builder corpus/catalog.yaml
git commit -m "feat(corpus): 建立可复现古籍清单与证据模型"
```

---

### Task 2: 提取可复制 PDF 并渲染扫描页

**Files:**
- Create: `tools/corpus-builder/src/liuyao_corpus/pdf_ingest.py`
- Create: `tools/corpus-builder/tests/test_pdf_ingest.py`

**Interfaces:**
- Produces: `classify_page(page) -> PageKind`，取值 `digital_text` 或 `scanned_image`。
- Produces: `ingest_pdf(book, output_dir) -> list[PageArtifact]`。
- Produces: 长边 2400px 的页面 WebP 预览和 PDF 文本块坐标。

- [ ] **Step 1: 写数字页与扫描页分类测试**

```python
def test_classifies_page_with_real_text_as_digital(digital_pdf):
    page = open_first_page(digital_pdf)
    assert classify_page(page) == PageKind.DIGITAL_TEXT

def test_classifies_image_only_page_as_scanned(scanned_pdf):
    page = open_first_page(scanned_pdf)
    assert classify_page(page) == PageKind.SCANNED_IMAGE
```

- [ ] **Step 2: 运行并确认失败**

Run: `tools\corpus-builder\.venv\Scripts\python.exe -m pytest tools/corpus-builder/tests/test_pdf_ingest.py -v`

Expected: FAIL，分类函数不存在。

- [ ] **Step 3: 实现页面分类与渲染**

数字页以有效汉字数量、文本覆盖面积和图片覆盖面积综合判断，不仅检查 `get_text()` 非空。所有页面都渲染预览图；数字页直接保留 PyMuPDF span 坐标，扫描页进入 OCR 队列。

```python
def classify_page(page: fitz.Page) -> PageKind:
    text = page.get_text("text").strip()
    han_count = sum("\u3400" <= ch <= "\u9fff" for ch in text)
    image_area = sum(rect.get_area() for rect in image_rects(page))
    page_area = page.rect.get_area()
    return PageKind.DIGITAL_TEXT if han_count >= 30 and image_area / page_area < 0.9 else PageKind.SCANNED_IMAGE
```

- [ ] **Step 4: 验证页面回链**

增加测试：页面图存在、尺寸固定、span 坐标位于页面范围内、PDF 页号从 1 开始持久化。

Run: `tools\corpus-builder\.venv\Scripts\python.exe -m pytest tools/corpus-builder/tests/test_pdf_ingest.py -v`

Expected: PASS。

- [ ] **Step 5: 提交**

```powershell
git add tools/corpus-builder/src/liuyao_corpus/pdf_ingest.py tools/corpus-builder/tests
git commit -m "feat(corpus): 提取 PDF 文本并生成原页预览"
```

---

### Task 3: OCR、竖排阅读顺序与可审阅校订

**Files:**
- Create: `tools/corpus-builder/src/liuyao_corpus/ocr.py`
- Create: `tools/corpus-builder/src/liuyao_corpus/reading_order.py`
- Create: `tools/corpus-builder/src/liuyao_corpus/corrections.py`
- Create: `tools/corpus-builder/tests/test_reading_order.py`
- Create: `tools/corpus-builder/tests/test_corrections.py`
- Create: `corpus/corrections/schema.json`

**Interfaces:**
- Produces: `OcrProvider.recognize(page_image) -> list[OcrSpan]`。
- Produces: `order_vertical(spans) -> list[OcrSpan]`，默认右列到左列、列内上到下。
- Produces: `apply_corrections(spans, patch) -> list[TextSpan]`，不修改 `ocr_raw`。

- [ ] **Step 1: 写竖排、夹注和校订不覆盖原文测试**

```python
def test_vertical_columns_are_right_to_left_and_top_to_bottom():
    spans = [span("左下", x=10, y=80), span("右下", x=90, y=80), span("右上", x=90, y=10)]
    assert [s.text for s in order_vertical(spans)] == ["右上", "右下", "左下"]

def test_correction_preserves_raw_ocr():
    corrected = apply_corrections([span("世爻休囚")], patch(replace="世爻休囚", with_="世爻休囚"))
    assert corrected[0].ocr_raw == "世爻休囚"
    assert corrected[0].corrected_text == "世爻休囚"
```

- [ ] **Step 2: 运行并确认失败**

Run: `tools\corpus-builder\.venv\Scripts\python.exe -m pytest tools/corpus-builder/tests/test_reading_order.py tools/corpus-builder/tests/test_corrections.py -v`

Expected: FAIL。

- [ ] **Step 3: 实现 PaddleOCR Adapter 与排序**

Adapter 固定输出模型版本、置信度和 bbox；PaddleOCR 依赖与模型下载位置通过 CLI 参数显式指定。列聚类按页面宽度归一化阈值执行；夹注和双行小字进入单独 `column_group`，不能静默并入正文。

- [ ] **Step 4: 实现 JSON Patch 校订格式**

```json
{
  "book_id": "book-001",
  "page_id": "book-001-p0001",
  "changes": [
    {"span_id": "s-12", "expected_raw": "官鬼持也", "corrected_text": "官鬼持世", "reviewer": "human"}
  ]
}
```

当 `expected_raw` 与当前 OCR 不一致时构建必须失败，防止补丁错贴到新版页面。

- [ ] **Step 5: 跑真实 20–50 页 OCR 风险实验**

Run: `tools\corpus-builder\.venv\Scripts\python.exe -m liuyao_corpus.cli benchmark-ocr --catalog corpus/catalog.yaml --pages corpus/eval/ocr_gold.jsonl`

Expected: 输出全文 CER、关键术语 CER、阅读顺序准确率和 bbox 覆盖率；把报告保存到 `docs/quality/ocr-baseline.md`。未达到关键术语人工复核覆盖 100% 时，不进入索引构建。

- [ ] **Step 6: 提交**

```powershell
git add tools/corpus-builder corpus/corrections corpus/eval/ocr_gold.jsonl docs/quality/ocr-baseline.md
git commit -m "feat(corpus): 支持竖排 OCR 与可追溯人工校订"
```

---

### Task 4: 语义切分与六爻元数据

**Files:**
- Create: `tools/corpus-builder/src/liuyao_corpus/chunking.py`
- Create: `tools/corpus-builder/tests/test_chunking.py`

**Interfaces:**
- Produces: `chunk_document(document) -> list[Chunk]`。
- Produces: 父块/子块关系和 `rule|case|commentary|glossary` 类型。
- Produces: 卦名、动爻、六亲、世应、用神、月日、占类、流派标签。

- [ ] **Step 1: 写“不跨卦例”失败测试**

```python
def test_case_chunks_never_cross_case_boundary():
    document = fixture_document_with_two_cases()
    chunks = chunk_document(document)
    case_chunks = [c for c in chunks if c.type == "case"]
    assert len(case_chunks) == 2
    assert all("次占" not in c.original_text for c in case_chunks[:1])
```

- [ ] **Step 2: 运行并确认失败**

Run: `tools\corpus-builder\.venv\Scripts\python.exe -m pytest tools/corpus-builder/tests/test_chunking.py -v`

Expected: FAIL。

- [ ] **Step 3: 实现规则驱动切分**

先按已校订章节标题和卦例边界形成父块，再生成 300–800 汉字子块；边界优先于长度。LLM 只能离线提出类型和标签候选，所有候选标记为 `machine`，不得自动升级为 `approved`。

- [ ] **Step 4: 验证证据回链**

测试每个 Chunk 至少关联一个 TextSpan，所有 evidence span 属于同一本书和父章节，完整卦例不被拆到不同父块。

Run: `tools\corpus-builder\.venv\Scripts\python.exe -m pytest tools/corpus-builder/tests/test_chunking.py -v`

Expected: PASS。

- [ ] **Step 5: 提交**

```powershell
git add tools/corpus-builder/src/liuyao_corpus/chunking.py tools/corpus-builder/tests/test_chunking.py
git commit -m "feat(corpus): 按规则与卦例构建语义父子块"
```

---

### Task 5: 构建 SQLite、FTS5 与向量证据包

**Files:**
- Create: `tools/corpus-builder/src/liuyao_corpus/indexer.py`
- Create: `tools/corpus-builder/src/liuyao_corpus/embeddings.py`
- Create: `tools/corpus-builder/src/liuyao_corpus/validate.py`
- Create: `tools/corpus-builder/tests/test_indexer.py`

**Interfaces:**
- Produces: `corpus/build/corpus.sqlite`、`corpus/build/pages/`、`corpus/build/manifest.json`。
- Produces: FTS5 BM25 和定长 little-endian float32 向量 BLOB。
- Produces: `validate-package` CLI，验证哈希、外键、向量维度和引用回链。

- [ ] **Step 1: 写失败的原文精确检索测试**

```python
def test_fts_finds_traditional_and_search_alias(tmp_path):
    db = build_fixture_index(tmp_path, original="官鬼進神", alias="官鬼进神")
    assert search_fts(db, "進神")
    assert search_fts(db, "进神")
```

- [ ] **Step 2: 运行并确认失败**

Run: `tools\corpus-builder\.venv\Scripts\python.exe -m pytest tools/corpus-builder/tests/test_indexer.py -v`

Expected: FAIL。

- [ ] **Step 3: 实现只读语料 Schema**

创建 `books`、`pages`、`text_spans`、`chunks`、`chunk_evidence`、`embeddings` 和 `chunks_fts`。FTS 索引 `original_text`、`punctuated_text`、`search_alias`、`section_path` 和 tags；向量记录 `model_id` 与 dimensions。

- [ ] **Step 4: 实现批量 Embedding**

API 密钥只从进程环境读取，构建日志只记录 chunk ID、批次和耗时。响应数量或维度不一致立即失败，不写半成品索引。所有向量 L2 归一化后保存。

- [ ] **Step 5: 构建并验证真实证据包**

Run:

```powershell
tools\corpus-builder\.venv\Scripts\python.exe -m liuyao_corpus.cli build --catalog corpus/catalog.yaml --out corpus/build --prompt-for-api-key
tools\corpus-builder\.venv\Scripts\python.exe -m liuyao_corpus.cli validate-package corpus/build/manifest.json
```

`--prompt-for-api-key` 必须使用 Python `getpass.getpass()` 读取且只保存在当前进程内存，不写环境变量、shell 历史、配置和日志。

Expected: 所有书籍哈希一致；外键与引用回链零错误；每个 approved chunk 有 FTS 行和正确维度向量。

- [ ] **Step 6: 提交**

```powershell
git add tools/corpus-builder
git commit -m "feat(corpus): 构建可校验的混合检索证据包"
```

---

### Task 6: Rust 混合检索与原页证据查看器

**Files:**
- Create: `crates/liuyao-retrieval/**`
- Modify: `Cargo.toml`
- Create: `apps/desktop/src/features/evidence/EvidenceViewer.tsx`
- Create: `apps/desktop/src/features/evidence/EvidenceViewer.test.tsx`

**Interfaces:**
- Produces: `Corpus::open_read_only(path, expected_hash)`。
- Produces: `search(SearchQuery) -> SearchResult`，含 FTS、向量、RRF 分数。
- Produces: `get_evidence(evidence_id) -> EvidenceDetail`，含页面图和 bbox。

- [ ] **Step 1: 写 RRF 与只读打开失败测试**

```rust
#[test]
fn rrf_rewards_documents_returned_by_both_channels() {
    let fused = rrf(vec![["a", "b"], ["b", "c"]], 60.0);
    assert_eq!(fused[0].id, "b");
}
```

- [ ] **Step 2: 实现精确向量搜索与 RRF**

固定语料规模下先加载归一化向量到内存并做精确点积，避免引入独立向量服务。FTS 与向量各取前 40，RRF 融合后取前 30。接口保留 `VectorIndex` trait，后续规模增长可换 HNSW 而不影响上层。

- [ ] **Step 3: 写查看器失败测试并实现**

```tsx
it('renders the source page and bbox overlay', () => {
  render(<EvidenceViewer evidence={fixtureEvidence()} />);
  expect(screen.getByRole('img', { name: /原书第 12 页/ })).toBeVisible();
  expect(screen.getByTestId('evidence-highlight')).toHaveStyle({ left: '20%' });
});
```

查看器用页面自然尺寸将 bbox 归一化为百分比 overlay；支持放大、上下文前后 span 和书目版本显示。

- [ ] **Step 4: 运行验证**

Run:

```powershell
cargo test -p liuyao-retrieval
npm.cmd test --workspace @liuyao/desktop -- EvidenceViewer.test.tsx --run
```

Expected: PASS。

- [ ] **Step 5: 提交**

```powershell
git add Cargo.toml Cargo.lock crates/liuyao-retrieval apps/desktop/src/features/evidence
git commit -m "feat(retrieval): 交付混合检索与原页证据回链"
```

---

### Task 7: 建立 OCR 与检索质量门

**Files:**
- Create: `corpus/eval/retrieval_gold.jsonl`
- Create: `tools/corpus-builder/src/liuyao_corpus/evaluate.py`
- Create: `docs/quality/retrieval-baseline.md`

**Interfaces:**
- Produces: `evaluate-retrieval` CLI 与 JSON/Markdown 报告。
- Produces: Recall@5/10、MRR、nDCG@10、无答案拒答率。

- [ ] **Step 1: 写指标实现测试**

为已知排名构造样本，断言 Recall、MRR、nDCG 的精确小数结果。

- [ ] **Step 2: 准备 150 个专家标注问题**

JSONL 每行包含 `question`、`category`、`plate_facts`、`relevant_evidence_ids`、`answerable` 和 `notes`。覆盖原句、现代同义问法、规则、卦例、跨章节、冲突流派和无答案。

- [ ] **Step 3: 运行基线并固定门槛**

Run: `tools\corpus-builder\.venv\Scripts\python.exe -m liuyao_corpus.cli evaluate-retrieval --gold corpus/eval/retrieval_gold.jsonl --package corpus/build/manifest.json`

Expected: 生成 `docs/quality/retrieval-baseline.md`；任何后续变更不得让 Recall@10、MRR 或无答案拒答率低于该已审基线。

- [ ] **Step 4: 跑全部质量门并提交**

```powershell
tools\corpus-builder\.venv\Scripts\python.exe -m pytest tools/corpus-builder/tests -v
cargo test -p liuyao-retrieval
git add corpus/eval tools/corpus-builder/src/liuyao_corpus/evaluate.py docs/quality
git commit -m "test(corpus): 建立古籍 OCR 与检索评测基线"
```

## Completion Gate

- 约 10 本书全部进入版本化 Manifest，源文件未提交 Git。
- 100 页 OCR 金标准和 150 个检索问题完成评测。
- 任意 Evidence ID 能打开正确书页和 bbox。
- FTS、向量和 RRF 均有独立测试，向量失败时 FTS 可用。
- `corpus.sqlite` 以只读方式打开，哈希不一致时明确阻止 AI 分析。
