import type { AIConfigStatus } from '../types/desktop';

export function isAIUsable(status: AIConfigStatus) {
  return Boolean(status.activeCapabilities?.generation);
}
