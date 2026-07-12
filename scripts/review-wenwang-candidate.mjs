import { createHash } from 'node:crypto';
import {
  RULE_SOURCE_EVIDENCE_CAPSULES,
  WENWANG_NAJIA_V2_ARTIFACT_HASH,
  WENWANG_NAJIA_V2_CANONICAL_PAYLOAD,
} from '../electron/generated/domain/rules/wenwang-najia-v2.js';

const sha256 = (payload) => createHash('sha256').update(payload, 'utf8').digest('hex');
const artifactHash = sha256(WENWANG_NAJIA_V2_CANONICAL_PAYLOAD);
const sourceEvidence = RULE_SOURCE_EVIDENCE_CAPSULES.map(({ ref, payload }) => ({
  sourceId: ref.id,
  declaredHash: ref.contentHash,
  computedHash: sha256(payload),
  matched: ref.contentHash === sha256(payload),
}));

const result = {
  artifact: {
    declaredHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
    computedHash: artifactHash,
    matched: WENWANG_NAJIA_V2_ARTIFACT_HASH === artifactHash,
    canonicalBytes: Buffer.byteLength(WENWANG_NAJIA_V2_CANONICAL_PAYLOAD, 'utf8'),
  },
  sourceEvidence,
};

console.log(JSON.stringify(result, null, 2));
if (!result.artifact.matched || sourceEvidence.some(({ matched }) => !matched)) {
  process.exitCode = 1;
}
