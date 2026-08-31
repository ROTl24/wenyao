const EMBEDDING_DOCUMENT_VERSION = 'source-title-text-v1';

function composeEmbeddingDocument(entry, fallbackTitle = '') {
  return `${entry?.source || fallbackTitle}\n${entry?.title || ''}\n${entry?.text || ''}`;
}

module.exports = {
  EMBEDDING_DOCUMENT_VERSION,
  composeEmbeddingDocument,
};
