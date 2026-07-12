const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const reportV2 = require('./report-v2.cjs');

const CASE_INPUT = {
  sessionId: 'report-facade',
  plateId: 'plate:report-facade:v2',
  question: '这次考试能否录取？',
  category: 'study',
  explicitIntentId: 'study.exam-rank-or-admission',
  castAt: '2026-07-11T04:00:00.000Z',
  builtAt: '2026-07-12T00:00:00.000Z',
  tossValues: [9, 7, 7, 7, 7, 7],
};

test('report-v2 is an async facade over the generated domain implementation', async () => {
  const domain = await import('../generated/domain/index.js');
  const caseSnapshot = domain.buildDivinationCase({
    ...CASE_INPUT,
    ruleContext: domain.DEFAULT_RULE_CONTEXT,
  }, {
    sha256(value) {
      return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
    },
  });
  const contractPromise = reportV2.createFactContractV2(caseSnapshot);
  assert.equal(typeof contractPromise.then, 'function');
  const contract = await contractPromise;
  const raw = await reportV2.createLocalRawReportV2(contract);
  const validated = await reportV2.validateAnalysisReportV2(
    raw, contract, [], '2026-07-12T08:00:00.000Z',
  );
  const retrieval = await reportV2.createAnalysisRetrievalContextV2(contract.modelContract);
  const followUpRaw = await reportV2.createLocalRawFollowUpV2(contract);
  const followUp = await reportV2.validateFollowUpV2(
    followUpRaw, contract, [], '2026-07-12T08:00:00.000Z',
  );
  const followUpContent = await reportV2.deriveFollowUpContentV2(followUp);
  const followUpSchema = await reportV2.getFollowUpV2Schema();

  assert.equal(validated.validation.status, 'validated');
  assert.equal(validated.caseHash, caseSnapshot.factSetHash);
  assert.ok(retrieval.queryTerms.includes(CASE_INPUT.question));
  assert.equal(followUp.claims.length, 1);
  assert.match(followUpContent, /^### 1\. 行动建议\n/);
  assert.equal(followUpSchema.schema.properties.claims.maxItems, 8);
  assert.equal(Object.hasOwn(followUpSchema.schema.properties, 'content'), false);
  assert.equal(Object.isFrozen(validated), true);
});
