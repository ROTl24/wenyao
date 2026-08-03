import type { AIConfigStatus } from '../types/desktop';

export function isAIUsable(status: AIConfigStatus) {
  return status.status === 'ready' || Boolean(status.activeCapabilities && status.activeFingerprint);
}
