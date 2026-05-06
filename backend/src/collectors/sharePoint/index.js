const { collectPermissions } = require('./permissionsCollector');
const { collectOwnership } = require('./ownershipCollector');
const { collectStaleContent } = require('./staleContentCollector');
const { collectFiles } = require('./filesCollector');
const { collectStorage } = require('./storageCollector');
const logger = require('../../logger');

// Weights must sum to a fixed total so unavailable collectors pull the domain score down.
const COLLECTOR_WEIGHTS = {
  permissions: 3, // external sharing risk is highest impact
  ownership: 3,   // governance foundation — sites without active owners
  staleContent: 2, // data hygiene — inactive sites
  files: 2,        // large files, duplicates, stale files
  storage: 2,      // per-site concentration and capacity
};
const TOTAL_WEIGHT = Object.values(COLLECTOR_WEIGHTS).reduce((a, b) => a + b, 0); // 12

async function runSharePointAssessment(tenantId) {
  logger.info({ event: 'assessment_start', domain: 'sharePoint', tenantId });

  const collectors = [
    { name: 'permissions', fn: () => collectPermissions(tenantId) },
    { name: 'ownership', fn: () => collectOwnership(tenantId) },
    { name: 'staleContent', fn: () => collectStaleContent(tenantId) },
    { name: 'files', fn: () => collectFiles(tenantId) },
    { name: 'storage', fn: () => collectStorage(tenantId) },
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

  // Weighted score: unavailable/errored collectors contribute 0 (denominator is always TOTAL_WEIGHT)
  let weightedSum = 0;
  for (const [name, weight] of Object.entries(COLLECTOR_WEIGHTS)) {
    const r = results[name];
    if (r && typeof r.score === 'number' && !r.unavailable) {
      weightedSum += r.score * weight;
    }
  }
  const domainScore = Math.round((weightedSum / (TOTAL_WEIGHT * 5)) * 5 * 10) / 10;

  logger.info({ event: 'assessment_done', domain: 'sharePoint', tenantId, domainScore });

  return {
    domain: 'sharePoint',
    tenantId,
    assessedAt: new Date().toISOString(),
    domainScore,
    collectors: results,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

module.exports = { runSharePointAssessment };
