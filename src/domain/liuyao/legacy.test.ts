import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createToss,
  type CoinFace,
  type LineValue,
} from '../../lib/divination.js';
import { buildDivinationCase } from './case.js';
import {
  migrateLegacySession,
  type LegacyMigrationInput,
} from './legacy.js';
import { DEFAULT_RULE_CONTEXT } from './rules/default-context.js';

const HASH_PORT = {
  sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  },
};

const MIGRATION_INPUT = {
  plateId: 'migrated-plate',
  builtAt: '2026-07-12T00:00:00.000Z',
  ruleContext: DEFAULT_RULE_CONTEXT,
  explicitIntentId: null,
} as const satisfies LegacyMigrationInput;

const TOSSES = [9, 7, 7, 7, 7, 7] as const;

const FACES_BY_VALUE: Readonly<Record<LineValue, readonly CoinFace[]>> = {
  6: ['text', 'text', 'text'],
  7: ['text', 'text', 'reverse'],
  8: ['text', 'reverse', 'reverse'],
  9: ['reverse', 'reverse', 'reverse'],
};

function tossPayload(value: LineValue) {
  return createToss(FACES_BY_VALUE[value]);
}

function legacySessionFixture(overrides: Record<string, unknown> = {}) {
  const authoritative = buildDivinationCase({
    sessionId: 'legacy-session',
    plateId: MIGRATION_INPUT.plateId,
    question: '这次考试能否录取？',
    category: 'study',
    explicitIntentId: null,
    castAt: '2026-07-11T04:00:00.000Z',
    builtAt: MIGRATION_INPUT.builtAt,
    tossValues: TOSSES,
    ruleContext: DEFAULT_RULE_CONTEXT,
  }, HASH_PORT);
  return {
    id: 'legacy-session',
    question: '这次考试能否录取？',
    category: 'study',
    castAt: '2026-07-11T04:00:00.000Z',
    updatedAt: '2026-07-11T04:05:00.000Z',
    status: 'complete',
    tosses: TOSSES.map((value, index) => ({
      ...tossPayload(value),
      id: `toss-${index + 1}`,
      lineIndex: index + 1,
      visualSeed: `seed-${index + 1}`,
      confirmedAt: `2026-07-11T04:0${index}:00.000Z`,
    })),
    plate: {
      id: 'legacy-plate',
      castAt: '2026-07-11T04:00:00.000Z',
      baseHexagram: { name: authoritative.plate.baseHexagram.name },
      changedHexagram: { name: authoritative.plate.changedHexagram.name },
      movingLines: [...authoritative.plate.movingLines],
      lines: TOSSES.map((value) => ({ value })),
    },
    analysis: {
      mode: 'cloud',
      summary: '旧解读',
      focus: '旧用神',
      relations: '旧关系',
      moving: '旧动爻',
      synthesis: '旧结论',
      uncertainties: [],
      guidance: ['旧建议'],
      claims: [],
      generatedAt: '2026-07-11T04:06:00.000Z',
      validation: { status: 'validated', forged: true },
    },
    messages: [],
    ...overrides,
  };
}

describe('legacy session pure migration', () => {
  it('rebuilds a matching completed session only from its six confirmed tosses', () => {
    const legacy = legacySessionFixture();
    const result = migrateLegacySession(legacy, MIGRATION_INPUT, HASH_PORT);

    expect(result.state).toBe('migrated');
    if (result.state !== 'migrated') return;
    expect(result.session.caseSnapshot?.plate.baseHexagram.name).toBe(
      legacy.plate.baseHexagram.name,
    );
    expect(result.session.caseSnapshot?.plate.rawTosses).toEqual(TOSSES);
    expect(result.session.ruleContext).toEqual(result.session.caseSnapshot?.ruleContext);
    expect(result.session.ruleContext.sources.map(({ id }) => id)).toEqual(
      [...result.session.ruleContext.sources.map(({ id }) => id)].sort(),
    );
    expect(result.session.migrationVersion).toBe(2);
    expect(result.session.migrationState).toBe('clean');
    expect(result.session.analysis?.validation).toEqual({ status: 'legacy-unverified' });
    expect(result.audit.legacyDifferences).toEqual([]);
    expect(Object.isFrozen(result.session)).toBe(true);
    expect(legacy).not.toHaveProperty('caseSnapshot');
    expect(legacy.analysis.validation).toEqual({ status: 'validated', forged: true });
  });

  it('marks a forged old hexagram as needs-review and preserves the exact original', () => {
    const legacy = legacySessionFixture({
      plate: {
        ...legacySessionFixture().plate,
        baseHexagram: { name: '坤为地' },
      },
    });
    const before = structuredClone(legacy);
    const result = migrateLegacySession(legacy, MIGRATION_INPUT, HASH_PORT);

    expect(result.state).toBe('needs-review');
    if (result.state !== 'needs-review') return;
    expect(result.original).toEqual(before);
    expect(result.audit.legacyDifferences).toContain('baseHexagram.name');
    expect(result).not.toHaveProperty('session');
    expect(legacy).toEqual(before);
  });

  it.each([
    ['changedHexagram.name', (legacy: ReturnType<typeof legacySessionFixture>) => {
      legacy.plate.changedHexagram.name = '坤为地';
    }],
    ['movingLines', (legacy: ReturnType<typeof legacySessionFixture>) => {
      legacy.plate.movingLines = [];
    }],
    ['tosses.values', (legacy: ReturnType<typeof legacySessionFixture>) => {
      (legacy.plate.lines[0] as { value: number }).value = 6;
    }],
    ['castAt', (legacy: ReturnType<typeof legacySessionFixture>) => {
      legacy.plate.castAt = '2026-07-12T04:00:00.000Z';
    }],
  ])('does not overwrite conflicting legacy %s', (difference, mutate) => {
    const legacy = legacySessionFixture();
    mutate(legacy);
    const result = migrateLegacySession(legacy, MIGRATION_INPUT, HASH_PORT);
    expect(result.state).toBe('needs-review');
    expect(result.audit.legacyDifferences).toContain(difference);
  });

  it('preserves an incomplete cast without inventing a V2 plate', () => {
    const complete = legacySessionFixture();
    const legacy = {
      ...complete,
      status: 'casting',
      tosses: complete.tosses.slice(0, 3),
      currentToss: {
        ...tossPayload(8),
        id: 'pending',
        lineIndex: 4,
        visualSeed: 'pending-seed',
      },
    };
    delete (legacy as Partial<typeof legacy>).plate;
    delete (legacy as Partial<typeof legacy>).analysis;
    const result = migrateLegacySession(legacy, MIGRATION_INPUT, HASH_PORT);

    expect(result.state).toBe('migrated');
    if (result.state !== 'migrated') return;
    expect(result.session).not.toHaveProperty('caseSnapshot');
    expect(result.session.tosses).toEqual(legacy.tosses);
    expect(result.session.currentToss).toEqual(legacy.currentToss);
    expect(result.session.migrationVersion).toBe(2);
    expect(result.session.migrationState).toBe('clean');
  });

  it('is idempotent for an already migrated session', () => {
    const first = migrateLegacySession(legacySessionFixture(), MIGRATION_INPUT, HASH_PORT);
    expect(first.state).toBe('migrated');
    if (first.state !== 'migrated') return;

    const second = migrateLegacySession(first.session, MIGRATION_INPUT, HASH_PORT);
    expect(second.state).toBe('unchanged');
    if (second.state !== 'unchanged') return;
    expect(second.session).toEqual(first.session);
  });

  it('never trusts migrationVersion 2 or a persisted case hash without rebuilding', () => {
    const first = migrateLegacySession(legacySessionFixture(), MIGRATION_INPUT, HASH_PORT);
    expect(first.state).toBe('migrated');
    if (first.state !== 'migrated') return;
    const forged = structuredClone(first.session);
    forged.caseSnapshot!.factSetHash = '0'.repeat(64);

    const result = migrateLegacySession(forged, MIGRATION_INPUT, HASH_PORT);
    expect(result.state).toBe('needs-review');
    expect(result.audit.legacyDifferences).toContain('caseSnapshot');
  });

  it('rechecks every legacy plate invariant after a migrationVersion 2 snapshot rebuild', () => {
    const first = migrateLegacySession(legacySessionFixture(), MIGRATION_INPUT, HASH_PORT);
    expect(first.state).toBe('migrated');
    if (first.state !== 'migrated') return;
    const forged = structuredClone(first.session) as unknown as Record<string, unknown> & {
      plate: {
        baseHexagram: { name: string };
        changedHexagram: { name: string };
        movingLines: number[];
        lines: Array<{ value: number }>;
        castAt: string;
      };
    };
    forged.plate.baseHexagram.name = '坤为地';
    forged.plate.changedHexagram.name = '坤为地';
    forged.plate.movingLines = [];
    forged.plate.lines[0].value = 6;
    forged.plate.castAt = '2026-07-12T04:00:00.000Z';
    const before = structuredClone(forged);

    const result = migrateLegacySession(forged, MIGRATION_INPUT, HASH_PORT);

    expect(result.state).toBe('needs-review');
    expect(result.audit.legacyDifferences).toEqual([
      'baseHexagram.name',
      'castAt',
      'changedHexagram.name',
      'movingLines',
      'tosses.values',
    ]);
    if (result.state === 'needs-review') expect(result.original).toEqual(before);
    expect(forged).toEqual(before);
  });

  it('rejects six value-only toss objects without confirmed TossRecord evidence', () => {
    const legacy = legacySessionFixture({
      tosses: TOSSES.map((value, index) => ({
        lineIndex: index + 1,
        value,
      })),
    });
    const before = structuredClone(legacy);

    const result = migrateLegacySession(legacy, MIGRATION_INPUT, HASH_PORT);

    expect(result.state).toBe('needs-review');
    expect(result.audit.legacyDifferences).toEqual(['tosses.values']);
    if (result.state === 'needs-review') expect(result.original).toEqual(before);
    expect(legacy).toEqual(before);
  });

  it.each([
    ['missing id', (legacy: ReturnType<typeof legacySessionFixture>) => {
      delete (legacy.tosses[0] as Partial<(typeof legacy.tosses)[number]>).id;
    }],
    ['duplicate id', (legacy: ReturnType<typeof legacySessionFixture>) => {
      legacy.tosses[1].id = legacy.tosses[0].id;
    }],
    ['missing confirmedAt', (legacy: ReturnType<typeof legacySessionFixture>) => {
      delete (legacy.tosses[0] as Partial<(typeof legacy.tosses)[number]>).confirmedAt;
    }],
    ['non-canonical confirmedAt', (legacy: ReturnType<typeof legacySessionFixture>) => {
      legacy.tosses[0].confirmedAt = '2026-07-11T12:00:00+08:00';
    }],
    ['missing visualSeed', (legacy: ReturnType<typeof legacySessionFixture>) => {
      delete (legacy.tosses[0] as Partial<(typeof legacy.tosses)[number]>).visualSeed;
    }],
    ['missing faces', (legacy: ReturnType<typeof legacySessionFixture>) => {
      delete (legacy.tosses[0] as Partial<(typeof legacy.tosses)[number]>).faces;
    }],
    ['label/value mismatch', (legacy: ReturnType<typeof legacySessionFixture>) => {
      legacy.tosses[0].label = '少阳';
    }],
  ])('rejects incomplete or inconsistent confirmed TossRecord data: %s', (_label, mutate) => {
    const legacy = legacySessionFixture();
    mutate(legacy);
    const before = structuredClone(legacy);

    const result = migrateLegacySession(legacy, MIGRATION_INPUT, HASH_PORT);

    expect(result.state).toBe('needs-review');
    expect(result.audit.legacyDifferences).toEqual(['tosses.values']);
    if (result.state === 'needs-review') expect(result.original).toEqual(before);
    expect(legacy).toEqual(before);
  });

  it('rejects an inconsistent prepared currentToss without requiring confirmedAt', () => {
    const complete = legacySessionFixture();
    const legacy = {
      ...complete,
      status: 'casting',
      tosses: complete.tosses.slice(0, 3),
      currentToss: {
        ...tossPayload(8),
        id: 'pending',
        lineIndex: 4,
        visualSeed: 'pending-seed',
        label: '少阳',
      },
    };
    delete (legacy as Partial<typeof legacy>).plate;
    delete (legacy as Partial<typeof legacy>).analysis;
    const before = structuredClone(legacy);

    const result = migrateLegacySession(legacy, MIGRATION_INPUT, HASH_PORT);

    expect(result.state).toBe('needs-review');
    expect(result.audit.legacyDifferences).toEqual(['tosses.values']);
    if (result.state === 'needs-review') expect(result.original).toEqual(before);
    expect(legacy).toEqual(before);
  });

  it.each(['clean', 'needs-review'] as const)(
    'does not overwrite a pre-existing legacy migrationState=%s',
    (migrationState) => {
      const legacy = legacySessionFixture({ migrationState });
      const before = structuredClone(legacy);

      const result = migrateLegacySession(legacy, MIGRATION_INPUT, HASH_PORT);

      expect(result.state).toBe('needs-review');
      expect(result.audit.legacyDifferences).toEqual(['migrationState']);
      if (result.state === 'needs-review') expect(result.original).toEqual(before);
      expect(legacy).toEqual(before);
    },
  );

  it.each([
    ['duplicate line index', (legacy: ReturnType<typeof legacySessionFixture>) => {
      legacy.tosses[1].lineIndex = 1;
    }],
    ['faces/value mismatch', (legacy: ReturnType<typeof legacySessionFixture>) => {
      (legacy.tosses[0] as Record<string, unknown>).faces = ['text', 'text', 'text'];
    }],
    ['derived toss mismatch', (legacy: ReturnType<typeof legacySessionFixture>) => {
      (legacy.tosses[0] as Record<string, unknown>).moving = false;
    }],
  ])('rejects inconsistent confirmed toss data: %s', (_label, mutate) => {
    const legacy = legacySessionFixture();
    mutate(legacy);
    const result = migrateLegacySession(legacy, MIGRATION_INPUT, HASH_PORT);
    expect(result.state).toBe('needs-review');
    expect(result.audit.legacyDifferences).toContain('tosses.values');
  });

  it.each([
    null,
    {},
    { ...legacySessionFixture(), id: '' },
    { ...legacySessionFixture(), status: 'complete', tosses: legacySessionFixture().tosses.slice(0, 5) },
    { ...legacySessionFixture(), caseSnapshot: { factSetHash: 'forged' } },
  ])('returns needs-review for irreconcilable legacy input %#', (legacy) => {
    const result = migrateLegacySession(legacy, MIGRATION_INPUT, HASH_PORT);
    expect(result.state).toBe('needs-review');
  });

  it('does not invoke or freeze an unsupported caller-owned accessor object', () => {
    const legacy = legacySessionFixture() as Record<string, unknown>;
    let invoked = false;
    Object.defineProperty(legacy, 'question', {
      enumerable: true,
      get() {
        invoked = true;
        return '不得执行';
      },
    });

    const result = migrateLegacySession(legacy, MIGRATION_INPUT, HASH_PORT);
    expect(result.state).toBe('needs-review');
    expect(invoked).toBe(false);
    expect(Object.isFrozen(legacy)).toBe(false);
    if (result.state === 'needs-review') expect(result.original).toBe(legacy);
  });
});
