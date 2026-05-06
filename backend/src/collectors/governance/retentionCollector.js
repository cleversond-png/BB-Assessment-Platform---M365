const { graphGetBeta } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: RecordsManagement.Read.All (Application)
// Lists retention labels from Microsoft Purview compliance API (beta).
// Retention labels define how long content is kept and whether deletion is blocked.

async function collectRetention(tenantId) {
  logger.info({ event: 'collector_start', collector: 'retention', tenantId });

  let labels;
  try {
    const data = await graphGetBeta(
      tenantId,
      '/security/informationProtection/retentionLabels'
    );
    labels = data.value ?? [];
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 404) {
      logger.warn({ event: 'collector_unavailable', collector: 'retention', tenantId });
      return {
        collector: 'retention',
        score: 0,
        unavailable: true,
        reason: 'RecordsManagement.Read.All required for retention label enumeration.',
      };
    }
    throw err;
  }

  const totalLabels = labels.length;

  // Separate labels that block deletion (records) from advisory ones
  const recordLabels = labels.filter(
    (l) => l.retentionTrigger === 'dateLabeled' || l.isRecordLabel === true || l.behaviorDuringRetentionPeriod === 'retainAsRecord'
  );
  const publishedLabels = labels.filter((l) => l.isInUse === true);

  let score;
  if (totalLabels === 0) score = 0;
  else if (totalLabels <= 2 && recordLabels.length === 0) score = 1;
  else if (totalLabels <= 5 && recordLabels.length === 0) score = 2;
  else if (totalLabels > 0 && recordLabels.length > 0 && publishedLabels.length === 0) score = 3;
  else if (recordLabels.length > 0 && publishedLabels.length > 0) score = 4;
  else score = 2;

  logger.info({
    event: 'collector_done', collector: 'retention', tenantId,
    totalLabels, recordLabels: recordLabels.length, publishedLabels: publishedLabels.length, score,
  });

  return {
    collector: 'retention',
    score,
    summary: {
      totalLabels,
      recordLabelCount: recordLabels.length,
      publishedLabelCount: publishedLabels.length,
    },
    labels: labels.slice(0, 20).map((l) => ({
      id: l.id,
      displayName: l.displayName,
      retentionDuration: l.retentionDuration,
      retentionTrigger: l.retentionTrigger,
      isRecordLabel: l.isRecordLabel ?? false,
      isInUse: l.isInUse ?? false,
    })),
  };
}

module.exports = { collectRetention };
