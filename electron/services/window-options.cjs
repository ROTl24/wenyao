function createWindowOptions({ platform, preloadPath, runtimeArgument }) {
  const options = {
    width: 1480,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#d8d2c5',
    title: '问爻',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      additionalArguments: [runtimeArgument],
    },
  };

  if (platform === 'darwin') {
    return {
      ...options,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 14 },
    };
  }

  return {
    ...options,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#232421', symbolColor: '#e8dfcf', height: 42 },
  };
}

module.exports = { createWindowOptions };
