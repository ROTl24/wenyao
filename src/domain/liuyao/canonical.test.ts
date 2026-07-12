import { describe, expect, it } from 'vitest';
import {
  hashCanonicalPayload,
  strictCanonicalStringify,
  type HashPort,
} from './canonical.js';

describe('strictCanonicalStringify', () => {
  it('serializes the JSON data model with recursively sorted object keys', () => {
    const first = {
      z: [true, null, { beta: 2, alpha: 'one' }],
      a: -0,
    };
    const second = {
      a: 0,
      z: [true, null, { alpha: 'one', beta: 2 }],
    };

    expect(strictCanonicalStringify(first)).toBe(
      '{"a":0,"z":[true,null,{"alpha":"one","beta":2}]}',
    );
    expect(strictCanonicalStringify(second)).toBe(strictCanonicalStringify(first));
  });

  it('accepts null-prototype records and dense arrays', () => {
    const record = Object.create(null) as Record<string, unknown>;
    record.answer = 42;
    record.items = ['甲', false];

    expect(strictCanonicalStringify(record)).toBe(
      '{"answer":42,"items":["甲",false]}',
    );
  });

  it.each([
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['negative Infinity', Number.NEGATIVE_INFINITY],
    ['function', () => undefined],
    ['symbol', Symbol('unsupported')],
    ['bigint', 1n],
  ])('rejects unsupported scalar %s at any depth', (_label, value) => {
    expect(() => strictCanonicalStringify(value)).toThrow(TypeError);
    expect(() => strictCanonicalStringify({ value })).toThrow(TypeError);
    expect(() => strictCanonicalStringify([value])).toThrow(TypeError);
  });

  it.each([
    ['Date', new Date('2026-07-12T00:00:00.000Z')],
    ['Map', new Map([['answer', 42]])],
    ['Set', new Set([42])],
    ['RegExp', /liuyao/u],
    ['typed array', new Uint8Array([1, 2])],
    ['boxed primitive', new Number(42)],
    ['custom prototype', Object.create({ inherited: true })],
  ])('rejects non-plain object %s', (_label, value) => {
    expect(() => strictCanonicalStringify(value)).toThrow(TypeError);
  });

  it('rejects class instances and array subclasses', () => {
    class RecordModel {
      readonly answer = 42;
    }
    class ListModel extends Array<number> {}

    expect(() => strictCanonicalStringify(new RecordModel())).toThrow(TypeError);
    expect(() => strictCanonicalStringify(new ListModel(1, 2))).toThrow(TypeError);
  });

  it('rejects accessors without invoking them', () => {
    let invoked = false;
    const value = Object.defineProperty({}, 'answer', {
      enumerable: true,
      get() {
        invoked = true;
        return 42;
      },
    });

    expect(() => strictCanonicalStringify(value)).toThrow(TypeError);
    expect(invoked).toBe(false);
  });

  it('rejects sparse arrays, custom array properties, and symbol keys', () => {
    const sparse = [1, , 3];
    const extended = [1, 2] as number[] & { note?: string };
    extended.note = 'not JSON array data';
    const symbolRecord = { answer: 42 } as Record<PropertyKey, unknown>;
    symbolRecord[Symbol('hidden')] = true;
    const hiddenIndex = [1];
    Object.defineProperty(hiddenIndex, '0', { value: 1, enumerable: false });

    expect(() => strictCanonicalStringify(sparse)).toThrow(TypeError);
    expect(() => strictCanonicalStringify(extended)).toThrow(TypeError);
    expect(() => strictCanonicalStringify(symbolRecord)).toThrow(TypeError);
    expect(() => strictCanonicalStringify(hiddenIndex)).toThrow(TypeError);
  });

  it('rejects cyclic references but permits repeated acyclic references', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    const shared = { answer: 42 };

    expect(() => strictCanonicalStringify(cyclic)).toThrow(TypeError);
    expect(strictCanonicalStringify([shared, shared])).toBe(
      '[{"answer":42},{"answer":42}]',
    );
  });
});

describe('hashCanonicalPayload', () => {
  it('passes the strict canonical representation to a synchronous SHA-256 port', () => {
    const received: string[] = [];
    const expectedHash = 'a'.repeat(64);
    const hashPort: HashPort = {
      sha256(value) {
        received.push(value);
        return expectedHash;
      },
    };

    expect(hashCanonicalPayload({ b: 2, a: 1 }, hashPort)).toBe(expectedHash);
    expect(received).toEqual(['{"a":1,"b":2}']);
  });

  it('rejects a digest that is not a lowercase 64-character SHA-256 hex string', () => {
    expect(() => hashCanonicalPayload(null, { sha256: () => 'ABC' })).toThrow(TypeError);
    const coercibleDigest = {
      toString: () => 'a'.repeat(64),
    } as unknown as string;
    expect(() => hashCanonicalPayload(null, { sha256: () => coercibleDigest }))
      .toThrow(TypeError);
  });
});
