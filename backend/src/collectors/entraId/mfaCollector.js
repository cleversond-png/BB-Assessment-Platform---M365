const { graphGetAll } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: Reports.Read.All + Azure AD Premium P1
async function collectMfa(tenantId) {
  logger.info({ event: 'collector_start', collector: 'mfa', tenantId });

  let registrations;
  try {
    registrations = await graphGetAll(
      tenantId,
      '/reports/authenticationMethods/userRegistrationDetails',
      { $select: 'userPrincipalName,isMfaRegistered,isMfaCapable,methodsRegistered' }
    );
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 403) {
      logger.warn({ event: 'collector_unavailable', collector: 'mfa', tenantId, reason: 'Azure AD Premium P1 required' });
      return {
        collector: 'mfa',
        score: 0,
        unavailable: true,
        reason: 'Azure AD Premium P1 required for MFA reporting. Tenant likely has no MFA enforcement policies.',
      };
    }
    throw err;
  }

  const total = registrations.length;
  const mfaRegistered = registrations.filter((u) => u.isMfaRegistered).length;
  const mfaCapable = registrations.filter((u) => u.isMfaCapable).length;
  const withoutMfa = registrations
    .filter((u) => !u.isMfaRegistered)
    .map((u) => u.userPrincipalName);

  const coveragePercent = total > 0 ? Math.round((mfaRegistered / total) * 100) : 0;

  const score =
    coveragePercent >= 95 ? 5 :
    coveragePercent >= 80 ? 4 :
    coveragePercent >= 60 ? 3 :
    coveragePercent >= 40 ? 2 :
    coveragePercent >= 20 ? 1 : 0;

  logger.info({ event: 'collector_done', collector: 'mfa', tenantId, total, mfaRegistered, coveragePercent });

  return {
    collector: 'mfa',
    score,
    summary: { total, mfaRegistered, mfaCapable, coveragePercent },
    usersWithoutMfa: withoutMfa,
  };
}

module.exports = { collectMfa };
