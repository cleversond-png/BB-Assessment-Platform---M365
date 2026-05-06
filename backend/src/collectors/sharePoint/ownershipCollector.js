const { graphGetAll } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: Group.Read.All (or Directory.Read.All), User.Read.All
// Analyzes M365 group-connected sites for missing or disabled owners.
const SAMPLE_LIMIT = 50; // max groups to fetch owners for per assessment

async function collectOwnership(tenantId) {
  logger.info({ event: 'collector_start', collector: 'ownership', tenantId });

  let allGroups;
  try {
    allGroups = await graphGetAll(tenantId, '/groups', {
      $select: 'id,displayName,mail,groupTypes',
    });
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 404) {
      logger.warn({ event: 'collector_unavailable', collector: 'ownership', tenantId });
      return {
        collector: 'ownership',
        score: 0,
        unavailable: true,
        reason: 'Group.Read.All or Directory.Read.All required.',
      };
    }
    throw err;
  }

  // Keep only M365 group-connected sites (Unified groups have SharePoint sites)
  const groups = allGroups.filter((g) => g.groupTypes?.includes('Unified'));

  // Build a set of disabled user IDs for cross-reference
  let disabledIds = new Set();
  try {
    const disabledUsers = await graphGetAll(tenantId, '/users', {
      $filter: 'accountEnabled eq false',
      $select: 'id',
    });
    disabledIds = new Set(disabledUsers.map((u) => u.id));
  } catch {
    // Non-fatal: proceed without disabled-user cross-reference
    logger.warn({ event: 'ownership_disabled_users_unavailable', tenantId });
  }

  const sample = groups.slice(0, SAMPLE_LIMIT);
  let ownerlessCount = 0;
  let disabledOwnerCount = 0;
  const ownerlessSites = [];
  const disabledOwnerSites = [];

  await Promise.allSettled(
    sample.map(async (group) => {
      try {
        const owners = await graphGetAll(tenantId, `/groups/${group.id}/owners`, {
          $select: 'id,displayName,accountEnabled',
        });

        if (owners.length === 0) {
          ownerlessCount++;
          ownerlessSites.push({ displayName: group.displayName, mail: group.mail });
          return;
        }

        const hasActiveOwner = owners.some(
          (o) => o.accountEnabled !== false && !disabledIds.has(o.id)
        );
        if (!hasActiveOwner) {
          disabledOwnerCount++;
          disabledOwnerSites.push({
            displayName: group.displayName,
            mail: group.mail,
            owners: owners.map((o) => ({ displayName: o.displayName, active: o.accountEnabled !== false })),
          });
        }
      } catch {
        // Group may have been deleted between list and fetch — skip silently
      }
    })
  );

  const total = sample.length;
  const problemCount = ownerlessCount + disabledOwnerCount;
  const problemRatio = total > 0 ? problemCount / total : 0;

  const score =
    total === 0 ? 5 :
    problemRatio === 0 ? 5 :
    problemRatio <= 0.05 ? 4 :
    problemRatio <= 0.15 ? 3 :
    problemRatio <= 0.30 ? 2 :
    problemRatio <= 0.50 ? 1 : 0;

  logger.info({
    event: 'collector_done', collector: 'ownership', tenantId,
    totalGroupsInTenant: groups.length, total, ownerlessCount, disabledOwnerCount, score,
  });

  return {
    collector: 'ownership',
    score,
    summary: {
      totalM365Groups: groups.length,
      groupsChecked: total,
      ownerlessCount,
      disabledOwnerCount,
      problemRatioPercent: Math.round(problemRatio * 100),
      note: total < groups.length ? `Sample of ${total} of ${groups.length} groups` : undefined,
    },
    ownerlessSites: ownerlessSites.slice(0, 20),
    disabledOwnerSites: disabledOwnerSites.slice(0, 20),
  };
}

module.exports = { collectOwnership };
