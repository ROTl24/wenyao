import { describe, expect, it } from 'vitest';
import { BASE_RULE_CONTEXT, DEFAULT_RULE_CONTEXT, RULE_SOURCE_EVIDENCE_CAPSULES } from './index';

describe('V2 domain contract', () => {
  it('locks every interpretation choice into a versioned context', () => {
    expect(BASE_RULE_CONTEXT).toMatchObject({
      schemaVersion: '2.0.0',
      rulePackId: 'wenwang_najia_v2',
      calendarProfile: {
        id: 'beijing_jieqi_zichu_v2',
        timezone: 'Asia/Shanghai',
        dayBoundary: 'zi-hour-23',
      },
      growthProfile: {
        display: 'all-twelve',
        interpretationWeight: 'sheng-wang-mu-jue-only',
      },
      shenShaProfile: {
        enabled: ['tianyi', 'lushen', 'yima', 'tianxi'],
        authority: 'secondary',
      },
    });
    expect(Object.isFrozen(BASE_RULE_CONTEXT)).toBe(true);
  });

  it('deep-freezes nested profiles and source arrays', () => {
    expect(Object.isFrozen(BASE_RULE_CONTEXT.calendarProfile)).toBe(true);
    expect(Object.isFrozen(BASE_RULE_CONTEXT.shenShaProfile)).toBe(true);
    expect(Object.isFrozen(BASE_RULE_CONTEXT.shenShaProfile.enabled)).toBe(true);
    expect(Object.isFrozen(BASE_RULE_CONTEXT.sources)).toBe(true);
    expect(BASE_RULE_CONTEXT.sources).toEqual([]);
  });

  it('exports one deeply frozen production context with all registered source refs', () => {
    expect(DEFAULT_RULE_CONTEXT).toMatchObject({
      rulePackId: 'wenwang_najia_v2',
      rulePackVersion: '2.0.0',
    });
    expect(DEFAULT_RULE_CONTEXT.sources).toEqual(
      RULE_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
    );
    expect(DEFAULT_RULE_CONTEXT.sources).toHaveLength(7);
    expect(Object.isFrozen(DEFAULT_RULE_CONTEXT)).toBe(true);
    expect(Object.isFrozen(DEFAULT_RULE_CONTEXT.sources)).toBe(true);
    expect(DEFAULT_RULE_CONTEXT.sources.every(Object.isFrozen)).toBe(true);
  });
});
