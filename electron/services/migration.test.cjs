const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { migrateDataFile, migrationBackupPath } = require('./migration.cjs');

const domainPromise = import('../generated/domain/index.js');
const NOW = '2026-07-12T00:00:10.000Z';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function tossRecord(value, index) {
  const facesByValue = {
    6: ['text', 'text', 'text'],
    7: ['text', 'text', 'reverse'],
    8: ['text', 'reverse', 'reverse'],
    9: ['reverse', 'reverse', 'reverse'],
  };
  const fieldsByValue = {
    6: { label: '老阴', moving: true, baseYang: false, changedYang: true },
    7: { label: '少阳', moving: false, baseYang: true, changedYang: true },
    8: { label: '少阴', moving: false, baseYang: false, changedYang: false },
    9: { label: '老阳', moving: true, baseYang: true, changedYang: false },
  };
  return {
    id: `toss-${index}`,
    lineIndex: index,
    visualSeed: `seed-${index}`,
    confirmedAt: `2026-07-12T00:00:0${index}.000Z`,
    faces: facesByValue[value],
    value,
    ...fieldsByValue[value],
  };
}

async function completeLegacySession(id = 'session-1') {
  const domain = await domainPromise;
  const values = [7, 7, 7, 7, 7, 7];
  const castAt = '2026-07-12T00:00:00.000Z';
  const expected = domain.buildDivinationCase({
    sessionId: id,
    plateId: `plate:${id}:v2`,
    question: '事业是否顺利',
    category: 'career',
    explicitIntentId: null,
    castAt,
    builtAt: NOW,
    tossValues: values,
    ruleContext: domain.DEFAULT_RULE_CONTEXT,
  }, { sha256 });
  return {
    id,
    question: '事业是否顺利',
    category: 'career',
    castAt,
    updatedAt: '2026-07-12T00:00:06.000Z',
    status: 'complete',
    tosses: values.map((value, index) => tossRecord(value, index + 1)),
    messages: [{ id: 'legacy-message', role: 'user', content: '旧追问' }],
    customLegacyField: { preserved: true },
    plate: {
      castAt,
      baseHexagram: { name: expected.plate.baseHexagram.name },
      changedHexagram: { name: expected.plate.changedHexagram.name },
      movingLines: [...expected.plate.movingLines],
      lines: values.map((value) => ({ value })),
    },
  };
}

test('raw data migration backs up exact bytes once and is deeply idempotent', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-migration-'));
  const filePath = path.join(dir, 'app-data.json');
  const original = Buffer.from(`${JSON.stringify({
    sessions: [await completeLegacySession()],
    settings: { model: 'test-model' },
  })}\n`, 'utf8');
  fs.writeFileSync(filePath, original);

  const first = await migrateDataFile(filePath, {
    domain: await domainPromise,
    now: () => new Date(NOW),
  });
  const firstBytes = fs.readFileSync(filePath);
  const firstState = JSON.parse(firstBytes.toString('utf8'));

  assert.equal(first.migrated, true);
  assert.deepEqual(fs.readFileSync(migrationBackupPath(filePath)), original);
  assert.equal(firstState.migrationVersion, 2);
  assert.equal(firstState.sessions[0].migrationVersion, 2);
  assert.equal(firstState.sessions[0].caseSnapshot.plate.id, 'plate:session-1:v2');
  assert.equal(firstState.sessions[0].caseRuntimeTrust, 'authoritative');
  assert.deepEqual(firstState.sessions[0].customLegacyField, { preserved: true });

  const second = await migrateDataFile(filePath, {
    domain: await domainPromise,
    now: () => new Date('2026-07-13T00:00:00.000Z'),
  });
  assert.equal(second.migrated, false);
  assert.deepEqual(fs.readFileSync(filePath), firstBytes);
  assert.equal(fs.readdirSync(dir).filter((name) => name.includes('.backup-v1')).length, 1);
});

test('needs-review migration preserves every legacy field and never synthesizes a Case', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-migration-'));
  const filePath = path.join(dir, 'app-data.json');
  const legacy = await completeLegacySession('review-session');
  legacy.plate.baseHexagram.name = '伪造冲突卦名';
  fs.writeFileSync(filePath, JSON.stringify({ sessions: [legacy], settings: {} }));

  await migrateDataFile(filePath, {
    domain: await domainPromise,
    now: () => new Date(NOW),
  });
  const migrated = JSON.parse(fs.readFileSync(filePath, 'utf8')).sessions[0];
  assert.equal(migrated.migrationState, 'needs-review');
  assert.equal(Object.hasOwn(migrated, 'caseSnapshot'), false);
  assert.equal(migrated.plate.baseHexagram.name, '伪造冲突卦名');
  assert.deepEqual(migrated.customLegacyField, { preserved: true });
  assert.deepEqual(migrated.messages, legacy.messages);
});

test('irreconcilable incomplete records remain reviewable without invented session fields', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-migration-'));
  const filePath = path.join(dir, 'app-data.json');
  fs.writeFileSync(filePath, JSON.stringify({
    sessions: [{ id: 'incomplete-record' }, 123],
    settings: {},
  }));

  await migrateDataFile(filePath, {
    domain: await domainPromise,
    now: () => new Date(NOW),
  });
  const migrated = JSON.parse(fs.readFileSync(filePath, 'utf8')).sessions;
  assert.deepEqual(migrated[0], { id: 'incomplete-record', migrationState: 'needs-review' });
  assert.deepEqual(migrated[1], { legacyValue: 123, migrationState: 'needs-review' });
});

test('simulated migration rename failure leaves original file bytes unchanged', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-migration-'));
  const filePath = path.join(dir, 'app-data.json');
  const original = Buffer.from(JSON.stringify({
    sessions: [await completeLegacySession()],
    settings: {},
  }), 'utf8');
  fs.writeFileSync(filePath, original);
  const failingFs = {
    ...fs,
    renameSync(from, to) {
      if (to === filePath) throw new Error('simulated rename failure');
      return fs.renameSync(from, to);
    },
  };

  await assert.rejects(
    migrateDataFile(filePath, {
      domain: await domainPromise,
      now: () => new Date(NOW),
      fileSystem: failingFs,
    }),
    /simulated rename failure/,
  );
  assert.deepEqual(fs.readFileSync(filePath), original);

  const changedOriginal = Buffer.concat([original, Buffer.from('\n')]);
  fs.writeFileSync(filePath, changedOriginal);
  await assert.rejects(
    migrateDataFile(filePath, {
      domain: await domainPromise,
      now: () => new Date(NOW),
    }),
    /备份.*不一致/,
  );
  assert.deepEqual(fs.readFileSync(filePath), changedOriginal);
});

test('corrupt raw JSON blocks migration startup without creating a backup', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-migration-'));
  const filePath = path.join(dir, 'app-data.json');
  const original = Buffer.from('{ definitely-not-json', 'utf8');
  fs.writeFileSync(filePath, original);

  await assert.rejects(
    migrateDataFile(filePath, {
      domain: await domainPromise,
      now: () => new Date(NOW),
    }),
    /数据文件损坏/,
  );
  assert.deepEqual(fs.readFileSync(filePath), original);
  assert.equal(fs.existsSync(migrationBackupPath(filePath)), false);
});
