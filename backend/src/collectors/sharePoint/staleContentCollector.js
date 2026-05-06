const { graphGetAll } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: Sites.Read.All
// A site is considered stale if its lastModifiedDateTime > 180 days ago.
// lastModifiedDateTime on a site is updated when files inside are modified,
// making it a reliable proxy for "no one has touched this site recently."
const STALE_DAYS = 180;

async function collectStaleContent(tenantId) {
  logger.info({ event: 'collector_start', collector: 'staleContent', tenantId });

  let sites;
  try {
    sites = await graphGetAll(tenantId, '/sites', {
      search: '*',
      $select: 'id,displayName,webUrl,lastModifiedDateTime,createdDateTime',
    });
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 404) {
      logger.warn({ event: 'collector_unavailable', collector: 'staleContent', tenantId });
      return {
        collector: 'staleContent',
        score: 0,
        unavailable: true,
        reason: 'Sites.Read.All required.',
      };
    }
    throw err;
  }

  const now = Date.now();
  const staleCutoffMs = STALE_DAYS * 24 * 60 * 60 * 1000;

  const staleSites = [];
  const activeSites = [];

  for (const site of sites) {
    const lastMod = site.lastModifiedDateTime
      ? new Date(site.lastModifiedDateTime).getTime()
      : 0;
    const isStale = !lastMod || now - lastMod > staleCutoffMs;
    const daysSinceActivity = lastMod
      ? Math.floor((now - lastMod) / (24 * 60 * 60 * 1000))
      : null;

    if (isStale) {
      staleSites.push({
        displayName: site.displayName,
        webUrl: site.webUrl,
        lastModifiedDateTime: site.lastModifiedDateTime || null,
        daysSinceActivity,
        createdDateTime: site.createdDateTime,
      });
    } else {
      activeSites.push(site);
    }
  }

  const total = sites.length;
  const staleRatio = total > 0 ? staleSites.length / total : 0;

  // Sort stale sites: longest inactive first
  staleSites.sort((a, b) => (b.daysSinceActivity ?? 99999) - (a.daysSinceActivity ?? 99999));

  const score =
    total === 0 ? 5 :
    staleRatio <= 0.05 ? 5 :
    staleRatio <= 0.15 ? 4 :
    staleRatio <= 0.30 ? 3 :
    staleRatio <= 0.50 ? 2 :
    staleRatio <= 0.70 ? 1 : 0;

  logger.info({
    event: 'collector_done', collector: 'staleContent', tenantId,
    total, staleCount: staleSites.length, score,
  });

  return {
    collector: 'staleContent',
    score,
    summary: {
      totalSites: total,
      staleSiteCount: staleSites.length,
      activeSiteCount: activeSites.length,
      staleRatioPercent: Math.round(staleRatio * 100),
      stalePeriodDays: STALE_DAYS,
    },
    staleSites: staleSites.slice(0, 20),
  };
}

module.exports = { collectStaleContent };
