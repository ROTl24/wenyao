import { deepFreeze } from '../rules/tables.js';

export const GROWTH_SHENSHA_REVIEW_CHECKED_CLAIMS = deepFreeze([
  'artifact-hash-and-wenwang-dependency',
  'five-by-twelve-growth-matrix-and-earth-dispute',
  'ten-by-six-six-spirit-matrix-and-aliases',
  'four-shen-sha-default-tables-and-disabled-variants',
  'fact-count-scope-authority-and-certainty',
  'local-corpus-and-fixed-oldid-bindings',
  'profile-source-and-production-gates',
] as const);

export const GROWTH_SHENSHA_REVIEW_REPORT_PATHS = deepFreeze([
  'docs/domain/reviews/growth-shensha-core-v1-review-a.md',
  'docs/domain/reviews/growth-shensha-core-v1-review-b.md',
] as const);
