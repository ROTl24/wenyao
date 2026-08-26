# Agent Note: Vite 开发服务器转换浏览器侧 CommonJS 模块

Status: implemented

## Context

渲染端和 Web AI Worker 会复用 Electron 与 `shared` 目录中的 CommonJS 领域模块。生产构建通过 Vite 的 `build.commonjsOptions` 转换这些模块，但开发服务器默认直接返回 `.cjs` 源码，浏览器执行默认导入时会因模块没有 ESM `default` 导出而停止渲染。

## Decision

Vite 开发模式使用 `vite-plugin-commonjs` 转换浏览器实际引用的 `electron/services` 与 `shared` CommonJS 模块，并把 `.cjs` 纳入解析扩展名。该转换器只在 `serve` 命令生效；生产构建继续使用 Vite 内置的 CommonJS 构建流程。

测试通过开发服务器的真实 `transformRequest` 接口校验生成、检索、配置及其依赖模块均提供浏览器可用的默认导出，防止 HTTP 200 但渲染端空白的情况再次出现。

## Verification

- `npx vitest run src/lib/devCommonJS.test.ts`
- `npm test`
- `npm run typecheck`
- `npm run build:renderer`
- `npm run verify:web`
- Electron 开发窗口截图确认三步向导已经渲染，开发控制台没有模块导出异常。
