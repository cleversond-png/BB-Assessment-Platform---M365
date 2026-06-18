const express = require('express');
const authService = require('../auth/authService');
const tokenStore = require('../auth/tokenStore');
const consentStore = require('../store/consentStore');
const resultsStore = require('../store/resultsStore');
const { TENANT_RE } = require('../config');
const logger = require('../logger');
const portalAuth = require('../auth/portalAuth');

const router = express.Router();

router.get('/session', portalAuth.sessionHandler);
router.post('/login', portalAuth.loginHandler);
router.post('/logout', portalAuth.logoutHandler);

// GET /auth/callback
// Microsoft redirects here after admin grants consent. This must remain public
// because the customer admin is redirected by Entra during the consent flow.
router.get('/callback', async (req, res) => {
  const { admin_consent, tenant, state, error, error_description } = req.query;

  if (error) {
    logger.warn({ event: 'consent_denied', error, error_description, state });
    return res.status(400).json({ error, description: error_description });
  }

  if (admin_consent !== 'True') {
    return res.status(400).json({ error: 'Admin consent not granted' });
  }

  const originalTenantId = authService.validateState(state);
  const tenantId = tenant || originalTenantId;
  if (!tenantId) {
    logger.warn({ event: 'callback_no_tenant_no_state', state });
    return res.status(400).json({ error: 'Tenant não retornado pelo Azure e state inválido' });
  }
  if (originalTenantId && originalTenantId !== tenantId) {
    logger.warn({ event: 'tenant_mismatch', originalTenantId, msTenant: tenantId, state });
    try { consentStore.removeTenant(originalTenantId); } catch { /* noop */ }
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

router.use(portalAuth.requirePortalAuth);

// GET /auth/consent?tenant_id=<customerTenantId>&client_name=<clientName>
// Returns the admin consent URL to send to the customer and registers a pending entry
router.get('/consent', (req, res) => {
  const { tenant_id, client_name } = req.query;

  if (!tenant_id) {
    return res.status(400).json({ error: 'tenant_id is required' });
  }

  if (!TENANT_RE.test(tenant_id.trim())) {
    return res.status(400).json({
      error: 'tenant_id inválido — use o Directory ID (UUID) ou o domínio *.onmicrosoft.com do tenant. O nome da empresa vai no campo client_name.',
    });
  }

  try {
    const { url, state } = authService.generateConsentUrl(tenant_id.trim());
    consentStore.addPending(tenant_id.trim(), client_name || '', url, state);
    logger.info({ event: 'consent_url_generated', tenantId: tenant_id, clientName: client_name, state });
    res.json({ consentUrl: url, state });
  } catch (err) {
    logger.error({ event: 'consent_url_error', error: err.message });
    res.status(500).json({ error: 'Failed to generate consent URL' });
  }
});

// GET /auth/required-permissions
// Lista canônica de permissões Microsoft Graph que a App Registration precisa
router.get('/required-permissions', (_req, res) => {
  res.json({ permissions: authService.REQUIRED_PERMISSIONS });
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
