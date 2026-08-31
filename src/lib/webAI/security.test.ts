import { describe, expect, it, vi } from 'vitest';
import type { AIConnection } from '../../types/desktop';
import { secureJsonRequest } from './provider';
import {
  assertConfirmedOrigins,
  confirmationPhrase,
  validateWebConnection,
  validateWebModelCatalog,
  WebAIError,
} from './security';

function customConnection(baseUrl = 'https://ai.example.com/v1'): AIConnection {
  return {
    id: 'custom-safe',
    providerId: 'custom',
    presetId: null,
    label: '自定义服务',
    region: '',
    baseUrl,
    fields: { workspaceId: 'public-workspace', apiKey: 'must-be-removed' },
    capabilities: {
      generation: { protocol: 'openai-chat', model: 'chat-model' },
      embedding: { protocol: 'openai-embeddings', model: 'embed-model', dimensions: 1024 },
      rerank: { protocol: 'cohere-rerank', model: 'rerank-model', url: 'https://rank.example.com/v1/rerank' },
    },
    hasApiKey: true,
    createdAt: '',
    updatedAt: '',
  };
}

describe('网页 AI 服务边界', () => {
  it('accepts a confirmed custom HTTPS stack and locks every actual origin', () => {
    const connection = customConnection();
    connection.capabilities.generation!.path = '/chat/completions?api-version=2026-01-01';
    const validated = validateWebConnection(connection);

    expect(validated.endpoints).toEqual({
      generation: 'https://ai.example.com/v1/chat/completions?api-version=2026-01-01',
      embedding: 'https://ai.example.com/v1/embeddings',
      rerank: 'https://rank.example.com/v1/rerank',
    });
    expect(validated.origins).toEqual(['https://ai.example.com', 'https://rank.example.com']);
    expect(confirmationPhrase(validated.origins)).toBe('ai.example.com + rank.example.com');
    expect(validated.connection.fields).toEqual({ workspaceId: 'public-workspace' });
    expect(() => assertConfirmedOrigins(validated.origins, { confirmedOrigins: validated.origins })).not.toThrow();
  });

  it.each([
    'http://ai.example.com/v1',
    'https://user:password@ai.example.com/v1',
    'https://ai.example.com/v1?api_key=secret',
    'https://127.0.0.1/v1',
    'https://2130706433/v1',
    'https://localhost./v1',
    'https://[fc00::1]/v1',
    'https://service.local/v1',
  ])('rejects unsafe or ambiguous provider URL %s', (baseUrl) => {
    expect(() => validateWebConnection(customConnection(baseUrl))).toThrow(WebAIError);
  });

  it('rejects a secret carried in a custom endpoint query string', () => {
    const connection = customConnection();
    connection.capabilities.generation!.path = '/chat/completions?api_key=secret';
    expect(() => validateWebConnection(connection)).toThrow(/密钥参数/);
  });

  it('rejects a partial or substituted origin confirmation', () => {
    const { origins } = validateWebConnection(customConnection());
    expect(() => assertConfirmedOrigins(origins, { confirmedOrigins: ['https://ai.example.com'] })).toThrow(/完整确认/);
    expect(() => assertConfirmedOrigins(origins, { confirmedOrigins: ['https://evil.example'] })).toThrow(/完整确认/);
  });

  it('validates a model catalog origin without requiring a model name', () => {
    expect(validateWebModelCatalog('https://api.example.com/v1')).toEqual({
      baseUrl: 'https://api.example.com/v1',
      origins: ['https://api.example.com'],
    });
  });

  it('sends one hardened request and never exposes a provider response body in the error', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init).toMatchObject({
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      });
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer session-secret');
      return new Response('provider-echoed-session-secret', { status: 500 });
    });

    const error = await secureJsonRequest(
      'https://ai.example.com/v1/chat/completions',
      'session-secret',
      { prompt: 'safe' },
      { fetchImpl: fetchImpl as typeof fetch },
    ).catch((caught) => caught as WebAIError);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(error.detail.message).not.toContain('session-secret');
    expect(error.detail.technicalDetails).toBe('{"status":500}');
    expect(error.detail.technicalDetails).not.toContain('session-secret');
  });
});
