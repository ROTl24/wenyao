import type { AIAnalysisProgress, AIConfigStatus, DesktopApi, DesktopError } from '../../types/desktop';

export type WebAICommand =
  | 'getStatus'
  | 'listModels'
  | 'testCapability'
  | 'completeSetup'
  | 'cancelSetup'
  | 'pauseBuild'
  | 'resumeBuild'
  | 'cancelBuild'
  | 'search'
  | 'analyze'
  | 'followUp'
  | 'cancelGeneration'
  | 'clear';

export interface WebAIRequest {
  id: string;
  command: WebAICommand;
  payload?: unknown;
}

export interface WebAIResponse {
  id: string;
  ok: boolean;
  value?: unknown;
  error?: DesktopError;
}

export interface WebAIStatusEvent {
  event: 'status';
  status: AIConfigStatus;
}

export type WebAIWorkerMessage = WebAIResponse | WebAIStatusEvent | { event: 'generation'; requestId: string; progress: AIAnalysisProgress };

export type TestCapabilityPayload = Parameters<DesktopApi['aiConfig']['testCapability']>[0];
