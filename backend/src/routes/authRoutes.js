const express = require('express');
const authService = require('../auth/authService');
const tokenStore = require('../auth/tokenStore');
const consentStore = require('../store/consentStore');
const resultsStore = require('../store/resultsStore');
const logger = require('../logger');

const router = express.Router();

// GET /auth/consent?tenant_id=<customerTenantId>&client_name=<clientName>
// Returns the admin consent URL to send to the customer and registers a pending entry
router.get('/consent', (req, res) => {
  const { tenant_id, client_name } = req.query;

  if (!tenant_id) {
    return res.status(400).json({ error: 'tenant_id is required' });
  }

  try {
    const { url, state } = authService.generateConsentUrl(tenant_id);
    consentStore.addPending(tenant_id, client_name || '', url);
    logger.info({ event: 'consent_url_generated', tenantId: tenant_id, clientName: client_name, state });
    res.json({ consentUrl: url, state });
  } catch (err) {
    logger.error({ event: 'consent_url_error', error: err.message });
    res.status(500).json({ error: 'Failed to generate consent URL' });
  }
});

// GET /auth/callback
// Microsoft redirects here after admin grants consent
router.get('/callback', async (req, res) => {
  const { admin_consent, tenant, state, error, error_description } = req.query;

  if (error) {
    logger.warn({ event: 'consent_denied', error, error_description, state });
    return res.status(400).json({ error, description: error_description });
  }

  if (admin_consent !== 'True') {
    return res.status(400).json({ error: 'Admin consent not granted' });
  }

  let tenantId = authService.validateState(state);
  if (!tenantId) {
    // State not found in memory (server restarted, or URL was generated manually).
    // Fall back to the tenant Microsoft returns in the callback — safe for client_credentials flow.
    if (tenant) {
      logger.warn({ event: 'state_not_found_using_ms_tenant', state, tenant });
      tenantId = tenant;
    } else {
      logger.warn({ event: 'invalid_state_no_tenant_fallback', state });
      return res.status(400).json({ error: 'Invalid or expired state parameter' });
    }
  }

  try {
    await authService.acquireTokenForTenant(tenantId);
    consentStore.markConsented(tenantId);
    logger.info({ event: 'token_acquired', tenantId });
    res.json({ success: true, tenantId, message: 'Consent granted and token stored.' });
  } catch (err) {
    const azureError = err.response?.data || null;
    logger.error({ event: 'token_acquisition_error', tenantId, error: err.message, azureError });
    res.status(500).json({
      error: 'Failed to acquire token after consent',
      detail: err.message,
      azureError,
    });
  }
});

// GET /auth/tenants
// Lists all registered tenants with their consent status
router.get('/tenants', (req, res) => {
  res.json({ tenants: consentStore.listTenants() });
});

// DELETE /auth/tenants/:tenantId
// Removes all tenant data: consent record, in-memory token and all assessment results
router.delete('/tenants/:tenantId', (req, res) => {
  const { tenantId } = req.params;
  consentStore.removeTenant(tenantId);
  tokenStore.removeToken(tenantId);
  const deletedFiles = resultsStore.deleteAllForTenant(tenantId);
  logger.info({ event: 'tenant_deleted', tenantId, deletedFiles });
  res.json({ success: true, tenantId, deletedFiles });
});

module.exports = router;
