const { graphGet } = require('../../graph/graphClient');
const logger = require('../../logger');

// Teams External Access (federation) settings determine whether users
// can communicate with people outside the organization via Teams.
// Unrestricted federation allows unknown external parties to initiate
// contact with internal users, creating a social engineering surface.
// Also checks B2B collaboration settings for guest access.
// Requires: Policy.Read.All (already present in consent scope)

async function collectTeamsExternalAccess(tenantId) {
  logger.info({ event: 'collector_start', collector: 'teamsExternalAccess', tenantId });

  let crossTenantPolicy = null;
  let allowsAllExternalDomains = false;
  let federatedDomainsCount = 0;
  let guestAccessEnabled = false;

  try {
    // Cross-tenant access policy (B2B + Teams federation)
    const policyRes = await graphGet(tenantId, '/policies/crossTenantAccessPolicy/default', {
      $select: 'inboundTrust,b2bCollaborationInbound,b2bCollaborationOutbound,b2bDirectConnectInbound,b2bDirectConnectOutbound',
    });
    crossTenantPolicy = policyRes;

    // B2B collaboration inbound: if allowedIdentities.type == 'none' → most restrictive
    const inbound = crossTenantPolicy?.b2bCollaborationInbound;
    guestAccessEnabled = inbound?.applications?.accessType !== 'blocked';

    // Teams federation: check if direct connect is unrestricted
    const directConnectInbound = crossTenantPolicy?.b2bDirectConnectInbound;
    allowsAllExternalDomains = directConnectInbound?.applications?.accessType !== 'blocked';

  } catch (err) {
    const status = err?.response?.status ?? err?.statusCode;
    if (status === 403 || status === 401) {
      logger.info({ event: 'collector_unavailable', collector: 'teamsExternalAccess', tenantId, reason: 'Policy.Read.All ausente ou endpoint indisponivel' });
      return {
        collector: 'teamsExternalAccess',
        score: 0,
        unavailable: true,
        reason: 'Permissao Policy.Read.All ausente ou endpoint crossTenantAccessPolicy indisponivel.',
      };
    }
    // Endpoint pode não existir em tenants sem P1 — tratar como indisponível
    logger.warn({ event: 'collector_unavailable', collector: 'teamsExternalAccess', tenantId, reason: err.message });
    return {
      collector: 'teamsExternalAccess',
      score: 0,
      unavailable: true,
      reason: `Politicas de acesso externo indisponiveis: ${err.message}`,
    };
  }

  // Contar domínios federados específicos
  try {
    const partnersRes = await graphGet(tenantId, '/policies/crossTenantAccessPolicy/partners', {
      $select: 'tenantId,b2bDirectConnectInbound',
      $top: '50',
    });
    const partners = partnersRes.value || [];
    federatedDomainsCount = partners.filter(p =>
      p.b2bDirectConnectInbound?.applications?.accessType !== 'blocked'
    ).length;
  } catch {
    // Opcional — continua sem contagem
  }

  // Score:
  // 5 = sem federação externa habilitada (mais restritivo)
  // 4 = apenas domínios específicos autorizados
  // 3 = federação habilitada, guest restrito
  // 2 = tudo aberto (federation + guest)
  // 1 = políticas inconsistentes/sem controle
  const score =
    !allowsAllExternalDomains && !guestAccessEnabled ? 5 :
    !allowsAllExternalDomains && federatedDomainsCount <= 5 ? 4 :
    !allowsAllExternalDomains ? 3 :
    guestAccessEnabled ? 2 : 3;

  logger.info({ event: 'collector_done', collector: 'teamsExternalAccess', tenantId, allowsAllExternalDomains, federatedDomainsCount, guestAccessEnabled, score });

  return {
    collector: 'teamsExternalAccess',
    score,
    summary: {
      allowsAllExternalDomains,
      federatedDomainsCount,
      guestAccessEnabled,
    },
  };
}

module.exports = { collectTeamsExternalAccess };
