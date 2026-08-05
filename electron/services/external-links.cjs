const publicLinks = require('../../config/public-links.json');

function publicLinkUrl(id) {
  if (typeof id !== 'string' || !Object.hasOwn(publicLinks, id)) return null;
  const value = publicLinks[id]?.url;
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function allowedExternalUrl(value, providerCatalog) {
  if (typeof value !== 'string') return false;
  const providerLinks = Array.isArray(providerCatalog?.presets)
    ? providerCatalog.presets.flatMap((preset) => Object.values(preset.setup || {}))
    : [];
  const approved = new Set([
    ...Object.keys(publicLinks).map(publicLinkUrl).filter(Boolean),
    ...providerLinks,
  ]);
  return approved.has(value);
}

async function openPublicLink(id, openExternal) {
  const url = publicLinkUrl(id);
  if (!url || typeof openExternal !== 'function') return false;
  try {
    await openExternal(url);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  allowedExternalUrl,
  openPublicLink,
  publicLinkUrl,
};
