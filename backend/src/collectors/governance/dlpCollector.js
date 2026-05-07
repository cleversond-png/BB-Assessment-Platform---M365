const { graphGetBeta } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: DataLossPreventionPolicy.Read.All (Application)
// Lists DLP policies from the M365 Security/Compliance API (beta).
// Checks whether policies exist and how many are actively enforcing rules.

async function collectDlp(tenantId) {
  logger.info({ event: 'collector_start', collector: 'dlp', tenantId });

  let policies;
  try {
    const data = await graphGetBeta(
      tenantId,
      '/security/informationProtection/dataLossPreventionPolicies'
    );
    policies = data.value ?? [];
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 404) {
      logger.warn({ event: 'collector_unavailable', collector: 'dlp', tenantId });
      return {
        collector: 'dlp',
        score: 0,
        unavailable: true,
        reason: 'DataLossPreventionPolicy.Read.All required for DLP policy enumeration.',
      };
    }
    throw err;
  }

  const totalPolicies = policies.length;
  const enabledPolicies = policies.filter(
    (p) => p.state === 'enabled' || p.mode === 'enabled' || p.isEnabled === true
  );

  // Copilot for M365 requires an explicit DLP workload — generic Exchange/SharePoint
  // policies do NOT automatically cover Copilot interactions.
  function policyCoversWorkload(p, workload) {
    const w = p.workload;
    if (!w) return false;
    const list = Array.isArray(w) ? w : String(w).split(',').map((s) => s.trim());
    return list.some((item) => item.toLowerCase().includes(workload.toLowerCase()));
  }

  const copilotPolicies = enabledPolicies.filter(
    (p) => policyCoversWorkload(p, 'CopilotForMicrosoft365') || policyCoversWorkload(p, 'Copilot') || policyCoversWorkload(p, 'AIApps')
  );

  let score;
  if (totalPolicies === 0) score = 0;
  else if (enabledPolicies.length === 0) score = 1;
  else if (enabledPolicies.length === 1) score = 2;
  else if (enabledPolicies.length <= 3) score = 3;
  else if (enabledPolicies.length <= 5) score = 4;
  else score = 5;

  logger.info({
    event: 'collector_done', collector: 'dlp', tenantId,
    totalPolicies, enabledCount: enabledPolicies.length, copilotDlpCount: copilotPolicies.length, score,
  });

  return {
    collector: 'dlp',
    score,
    summary: {
      totalPolicies,
      enabledPoliciesCount: enabledPolicies.length,
      copilotDlpPoliciesCount: copilotPolicies.length,
    },
    policies: policies.slice(0, 20).map((p) => ({
      id: p.id,
      name: p.name ?? p.displayName,
      state: p.state ?? p.mode,
      workload: p.workload,
      createdDateTime: p.createdDateTime,
    })),
  };
}

module.exports = { collectDlp };
