const { graphGetAll, graphGet } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: Sites.Read.All
// Collects per-site storage usage via drive quota and identifies concentration risks
// (few sites holding a disproportionate share of total storage).
const SITES_FOR_QUOTA = 50; // max sites to fetch drive quota for

async function collectStorage(tenantId) {
  logger.info({ event: 'collector_start', collector: 'storage', tenantId });

  let sites;
  try {
    sites = await graphGetAll(tenantId, '/sites', {
      search: '*',
      $select: 'id,displayName,webUrl,createdDateTime',
    });
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 404) {
      logger.warn({ event: 'collector_unavailable', collector: 'storage', tenantId });
      return {
        collector: 'storage',
        score: 0,
        unavailable: true,
        reason: 'Sites.Read.All required for storage analysis.',
      };
    }
    throw err;
  }

  if (sites.length === 0) {
    return {
      collector: 'storage',
      score: 5,
      summary: { message: 'No SharePoint sites found.' },
      topSitesByStorage: [],
    };
  }

  // Fetch drive quota for a sample of sites in parallel
  const sample = sites.slice(0, SITES_FOR_QUOTA);
  const siteStorage = (
    await Promise.allSettled(
      sample.map(async (site) => {
        try {
          const drive = await graphGet(tenantId, `/sites/${site.id}/drive`, { $select: 'id,quota' });
          return {
            displayName: site.displayName,
            webUrl: site.webUrl,
            createdDateTime: site.createdDateTime,
            storageBytes: drive.quota?.used ?? 0,
            storageMB: Math.round((drive.quota?.used ?? 0) / (1024 * 1024)),
            storageTotal: drive.quota?.total ?? 0,
            quotaState: drive.quota?.state ?? 'normal',
          };
        } catch {
          return null;
        }
      })
    )
  )
    .filter((r) => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value)
    .sort((a, b) => b.storageBytes - a.storageBytes);

  if (siteStorage.length === 0) {
    return {
      collector: 'storage',
      score: 5,
      summary: { message: 'Drive quota data unavailable for all sampled sites.' },
      topSitesByStorage: [],
    };
  }

  const totalBytes = siteStorage.reduce((s, site) => s + site.storageBytes, 0);
  const totalAllocatedBytes = siteStorage.reduce((s, site) => s + site.storageTotal, 0);

  // Concentration: what % of total storage do the top 20% of sites hold?
  const top20PercentCount = Math.max(1, Math.ceil(siteStorage.length * 0.2));
  const top20Bytes = siteStorage.slice(0, top20PercentCount).reduce((s, site) => s + site.storageBytes, 0);
  const concentrationRatio = totalBytes > 0 ? top20Bytes / totalBytes : 0;

  // Score: high concentration = low governance / harder to manage
  const score =
    concentrationRatio <= 0.40 ? 5 :
    concentrationRatio <= 0.55 ? 4 :
    concentrationRatio <= 0.70 ? 3 :
    concentrationRatio <= 0.85 ? 2 :
    concentrationRatio <= 0.95 ? 1 : 0;

  const totalGB = Math.round(totalBytes / (1024 * 1024 * 1024) * 10) / 10;

  logger.info({
    event: 'collector_done', collector: 'storage', tenantId,
    totalSites: sites.length, sampled: siteStorage.length,
    totalGB, concentrationRatio: Math.round(concentrationRatio * 100), score,
  });

  return {
    collector: 'storage',
    score,
    summary: {
      totalSites: sites.length,
      sitesSampled: siteStorage.length,
      totalStorageGB: totalGB,
      totalAllocatedGB: Math.round(totalAllocatedBytes / (1024 ** 3) * 10) / 10,
      utilizationPercent: totalAllocatedBytes > 0 ? Math.round((totalBytes / totalAllocatedBytes) * 100) : null,
      sitesNearing: siteStorage.filter((s) => s.quotaState === 'nearing').length,
      sitesCritical: siteStorage.filter((s) => s.quotaState === 'critical' || s.quotaState === 'exceeded').length,
      top20PercentSiteCount: top20PercentCount,
      top20PercentStoragePercent: Math.round(concentrationRatio * 100),
      note: sample.length < sites.length
        ? `Quota fetched for first ${sample.length} of ${sites.length} sites`
        : undefined,
    },
    topSitesByStorage: siteStorage.slice(0, 20),
  };
}

module.exports = { collectStorage };
