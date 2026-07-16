import { describe, expect, it } from 'vitest';
import { createLaunchPlan } from './CoinScene';

describe('铜钱物理抛掷参数', () => {
  it('derives a stable but distinct launch for every coin from the visual seed', () => {
    const first = createLaunchPlan('saved-ritual-seed');
    const replay = createLaunchPlan('saved-ritual-seed');
    const another = createLaunchPlan('another-ritual-seed');

    expect(replay).toEqual(first);
    expect(another).not.toEqual(first);
    expect(first).toHaveLength(3);
    expect(new Set(first.map((launch) => launch.linearVelocity.join(','))).size).toBe(3);
    expect(new Set(first.map((launch) => launch.angularVelocity.join(','))).size).toBe(3);
  });
});
