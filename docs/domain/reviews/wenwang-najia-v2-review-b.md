# `wenwang_najia_v2` 独立自动化审阅 B

## 审阅身份与独立性

- reviewerId：`codex-wikisource-audit-b`
- reviewerKind：`automated-agent`
- independentRunId：`wenwang-final-b-20260712`
- reviewedAt：`2026-07-12T07:57:25.9273596+08:00`
- artifactHash：`241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa`
- outcome：`matched`
- 差异：空

B 的执行约束是禁止读取 A；本次没有读取 `docs/domain/reviews/wenwang-najia-v2-review-a.md` 或 A 的结论。本记录只复述 B 的实际自动化输出，不是人工底本审阅。

## 输入来源

审阅输入固定为以下 source ID、URL 与规则包内登记的 locator/contentHash：

| Source ID | URL |
|---|---|
| `WS-JING-7903767` | https://zh.wikisource.org/w/index.php?title=%E4%BA%AC%E6%B0%8F%E6%98%93%E5%82%B3&oldid=7903767 |
| `WS-YIPI-760928` | https://zh.wikisource.org/w/index.php?title=%E6%98%93%E7%A6%86%E5%82%B3_(%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC)/%E5%A4%96%E7%AF%87&oldid=760928 |
| `WS-NAJIA1-2031149` | https://zh.wikisource.org/w/index.php?title=%E6%98%93%E5%AD%B8%E8%B1%A1%E6%95%B8%E8%AB%96/%E7%B4%8D%E7%94%B2%E4%B8%80&oldid=2031149 |
| `WS-NAJIA2-2031150` | https://zh.wikisource.org/w/index.php?title=%E6%98%93%E5%AD%B8%E8%B1%A1%E6%95%B8%E8%AB%96/%E7%B4%8D%E7%94%B2%E4%BA%8C&oldid=2031150 |
| `CTEXT-ZENGSHAN-1` | https://ctext.org/wiki.pl?chapter=950329&if=en |
| `CTEXT-ZENGSHAN-2` | https://ctext.org/wiki.pl?chapter=157683&if=en&remap=gb |
| `CTEXT-ZHENGZONG` | https://ctext.org/wiki.pl?chapter=801184&if=gb |

读取的本地对象：

- `src/domain/liuyao/rules/wenwang-najia-v2.ts` 的最终 artifact/canonical payload；
- `src/domain/liuyao/__fixtures__/golden-hexagrams.ts`；
- `src/domain/liuyao/__fixtures__/golden-najia.ts`；
- `scripts/review-wenwang-candidate.mjs`；
- `.superpowers/sdd/domain-source-second-review.md` 的第二审计路径与其中登记的固定修订。

## 独立方法与检查输出

1. 从第二审计与固定修订重新建立比对输入，不读取 A 的中间值或结论。
2. 独立复算 canonical payload：13,192 UTF-8 bytes，SHA-256 为 `241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa`。
3. 比对 64 个卦象条目：`hexagrams:64`，差异 0。
4. 比对 64×6 共 384 个纳甲位：`najia-lines:384`，差异 0。
5. 执行审阅输出汇总的 25 项关键断言：`review-assertions:25`，差异 0。
6. 核对乾变姤的完整变卦重装与乾本卦候选为空：`qian-to-gou-full-changed-reinstall`，差异 0。
7. 核对乾六爻动变坤的六条 base/own 六亲：`qian-to-kun-dual-relations`，差异 0。
8. 核对潜在伏神总数与分布：`hidden-spirit-candidates:56`，差异 0。

## 结论

该自动化审阅针对上述同一 artifactHash 得到 `matched`，差异清单为空。它不构成人工审阅，也没有提升为 `human-reviewed`。
