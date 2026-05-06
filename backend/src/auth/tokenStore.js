// In-memory token store: tenantId -> { accessToken, expiresAt, acquiredAt }
// Replace with Redis or encrypted DB before production.
const store = new Map();

function saveToken(tenantId, tokenData) {
  const expiresAt = Date.now() + tokenData.expires_in * 1000;
  store.set(tenantId, {
    accessToken: tokenData.access_token,
    expiresAt,
    acquiredAt: Date.now(),
  });
}

function getToken(tenantId) {
  const entry = store.get(tenantId);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(tenantId);
    return null;
  }
  return entry;
}

function hasConsent(tenantId) {
  return store.has(tenantId);
}

function listTenants() {
  return Array.from(store.keys()).map((tenantId) => ({
    tenantId,
    expiresAt: new Date(store.get(tenantId).expiresAt).toISOString(),
  }));
}

function removeToken(tenantId) {
  store.delete(tenantId);
}

module.exports = { saveToken, getToken, hasConsent, listTenants, removeToken };
