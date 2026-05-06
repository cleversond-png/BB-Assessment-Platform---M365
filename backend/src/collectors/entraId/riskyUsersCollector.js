const { graphGet } = require('../../graph/graphClient');
const logger = require('../../logger');

async function collectRiskyUsers(tenantId) {
  logger.info({ event: 'collector_start', collector: 'riskyUsers', tenantId });
  let data;
  try {
    data = await graphGet(tenantId, '/identityProtection/riskyUsers', {
      $filter: "riskState eq 'atRisk' or riskState eq 'confirmedCompromised'",
      $select: 'id,userPrincipalName,userDisplayName,riskState,riskLevel,riskLastUpdatedDateTime',
      $orderby: 'riskLastUpdatedDateTime desc',
      $top: 100,
    });
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 404) {
      return {
        collector: 'riskyUsers',
        score: 0,
        unavailable: true,
        reason: 'IdentityRiskyUser.Read.All necessário (Entra ID P2).',
      };
    }
    throw err;
  }

  const users = data.value || [];
  const byLevel = { high: 0, medium: 0, low: 0 };
  let confirmedCompromised = 0;
  for (const u of users) {
    if (u.riskState === 'confirmedCompromised') confirmedCompromised++;
    if (byLevel[u.riskLevel] !== undefined) byLevel[u.riskLevel]++;
  }

  const score = users.length === 0 ? 5
    : confirmedCompromised > 0 || byLevel.high >= 3 ? 1
    : byLevel.high > 0 ? 2
    : byLevel.medium > 0 ? 3
    : 4;

  logger.info({ event: 'collector_done', collector: 'riskyUsers', tenantId, total: users.length, score });

  return {
    collector: 'riskyUsers',
    score,
    summary: {
      total: users.length,
      highRisk: byLevel.high,
      mediumRisk: byLevel.medium,
      lowRisk: byLevel.low,
      confirmedCompromised,
    },
    riskyUsers: users.map((u) => ({
      displayName: u.userDisplayName,
      upn: u.userPrincipalName,
      riskLevel: u.riskLevel,
      riskState: u.riskState,
      riskLastUpdated: u.riskLastUpdatedDateTime,
    })),
  };
}

module.exports = { collectRiskyUsers };
