const path = require('node:path');
const { app, BrowserWindow, net, protocol } = require('electron');
const {
  APP_PROTOCOL_ENTRY_URL,
  APP_PROTOCOL_PRIVILEGES,
  APP_PROTOCOL_SCHEME,
  createAppProtocolHandler,
} = require('../electron/services/app-protocol.cjs');

protocol.registerSchemesAsPrivileged([{
  scheme: APP_PROTOCOL_SCHEME,
  privileges: APP_PROTOCOL_PRIVILEGES,
}]);

app.whenReady().then(async () => {
  protocol.handle(APP_PROTOCOL_SCHEME, createAppProtocolHandler({
    distRoot: path.resolve(__dirname, '..', 'dist'),
    fetchFile: (url, options) => net.fetch(url, options),
  }));

  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  await window.loadURL(APP_PROTOCOL_ENTRY_URL);
  const result = await window.webContents.executeJavaScript(`(async () => {
    const manifestUrl = new URL('ritual/manifest.json', document.baseURI);
    const response = await fetch(manifestUrl);
    const manifest = await response.json();
    const imageUrl = new URL(manifest.closedPoster.replace(/^\\/+/, ''), document.baseURI);
    const imageResponse = await fetch(imageUrl);
    return {
      baseURI: document.baseURI,
      manifestUrl: manifestUrl.href,
      manifestStatus: response.status,
      manifestId: manifest.id,
      imageUrl: imageUrl.href,
      imageStatus: imageResponse.status,
      imageBytes: (await imageResponse.arrayBuffer()).byteLength,
    };
  })()`);

  if (
    result.baseURI !== APP_PROTOCOL_ENTRY_URL
    || result.manifestStatus !== 200
    || result.manifestId !== 'wenyao-ritual-stills-v1'
    || result.imageStatus !== 200
    || result.imageBytes <= 0
  ) throw new Error(`app protocol smoke failed: ${JSON.stringify(result)}`);

  process.stdout.write(`APP_PROTOCOL_SMOKE ${JSON.stringify(result)}\n`);
  window.destroy();
  app.quit();
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  app.exit(1);
});
