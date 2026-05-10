const { graphGet } = require('../../graph/graphClient');
const logger = require('../../logger');

// DLP policy configuration (Get-DlpCompliancePolicy) is NOT exposed via Graph API.
// Proxy approach: check /security/alerts_v2 for recent DLP alerts.
// If DLP alerts exist → policies are configured and actively monitoring.
// Requires: SecurityAlert.Read.All (Application).
// Copilot-specific workload coverage still cannot be confirmed remotely.

const ALERT_WINDOW_DAYS = 30;

async function collectDlp(tenantId) {
  logger.info({ event: 'collector_start', collector: 'dlp', tenantId });

  let dlpAlerts = [];
  let permissionMissing = false;

  try {
    const since = new Date(Date.now() - ALERT_WINDOW_DAYS * 86400_000).toISOString();
    const res = await graphGet(tenantId, '/security/alerts_v2', {
      $filter: `category eq 'DataLossPrevention' and createdDateTime ge ${since}`,
      $top: '25',
      $select: 'id,title,severity,status,createdDateTime',
    });
    dlpAlerts = res.value || [];
  } catch (err) {
    const status = err?.response?.status ?? err?.statusCode;
    if (status === 403 || status === 401) {
      permissionMissing = true;
    } else {
      logger.warn({ event: 'dlp_alerts_fetch_failed', tenantId, error: err.message });
      permissionMissing = true;
    }
  }

  if (permissionMissing) {
    logger.info({ event: 'collector_unavailable', collector: 'dlp', tenantId, reason: 'SecurityAlert.Read.All ausente' });
    return {
      collector: 'dlp',
      score: 0,
      unavailable: true,
      proxy: true,
      reason: 'Permissão SecurityAlert.Read.All ausente — DLP inferido por alertas não disponível. Verificação manual via Microsoft Purview.',
    };
  }

  const alertCount = dlpAlerts.length;
  const activeAlerts = dlpAlerts.filter((a) => a.status !== 'resolved').length;
  const hasActivePolicy = alertCount > 0;

  // score 3 = DLP evidenciado por alertas recentes (proxy positivo)
  // score 1 = sem alertas no período (DLP pode estar inativo ou sem violações)
  const score = hasActivePolicy ? 3 : 1;

  logger.info({ event: 'collector_done', collector: 'dlp', tenantId, alertCount, activeAlerts, score });

  return {
    collector: 'dlp',
    score,
    proxy: true,
    summary: {
      alertsInPeriod: alertCount,
      activeAlerts,
      periodDays: ALERT_WINDOW_DAYS,
      copilotDlpPoliciesCount: null,
    },
  };
}

module.exports = { collectDlp };
