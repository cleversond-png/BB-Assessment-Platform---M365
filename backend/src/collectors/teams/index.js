const { collectTeamsExternalAccess } = require('./teamsExternalAccessCollector');
const { collectTeamsSettings } = require('./teamsSettingsCollector');
const logger = require('../../logger');

const COLLECTOR_WEIGHTS = { teamsExternalAccess: 2, teamsSettings: 1 };

async function runTeamsAssessment(tenantId) {
  logger.info({ event: 'assessment_start', domain: 'teams', tenantId });

  const collectors = [
    { name: 'teamsExternalAccess', fn: () => collectTeamsExternalAccess(tenantId) },
    { name: 'teamsSettings',       fn: () => collectTeamsSettings(tenantId) },
  ];

  const results = {};
  const errors = {};

  await Promise.allSettled(collectors.map(async ({ name, fn }) => {
    try {
      results[name] = await fn();
    } catch (err) {
      logger.error({ event: 'collector_error', collector: name, tenantId, error: err.message });
      errors[name] = err.response?.data?.error?.message || err.message;
    }
  }));

  // Scoring: unavailable collectors degradam o score (penalidade implícita)
  let weightedSum = 0;
  const totalWeight = Object.values(COLLECTOR_WEIGHTS).reduce((a, b) => a + b, 0);
  for (const [name, weight] of Object.entries(COLLECTOR_WEIGHTS)) {
    if (results[name]) {
      weightedSum += results[name].score * weight;
    }
    // collectors ausentes ou com erro contribuem 0
  }
  const domainScore = Math.round((weightedSum / (totalWeight * 5)) * 5 * 10) / 10;

  logger.info({ event: 'assessment_done', domain: 'teams', tenantId, domainScore });

  return {
    domain: 'teams',
    tenantId,
    assessedAt: new Date().toISOString(),
    domainScore,
    collectors: results,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

module.exports = { runTeamsAssessment };
