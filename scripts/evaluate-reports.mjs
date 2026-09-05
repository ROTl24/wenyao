import fs from 'node:fs';
import path from 'node:path';
import { evaluateReport, applyReviews, reviewTemplate, summarizeReports } from './lib/report-quality.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} 缺少路径。`);
  return value;
}

function readJson(filename) {
  if (fs.statSync(filename).size > 64 * 1024 * 1024) throw new Error('输入文件超过 64 MB，请先筛选后分批导出。');
  return JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
}

try {
  const archivePath = argument('--archive');
  if (!archivePath) {
    process.stdout.write('离线完整解读评测（不会调用模型）\n用法：npm run eval:reports -- --archive "占簿备份.json" --output-dir "本机输出目录" [--reviews "人工评分.json"]\n先生成诊断与人工评分模板，审阅后填入 0/1/2 分和理由，再带 --reviews 汇总。自动检查结果不等于解读正确率。\n');
  } else {
    const archive = readJson(archivePath);
    if (archive.format !== 'wenyao-session-archive' || archive.version !== 1 || !Array.isArray(archive.sessions) || archive.sessions.length > 10000) throw new Error('请使用问爻导出的版本 1 占簿备份。');
    if (new Set(archive.sessions.map((session) => session.id)).size !== archive.sessions.length) throw new Error('占簿包含重复记录。');
    const results = archive.sessions.map(evaluateReport).filter(Boolean);
    const reviewsPath = argument('--reviews');
    if (reviewsPath) applyReviews(results, readJson(reviewsPath));
    const summary = summarizeReports(results, archive.sessions.filter((session) => session.generationDraft).length);
    const outputDir = argument('--output-dir');
    if (outputDir) {
      fs.mkdirSync(outputDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const output = { format: 'wenyao-report-quality', version: 1, evaluatedAt: new Date().toISOString(), summary, reports: results };
      fs.writeFileSync(path.join(outputDir, `解读评测-${stamp}.json`), JSON.stringify(output, null, 2), { flag: 'wx' });
      fs.writeFileSync(path.join(outputDir, `人工评分模板-${stamp}.json`), JSON.stringify(reviewTemplate(results), null, 2), { flag: 'wx' });
    }
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
