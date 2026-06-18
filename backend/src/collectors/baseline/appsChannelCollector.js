const { graphGet } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: Reports.Read.All
// Fetches M365 App user detail report to assess desktop client deployment breadth.
// Copilot for M365 requires Current Channel or Monthly Enterprise Channel on desktop.
// Semi-Annual Channel users cannot see the Copilot button in Office apps at all.
// Note: exact update channel detection requires Intune data — this collector reports
// desktop vs web usage as a deployment proxy and flags the manual verification need.

function parseCsvHeaders(line) {
  return line.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
}

function parseCsvRow(headers, line) {
  const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
  const row = {};
  headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
  return row;
}

function isTrue(v) { return v === 'True' || v === 'Yes' || v === 'true' || v === '1'; }

async function collectAppsChannel(tenantId, licensingResult = null) {
  logger.info({ event: 'collector_start', collector: 'appsChannel', tenantId });

  let csv;
  try {
    csv = await graphGet(tenantId, "/reports/getM365AppUserDetail(period='D30')");
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 404) {
      logger.warn({ event: 'collector_unavailable', collector: 'appsChannel', tenantId });
      return {
        collector: 'appsChannel',
        score: null,
        unavailable: true,
        reason: 'Reports.Read.All required for M365 Apps deployment data.',
      };
    }
    throw err;
  }

  if (typeof csv !== 'string' || csv.length < 10) {
    return {
      collector: 'appsChannel',
      score: null,
      unavailable: true,
      reason: 'Resposta inesperada do endpoint de relatório de apps.',
    };
  }

  const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return {
      collector: 'appsChannel',
      score: null,
      unavailable: true,
      reason: 'CSV de apps vazio ou inválido.',
    };
  }

  const headers = parseCsvHeaders(lines[0]);
  const users = lines.slice(1).map((l) => parseCsvRow(headers, l)).filter((r) => r['User Principal Name']);

  const totalUsers = users.length;
  if (totalUsers === 0) {
    const eligibleLicenseUsers = licensingResult?.summary?.desktopAppsEligibleAssigned ?? 0;
    return {
      collector: 'appsChannel',
      score: eligibleLicenseUsers > 0 ? 1 : 3,
      summary: {
        totalUsers: 0,
        eligibleLicenseUsers,
        windowsUsersCount: 0,
        macUsersCount: 0,
        desktopUsersCount: 0,
        webOnlyUsersCount: 0,
        desktopPercent: 0,
        denominatorSource: eligibleLicenseUsers > 0 ? 'desktopAppsEligibleLicenses' : 'reportUsers',
        channelDetectable: false,
      },
    };
  }

  const windowsUsers = users.filter((u) => isTrue(u['Windows'])).length;
  const macUsers     = users.filter((u) => isTrue(u['Mac'])).length;
  const desktopUsers = windowsUsers + macUsers;
  const webOnlyUsers = users.filter((u) =>
    isTrue(u['Web']) && !isTrue(u['Windows']) && !isTrue(u['Mac'])
  ).length;

  const eligibleLicenseUsers = licensingResult?.summary?.desktopAppsEligibleAssigned ?? 0;
  const denominator = eligibleLicenseUsers > 0 ? eligibleLicenseUsers : totalUsers;
  const denominatorSource = eligibleLicenseUsers > 0 ? 'desktopAppsEligibleLicenses' : 'reportUsers';
  const desktopPercent = denominator > 0 ? Math.min(100, Math.round((desktopUsers / denominator) * 100)) : 0;
  const windowsPercent = denominator > 0 ? Math.min(100, Math.round((windowsUsers / denominator) * 100)) : 0;

  // Proxy score: Copilot requires desktop client — low desktop deployment is a blocker.
  // Channel-level detection requires Intune; surfaced as an action item in the summary.
  const score =
    desktopPercent >= 80 ? 4 :
    desktopPercent >= 60 ? 3 :
    desktopPercent >= 40 ? 2 : 1;

  logger.info({
    event: 'collector_done', collector: 'appsChannel', tenantId,
    totalUsers, windowsUsers, macUsers, desktopPercent, score,
  });

  return {
    collector: 'appsChannel',
    score,
    summary: {
      totalUsers,
      eligibleLicenseUsers,
      windowsUsersCount: windowsUsers,
      macUsersCount: macUsers,
      desktopUsersCount: desktopUsers,
      webOnlyUsersCount: webOnlyUsers,
      windowsPercent,
      desktopPercent,
      denominatorSource,
      channelDetectable: false,
      channelNote: 'Verificar canal de atualização (Current vs Semi-Annual) no Intune > Devices > Monitor > App install status.',
    },
  };
}

module.exports = { collectAppsChannel };
