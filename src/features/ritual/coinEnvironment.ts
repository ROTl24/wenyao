import type * as THREE from 'three';

export function restoreOwnedCoinEnvironment(
  scene: THREE.Scene,
  ownedEnvironment: THREE.Texture,
  previousEnvironment: THREE.Texture | null,
  previousIntensity: number,
): boolean {
  const stillOwned = scene.environment === ownedEnvironment;
  if (!stillOwned) return false;
  scene.environment = previousEnvironment;
  scene.environmentIntensity = previousIntensity;
  return true;
}
