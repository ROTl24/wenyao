import { deepFreeze } from '../rules/tables.js';

export const EFFECTS_REVIEW_CHECKED_CLAIMS = deepFreeze([
  'artifact-hash-and-three-dependencies',
  'month-status-break-void-and-day-clash-policy',
  'changed-to-base-return-relations-and-basis-facts',
  'advance-retreat-and-growth-delegation',
  'restricted-three-harmony-and-blockers',
  'hexagram-harmony-clash-and-fan-fu-oracles',
  'local-corpus-and-fixed-oldid-bindings',
  'profile-source-and-production-gates',
] as const);

export const EFFECTS_REVIEW_REPORT_PATHS = deepFreeze([
  'docs/domain/reviews/liuyao-effects-v1-review-a.md',
  'docs/domain/reviews/liuyao-effects-v1-review-b.md',
] as const);
