function createApplicationMenuTemplate({ appName, onOpenSettings }) {
  return [
    {
      label: appName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: '设置…', accelerator: 'CommandOrControl+,', click: onOpenSettings },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'windowMenu' },
    { role: 'help', submenu: [] },
  ];
}

function installApplicationMenu({ Menu, appName, onOpenSettings }) {
  const menu = Menu.buildFromTemplate(createApplicationMenuTemplate({ appName, onOpenSettings }));
  Menu.setApplicationMenu(menu);
  return menu;
}

module.exports = {
  createApplicationMenuTemplate,
  installApplicationMenu,
};
