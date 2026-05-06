const { graphGet } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: SharePointTenantSettings.Read.All
const SHARING_SCORE = {
  disabled: 5,
  existingExternalUserSharingOnly: 4,
  externalUserSharingOnly: 3,
  externalUserAndGuestSharing: 1,
};

async function collectPermissions(tenantId) {
  logger.info({ event: 'collector_start', collector: 'permissions', tenantId });

  let settings;
  try {
    settings = await graphGet(tenantId, '/admin/sharepoint/settings');
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 404) {
      logger.warn({ event: 'collector_unavailable', collector: 'permissions', tenantId });
      return {
        collector: 'permissions',
        score: 0,
        unavailable: true,
        reason: 'SharePointTenantSettings.Read.All required or SharePoint not provisioned.',
      };
    }
    throw err;
  }

  const capability = settings.sharingCapability || 'externalUserAndGuestSharing';
  const baseScore = SHARING_SCORE[capability] ?? 1;
  const anonymousLinkExpiration = settings.requireAnonymousLinksExpireInDays ?? 0;
  const defaultLinkType = settings.defaultSharingLinkType;
  const anonymousLinksAllowed = capability === 'externalUserAndGuestSharing';

  let score = baseScore;
  if (anonymousLinksAllowed) {
    if (anonymousLinkExpiration === 0) score = Math.max(score - 1, 0);
    else if (anonymousLinkExpiration > 30) score = Math.max(score - 0.5, 0);
  }
  if (defaultLinkType === 'anonymous') score = Math.max(score - 0.5, 0);
  score = Math.round(score * 10) / 10;

  const risks = [];
  if (anonymousLinksAllowed) risks.push('Links anônimos habilitados no nível do tenant');
  if (anonymousLinksAllowed && anonymousLinkExpiration === 0) risks.push('Links anônimos sem expiração configurada');
  if (defaultLinkType === 'anonymous') risks.push('Link padrão de compartilhamento é anônimo');

  logger.info({ event: 'collector_done', collector: 'permissions', tenantId, capability, score });

  return {
    collector: 'permissions',
    score,
    summary: {
      sharingCapability: capability,
      anonymousLinksAllowed,
      anonymousLinkExpirationDays: anonymousLinkExpiration || 'none',
      defaultSharingLinkType: defaultLinkType,
    },
    risks,
  };
}

module.exports = { collectPermissions };
