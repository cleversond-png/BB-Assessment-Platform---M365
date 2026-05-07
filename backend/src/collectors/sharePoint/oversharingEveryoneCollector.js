const { graphGetAll, graphGet } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: Sites.Read.All
// Detects sites where SharePoint's special "Everyone" or "Everyone except external users"
// groups hold explicit permissions. Every user in the tenant (including service accounts
// and new hires) inherits access automatically — a critical Copilot risk because the AI
// surfaces content to whoever asks, regardless of whether they knew the file existed.

const SITES_TO_SAMPLE = 50;

function isEveryoneIdentity(identity) {
  if (!identity) return false;
  const name = (identity.displayName || '').toLowerCase();
  const login = (identity.loginName || '').toLowerCase();
  const email = (identity.email || '').toLowerCase();
  if (name === 'everyone' || name === 'everyone except external users') return true;
  if (login.includes('spo-grid-all-users')) return true;
  if (login === 'c:0(.s|true)') return true;
  if (email.startsWith('everyone@') || email.startsWith('everyoneexceptexternalusers@')) return true;
  return false;
}

function permissionHasEveryone(perm) {
  const v2 = perm.grantedToV2;
  if (v2 && isEveryoneIdentity(v2.user || v2.siteUser)) return true;
  const identities = perm.grantedToIdentitiesV2 || perm.grantedToIdentities || [];
  return identities.some((i) => isEveryoneIdentity(i.user || i.siteUser));
}

async function getActiveSites(tenantId) {
  const sites = await graphGetAll(tenantId, '/sites', {
    search: '*',
    $select: 'id,displayName,webUrl,lastModifiedDateTime',
  });
  sites.sort((a, b) => {
    const at = a.lastModifiedDateTime ? new Date(a.lastModifiedDateTime).getTime() : 0;
    const bt = b.lastModifiedDateTime ? new Date(b.lastModifiedDateTime).getTime() : 0;
    return bt - at;
  });
  return sites.slice(0, SITES_TO_SAMPLE);
}

async function collectOversharingEveryone(tenantId) {
  logger.info({ event: 'collector_start', collector: 'oversharing', tenantId });

  let sites;
  try {
    sites = await getActiveSites(tenantId);
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 404) {
      logger.warn({ event: 'collector_unavailable', collector: 'oversharing', tenantId });
      return {
        collector: 'oversharing',
        score: 0,
        unavailable: true,
        reason: 'Sites.Read.All required for oversharing analysis.',
      };
    }
    throw err;
  }

  if (sites.length === 0) {
    return {
      collector: 'oversharing',
      score: 5,
      summary: { sitesSampled: 0, sitesWithEveryoneCount: 0 },
      sitesWithEveryone: [],
    };
  }

  const sitesWithEveryone = [];

  await Promise.allSettled(
    sites.map(async (site) => {
      try {
        const res = await graphGet(tenantId, `/sites/${site.id}/permissions`);
        const perms = res.value || [];
        const everyonePerms = perms.filter(permissionHasEveryone);
        if (everyonePerms.length > 0) {
          const roles = [...new Set(everyonePerms.flatMap((p) => p.roles || []))];
          sitesWithEveryone.push({
            displayName: site.displayName,
            webUrl: site.webUrl,
            lastModifiedDateTime: site.lastModifiedDateTime || null,
            roles,
          });
        }
      } catch (err) {
        logger.warn({ event: 'oversharing_site_check_failed', siteId: site.id, error: err.message });
      }
    })
  );

  const count = sitesWithEveryone.length;

  let score = 5;
  if (count >= 10) score = 0;
  else if (count >= 5) score = 1;
  else if (count >= 2) score = 2;
  else if (count === 1) score = 3;

  logger.info({
    event: 'collector_done', collector: 'oversharing', tenantId,
    sitesSampled: sites.length, sitesWithEveryoneCount: count, score,
  });

  return {
    collector: 'oversharing',
    score,
    summary: {
      sitesSampled: sites.length,
      sitesWithEveryoneCount: count,
      coverage: `Top ${sites.length} sites mais recentes por atividade`,
    },
    sitesWithEveryone,
  };
}

module.exports = { collectOversharingEveryone };
