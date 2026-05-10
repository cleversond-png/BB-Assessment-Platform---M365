const { graphGet } = require('../../graph/graphClient');
const logger = require('../../logger');

// Teams app governance settings determine whether users can install
// third-party or custom apps without admin approval.
// Ungoverned app installs can introduce untrusted data connectors
// that expand the Copilot data surface without security review.
// Requires: Team.ReadBasic.All (new permission — re-consent needed)

async function collectTeamsSettings(tenantId) {
  logger.info({ event: 'collector_start', collector: 'teamsSettings', tenantId });

  let appSettings = null;
  let thirdPartyAppsAllowed = true;
  let customAppsAllowed = true;
  let sideloadingEnabled = true;

  try {
    // Teams app settings (admin-level governance)
    const res = await graphGet(tenantId, '/teamwork/teamsAppSettings', {
      $select: 'allowUserRequestsForAppAccess,isUserPersonalScopeResourceSpecificConsentEnabled',
    });
    appSettings = res;

    // allowUserRequestsForAppAccess: false = admin controls installs (better)
    thirdPartyAppsAllowed = res?.allowUserRequestsForAppAccess !== false;
    sideloadingEnabled    = res?.isUserPersonalScopeResourceSpecificConsentEnabled !== false;

  } catch (err) {
    const status = err?.response?.status ?? err?.statusCode;
    if (status === 403 || status === 401) {
      logger.info({ event: 'collector_unavailable', collector: 'teamsSettings', tenantId, reason: 'Team.ReadBasic.All ausente ou endpoint indisponivel' });
      return {
        collector: 'teamsSettings',
        score: 0,
        unavailable: true,
        reason: 'Permissao Team.ReadBasic.All ausente ou endpoint /teamwork/teamsAppSettings indisponivel.',
      };
    }
    logger.warn({ event: 'collector_unavailable', collector: 'teamsSettings', tenantId, reason: err.message });
    return {
      collector: 'teamsSettings',
      score: 0,
      unavailable: true,
      reason: `Configuracoes do Teams indisponiveis: ${err.message}`,
    };
  }

  // Tentar checar politicas de setup de apps (mais granular)
  try {
    const setupPoliciesRes = await graphGet(tenantId, '/teamwork/teamsAppSettings', {
      $select: 'allowUserPinning',
    });
    customAppsAllowed = setupPoliciesRes?.allowUserPinning !== false;
  } catch {
    // Opcional
  }

  // Score:
  // 5 = admin controla tudo (sem auto-install por usuários)
  // 4 = terceiros bloqueados mas custom apps permitidas
  // 3 = terceiros permitidos mas sideloading bloqueado
  // 2 = terceiros e sideloading liberados
  // 1 = sem controle (configurações padrão permissivas)
  const score =
    !thirdPartyAppsAllowed && !sideloadingEnabled ? 5 :
    !thirdPartyAppsAllowed ? 4 :
    !sideloadingEnabled    ? 3 :
    !customAppsAllowed     ? 3 : 2;

  logger.info({ event: 'collector_done', collector: 'teamsSettings', tenantId, thirdPartyAppsAllowed, customAppsAllowed, sideloadingEnabled, score });

  return {
    collector: 'teamsSettings',
    score,
    summary: {
      thirdPartyAppsAllowed,
      customAppsAllowed,
      sideloadingEnabled,
    },
  };
}

module.exports = { collectTeamsSettings };
