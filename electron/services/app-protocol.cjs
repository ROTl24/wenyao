const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_PROTOCOL_SCHEME = 'app';
const APP_PROTOCOL_HOST = 'wenyao';
const APP_PROTOCOL_ENTRY_URL = `${APP_PROTOCOL_SCHEME}://${APP_PROTOCOL_HOST}/index.html`;
const APP_PROTOCOL_PRIVILEGES = Object.freeze({
  standard: true,
  secure: true,
  supportFetchAPI: true,
  corsEnabled: true,
  stream: true,
  codeCache: true,
});

function isInsideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`)
    && relative !== '..'
    && !path.isAbsolute(relative));
}

function resolveAppProtocolFile(requestUrl, distRoot) {
  try {
    const url = new URL(requestUrl);
    if (
      url.protocol !== `${APP_PROTOCOL_SCHEME}:`
      || url.hostname !== APP_PROTOCOL_HOST
      || url.port
      || url.username
      || url.password
    ) return null;

    const decodedPath = decodeURIComponent(url.pathname);
    if (decodedPath.includes('\0') || decodedPath.includes('\\')) return null;
    const relativePath = decodedPath.replace(/^\/+/, '') || 'index.html';
    const root = path.resolve(distRoot);
    const candidate = path.resolve(root, relativePath);
    return isInsideRoot(root, candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function resolveAppProtocolFileUrl(requestUrl, distRoot) {
  const file = resolveAppProtocolFile(requestUrl, distRoot);
  return file ? pathToFileURL(file).href : null;
}

function createAppProtocolHandler({ distRoot, fetchFile }) {
  return async function handleAppProtocol(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
    }
    const fileUrl = resolveAppProtocolFileUrl(request.url, distRoot);
    if (!fileUrl) return new Response(null, { status: 404 });

    try {
      return await fetchFile(fileUrl, {
        method: request.method,
        headers: request.headers,
        bypassCustomProtocolHandlers: true,
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  };
}

module.exports = {
  APP_PROTOCOL_ENTRY_URL,
  APP_PROTOCOL_HOST,
  APP_PROTOCOL_PRIVILEGES,
  APP_PROTOCOL_SCHEME,
  createAppProtocolHandler,
  resolveAppProtocolFile,
  resolveAppProtocolFileUrl,
};
