import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const distRoot = path.join(projectRoot, 'dist');

function requireFile(filePath, minimumBytes = 1) {
  if (!existsSync(filePath)) {
    throw new Error(`缺少 Web 发布产物：${path.relative(projectRoot, filePath)}`);
  }
  const bytes = statSync(filePath).size;
  if (bytes < minimumBytes) {
    throw new Error(`Web 发布产物异常小：${path.relative(projectRoot, filePath)} (${bytes} bytes)`);
  }
  return bytes;
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(filePath) : [filePath];
  });
}

function normalizedRelative(filePath) {
  return path.relative(distRoot, filePath).split(path.sep).join('/');
}

function resolveLocalReference(reference, owner) {
  const value = reference.split(/[?#]/, 1)[0];
  if (!value || value.startsWith('#') || /^(?:data|blob|https?):/i.test(value)) return null;
  if (value.startsWith('/')) {
    throw new Error(`${owner} 使用了无法随相对 base 部署的根路径：${reference}`);
  }
  const resolved = path.resolve(distRoot, value);
  const relative = path.relative(distRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${owner} 引用越出 dist：${reference}`);
  }
  requireFile(resolved);
  return resolved;
}

function pngDimensions(filePath) {
  const bytes = readFileSync(filePath);
  const signature = bytes.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a' || bytes.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error(`PWA 图标不是有效 PNG：${normalizedRelative(filePath)}`);
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function requireIcon(manifest, src, size, purpose) {
  const icon = manifest.icons?.find((item) => item.src === src && item.sizes === `${size}x${size}`);
  if (!icon || icon.type !== 'image/png' || (purpose && icon.purpose !== purpose)) {
    throw new Error(`manifest.webmanifest 缺少 ${src} 的 ${size}x${size}${purpose ? ` ${purpose}` : ''} 声明`);
  }
  const filePath = resolveLocalReference(icon.src, 'manifest.webmanifest');
  const dimensions = pngDimensions(filePath);
  if (dimensions.width !== size || dimensions.height !== size) {
    throw new Error(`${icon.src} 实际尺寸为 ${dimensions.width}x${dimensions.height}，应为 ${size}x${size}`);
  }
  return filePath;
}

const indexPath = path.join(distRoot, 'index.html');
const manifestPath = path.join(distRoot, 'manifest.webmanifest');
const serviceWorkerPath = path.join(distRoot, 'sw.js');
const headersPath = path.join(distRoot, '_headers');
const indexBytes = requireFile(indexPath, 200);
const manifestBytes = requireFile(manifestPath, 100);
const serviceWorkerBytes = requireFile(serviceWorkerPath, 200);
requireFile(headersPath, 200);
const index = readFileSync(indexPath, 'utf8');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const serviceWorker = readFileSync(serviceWorkerPath, 'utf8');
const headers = readFileSync(headersPath, 'utf8');

for (const requiredHeader of [
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "worker-src 'self'",
  'Referrer-Policy: no-referrer',
  'X-Content-Type-Options: nosniff',
  'X-Frame-Options: DENY',
  'Permissions-Policy:',
]) {
  if (!headers.includes(requiredHeader)) throw new Error(`Cloudflare Pages 安全响应头缺少：${requiredHeader}`);
}
if (/connect-src[^\n;]*\bhttp:/.test(headers) || /worker-src[^\n;]*blob:/.test(headers)) {
  throw new Error('Cloudflare Pages 安全策略不得允许明文 AI 请求或 blob Worker');
}

if (/\/src\/main\.(?:t|j)sx?/.test(index)) {
  throw new Error('dist/index.html 仍引用开发源码入口');
}

const htmlReferences = [...index.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)]
  .map((match) => match[1]);
for (const reference of htmlReferences) resolveLocalReference(reference, 'dist/index.html');

for (const [key, expected] of Object.entries({
  name: '问爻',
  short_name: '问爻',
  lang: 'zh-CN',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#d8d2c5',
  theme_color: '#232421',
})) {
  if (manifest[key] !== expected) {
    throw new Error(`manifest.webmanifest 的 ${key} 应为 ${expected}，实际为 ${manifest[key] ?? '<missing>'}`);
  }
}

const icon192 = requireIcon(manifest, 'icons/icon-192.png', 192);
const icon512 = requireIcon(manifest, 'icons/icon-512.png', 512);
const maskableIcon = requireIcon(manifest, 'icons/icon-maskable-512.png', 512, 'maskable');
const appleIconPath = path.join(distRoot, 'icons', 'apple-touch-icon.png');
requireFile(appleIconPath);
const appleDimensions = pngDimensions(appleIconPath);
if (appleDimensions.width !== 180 || appleDimensions.height !== 180) {
  throw new Error(`Apple 图标实际尺寸为 ${appleDimensions.width}x${appleDimensions.height}，应为 180x180`);
}
if (!htmlReferences.some((reference) => reference.endsWith('icons/apple-touch-icon.png'))) {
  throw new Error('dist/index.html 未引用 Apple Touch 图标');
}

const serviceWorkerWithoutExplicitUpdateHandler = serviceWorker.replace(
  /self\.addEventListener\(["']message["'],\w+=>\{[^{}]*["']SKIP_WAITING["'][^{}]*self\.skipWaiting\(\)[^{}]*\}\)/,
  '',
);
if (/self\.skipWaiting\s*\(|clientsClaim\s*\(/.test(serviceWorkerWithoutExplicitUpdateHandler)) {
  throw new Error('Service Worker 不得强制接管并刷新正在进行的起卦页面');
}

const distFiles = listFiles(distRoot);
const precacheFiles = distFiles.filter((filePath) => {
  const relative = normalizedRelative(filePath);
  return relative !== 'sw.js' && relative !== '_headers' && !/^workbox-[\w-]+\.js$/.test(relative);
});
const missingFromPrecache = precacheFiles
  .map(normalizedRelative)
  .filter((relative) => !serviceWorker.includes(JSON.stringify(relative)));
if (missingFromPrecache.length) {
  throw new Error(`Service Worker 未预缓存以下本地产物：${missingFromPrecache.join(', ')}`);
}
if (/runtimeCaching|NetworkFirst|NetworkOnly|StaleWhileRevalidate/.test(serviceWorker)) {
  throw new Error('Service Worker 不得添加可能缓存跨域 AI 请求或响应的运行时路由');
}
if (/authorization|api[-_]?key|bearer/i.test(serviceWorker)) {
  throw new Error('Service Worker 不得处理 AI 访问密钥或认证头');
}

for (const pattern of [
  /assets\/ZhuqueFangsong-Regular-.*\.ttf$/,
  /assets\/CoinScene-.*\.js$/,
  /images\/ritual-hands\.png$/,
  /images\/ritual-hands-closed\.png$/,
]) {
  if (!precacheFiles.map(normalizedRelative).some((relative) => pattern.test(relative))) {
    throw new Error(`离线包缺少关键资源：${pattern}`);
  }
}

const totalBytes = distFiles.reduce((total, filePath) => total + requireFile(filePath), 0);
const largest = distFiles
  .map((filePath) => ({ file: normalizedRelative(filePath), bytes: statSync(filePath).size }))
  .sort((left, right) => right.bytes - left.bytes)[0];

process.stdout.write(`${JSON.stringify({
  files: distFiles.length,
  totalBytes,
  largest,
  indexBytes,
  manifestBytes,
  serviceWorkerBytes,
  precachedFiles: precacheFiles.length,
  icons: [icon192, icon512, maskableIcon, appleIconPath].map(normalizedRelative),
})}\n`);
