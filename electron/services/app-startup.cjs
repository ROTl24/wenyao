const COMMAND_MODE_FLAGS = new Set([
  '--configure-api-keys-env',
  '--build-vector-index',
  '--verify-model-stack',
  '--verify-hybrid-retrieval',
  '--verify-analysis',
]);

function prepareApplicationStartup({ app, argv, configureDataPaths }) {
  const commandMode = argv.some((argument) => COMMAND_MODE_FLAGS.has(argument));
  if (!commandMode && !app.requestSingleInstanceLock()) {
    app.quit();
    return {
      shouldStart: false,
      commandMode: false,
    };
  }

  configureDataPaths(app);
  return {
    shouldStart: true,
    commandMode,
  };
}

module.exports = {
  COMMAND_MODE_FLAGS,
  prepareApplicationStartup,
};
