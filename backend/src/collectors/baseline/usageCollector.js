const { graphGet } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: Reports.Read.All
// Calls getOffice365ServicesUserCounts(period='D30') — returns CSV with Active+Inactive
// per service, enabling per-service adoption rates without a second data source.

function parseServiceUserCountsCsv(csv) {
  const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map((h) => h.trim());
  const values = lines[lines.length - 1].split(',').map((v) => v.trim());
  const row = {};
  headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
  function n(key) { const v = parseInt(row[key], 10); return isNaN(v) ? 0 : v; }
  return {
    reportDate: row['Report Refresh Date'] || null,
    exchange:   { active: n('Exchange Active'),       inactive: n('Exchange Inactive') },
    oneDrive:   { active: n('OneDrive Active'),       inactive: n('OneDrive Inactive') },
    sharePoint: { active: n('SharePoint Active'),     inactive: n('SharePoint Inactive') },
    teams:      { active: n('Teams Active'),           inactive: n('Teams Inactive') },
    m365:       { active: n('Microsoft 365 Active'),  inactive: n('Microsoft 365 Inactive') },
  };
}

async function collectUsage(tenantId) {
  logger.info({ event: 'collector_start', collector: 'usage', tenantId });

  let csv;
  try {
    csv = await graphGet(tenantId, "/reports/getOffice365ServicesUserCounts(period='D30')");
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 404) {
      logger.warn({ event: 'collector_unavailable', collector: 'usage', tenantId });
      return {
        collector: 'usage',
        score: null,
        unavailable: true,
        reason: 'Reports.Read.All necessário para dados de adoção.',
      };
    }
    throw err;
  }

  // Guard against JSON error bodies returned instead of CSV
  if (typeof csv !== 'string' || csv.length < 10) {
    logger.warn({ event: 'collector_unavailable', collector: 'usage', tenantId, reason: 'non-csv response' });
    return {
      collector: 'usage',
      score: null,
      unavailable: true,
      reason: 'Resposta inesperada do endpoint de relatório de adoção.',
    };
  }

  const parsed = parseServiceUserCountsCsv(csv);
  if (!parsed) {
    return {
      collector: 'usage',
      score: null,
      unavailable: true,
      reason: 'Não foi possível interpretar o CSV do relatório de adoção.',
    };
  }

  const m365Total = parsed.m365.active + parsed.m365.inactive;
  const hasServiceData = parsed.exchange.active + parsed.teams.active +
    parsed.sharePoint.active + parsed.oneDrive.active > 0;

  let adoptionPercent;
  let m365MetricUnavailable = false;

  if (m365Total > 0) {
    adoptionPercent = Math.round((parsed.m365.active / m365Total) * 100);
  } else if (hasServiceData) {
    // Coluna "Microsoft 365" vazia (comum em tenants business/SMB) — usar média
    // de adoção por serviço como proxy. Marcado com m365MetricUnavailable para
    // o frontend exibir a origem do dado.
    const serviceRates = [parsed.exchange, parsed.teams, parsed.sharePoint, parsed.oneDrive]
      .map(svc => { const t = svc.active + svc.inactive; return t > 0 ? svc.active / t : null; })
      .filter(r => r !== null);
    adoptionPercent = serviceRates.length > 0
      ? Math.round(serviceRates.reduce((a, b) => a + b) / serviceRates.length * 100)
      : null;
    m365MetricUnavailable = true;
  } else {
    adoptionPercent = null;
  }

  const score = adoptionPercent == null
    ? null
    : adoptionPercent >= 80 ? 5
    : adoptionPercent >= 65 ? 4
    : adoptionPercent >= 50 ? 3
    : adoptionPercent >= 35 ? 2 : 1;

  function svcAdoption(svc) {
    const t = svc.active + svc.inactive;
    return t > 0 ? Math.round((svc.active / t) * 100) : null;
  }

  logger.info({ event: 'collector_done', collector: 'usage', tenantId, adoptionPercent, score, m365Total });

  return {
    collector: 'usage',
    score,
    summary: {
      reportDate: parsed.reportDate,
      m365Active: m365Total > 0 ? parsed.m365.active : null,
      m365Total: m365Total > 0 ? m365Total : null,
      adoptionPercent,
      m365MetricUnavailable: m365MetricUnavailable || undefined,
      services: {
        exchange:   { active: parsed.exchange.active,   adoptionPercent: svcAdoption(parsed.exchange) },
        teams:      { active: parsed.teams.active,      adoptionPercent: svcAdoption(parsed.teams) },
        sharePoint: { active: parsed.sharePoint.active, adoptionPercent: svcAdoption(parsed.sharePoint) },
        oneDrive:   { active: parsed.oneDrive.active,   adoptionPercent: svcAdoption(parsed.oneDrive) },
      },
    },
  };
}

module.exports = { collectUsage };
