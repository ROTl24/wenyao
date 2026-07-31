const UPDATE_STATUSES = new Set([
  'idle',
  'checking',
  'available',
  'downloading',
  'downloaded',
  'upToDate',
  'error',
  'unsupported',
]);

function safeText(value, fallback = '', maxLength = 200) {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function sanitizeUpdateState(value) {
  if (!value || typeof value !== 'object' || !UPDATE_STATUSES.has(value.status)) {
    return { status: 'unsupported', currentVersion: '' };
  }

  const output = {
    status: value.status,
    currentVersion: safeText(value.currentVersion, '', 64),
  };
  if (['available', 'downloading', 'downloaded', 'error'].includes(value.status)) {
    const availableVersion = safeText(value.availableVersion, '', 64);
    if (availableVersion) output.availableVersion = availableVersion;
  }
  if (value.status === 'checking') output.manual = Boolean(value.manual);
  if (value.status === 'downloading') {
    const progress = Number(value.progress);
    output.progress = Number.isFinite(progress)
      ? Math.min(100, Math.max(0, Math.round(progress * 10) / 10))
      : 0;
  }
  if (value.status === 'error') {
    output.operation = value.operation === 'download' ? 'download' : 'check';
    output.manual = Boolean(value.manual);
    output.message = output.operation === 'download'
      ? '更新包下载失败，请检查网络连接后重试。'
      : '暂时无法检查更新，请检查网络连接后重试。';
  }
  return output;
}

module.exports = {
  sanitizeUpdateState,
};
