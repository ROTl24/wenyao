import { describe, expect, it } from 'vitest';
import styles from '../styles.css?raw';

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(styles)?.[1] ?? '';
}

describe('RitualScreen 固定几何与唯一动画时钟', () => {
  it('水平居中只属于固定按钮槽，内部按钮保持 relative 且只做纵向 transform', () => {
    expect(rule('.ritual-confirm-slot')).toMatch(/transform:\s*translateX\(-50%\)/);
    expect(rule('.ritual-confirm')).toMatch(/position:\s*relative/);
    expect(rule('.ritual-confirm')).not.toMatch(/left:|bottom:|translateX/);
    expect(rule('.ritual-confirm:hover:not(:disabled)')).toMatch(/translateY\(-1px\)/);
  });

  it('手掌根、两层媒体和墨幕均绝对铺满，且不保留旧伪元素或 CSS transition', () => {
    expect(rule('.ink-hands-runtime')).toMatch(/position:\s*absolute/);
    expect(rule('.ink-hands-runtime > img, .ink-hands-runtime > video')).toMatch(/object-fit:\s*cover/);
    expect(rule('.ink-hands-runtime__cover')).toMatch(/position:\s*absolute/);
    expect(styles).not.toMatch(/\.ink-hands(?:\s*\{|::|--)/);
    expect(rule('.ink-hands-runtime')).not.toMatch(/transition:/);
    expect(rule('.ink-hands-runtime > img, .ink-hands-runtime > video')).not.toMatch(/transition:/);
  });
});
