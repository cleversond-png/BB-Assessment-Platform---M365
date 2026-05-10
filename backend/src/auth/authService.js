const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const tokenStore = require('./tokenStore');

// Lista canônica de permissões Microsoft Graph (Application/Role) que a App Registration
// precisa ter aprovadas. Mantenha em sincronia com azure/app-registration-permissions.json.
const REQUIRED_PERMISSIONS = [
  { name: 'AuditLog.Read.All',                  category: 'Governança',     collectors: ['audit', 'usersBaseline (inactiveUsers)'] },
  { name: 'ExternalConnection.Read.All',        category: 'Copilot',        collectors: ['copilotExtensions'] },
  { name: 'Files.Read.All',                     category: 'SharePoint',     collectors: ['files'] },
  { name: 'IdentityRiskyUser.Read.All',         category: 'Identidade',     collectors: ['riskyUsers'], requires: 'Entra ID P2' },
  { name: 'InformationProtectionPolicy.Read.All', category: 'Governança',   collectors: ['sensitivityLabels'] },
  { name: 'Organization.Read.All',              category: 'Baseline',       collectors: ['tenantInfo', 'licensing'] },
  { name: 'Policy.Read.All',                    category: 'Identidade',     collectors: ['conditionalAccess'], requires: 'Entra ID P1' },
  { name: 'RecordsManagement.Read.All',         category: 'Governança',     collectors: ['retentionPolicies'] },
  { name: 'Reports.Read.All',                   category: 'Baseline',       collectors: ['usage', 'appsChannel'] },
  { name: 'RoleManagement.Read.Directory',      category: 'Identidade',     collectors: ['privileged (PIM)'] },
  { name: 'SharePointTenantSettings.Read.All',  category: 'SharePoint',     collectors: ['permissions (OneDrive global)'] },
  { name: 'Sites.Read.All',                     category: 'SharePoint',     collectors: ['permissions', 'ownership', 'oversharing'] },
  { name: 'User.Read.All',                      category: 'Baseline',       collectors: ['users', 'guests', 'ownership'] },
  { name: 'UserAuthenticationMethod.Read.All',  category: 'Identidade',     collectors: ['mfa', 'sspr'], requires: 'Entra ID P1' },
  { name: 'Application.Read.All',               category: 'Identidade',     collectors: ['appPermissions'] },
  { name: 'Team.ReadBasic.All',                 category: 'Teams',          collectors: ['teamsExternalAccess', 'teamsSettings'] },
];

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

module.exports = { generateConsentUrl, validateState, acquireTokenForTenant, REQUIRED_PERMISSIONS };
