import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  buildKnowledgeIndex,
  collectReviewedRuleEvidence,
  serializeKnowledgeIndex,
} from './build-knowledge.mjs';

const textHash = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

function corpusFixture() {
  return [
    { id: 'E1', title: '甲', source: '书甲', location: '一', text: '正文甲', tags: ['rule:fake', '事业'], sourceType: 'original' },
    { id: 'E2', title: '乙', source: '书乙', location: '二', text: '正文乙', tags: ['用神'], sourceType: 'original' },
  ];
}

function manifestFixture() {
  return {
    schemaVersion: 1,
    corpusVersion: 'fixture-v1',
    sourceType: 'user-provided-plain-text',
    bookCount: 2,
    entryCount: 2,
    sources: [
      { id: 'BOOK-A', title: '书甲', filename: 'a.txt', sha256: '1'.repeat(64), encoding: 'utf8', bytes: 1, rawLineCount: 1, acceptedLineCount: 1, entryCount: 1 },
      { id: 'BOOK-B', title: '书乙', filename: 'b.txt', sha256: '2'.repeat(64), encoding: 'utf8', bytes: 1, rawLineCount: 1, acceptedLineCount: 1, entryCount: 1 },
    ],
  };
}

function reviewedFixture(overrides = {}) {
  const corpus = corpusFixture();
  return {
    artifacts: [{ rules: [{ ruleId: 'rule:a', sourceRefs: ['SOURCE-A'] }] }],
    capsules: [{
      ref: { id: 'SOURCE-A' },
      payload: `sourceId=SOURCE-A\nlocalEntries=E1:${textHash(corpus[0].text)}`,
    }],
    ...overrides,
  };
}

test('supportsRuleIds come only from exact reviewed localEntries, never tags or topics', () => {
  const corpus = corpusFixture();
  const reviewed = collectReviewedRuleEvidence(reviewedFixture());
  const index = buildKnowledgeIndex({ corpus, corpusManifest: manifestFixture(), reviewed });

  assert.deepEqual(index.units.find(({ id }) => id === 'E1').supportsRuleIds, ['rule:a']);
  assert.deepEqual(index.units.find(({ id }) => id === 'E2').supportsRuleIds, []);
  assert.equal(index.units.find(({ id }) => id === 'E1').topics.includes('rule:fake'), false);
});

test('unknown evidence ids and stale text hashes fail closed', () => {
  const corpus = corpusFixture();
  const unknown = collectReviewedRuleEvidence(reviewedFixture({
    capsules: [{ ref: { id: 'SOURCE-A' }, payload: `sourceId=SOURCE-A\nlocalEntries=UNKNOWN:${'a'.repeat(64)}` }],
  }));
  assert.throws(
    () => buildKnowledgeIndex({ corpus, corpusManifest: manifestFixture(), reviewed: unknown }),
    /未知语料|UNKNOWN/,
  );

  const stale = collectReviewedRuleEvidence(reviewedFixture({
    capsules: [{ ref: { id: 'SOURCE-A' }, payload: `sourceId=SOURCE-A\nlocalEntries=E1:${'b'.repeat(64)}` }],
  }));
  assert.throws(
    () => buildKnowledgeIndex({ corpus, corpusManifest: manifestFixture(), reviewed: stale }),
    /陈旧|哈希/,
  );
});

test('unknown source refs, duplicate rules and duplicate rule-evidence mappings fail closed', () => {
  assert.throws(
    () => collectReviewedRuleEvidence(reviewedFixture({ capsules: [] })),
    /来源.*缺失|SOURCE-A/,
  );
  assert.throws(
    () => collectReviewedRuleEvidence(reviewedFixture({
      artifacts: [{ rules: [
        { ruleId: 'rule:a', sourceRefs: ['SOURCE-A'] },
        { ruleId: 'rule:a', sourceRefs: ['SOURCE-A'] },
      ] }],
    })),
    /重复规则/,
  );
  const corpus = corpusFixture();
  assert.throws(
    () => collectReviewedRuleEvidence(reviewedFixture({
      capsules: [{
        ref: { id: 'SOURCE-A' },
        payload: `sourceId=SOURCE-A\nlocalEntries=E1:${textHash(corpus[0].text)},E1:${textHash(corpus[0].text)}`,
      }],
    })),
    /重复.*映射/,
  );
});

test('knowledge output is byte deterministic under reordered artifact and capsule inputs', () => {
  const corpus = corpusFixture();
  const hash1 = textHash(corpus[0].text);
  const hash2 = textHash(corpus[1].text);
  const one = collectReviewedRuleEvidence({
    artifacts: [{ rules: [
      { ruleId: 'rule:b', sourceRefs: ['SOURCE-B'] },
      { ruleId: 'rule:a', sourceRefs: ['SOURCE-A'] },
    ] }],
    capsules: [
      { ref: { id: 'SOURCE-B' }, payload: `sourceId=SOURCE-B\nlocalEntries=E2:${hash2}` },
      { ref: { id: 'SOURCE-A' }, payload: `sourceId=SOURCE-A\nlocalEntries=E1:${hash1}` },
    ],
  });
  const two = collectReviewedRuleEvidence({
    artifacts: [{ rules: [
      { ruleId: 'rule:a', sourceRefs: ['SOURCE-A'] },
      { ruleId: 'rule:b', sourceRefs: ['SOURCE-B'] },
    ] }],
    capsules: [
      { ref: { id: 'SOURCE-A' }, payload: `sourceId=SOURCE-A\nlocalEntries=E1:${hash1}` },
      { ref: { id: 'SOURCE-B' }, payload: `sourceId=SOURCE-B\nlocalEntries=E2:${hash2}` },
    ],
  });
  const first = buildKnowledgeIndex({ corpus, corpusManifest: manifestFixture(), reviewed: one });
  const second = buildKnowledgeIndex({ corpus: [...corpus].reverse(), corpusManifest: manifestFixture(), reviewed: two });

  assert.equal(serializeKnowledgeIndex(first), serializeKnowledgeIndex(second));
});
