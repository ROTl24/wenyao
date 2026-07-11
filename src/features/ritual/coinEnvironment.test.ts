import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { restoreOwnedCoinEnvironment } from './coinEnvironment';

describe('离线 PMREM 环境所有权', () => {
  it('仍持有本 PMREM 时同时恢复旧 environment 与 intensity', () => {
    const scene = new THREE.Scene();
    const previous = new THREE.Texture();
    const owned = new THREE.Texture();
    scene.environment = owned;
    scene.environmentIntensity = 0.78;

    expect(restoreOwnedCoinEnvironment(scene, owned, previous, 0.42)).toBe(true);
    expect(scene.environment).toBe(previous);
    expect(scene.environmentIntensity).toBe(0.42);

    previous.dispose();
    owned.dispose();
  });

  it('新环境已接管时不覆盖它的 environment 或 intensity', () => {
    const scene = new THREE.Scene();
    const previous = new THREE.Texture();
    const owned = new THREE.Texture();
    const replacement = new THREE.Texture();
    scene.environment = replacement;
    scene.environmentIntensity = 1.31;

    expect(restoreOwnedCoinEnvironment(scene, owned, previous, 0.42)).toBe(false);
    expect(scene.environment).toBe(replacement);
    expect(scene.environmentIntensity).toBe(1.31);

    previous.dispose();
    owned.dispose();
    replacement.dispose();
  });
});
