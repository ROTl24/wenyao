const assert = require('node:assert/strict');
const test = require('node:test');
const { createApplicationMenuTemplate, installApplicationMenu } = require('./application-menu.cjs');

test('macOS application menu provides native roles and a settings command', () => {
  let settingsOpened = 0;
  const template = createApplicationMenuTemplate({
    appName: '问爻',
    onOpenSettings: () => { settingsOpened += 1; },
  });
  assert.equal(template[0].label, '问爻');
  const settings = template[0].submenu.find((item) => item.label === '设置…');
  assert.equal(settings.accelerator, 'CommandOrControl+,');
  settings.click();
  assert.equal(settingsOpened, 1);
  assert.deepEqual(template.slice(1).map((item) => item.role), ['fileMenu', 'editMenu', 'windowMenu', 'help']);
});

test('menu installation delegates exactly one template to Electron', () => {
  const calls = [];
  const menu = { id: 'native-menu' };
  const Menu = {
    buildFromTemplate(template) { calls.push(['build', template]); return menu; },
    setApplicationMenu(value) { calls.push(['set', value]); },
  };
  assert.equal(installApplicationMenu({ Menu, appName: '问爻', onOpenSettings() {} }), menu);
  assert.equal(calls[0][0], 'build');
  assert.deepEqual(calls[1], ['set', menu]);
});
