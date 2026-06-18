const { graphGet } = require('../../graph/graphClient');
const logger = require('../../logger');

const PERIOD_DAYS = 7;

function formatLocation(location = {}) {
  return [location.city, location.state, location.countryOrRegion]
    .filter(Boolean)
    .join(', ');
}

function riskWeight(level) {
  if (level === 'high') return 3;
  if (level === 'medium') return 2;
  if (level === 'low') return 1;
  return 0;
}

async function collectRiskySignIns(tenantId) {
  logger.info({ event: 'collector_start', collector: 'riskySignIns', tenantId });

  const since = new Date(Date.now() - PERIOD_DAYS * 86400_000).toISOString();
  let data;

  try {
    data = await graphGet(tenantId, '/identityProtection/riskDetections', {
      $filter: `(riskState eq 'atRisk' or riskState eq 'confirmedCompromised') and activityDateTime ge ${since}`,
      $select: 'id,requestId,correlationId,riskEventType,riskState,riskLevel,riskDetail,detectionTimingType,activity,ipAddress,location,activityDateTime,detectedDateTime,userDisplayName,userPrincipalName',
      $top: 500,
    });
  } catch (err) {
    const status = err.response?.status || err.statusCode;
    if (status === 403 || status === 404) {
      return {
        collector: 'riskySignIns',
        score: 0,
        unavailable: true,
        reason: 'IdentityRiskEvent.Read.All necessario (Entra ID P1/P2).',
      };
    }
    throw err;
  }

  const detections = (data.value || [])
    .filter((d) => !d.activity || d.activity === 'signin')
    .sort((a, b) => new Date(b.activityDateTime || b.detectedDateTime || 0) - new Date(a.activityDateTime || a.detectedDateTime || 0));

  const byLevel = { high: 0, medium: 0, low: 0, hidden: 0, none: 0, unknown: 0 };
  const byState = { atRisk: 0, confirmedCompromised: 0 };
  const uniqueUsers = new Set();
  const uniqueIps = new Set();

  for (const d of detections) {
    if (byLevel[d.riskLevel] !== undefined) byLevel[d.riskLevel]++;
    else byLevel.unknown++;
    if (byState[d.riskState] !== undefined) byState[d.riskState]++;
    if (d.userPrincipalName) uniqueUsers.add(d.userPrincipalName);
    if (d.ipAddress) uniqueIps.add(d.ipAddress);
  }

  const total = detections.length;
  const score =
    total === 0 ? 5 :
    byState.confirmedCompromised > 0 || byLevel.high >= 3 ? 1 :
    byLevel.high > 0 || total >= 20 ? 2 :
    byLevel.medium > 0 || total >= 5 ? 3 : 4;

  const topDetections = detections
    .map((d) => ({
      id: d.id,
      activityDateTime: d.activityDateTime,
      detectedDateTime: d.detectedDateTime,
      userDisplayName: d.userDisplayName,
      userPrincipalName: d.userPrincipalName,
      ipAddress: d.ipAddress,
      location: formatLocation(d.location),
      riskLevel: d.riskLevel,
      riskState: d.riskState,
      riskEventType: d.riskEventType,
      riskDetail: d.riskDetail,
      detectionTimingType: d.detectionTimingType,
    }))
    .sort((a, b) => {
      const weightDelta = riskWeight(b.riskLevel) - riskWeight(a.riskLevel);
      if (weightDelta !== 0) return weightDelta;
      return new Date(b.activityDateTime || b.detectedDateTime || 0) - new Date(a.activityDateTime || a.detectedDateTime || 0);
    })
    .slice(0, 20);

  logger.info({
    event: 'collector_done',
    collector: 'riskySignIns',
    tenantId,
    total,
    uniqueUsers: uniqueUsers.size,
    score,
  });

  return {
    collector: 'riskySignIns',
    score,
    summary: {
      total,
      highRisk: byLevel.high,
      mediumRisk: byLevel.medium,
      lowRisk: byLevel.low,
      confirmedCompromised: byState.confirmedCompromised,
      distinctUsers: uniqueUsers.size,
      distinctIps: uniqueIps.size,
      periodDays: PERIOD_DAYS,
      topCount: topDetections.length,
    },
    riskySignIns: topDetections,
  };
}

module.exports = { collectRiskySignIns };
