import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildDivinationCase } from '../domain/liuyao/case';
import { DEFAULT_RULE_CONTEXT } from '../domain/liuyao/rules/default-context';
import { legacyPlateFromCase } from './casePresentation';

describe('Case compatibility presentation', () => {
  it('projects calendar facts onto the exact base or changed line side', () => {
    const caseSnapshot = buildDivinationCase({
      sessionId: 'side-aware-case',
      plateId: 'plate:side-aware-case:v2',
      question: '变爻月破投影',
      category: 'career',
      explicitIntentId: null,
      castAt: '2026-07-08T00:00:00.000Z',
      builtAt: '2026-07-12T00:00:00.000Z',
      tossValues: [6, 9, 7, 8, 7, 8],
      ruleContext: DEFAULT_RULE_CONTEXT,
    }, {
      sha256: (value) => createHash('sha256').update(value).digest('hex'),
    });

    const second = legacyPlateFromCase(caseSnapshot).lines[1];
    expect(second.monthBreak).toBe(false);
    expect(second.changedMonthBreak).toBe(true);
  });

  it('keeps raw day clash visible when the domain classifies it as dark-moving', () => {
    const caseSnapshot = buildDivinationCase({
      sessionId: 'raw-day-clash',
      plateId: 'plate:raw-day-clash:v2',
      question: '日冲投影',
      category: 'career',
      explicitIntentId: null,
      castAt: '2026-07-01T00:00:00.000Z',
      builtAt: '2026-07-12T00:00:00.000Z',
      tossValues: [7, 7, 7, 7, 7, 7],
      ruleContext: DEFAULT_RULE_CONTEXT,
    }, {
      sha256: (value) => createHash('sha256').update(value).digest('hex'),
    });
    expect(caseSnapshot.facts.some((fact) => (
      fact.relation === 'is-dark-moving' && fact.target?.id === 'line:4'
    ))).toBe(true);
    expect(caseSnapshot.facts.some((fact) => (
      fact.relation === 'is-day-break' && fact.target?.id === 'line:4'
    ))).toBe(false);

    expect(legacyPlateFromCase(caseSnapshot).lines[3].dayClash).toBe(true);
  });
});
