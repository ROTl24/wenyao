import { deepFreeze } from '../rules/tables.js';

export const RELATION_REVIEW_CHECKED_CLAIMS = deepFreeze([
  'artifact-hash-and-dependency',
  'element-five-by-five-matrix',
  'six-combines-and-six-clashes',
  'six-harms-profile',
  'break-profiles-and-default-intersection',
  'directional-punishments',
  'source-evidence-capsules',
] as const);

export const RELATION_REVIEW_REPORT_PATHS = deepFreeze([
  'docs/domain/reviews/relation-core-v1-review-a.md',
  'docs/domain/reviews/relation-core-v1-review-b.md',
] as const);
