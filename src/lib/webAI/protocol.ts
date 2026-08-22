import type { AIConfigStatus, DesktopApi, DesktopError } from '../../types/desktop';

export type WebAICommand =
  | 'getStatus'
  | 'saveDraft'
  | 'testDraft'
  | 'buildAndActivate'
  | 'pauseBuild'
  | 'resumeBuild'
  | 'cancelBuild'
  | 'removeConnection'
  | 'search'
  | 'analyze'
  | 'followUp'
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

export type WebAIWorkerMessage = WebAIResponse | WebAIStatusEvent;

export type SaveDraftPayload = Parameters<DesktopApi['aiConfig']['saveDraft']>[0];
