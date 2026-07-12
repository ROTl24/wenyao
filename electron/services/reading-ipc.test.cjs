const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { registerReadingIpc } = require('./reading-ipc.cjs');

test('reading IPC handlers sanitize payloads again in the main process', async () => {
  const handlers = new Map();
  const calls = [];
  const ipcMain = {
    handle(channel, handler) { handlers.set(channel, handler); },
  };
  const service = Object.fromEntries(
    ['buildCase', 'selectIntent', 'analyze', 'followUp'].map((method) => [
      method,
      async (payload) => { calls.push({ method, payload }); return { method, payload }; },
    ]),
  );
  registerReadingIpc({ ipcMain, service });
  assert.deepEqual([...handlers.keys()], [
    'reading:build-case', 'reading:select-intent', 'reading:analyze', 'reading:follow-up',
  ]);

  const forged = { plate: { id: 'fake' }, facts: [{ id: 'fake' }], evidence: [{ id: 'fake' }], analysis: { fake: true } };
  await handlers.get('reading:build-case')(null, {
    sessionId: 'session-1', clarification: { explicitIntentId: 'career.rank-or-office', facts: ['fake'] }, ...forged,
  });
  await handlers.get('reading:select-intent')(null, {
    sessionId: 'session-1', clarification: { subjectRelation: '父母', facts: ['fake'] }, expectedFactSetHash: 'hash', ...forged,
  });
  await handlers.get('reading:analyze')(null, { sessionId: 'session-1', expectedFactSetHash: 'hash', ...forged });
  await handlers.get('reading:follow-up')(null, { sessionId: 'session-1', question: '追问', expectedFactSetHash: 'hash', ...forged });

  assert.deepEqual(calls, [
    { method: 'buildCase', payload: { sessionId: 'session-1', clarification: { explicitIntentId: 'career.rank-or-office' } } },
    { method: 'selectIntent', payload: { sessionId: 'session-1', clarification: { subjectRelation: '父母' }, expectedFactSetHash: 'hash' } },
    { method: 'analyze', payload: { sessionId: 'session-1', expectedFactSetHash: 'hash' } },
    { method: 'followUp', payload: { sessionId: 'session-1', question: '追问', expectedFactSetHash: 'hash' } },
  ]);
});

test('main startup loads canonical evidence fail-closed, migrates before Store and wires only V2 reading ports', () => {
  const root = path.resolve(__dirname, '../..');
  const main = fs.readFileSync(path.join(root, 'electron/main.cjs'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const migrationCall = main.indexOf('await migrateDataFile(dataPath()');
  const storeConstruction = main.indexOf('new JsonStore(dataPath()');
  const catalogLoad = main.indexOf('await loadEvidenceCatalog({');

  assert.ok(catalogLoad >= 0, 'main must await the canonical evidence catalog');
  assert.ok(catalogLoad < migrationCall, 'corrupt or missing catalog must fail before data migration/store startup');
  assert.ok(migrationCall >= 0, 'main must await raw migration');
  assert.ok(storeConstruction > migrationCall, 'Store must be constructed after migration');
  assert.match(main, /normalizeValidatedAnalysisReportV2:\s*domainRuntime\.normalizeValidatedAnalysisReportV2/);
  assert.match(main, /evidenceCatalog,\s*\n\s*searchCorpus/);
  assert.match(main, /ruleIds:\s*Array\.isArray\(payload\.ruleIds\)\s*\?\s*payload\.ruleIds\s*:\s*\[\]/);
  assert.doesNotMatch(main, /function\s+(?:loadCorpus|hashCorpus)\b/);
  assert.doesNotMatch(main, /\b(?:createLocalReport|validateCloudReport|analyzeCloud|followUpCloud)\b/);
  assert.doesNotMatch(main, /ipcMain\.handle\(['"](?:ai:|retrieval:search)/);
  assert.match(main, /registerReadingIpc/);
  assert.equal(packageJson.scripts.start, 'npm run build:domain && electron .');
});
