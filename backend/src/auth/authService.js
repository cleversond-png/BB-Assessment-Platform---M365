const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const tokenStore = require('./tokenStore');

// Pending consent requests: state -> tenantId (CSRF protection)
const pendingStates = new Map();

function generateConsentUrl(tenantId) {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, tenantId);

  // state expires in 10 minutes
  setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000);

  const params = new URLSearchParams({
    client_id: config.azure.clientId,
    redirect_uri: config.azure.redirectUri,
    state,
  });

  // Admin consent URL — grants app-only permissions for the entire tenant
  return {
    url: `${config.azure.authority}/common/adminconsent?${params}`,
    state,
  };
}

function validateState(state) {
  const tenantId = pendingStates.get(state);
  if (!tenantId) return null;
  pendingStates.delete(state);
  return tenantId;
}

// After admin consent, acquire token using client credentials (app-only)
async function acquireTokenForTenant(tenantId) {
  const tokenEndpoint = `${config.azure.authority}/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: config.azure.clientId,
    client_secret: config.azure.clientSecret,
    scope: config.azure.graphScope,
    grant_type: 'client_credentials',
  });

  const response = await axios.post(tokenEndpoint, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  tokenStore.saveToken(tenantId, response.data);
  return tokenStore.getToken(tenantId);
}

module.exports = { generateConsentUrl, validateState, acquireTokenForTenant };
