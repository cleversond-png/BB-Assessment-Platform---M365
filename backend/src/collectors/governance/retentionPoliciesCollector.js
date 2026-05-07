const { graphGetBeta } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: RecordsManagement.Read.All (Application)
// Distinct from retentionCollector.js which reads retention *labels* (applied to content).
// This collector reads retention *policies* — auto-applied to entire workloads.
// Teams and Exchange policies are critical for Copilot: without them, the AI draws on
// stale or irrelevant context, and compliance audits cannot rely on message history.

const TEAMS_WORKLOADS  = new Set(['teamsChannelMessages', 'teamsChatMessages', 'teams']);
const EXCHANGE_WORKLOADS = new Set(['exchangeEmail', 'exchange']);

function extractWorkloads(policy) {
  const w = policy.workload;
  if (!w) return [];
  if (Array.isArray(w)) return w;
  return String(w).split(',').map((s) => s.trim()).filter(Boolean);
}

async function collectRetentionPolicies(tenantId) {
  logger.info({ event: 'collector_start', collector: 'retentionPolicies', tenantId });

  let policies;
  try {
    const data = await graphGetBeta(tenantId, '/security/informationProtection/retentionPolicies');
    policies = data.value ?? [];
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 404) {
      logger.warn({ event: 'collector_unavailable', collector: 'retentionPolicies', tenantId });
      return {
        collector: 'retentionPolicies',
        score: 0,
        unavailable: true,
        reason: 'RecordsManagement.Read.All required for retention policy enumeration.',
      };
    }
    throw err;
  }

  const teamsChannelPolicies = policies.filter((p) => extractWorkloads(p).some((w) => TEAMS_WORKLOADS.has(w)));
  const exchangePolicies     = policies.filter((p) => extractWorkloads(p).some((w) => EXCHANGE_WORKLOADS.has(w)));

  const teamsRetentionConfigured    = teamsChannelPolicies.length > 0;
  const exchangeRetentionConfigured = exchangePolicies.length > 0;

  let score = 5;
  if (!teamsRetentionConfigured) score -= 2;
  if (!exchangeRetentionConfigured) score -= 3;
  score = Math.max(score, 0);

  logger.info({
    event: 'collector_done', collector: 'retentionPolicies', tenantId,
    totalPolicies: policies.length, teamsRetentionConfigured, exchangeRetentionConfigured, score,
  });

  return {
    collector: 'retentionPolicies',
    score,
    summary: {
      totalPolicies: policies.length,
      teamsRetentionConfigured,
      exchangeRetentionConfigured,
      teamsPoliciesCount: teamsChannelPolicies.length,
      exchangePoliciesCount: exchangePolicies.length,
    },
    policies: policies.slice(0, 20).map((p) => ({
      id: p.id,
      name: p.name ?? p.displayName,
      workload: extractWorkloads(p),
      status: p.status ?? p.isEnabled,
    })),
  };
}

module.exports = { collectRetentionPolicies };
