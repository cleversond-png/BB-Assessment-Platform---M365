const { collectTenantInfo } = require('./tenantInfoCollector');
const { collectLicensing } = require('./licensingCollector');
const { collectUsersBaseline } = require('./usersBaselineCollector');
const { collectUsage } = require('./usageCollector');
const { collectAppsChannel } = require('./appsChannelCollector');
const logger = require('../../logger');

const COLLECTOR_WEIGHTS = { licensing: 3, users: 3, usage: 2, appsChannel: 2 };
const MAX_WEIGHT = Object.values(COLLECTOR_WEIGHTS).reduce((a, b) => a + b, 0);

async function runBaselineAssessment(tenantId) {
  logger.info({ event: 'assessment_start', domain: 'baseline', tenantId });

  function safeCollect(name, fn) {
    return fn().then(result => ({ name, result })).catch(err => ({ name, error: err?.message || String(err) }));
  }

  // tenantInfo runs independently — it's metadata, not scored
  const [tenantInfoResult, scoredResults] = await Promise.allSettled([
    collectTenantInfo(tenantId),
    Promise.all([
      safeCollect('licensing',   () => collectLicensing(tenantId)),
      safeCollect('users',       () => collectUsersBaseline(tenantId)),
      safeCollect('usage',       () => collectUsage(tenantId)),
      safeCollect('appsChannel', () => collectAppsChannel(tenantId)),
    ]),
  ]);

  const collectors = {};
  const errors = {};

  if (tenantInfoResult.status === 'fulfilled') {
    collectors.tenantInfo = tenantInfoResult.value;
  } else {
    errors.tenantInfo = tenantInfoResult.reason?.message;
  }

  if (scoredResults.status === 'fulfilled') {
    for (const { name, result, error } of scoredResults.value) {
      if (error) {
        errors[name] = error;
        collectors[name] = { score: null, unavailable: true, reason: error };
        logger.warn({ event: 'collector_error', collector: name, domain: 'baseline', tenantId, error });
      } else {
        collectors[name] = result;
      }
    }
  }

  // Weighted domain score — only from collectors that succeeded
  let weightedSum = 0;
  let usedWeight = 0;
  for (const [name, weight] of Object.entries(COLLECTOR_WEIGHTS)) {
    if (collectors[name]?.score != null) {
      weightedSum += collectors[name].score * weight;
      usedWeight += weight;
    }
  }
  const domainScore = usedWeight > 0
    ? Math.round((weightedSum / usedWeight) * 10) / 10
    : null;

  const entraIdTier = collectors.licensing?.entraIdTier || null;

  logger.info({ event: 'assessment_done', domain: 'baseline', tenantId, domainScore, entraIdTier });

  return {
    domain: 'baseline',
    tenantId,
    assessedAt: new Date().toISOString(),
    domainScore,
    entraIdTier,
    collectors,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

module.exports = { runBaselineAssessment };
