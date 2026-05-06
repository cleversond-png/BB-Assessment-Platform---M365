const { graphGetAll, graphGet } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: Sites.Read.All
// Samples the top N sites by storage and enumerates drive items (metadata only —
// no file content is read). Detects: large files (>100MB), stale files (>12 months),
// and duplicate files (by quickXorHash, then by name+size).
const LARGE_FILE_BYTES = 100 * 1024 * 1024; // 100 MB
const STALE_FILE_MONTHS = 12;
const SITES_TO_SAMPLE = 5;
const ITEMS_PER_SITE_LIMIT = 1000;
const QUOTA_SAMPLE_CAP = 200; // max sites to fetch drive quota for (prevents rate-limit storms)

async function getSitesByStorage(tenantId) {
  const sites = await graphGetAll(tenantId, '/sites', {
    search: '*',
    $select: 'id,displayName,webUrl',
  });

  // Cap before parallelizing to avoid overwhelming the Graph API with 1000+ concurrent requests
  const siteSample = sites.slice(0, QUOTA_SAMPLE_CAP);

  // Fetch drive quota in parallel (bounded by QUOTA_SAMPLE_CAP)
  const withQuota = await Promise.allSettled(
    siteSample.map(async (site) => {
      try {
        const drive = await graphGet(tenantId, `/sites/${site.id}/drive`, { $select: 'id,quota' });
        return { ...site, driveId: drive.id, storageBytes: drive.quota?.used ?? 0 };
      } catch {
        return { ...site, driveId: null, storageBytes: 0 };
      }
    })
  );

  return withQuota
    .filter((r) => r.status === 'fulfilled' && r.value.driveId)
    .map((r) => r.value)
    .sort((a, b) => b.storageBytes - a.storageBytes)
    .slice(0, SITES_TO_SAMPLE);
}

async function enumerateDriveItems(tenantId, driveId) {
  // delta without token returns all current items recursively (metadata only)
  const allItems = [];
  let nextUrl = null;
  let count = 0;

  try {
    // First page via graphGetAll would lose URL control — use manual pagination
    const firstPage = await graphGet(
      tenantId,
      `/drives/${driveId}/root/delta`,
      { $select: 'name,size,file,lastModifiedDateTime,parentReference,webUrl,shared' }
    );
    const items = firstPage.value ?? [];
    allItems.push(...items);
    count += items.length;
    nextUrl = firstPage['@odata.nextLink'] ?? firstPage['@odata.deltaLink'] ?? null;
    // deltaLink = end of first sync; nextLink = more pages available
    if (firstPage['@odata.deltaLink']) nextUrl = null; // single page — done

    // Continue pagination if needed, up to the item limit
    const axios = require('axios');
    const tokenStore = require('../../auth/tokenStore');
    while (nextUrl && count < ITEMS_PER_SITE_LIMIT) {
      const entry = tokenStore.getToken(tenantId);
      if (!entry) break;
      const res = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${entry.accessToken}` },
      });
      const pageItems = res.data.value ?? [];
      allItems.push(...pageItems);
      count += pageItems.length;
      nextUrl = res.data['@odata.nextLink'] ?? null;
    }
  } catch (err) {
    logger.warn({ event: 'files_drive_enum_failed', driveId, error: err.message });
  }

  // Filter to files only (exclude folders and deleted items)
  return allItems.filter((item) => item.file && !item.deleted);
}

async function collectFiles(tenantId) {
  logger.info({ event: 'collector_start', collector: 'files', tenantId });

  let topSites;
  try {
    topSites = await getSitesByStorage(tenantId);
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 404) {
      logger.warn({ event: 'collector_unavailable', collector: 'files', tenantId });
      return {
        collector: 'files',
        score: 0,
        unavailable: true,
        reason: 'Sites.Read.All required for file metadata analysis.',
      };
    }
    throw err;
  }

  if (topSites.length === 0) {
    return {
      collector: 'files',
      score: 5,
      summary: { message: 'No sites with accessible drives found.' },
      largeFiles: [],
      duplicates: [],
      staleFiles: [],
    };
  }

  const now = Date.now();
  const staleMs = STALE_FILE_MONTHS * 30 * 24 * 60 * 60 * 1000;

  const largeFiles = [];
  const staleFiles = [];
  const hashMap = new Map();  // hash → [{name, size, webUrl, site}]
  const nameSizeMap = new Map(); // "name|size" → [{webUrl, site}]
  let totalFilesScanned = 0;
  let sharedFilesCount = 0;
  let anonymousSharedCount = 0;

  for (const site of topSites) {
    const items = await enumerateDriveItems(tenantId, site.driveId);
    totalFilesScanned += items.length;

    for (const item of items) {
      const sizeBytes = item.size ?? 0;
      const lastMod = item.lastModifiedDateTime
        ? new Date(item.lastModifiedDateTime).getTime()
        : 0;
      const ref = { name: item.name, sizeBytes, webUrl: item.webUrl, site: site.displayName };

      // Explicit sharing (link created or permission granted on this item)
      if (item.shared) {
        sharedFilesCount++;
        if (item.shared.scope === 'anonymous') anonymousSharedCount++;
      }

      // Large files
      if (sizeBytes > LARGE_FILE_BYTES) {
        largeFiles.push({ ...ref, lastModifiedDateTime: item.lastModifiedDateTime });
      }

      // Stale files
      if (lastMod && now - lastMod > staleMs) {
        staleFiles.push({ ...ref, lastModifiedDateTime: item.lastModifiedDateTime });
      }

      // Duplicate detection by hash (quickXorHash = server-computed, no content read)
      const hash = item.file?.hashes?.quickXorHash;
      if (hash) {
        if (!hashMap.has(hash)) hashMap.set(hash, []);
        hashMap.get(hash).push(ref);
      } else {
        // Fallback: group by name+size
        const key = `${item.name}|${sizeBytes}`;
        if (!nameSizeMap.has(key)) nameSizeMap.set(key, []);
        nameSizeMap.get(key).push(ref);
      }
    }
  }

  // Build duplicate groups (hash-based)
  const duplicateGroups = [];
  for (const [, copies] of hashMap) {
    if (copies.length > 1) {
      const wasted = copies[0].sizeBytes * (copies.length - 1);
      duplicateGroups.push({ copies: copies.length, wastedBytes: wasted, files: copies });
    }
  }
  // Name+size fallback duplicates (may have false positives — noted in summary)
  for (const [, copies] of nameSizeMap) {
    if (copies.length > 1) {
      const wasted = copies[0].sizeBytes * (copies.length - 1);
      duplicateGroups.push({ copies: copies.length, wastedBytes: wasted, files: copies, matchType: 'name+size' });
    }
  }
  duplicateGroups.sort((a, b) => b.wastedBytes - a.wastedBytes);

  const totalWastedBytes = duplicateGroups.reduce((s, g) => s + g.wastedBytes, 0);

  // Sort large files by size desc, stale by age desc
  largeFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);
  staleFiles.sort((a, b) => new Date(a.lastModifiedDateTime) - new Date(b.lastModifiedDateTime));

  // Scoring: deductions for each risk dimension
  let score = 5;
  const staleRatio = totalFilesScanned > 0 ? staleFiles.length / totalFilesScanned : 0;
  const largeRatio = totalFilesScanned > 0 ? largeFiles.length / totalFilesScanned : 0;
  const dupRatio = totalFilesScanned > 0
    ? duplicateGroups.reduce((s, g) => s + g.copies - 1, 0) / totalFilesScanned
    : 0;

  if (staleRatio > 0.50) score -= 1.5;
  else if (staleRatio > 0.25) score -= 1;
  else if (staleRatio > 0.10) score -= 0.5;

  if (largeFiles.length > 50) score -= 1.5;
  else if (largeFiles.length > 20) score -= 1;
  else if (largeFiles.length > 5) score -= 0.5;

  if (dupRatio > 0.30) score -= 1;
  else if (dupRatio > 0.15) score -= 0.5;
  else if (dupRatio > 0.05) score -= 0.25;

  score = Math.max(Math.round(score * 10) / 10, 0);

  logger.info({
    event: 'collector_done', collector: 'files', tenantId,
    sitesSampled: topSites.length, totalFilesScanned,
    largeFiles: largeFiles.length, duplicateGroups: duplicateGroups.length,
    staleFiles: staleFiles.length, score,
  });

  return {
    collector: 'files',
    score,
    summary: {
      sitesSampled: topSites.length,
      totalFilesScanned,
      sharedFilesCount,
      anonymousSharedCount,
      sharedFilesRatioPercent: totalFilesScanned > 0 ? Math.round((sharedFilesCount / totalFilesScanned) * 100) : 0,
      largeFilesCount: largeFiles.length,
      duplicateGroupsCount: duplicateGroups.length,
      estimatedWastedBytes: totalWastedBytes,
      staleFilesCount: staleFiles.length,
      staleFilesRatioPercent: Math.round(staleRatio * 100),
      largeFileThresholdMB: 100,
      stalePeriodMonths: STALE_FILE_MONTHS,
      coverage: `Top ${topSites.length} sites by storage (up to ${ITEMS_PER_SITE_LIMIT} items/site)`,
    },
    largeFiles: largeFiles.slice(0, 20),
    duplicates: duplicateGroups.slice(0, 20),
    staleFiles: staleFiles.slice(0, 20),
  };
}

module.exports = { collectFiles };
