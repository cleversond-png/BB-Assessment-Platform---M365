const { graphGetAll } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: Policy.Read.All + Azure AD Premium P1
async function collectConditionalAccess(tenantId) {
  logger.info({ event: 'collector_start', collector: 'conditionalAccess', tenantId });

  let policies;
  try {
    policies = await graphGetAll(tenantId, '/identity/conditionalAccessPolicies');
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 403) {
      logger.warn({ event: 'collector_unavailable', collector: 'conditionalAccess', tenantId, reason: 'Azure AD Premium P1 required' });
      return {
        collector: 'conditionalAccess',
        score: 0,
        unavailable: true,
        reason: 'Azure AD Premium P1 required for Conditional Access. Tenant has no CA policies.',
      };
    }
    throw err;
  }

  const total = policies.length;
  const enabled = policies.filter((p) => p.state === 'enabled').length;
  const disabled = policies.filter((p) => p.state === 'disabled').length;
  const reportOnly = policies.filter((p) => p.state === 'enabledForReportingButNotEnforced').length;

  const mfaEnforced = policies.some(
    (p) =>
      p.state === 'enabled' &&
      p.grantControls?.builtInControls?.includes('mfa')
  );

  const blockLegacyAuth = policies.some(
    (p) =>
      p.state === 'enabled' &&
      p.conditions?.clientAppTypes?.some((t) =>
        ['exchangeActiveSync', 'other'].includes(t)
      ) &&
      p.grantControls?.operator === 'OR' &&
      p.grantControls?.builtInControls?.includes('block')
  );

  // Score 0–5: CA maturity
  let score = 0;
  if (enabled > 0) score += 1;
  if (mfaEnforced) score += 2;
  if (blockLegacyAuth) score += 1;
  if (enabled >= 3) score += 1;
  score = Math.min(score, 5);

  logger.info({ event: 'collector_done', collector: 'conditionalAccess', tenantId, total, enabled });

  return {
    collector: 'conditionalAccess',
    score,
    summary: { total, enabled, disabled, reportOnly, mfaEnforced, blockLegacyAuth },
    policies: policies.map((p) => ({
      displayName: p.displayName,
      state: p.state,
      createdDateTime: p.createdDateTime,
    })),
  };
}

module.exports = { collectConditionalAccess };
