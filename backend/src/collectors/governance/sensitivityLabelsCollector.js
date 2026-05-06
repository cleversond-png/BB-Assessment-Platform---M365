const { graphGetAll } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: InformationProtectionPolicy.Read.All
// Lists tenant sensitivity labels and infers classification maturity.
// A flat, small label set = low maturity. Hierarchical + auto-labeling = high maturity.

async function collectSensitivityLabels(tenantId) {
  logger.info({ event: 'collector_start', collector: 'sensitivityLabels', tenantId });

  let labels;
  try {
    // /informationProtection/policy/labels is the app-only endpoint for sensitivity labels.
    // /informationProtection/sensitivityLabels requires delegated (user) context.
    const data = await graphGetAll(tenantId, '/informationProtection/policy/labels', {});
    labels = Array.isArray(data) ? data : (data?.value ?? []);
  } catch (err) {
    const status = err.response?.status;
    if (status === 403 || status === 404 || status === 400) {
      logger.warn({ event: 'collector_unavailable', collector: 'sensitivityLabels', tenantId });
      return {
        collector: 'sensitivityLabels',
        score: 0,
        unavailable: true,
        reason: 'InformationProtectionPolicy.Read.All required, or tenant has no Purview licensing.',
      };
    }
    throw err;
  }

  const totalLabels = labels.length;

  if (totalLabels === 0) {
    logger.info({ event: 'collector_done', collector: 'sensitivityLabels', tenantId, totalLabels: 0, score: 0 });
    return {
      collector: 'sensitivityLabels',
      score: 0,
      summary: {
        totalLabels: 0,
        parentLabelCount: 0,
        sublabelCount: 0,
        hasAutoLabeling: false,
        message: 'No sensitivity labels configured.',
      },
      labels: [],
    };
  }

  const parentLabels = labels.filter((l) => !l.parent);
  const sublabels = labels.filter((l) => !!l.parent);
  const hasAutoLabeling = labels.some(
    (l) => l.autoLabeling?.sensitiveInformationTypes?.length > 0
  );

  // Score reflects structural maturity:
  // 0 = no labels, 1 = 1-2 flat, 2 = 3-5 flat, 3 = hierarchy no auto, 4 = hierarchy + auto
  let score;
  if (totalLabels <= 2 && sublabels.length === 0) score = 1;
  else if (totalLabels <= 5 && sublabels.length === 0) score = 2;
  else if (sublabels.length > 0 && !hasAutoLabeling) score = 3;
  else if (sublabels.length > 0 && hasAutoLabeling) score = 4;
  else score = 2;

  logger.info({
    event: 'collector_done', collector: 'sensitivityLabels', tenantId,
    totalLabels, parentLabelCount: parentLabels.length,
    sublabelCount: sublabels.length, hasAutoLabeling, score,
  });

  return {
    collector: 'sensitivityLabels',
    score,
    summary: {
      totalLabels,
      parentLabelCount: parentLabels.length,
      sublabelCount: sublabels.length,
      hasAutoLabeling,
    },
    labels: labels.slice(0, 30).map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      color: l.color,
      sensitivity: l.sensitivity,
      parentId: l.parent?.id ?? null,
      isActive: l.isActive ?? true,
    })),
  };
}

module.exports = { collectSensitivityLabels };
