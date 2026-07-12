import { describe, expect, it } from 'vitest';
import {
  BASE_RULE_CONTEXT,
  DEFAULT_RULE_CONTEXT,
  EFFECTS_SOURCE_EVIDENCE_CAPSULES,
  LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
  GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
  GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES,
  REGISTERED_RULE_SOURCES,
  RELATION_CORE_V1_ARTIFACT_HASH,
  RELATION_SOURCE_EVIDENCE_CAPSULES,
  RULE_SOURCE_EVIDENCE_CAPSULES,
  USE_GOD_CORE_V1_ARTIFACT_HASH,
  USE_GOD_SOURCE_EVIDENCE_CAPSULES,
} from './index';

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
      relationProfile: {
        id: 'yehe_core_v1',
        bundle: {
          id: 'relation_core_v1',
          version: '1.0.0',
          artifactHash: RELATION_CORE_V1_ARTIFACT_HASH,
        },
        harmPolicy: 'liuren-six-harms-v1',
        breakPolicy: 'cross-source-common-four-breaks-v1',
        punishmentPolicy: 'liuren-directional-core-v1',
      },
      effectsProfile: {
        id: 'yehe_effects_v1',
        bundle: {
          id: 'liuyao_effects_v1',
          version: '1.0.0',
          artifactHash: LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
        },
        monthStrengthPolicy: 'yehe-month-status-v1',
        dayClashPolicy: 'yehe-static-strength-aware-v1',
        advanceRetreatPolicy: 'yehe-seven-pair-v1',
        transitionGrowthPolicy: 'five-element-forward-earth-follows-water-v1',
        threeHarmonyPolicy: 'yehe-restricted-members-day-and-transition-tomb-v1',
        fanFuPolicy: 'yehe-corresponding-branches-v1',
      },
      growthProfile: {
        bundle: {
          id: 'growth_shensha_core_v1',
          version: '1.0.0',
          artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
        },
        display: 'all-twelve',
        interpretationWeight: 'sheng-wang-mu-jue-only',
      },
      sixSpiritProfile: {
        id: 'yehe-day-stem-six-spirit-v1',
        bundle: {
          id: 'growth_shensha_core_v1',
          version: '1.0.0',
          artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
        },
        source: 'day-stem',
        target: 'base-lines-only',
      },
      shenShaProfile: {
        bundle: {
          id: 'growth_shensha_core_v1',
          version: '1.0.0',
          artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
        },
        enabled: ['tianyi', 'lushen', 'yima', 'tianxi'],
        authority: 'secondary',
      },
      useGodProfile: {
        id: 'explicit_intent_first_v1',
        bundle: {
          id: 'use_god_core_v1',
          version: '1.0.0',
          artifactHash: USE_GOD_CORE_V1_ARTIFACT_HASH,
        },
        candidateTiers: ['base-visible', 'true-changed', 'palace-head-hidden'],
        multipleCandidates: 'retain-all-without-auto-choice',
        hiddenSpiritPolicy: 'yehe-last-resort-disputed-v1',
      },
    });
    expect(Object.isFrozen(BASE_RULE_CONTEXT)).toBe(true);
  });

  it('deep-freezes nested profiles and source arrays', () => {
    expect(Object.isFrozen(BASE_RULE_CONTEXT.calendarProfile)).toBe(true);
    expect(Object.isFrozen(BASE_RULE_CONTEXT.effectsProfile)).toBe(true);
    expect(Object.isFrozen(BASE_RULE_CONTEXT.effectsProfile.bundle)).toBe(true);
    expect(Object.isFrozen(BASE_RULE_CONTEXT.growthProfile.bundle)).toBe(true);
    expect(Object.isFrozen(BASE_RULE_CONTEXT.sixSpiritProfile)).toBe(true);
    expect(Object.isFrozen(BASE_RULE_CONTEXT.sixSpiritProfile.bundle)).toBe(true);
    expect(Object.isFrozen(BASE_RULE_CONTEXT.shenShaProfile)).toBe(true);
    expect(Object.isFrozen(BASE_RULE_CONTEXT.shenShaProfile.enabled)).toBe(true);
    expect(Object.isFrozen(BASE_RULE_CONTEXT.useGodProfile)).toBe(true);
    expect(Object.isFrozen(BASE_RULE_CONTEXT.useGodProfile.bundle)).toBe(true);
    expect(Object.isFrozen(BASE_RULE_CONTEXT.useGodProfile.candidateTiers)).toBe(true);
    expect(Object.isFrozen(BASE_RULE_CONTEXT.sources)).toBe(true);
    expect(BASE_RULE_CONTEXT.sources).toEqual([]);
  });

  it('exports one deeply frozen production context with all registered source refs', () => {
    expect(DEFAULT_RULE_CONTEXT).toMatchObject({
      rulePackId: 'wenwang_najia_v2',
      rulePackVersion: '2.0.0',
    });
    expect(DEFAULT_RULE_CONTEXT.sources).toEqual(REGISTERED_RULE_SOURCES);
    const allSources = [
      ...RULE_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
      ...RELATION_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
      ...GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
      ...EFFECTS_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
      ...USE_GOD_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
    ];
    expect(DEFAULT_RULE_CONTEXT.sources.map(({ id }) => id))
      .toEqual([...new Set(allSources.map(({ id }) => id))]);
    expect(DEFAULT_RULE_CONTEXT.sources).toHaveLength(35);
    expect(Object.isFrozen(DEFAULT_RULE_CONTEXT)).toBe(true);
    expect(Object.isFrozen(DEFAULT_RULE_CONTEXT.sources)).toBe(true);
    expect(DEFAULT_RULE_CONTEXT.sources.every(Object.isFrozen)).toBe(true);
  });
});
