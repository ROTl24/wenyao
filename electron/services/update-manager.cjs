const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function cloneState(state) {
  return structuredClone(state);
}

function versionFrom(info, fallback = '') {
  return typeof info?.version === 'string' && info.version.trim()
    ? info.version.trim()
    : fallback;
}

function createUpdateManager({
  updater,
  currentVersion,
  supported,
  broadcast = () => {},
  logger = console,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
}) {
  let state = {
    status: supported ? 'idle' : 'unsupported',
    currentVersion,
  };
  let checkPromise = null;
  let downloadPromise = null;
  let intervalHandle = null;
  let activeOperation = null;
  let activeCheckIsManual = false;
  let lastAvailableVersion = '';
  const boundEvents = [];

  function publish(next) {
    state = Object.freeze(next);
    try {
      broadcast(cloneState(state));
    } catch (error) {
      logger.warn('Unable to broadcast updater state', error);
    }
    return cloneState(state);
  }

  function publicError(operation, manual) {
    const message = operation === 'download'
      ? '更新包下载失败，请检查网络连接后重试。'
      : '暂时无法检查更新，请检查网络连接后重试。';
    return publish({
      status: 'error',
      currentVersion,
      ...(lastAvailableVersion ? { availableVersion: lastAvailableVersion } : {}),
      operation,
      manual: Boolean(manual),
      message,
    });
  }

  function bind(eventName, listener) {
    updater.on(eventName, listener);
    boundEvents.push([eventName, listener]);
  }

  if (supported) {
    if (!updater) throw new Error('Supported updates require an updater adapter.');
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = true;
    updater.autoRunAppAfterInstall = true;
    updater.allowPrerelease = false;
    updater.fullChangelog = false;
    updater.disableWebInstaller = true;
    updater.channel = 'latest';
    // Setting a channel can enable downgrade in electron-updater, so lock it down afterwards.
    updater.allowDowngrade = false;

    bind('checking-for-update', () => {
      publish({
        status: 'checking',
        currentVersion,
        manual: activeCheckIsManual,
      });
    });
    bind('update-available', (info) => {
      lastAvailableVersion = versionFrom(info, lastAvailableVersion);
      activeOperation = null;
      publish({
        status: 'available',
        currentVersion,
        availableVersion: lastAvailableVersion,
      });
    });
    bind('update-not-available', () => {
      activeOperation = null;
      publish({ status: 'upToDate', currentVersion });
    });
    bind('download-progress', (progress) => {
      const percent = Number.isFinite(progress?.percent)
        ? Math.min(100, Math.max(0, Number(progress.percent)))
        : 0;
      publish({
        status: 'downloading',
        currentVersion,
        availableVersion: lastAvailableVersion,
        progress: Math.round(percent * 10) / 10,
      });
    });
    bind('update-downloaded', (info) => {
      lastAvailableVersion = versionFrom(info, lastAvailableVersion);
      activeOperation = null;
      publish({
        status: 'downloaded',
        currentVersion,
        availableVersion: lastAvailableVersion,
      });
    });
    bind('update-cancelled', () => {
      activeOperation = null;
      publish({
        status: 'available',
        currentVersion,
        availableVersion: lastAvailableVersion,
      });
    });
    bind('error', (error) => {
      logger.error('Electron updater failed', error);
      const operation = activeOperation === 'download' ? 'download' : 'check';
      publicError(operation, operation === 'check' && activeCheckIsManual);
      activeOperation = null;
    });
  }

  async function check(trigger = 'manual') {
    if (!supported) return cloneState(state);
    if (state.status === 'downloading' || state.status === 'downloaded') return cloneState(state);
    if (checkPromise) return checkPromise;

    activeOperation = 'check';
    activeCheckIsManual = trigger === 'manual';
    publish({
      status: 'checking',
      currentVersion,
      manual: activeCheckIsManual,
    });

    checkPromise = Promise.resolve()
      .then(() => updater.checkForUpdates())
      .then(() => cloneState(state))
      .catch((error) => {
        logger.error('Update check failed', error);
        if (state.status !== 'error') publicError('check', activeCheckIsManual);
        return cloneState(state);
      })
      .finally(() => {
        checkPromise = null;
        if (activeOperation === 'check') activeOperation = null;
      });
    return checkPromise;
  }

  async function download() {
    if (!supported) return cloneState(state);
    const canDownload = state.status === 'available'
      || (state.status === 'error' && state.operation === 'download' && lastAvailableVersion);
    if (!canDownload) return downloadPromise || cloneState(state);
    if (downloadPromise) return downloadPromise;

    activeOperation = 'download';
    publish({
      status: 'downloading',
      currentVersion,
      availableVersion: lastAvailableVersion,
      progress: 0,
    });
    downloadPromise = Promise.resolve()
      .then(() => updater.downloadUpdate())
      .then(() => cloneState(state))
      .catch((error) => {
        logger.error('Update download failed', error);
        if (state.status !== 'error') publicError('download', true);
        return cloneState(state);
      })
      .finally(() => {
        downloadPromise = null;
        if (activeOperation === 'download') activeOperation = null;
      });
    return downloadPromise;
  }

  function install() {
    if (!supported || state.status !== 'downloaded') return cloneState(state);
    updater.quitAndInstall(false, true);
    return cloneState(state);
  }

  function start() {
    if (!supported || intervalHandle !== null) return;
    void check('automatic');
    intervalHandle = setIntervalFn(() => {
      void check('automatic');
    }, CHECK_INTERVAL_MS);
  }

  function stop() {
    if (intervalHandle === null) return;
    clearIntervalFn(intervalHandle);
    intervalHandle = null;
  }

  function destroy() {
    stop();
    if (!supported) return;
    for (const [eventName, listener] of boundEvents) {
      updater.removeListener(eventName, listener);
    }
  }

  return {
    getState: () => cloneState(state),
    check,
    download,
    install,
    start,
    stop,
    destroy,
  };
}

module.exports = {
  CHECK_INTERVAL_MS,
  createUpdateManager,
};
