const { collectMfa } = require('./mfaCollector');
const { collectConditionalAccess } = require('./caCollector');
const { collectPrivileged } = require('./privilegedCollector');
const { collectGuests } = require('./guestCollector');
const { collectRiskySignIns } = require('./riskySignInsCollector');
const { collectLegacyAuth } = require('./legacyAuthCollector');
const { collectSspr } = require('./ssprCollector');
const { collectBreakGlass } = require('./breakGlassCollector');
const { collectAppPermissions } = require('./appPermissionsCollector');
const logger = require('../../logger');

const COLLECTOR_WEIGHTS = {
  mfa: 2, conditionalAccess: 2, privileged: 2, guests: 1, riskySignIns: 2,
  legacyAuth: 2, sspr: 1, breakGlass: 1, appPermissions: 2,
};

async function runEntraIdAssessment(tenantId) {
  logger.info({ event: 'assessment_start', domain: 'entraId', tenantId });

  const collectors = [
    { name: 'mfa',              fn: () => collectMfa(tenantId) },
    { name: 'conditionalAccess', fn: () => collectConditionalAccess(tenantId) },
    { name: 'privileged',       fn: () => collectPrivileged(tenantId) },
    { name: 'guests',           fn: () => collectGuests(tenantId) },
    { name: 'riskySignIns',     fn: () => collectRiskySignIns(tenantId) },
    { name: 'legacyAuth',       fn: () => collectLegacyAuth(tenantId) },
    { name: 'sspr',             fn: () => collectSspr(tenantId) },
    { name: 'breakGlass',       fn: () => collectBreakGlass(tenantId) },
    { name: 'appPermissions',   fn: () => collectAppPermissions(tenantId) },
  ];

  const results = {};
  const errors = {};

  await Promise.allSettled(collectors.map(async ({ name, fn }) => {
    try {
      results[name] = await fn();
    } catch (err) {
      const reason = err.response?.data?.error?.message || err.message;
      logger.error({ event: 'collector_error', collector: name, tenantId, error: reason });
      errors[name] = reason;
      results[name] = { score: null, unavailable: true, reason };
    }
  }));

  // Weighted score: unavailable collectors (no premium license) count as 0 with full weight
  // so the domain score reflects the gap, not just the collectors that ran.
  let weightedSum = 0;
  const totalWeight = Object.values(COLLECTOR_WEIGHTS).reduce((a, b) => a + b, 0);
  for (const [name, weight] of Object.entries(COLLECTOR_WEIGHTS)) {
    if (results[name]) {
      weightedSum += results[name].score * weight;
    }
    // errors and missing collectors contribute 0 (already the default)
  }
  const domainScore = Math.round((weightedSum / (totalWeight * 5)) * 5 * 10) / 10;

  logger.info({ event: 'assessment_done', domain: 'entraId', tenantId, domainScore });

  return {
    domain: 'entraId',
    tenantId,
    assessedAt: new Date().toISOString(),
    domainScore,
    collectors: results,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

module.exports = { runEntraIdAssessment };
