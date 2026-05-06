const { collectSensitivityLabels } = require('./sensitivityLabelsCollector');
const { collectAudit } = require('./auditCollector');
const logger = require('../../logger');

// Graph API limitation: DLP and Retention policies are not exposed via
// Application permissions — only via Security & Compliance PowerShell or Purview portal.
// Collectors and required permissions:
//   sensitivityLabels → InformationProtectionPolicy.Read.All (already granted)
//   audit             → AuditLog.Read.All
const COLLECTOR_WEIGHTS = {
  sensitivityLabels: 6,
  audit: 4,
};
const TOTAL_WEIGHT = Object.values(COLLECTOR_WEIGHTS).reduce((a, b) => a + b, 0); // 10

async function runGovernanceAssessment(tenantId) {
  logger.info({ event: 'assessment_start', domain: 'governance', tenantId });

  const collectors = [
    { name: 'sensitivityLabels', fn: () => collectSensitivityLabels(tenantId) },
    { name: 'audit',             fn: () => collectAudit(tenantId) },
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

  let weightedSum = 0;
  for (const [name, weight] of Object.entries(COLLECTOR_WEIGHTS)) {
    const r = results[name];
    if (r && typeof r.score === 'number' && !r.unavailable) {
      weightedSum += r.score * weight;
    }
  }
  const domainScore = Math.round((weightedSum / (TOTAL_WEIGHT * 5)) * 5 * 10) / 10;

  logger.info({ event: 'assessment_done', domain: 'governance', tenantId, domainScore });

  return {
    domain: 'governance',
    tenantId,
    assessedAt: new Date().toISOString(),
    domainScore,
    collectors: results,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

module.exports = { runGovernanceAssessment };
