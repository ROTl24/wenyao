import { describe, expect, it } from 'vitest';
import type { CanonicalEvidenceV2 } from '../domain/liuyao/analysis-report';
import { RULE_MATCH_BOOST, searchEvidenceCandidates } from './retrieval';

const entries: CanonicalEvidenceV2[] = [
  {
    id: 'E1',
    title: '用神规则',
    source: '测试古籍',
    location: '卷一',
    text: '占问事业，以官鬼爻为用神，兼看世爻旺衰。',
    tags: ['事业', '官鬼', '世爻'],
    sourceType: 'original',
    contentHash: '1'.repeat(64),
    knowledgeKind: 'rule',
    topics: ['事业'],
    supportsRuleIds: ['rule:career'],
  },
  {
    id: 'E2',
    title: '财爻规则',
    source: '测试古籍',
    location: '卷二',
    text: '占问求财，以妻财爻为用神。',
    tags: ['财运', '妻财'],
    sourceType: 'original',
    contentHash: '2'.repeat(64),
    knowledgeKind: 'rule',
    topics: ['财运'],
    supportsRuleIds: ['rule:wealth'],
  },
  {
    id: 'E3', title: '杂论', source: '另一古籍', location: '卷三',
    text: '此处只讨论杂项。', tags: [], sourceType: 'original',
    contentHash: '3'.repeat(64), knowledgeKind: 'doctrine', topics: [], supportsRuleIds: [],
  },
];

describe('浏览器候选 ID 检索', () => {
  it('只返回 candidate refs 与完整 V2 diagnostics，不泄露可信正文', () => {
    const result = searchEvidenceCandidates({
      entries,
      query: '事业发展', domainTerms: ['官鬼'],
      ruleIds: ['rule:career', 'rule:missing'],
      limit: 2,
    });
    expect(result.candidateRefs[0]).toEqual({ id: 'E1', rank: 1 });
    expect(result.candidateRefs.every((candidate) => Object.keys(candidate).sort().join(',') === 'id,rank')).toBe(true);
    expect(result.diagnostics).toEqual({
      mode: 'lexical-fallback',
      lexicalCandidates: 1,
      vectorCandidates: 0,
      fusedCandidates: 1,
      vectorUsed: false,
      rerankUsed: false,
      requestedRuleIds: ['rule:career', 'rule:missing'],
      matchedRuleIds: ['rule:career'],
      ruleCandidateIds: ['E1'],
      ruleBoost: RULE_MATCH_BOOST,
      warnings: ['浏览器预览仅使用 canonical catalog 关键词召回。'],
    });
  });

  it('精确规则证据即使没有词法命中也会预留且稳定去重', () => {
    const result = searchEvidenceCandidates({
      entries,
      query: '完全无关的天气问题', domainTerms: [],
      ruleIds: ['rule:wealth', 'rule:career', 'rule:wealth'],
      limit: 2,
    });
    expect(result.candidateRefs.map(({ id }) => id)).toEqual(['E1', 'E2']);
    expect(result.diagnostics.requestedRuleIds).toEqual(['rule:career', 'rule:wealth']);
    expect(result.diagnostics.matchedRuleIds).toEqual(['rule:career', 'rule:wealth']);
    expect(result.diagnostics.ruleCandidateIds).toEqual(['E1', 'E2']);
  });

  it('没有词法或规则命中时不伪造候选', () => {
    expect(searchEvidenceCandidates({
      entries, query: '完全无关的天气问题', domainTerms: [], ruleIds: [], limit: 8,
    }).candidateRefs).toEqual([]);
  });
});
