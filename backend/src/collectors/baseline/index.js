const { collectTenantInfo } = require('./tenantInfoCollector');
const { collectLicensing } = require('./licensingCollector');
const { collectUsersBaseline } = require('./usersBaselineCollector');
const { collectUsage } = require('./usageCollector');
const logger = require('../../logger');

const COLLECTOR_WEIGHTS = { licensing: 3, users: 3, usage: 2 };
const MAX_WEIGHT = Object.values(COLLECTOR_WEIGHTS).reduce((a, b) => a + b, 0);

async function runBaselineAssessment(tenantId) {
  logger.info({ event: 'assessment_start', domain: 'baseline', tenantId });

  // tenantInfo runs independently — it's metadata, not scored
  const [tenantInfoResult, scoredResults] = await Promise.allSettled([
    collectTenantInfo(tenantId),
    Promise.allSettled([
      collectLicensing(tenantId).then((r) => ({ name: 'licensing', result: r })),
      collectUsersBaseline(tenantId).then((r) => ({ name: 'users', result: r })),
      collectUsage(tenantId).then((r) => ({ name: 'usage', result: r })),
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
    for (const settled of scoredResults.value) {
      if (settled.status === 'fulfilled') {
        const { name, result } = settled.value;
        collectors[name] = result;
      } else {
        const err = settled.reason;
        const name = err?.collectorName || 'unknown';
        errors[name] = err?.message;
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
