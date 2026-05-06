const { graphGetAll } = require('../../graph/graphClient');
const logger = require('../../logger');

const INACTIVE_DAYS = 90;

// Requires: Directory.Read.All
async function collectGuests(tenantId) {
  logger.info({ event: 'collector_start', collector: 'guests', tenantId });

  const guests = await graphGetAll(tenantId, '/users', {
    $filter: "userType eq 'Guest'",
    $select: 'id,displayName,mail,userPrincipalName,createdDateTime,signInActivity',
  });

  const now = Date.now();
  const cutoff = now - INACTIVE_DAYS * 24 * 60 * 60 * 1000;

  const inactive = guests.filter((g) => {
    const lastSignIn = g.signInActivity?.lastSignInDateTime;
    if (!lastSignIn) return true; // never signed in = inactive
    return new Date(lastSignIn).getTime() < cutoff;
  });

  const neverSignedIn = guests.filter((g) => !g.signInActivity?.lastSignInDateTime);

  // Score 0–5: guest hygiene
  const inactiveRatio = guests.length > 0 ? inactive.length / guests.length : 0;
  const score =
    guests.length === 0 ? 5 :
    inactiveRatio <= 0.05 ? 5 :
    inactiveRatio <= 0.15 ? 4 :
    inactiveRatio <= 0.30 ? 3 :
    inactiveRatio <= 0.50 ? 2 :
    inactiveRatio <= 0.70 ? 1 : 0;

  logger.info({ event: 'collector_done', collector: 'guests', tenantId, total: guests.length, inactive: inactive.length });

  return {
    collector: 'guests',
    score,
    summary: {
      total: guests.length,
      inactive: inactive.length,
      neverSignedIn: neverSignedIn.length,
      inactiveRatioPercent: Math.round(inactiveRatio * 100),
    },
    inactiveGuests: inactive.map((g) => ({
      displayName: g.displayName,
      mail: g.mail,
      createdDateTime: g.createdDateTime,
      lastSignIn: g.signInActivity?.lastSignInDateTime || null,
    })),
  };
}

module.exports = { collectGuests };
