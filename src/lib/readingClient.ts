import type { DivinationCaseV2, UseGodClarificationPatch, UseGodTargetSelector } from '../domain/liuyao/model';
import type { AssistantChatMessageV2, UserChatMessageV2 } from './session';
import type { ValidatedAnalysisBundleV2, ValidatedFollowUpBundleV2 } from './types';

export type RuntimeTrust = 'authoritative' | 'browser-preview';

export interface BuildCaseInput {
  sessionId: string;
  clarification?: UseGodClarificationPatch;
}

export interface SelectIntentInput extends BuildCaseInput {
  clarification: UseGodClarificationPatch;
  expectedFactSetHash: string;
}

export interface AnalyzeReadingInput {
  sessionId: string;
  expectedFactSetHash: string;
}

export interface FollowUpReadingInput extends AnalyzeReadingInput {
  question: string;
}

export interface ReadingCaseEnvelope {
  caseSnapshot: DivinationCaseV2;
  runtimeTrust: RuntimeTrust;
}

export interface AnalyzeReadingResult extends ReadingCaseEnvelope {
  analysisBundle: ValidatedAnalysisBundleV2;
}

export interface FollowUpReadingResult extends ReadingCaseEnvelope {
  followUpBundle: ValidatedFollowUpBundleV2;
  messages: readonly [UserChatMessageV2, AssistantChatMessageV2];
}

export interface ReadingClient {
  buildCase(payload: BuildCaseInput): Promise<ReadingCaseEnvelope>;
  selectIntent(payload: SelectIntentInput): Promise<ReadingCaseEnvelope>;
  analyze(payload: AnalyzeReadingInput): Promise<AnalyzeReadingResult>;
  followUp(payload: FollowUpReadingInput): Promise<FollowUpReadingResult>;
}

export type ReadingTransport = ReadingClient;

function copyExplicitTarget(target: UseGodTargetSelector | undefined): UseGodTargetSelector | undefined {
  if (!target) return undefined;
  if (target.kind === 'six-relation') return { kind: 'six-relation', relation: target.relation };
  if (target.kind === 'role') return { kind: 'role', role: target.role };
  if (target.kind === 'shi-ying-pair') return { kind: 'shi-ying-pair' };
  return {
    kind: 'explicit-entity',
    entity: target.entity.type === 'line'
      ? { type: 'line', id: target.entity.id, side: target.entity.side }
      : { type: 'hidden-spirit', id: target.entity.id },
  };
}

export function sanitizeClarificationPatch(
  value: UseGodClarificationPatch | undefined,
): UseGodClarificationPatch | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const clarification: UseGodClarificationPatch = {};
  if (typeof value.explicitIntentId === 'string') clarification.explicitIntentId = value.explicitIntentId;
  if (typeof value.subjectRelation === 'string') clarification.subjectRelation = value.subjectRelation;
  const explicitTarget = copyExplicitTarget(value.explicitTarget);
  if (explicitTarget) clarification.explicitTarget = explicitTarget;
  return Object.keys(clarification).length ? clarification : undefined;
}

export function mergeClarificationWithProvenance(
  provenance: UseGodClarificationPatch,
  clarification: UseGodClarificationPatch,
): UseGodClarificationPatch {
  const intentChanged = typeof clarification.explicitIntentId === 'string'
    && clarification.explicitIntentId.trim().length > 0
    && clarification.explicitIntentId !== provenance.explicitIntentId;
  return { ...(intentChanged ? {} : provenance), ...clarification };
}

export function createElectronReadingClient(transport: ReadingTransport): ReadingClient {
  return {
    buildCase(payload) {
      const clarification = sanitizeClarificationPatch(payload.clarification);
      return transport.buildCase({
        sessionId: payload.sessionId,
        ...(clarification ? { clarification } : {}),
      });
    },
    selectIntent(payload) {
      const clarification = sanitizeClarificationPatch(payload.clarification) ?? {};
      return transport.selectIntent({
        sessionId: payload.sessionId,
        clarification,
        expectedFactSetHash: payload.expectedFactSetHash,
      });
    },
    analyze(payload) {
      return transport.analyze({
        sessionId: payload.sessionId,
        expectedFactSetHash: payload.expectedFactSetHash,
      });
    },
    followUp(payload) {
      return transport.followUp({
        sessionId: payload.sessionId,
        question: payload.question,
        expectedFactSetHash: payload.expectedFactSetHash,
      });
    },
  };
}
