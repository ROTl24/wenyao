interface ReviewedArtifactManifestExpectation {
  readonly id: {
    readonly field: 'rulePackId' | 'bundleId';
    readonly value: string;
  };
  readonly version: string;
  readonly artifactHash: string;
  readonly sourceRefs: readonly string[];
  readonly checkedClaims: readonly string[];
  readonly reportPaths: readonly string[];
  readonly errorMessage: string;
}

const ZONED_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isDenseArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
    && Array.from({ length: value.length }, (_, index) => index in value).every(Boolean);
}

function isCanonicalNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function isZonedIso(value: unknown): value is string {
  return isCanonicalNonEmpty(value)
    && ZONED_ISO_PATTERN.test(value)
    && Number.isFinite(Date.parse(value));
}

function hasExactStringSet(actual: unknown, expected: readonly string[]): boolean {
  if (!isDenseArray(actual) || actual.length !== expected.length) return false;
  if (actual.some((value) => !isCanonicalNonEmpty(value))) return false;
  const actualSet = new Set(actual as string[]);
  const expectedSet = new Set(expected);
  return actualSet.size === actual.length
    && expectedSet.size === expected.length
    && [...expectedSet].every((value) => actualSet.has(value));
}

export function assertReviewedArtifactManifest(
  manifest: unknown,
  expected: ReviewedArtifactManifestExpectation,
): void {
  const reject = (): never => { throw new Error(expected.errorMessage); };
  try {
    if (!isPlainObject(manifest)) reject();
    const candidate = manifest as Record<string, unknown>;
    const verificationLevel = candidate.verificationLevel;
    const reviews = candidate.reviews;
    if (
      candidate[expected.id.field] !== expected.id.value
      || candidate.version !== expected.version
      || candidate.artifactHash !== expected.artifactHash
      || candidate.runtimeStatus !== 'project-enabled'
      || (verificationLevel !== 'independent-automated' && verificationLevel !== 'human-reviewed')
      || !hasExactStringSet(candidate.sourceRefs, expected.sourceRefs)
      || !isDenseArray(reviews)
      || reviews.length !== expected.reportPaths.length
    ) reject();
    const reviewRecords = reviews as unknown[];

    const reviewerIds = new Set<string>();
    const runIds = new Set<string>();
    const actualReportPaths = new Set<string>();
    const requiredReviewerKind = verificationLevel === 'human-reviewed' ? 'human' : 'automated-agent';
    for (const review of reviewRecords) {
      if (!isPlainObject(review)) reject();
      const record = review as Record<string, unknown>;
      if (
        record.outcome !== 'matched'
        || record.artifactHash !== expected.artifactHash
        || record.reviewerKind !== requiredReviewerKind
        || !isCanonicalNonEmpty(record.reviewerId)
        || !isCanonicalNonEmpty(record.independentRunId)
        || !isZonedIso(record.reviewedAt)
        || !isCanonicalNonEmpty(record.reportPath)
        || reviewerIds.has(record.reviewerId)
        || runIds.has(record.independentRunId)
        || actualReportPaths.has(record.reportPath)
        || !hasExactStringSet(record.inputSourceRefs, expected.sourceRefs)
        || !hasExactStringSet(record.checkedClaims, expected.checkedClaims)
      ) reject();
      reviewerIds.add(record.reviewerId as string);
      runIds.add(record.independentRunId as string);
      actualReportPaths.add(record.reportPath as string);
    }

    if (
      actualReportPaths.size !== expected.reportPaths.length
      || expected.reportPaths.some((reportPath) => !actualReportPaths.has(reportPath))
    ) reject();
  } catch (error) {
    if (error instanceof Error && error.message === expected.errorMessage) throw error;
    reject();
  }
}
