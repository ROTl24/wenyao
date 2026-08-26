import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';

const browserCommonJSModules = [
  '/shared/retrieval-core.cjs?import',
  '/shared/ai-setup-core.cjs?import',
  '/electron/services/ai.cjs?import',
  '/electron/services/system-prompt.cjs?import',
  '/electron/services/liuyao-domain.cjs?import',
];

describe('Vite 开发环境的浏览器 CommonJS 边界', () => {
  let server: ViteDevServer;

  beforeAll(async () => {
    server = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
  });

  afterAll(async () => {
    await server.close();
  });

  it.each(browserCommonJSModules)('%s 向浏览器提供默认导出', async (modulePath) => {
    const transformed = await server.transformRequest(modulePath);

    expect(transformed?.code).toMatch(/export\s+(?:default\b|\{[^}]*\bdefault\b)/s);
  });
});
