const core = require('../../shared/retrieval-core.cjs');

module.exports = {
  ...core,
  lexicalSearch: core.bm25Search,
};
