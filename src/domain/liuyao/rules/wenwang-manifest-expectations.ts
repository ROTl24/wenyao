import { deepFreeze } from './tables.js';

export const WENWANG_REVIEW_CHECKED_CLAIMS = deepFreeze([
  'hexagrams:64',
  'najia-lines:384',
  'review-assertions:25',
  'qian-to-gou-full-changed-reinstall',
  'qian-to-kun-dual-relations',
  'hidden-spirit-candidates:56',
] as const);

export const WENWANG_REVIEW_REPORT_PATHS = deepFreeze([
  'docs/domain/reviews/wenwang-najia-v2-review-a.md',
  'docs/domain/reviews/wenwang-najia-v2-review-b.md',
] as const);
