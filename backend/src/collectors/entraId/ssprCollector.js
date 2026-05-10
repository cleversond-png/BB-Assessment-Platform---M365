const { graphGetAll } = require('../../graph/graphClient');
const logger = require('../../logger');

// Self-Service Password Reset (SSPR) registration coverage.
// SSPR allows users to reset their own passwords without IT helpdesk.
// Without SSPR, account lockout incidents create support load and
// may lead to insecure workarounds (sharing passwords, weak resets).
// Requires: Reports.Read.All + UserAuthenticationMethod.Read.All (Entra ID P1)

async function collectSspr(tenantId) {
  logger.info({ event: 'collector_start', collector: 'sspr', tenantId });

  let registrations;
  try {
    registrations = await graphGetAll(
      tenantId,
      '/reports/authenticationMethods/userRegistrationDetails',
      { $select: 'userPrincipalName,isSsprRegistered,isSsprCapable,isSsprEnabled' }
    );
  } catch (err) {
    const status = err?.response?.status ?? err?.statusCode;
    if (status === 404 || status === 403) {
      logger.warn({ event: 'collector_unavailable', collector: 'sspr', tenantId, reason: 'Entra ID P1 ou permissao ausente' });
      return {
        collector: 'sspr',
        score: 0,
        unavailable: true,
        reason: 'Azure AD Premium P1 ou UserAuthenticationMethod.Read.All necessario para dados de SSPR.',
      };
    }
    throw err;
  }

  const total = registrations.length;
  const ssprRegistered = registrations.filter(u => u.isSsprRegistered).length;
  const ssprCapable    = registrations.filter(u => u.isSsprCapable).length;
  const ssprEnabled    = registrations.filter(u => u.isSsprEnabled).length;

  const coveragePercent = total > 0 ? Math.round((ssprRegistered / total) * 100) : 0;

  const score =
    coveragePercent >= 80 ? 4 :
    coveragePercent >= 60 ? 3 :
    coveragePercent >= 40 ? 2 :
    coveragePercent >= 20 ? 1 : 0;

  logger.info({ event: 'collector_done', collector: 'sspr', tenantId, total, ssprRegistered, coveragePercent, score });

  return {
    collector: 'sspr',
    score,
    summary: { total, ssprRegistered, ssprCapable, ssprEnabled, coveragePercent },
  };
}

module.exports = { collectSspr };
