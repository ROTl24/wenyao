const domainPromise = import('../generated/domain/index.js');

async function createFactContractV2(caseSnapshot) {
  const domain = await domainPromise;
  return domain.createFactContractV2(caseSnapshot);
}

async function createLocalRawReportV2(contract, canonicalEvidence = []) {
  const domain = await domainPromise;
  return domain.createLocalRawReportV2(contract, canonicalEvidence);
}

async function createLocalRawFollowUpV2(contract) {
  const domain = await domainPromise;
  return domain.createLocalRawFollowUpV2(contract);
}

async function deriveFollowUpContentV2(validated) {
  const domain = await domainPromise;
  return domain.deriveFollowUpContentV2(validated);
}

async function normalizeValidatedAnalysisReportV2(validated) {
  const domain = await domainPromise;
  return domain.normalizeValidatedAnalysisReportV2(validated);
}

async function normalizeValidatedFollowUpV2(validated) {
  const domain = await domainPromise;
  return domain.normalizeValidatedFollowUpV2(validated);
}

async function validateAnalysisReportV2(raw, contract, canonicalEvidence, validatedAt) {
  const domain = await domainPromise;
  return domain.validateAnalysisReportV2(raw, contract, canonicalEvidence, validatedAt);
}

async function validateFollowUpV2(raw, contract, canonicalEvidence, validatedAt) {
  const domain = await domainPromise;
  return domain.validateFollowUpV2(raw, contract, canonicalEvidence, validatedAt);
}

async function createAnalysisRetrievalContextV2(modelContract) {
  const domain = await domainPromise;
  return domain.createAnalysisRetrievalContextV2(modelContract);
}

async function getReportV2Schema() {
  const domain = await domainPromise;
  return domain.REPORT_V2_SCHEMA;
}

async function getFollowUpV2Schema() {
  const domain = await domainPromise;
  return domain.FOLLOW_UP_V2_SCHEMA;
}

module.exports = {
  createAnalysisRetrievalContextV2,
  createFactContractV2,
  createLocalRawFollowUpV2,
  createLocalRawReportV2,
  deriveFollowUpContentV2,
  getFollowUpV2Schema,
  getReportV2Schema,
  normalizeValidatedAnalysisReportV2,
  normalizeValidatedFollowUpV2,
  validateAnalysisReportV2,
  validateFollowUpV2,
  validateRawFollowUpV2: validateFollowUpV2,
};
