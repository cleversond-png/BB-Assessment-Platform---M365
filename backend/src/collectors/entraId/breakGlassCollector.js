const { graphGet, graphGetAll } = require('../../graph/graphClient');
const logger = require('../../logger');

// Break-glass (emergency access) accounts are cloud-only Global Admin accounts
// that are excluded from all Conditional Access policies.
// Without break-glass accounts, a misconfigured CA policy or Entra ID outage
// can lock out all administrators from the tenant.
// Microsoft recommends: at least 2 break-glass accounts, cloud-only, with
// strong passwords and no MFA requirement (CA excluded), monitored via alerts.
// Requires: User.Read.All + Policy.Read.All + RoleManagement.Read.Directory (all present)

const GLOBAL_ADMIN_ROLE_TEMPLATE_ID = '62e90394-69f5-4237-9190-012177145e10';

async function collectBreakGlass(tenantId) {
  logger.info({ event: 'collector_start', collector: 'breakGlass', tenantId });

  // 1. Buscar Global Admins
  let globalAdmins = [];
  try {
    const rolesRes = await graphGet(tenantId, '/directoryRoles', {
      $filter: `roleTemplateId eq '${GLOBAL_ADMIN_ROLE_TEMPLATE_ID}'`,
    });
    const gaRole = (rolesRes.value || [])[0];

    if (gaRole) {
      const membersRes = await graphGet(tenantId, `/directoryRoles/${gaRole.id}/members`, {
        $select: 'id,userPrincipalName,displayName,onPremisesSyncEnabled,accountEnabled',
        $top: '50',
      });
      globalAdmins = (membersRes.value || []).filter(m => m.accountEnabled !== false);
    }
  } catch (err) {
    const status = err?.response?.status ?? err?.statusCode;
    if (status === 403 || status === 401) {
      logger.info({ event: 'collector_unavailable', collector: 'breakGlass', tenantId, reason: 'RoleManagement.Read.Directory ausente' });
      return {
        collector: 'breakGlass',
        score: 0,
        unavailable: true,
        reason: 'Permissao RoleManagement.Read.Directory ausente.',
      };
    }
    throw err;
  }

  // 2. Buscar CA policies para detectar exclusoes
  let caPolicies = [];
  try {
    const caRes = await graphGet(tenantId, '/identity/conditionalAccessPolicies', {
      $select: 'id,state,displayName,conditions',
      $filter: "state eq 'enabled'",
      $top: '50',
    });
    caPolicies = caRes.value || [];
  } catch {
    // CA policies indisponíveis — continua sem dados de exclusão
  }

  const globalAdminCount = globalAdmins.length;

  // Cloud-only = onPremisesSyncEnabled is false or null (not synced from on-prem AD)
  const cloudOnlyAdmins = globalAdmins.filter(a => !a.onPremisesSyncEnabled);

  // Break-glass candidates: cloud-only admins excluded from ALL enabled CA policies
  const breakGlassCandidates = cloudOnlyAdmins.filter(admin => {
    if (caPolicies.length === 0) return false; // sem CA = não confirma break-glass
    return caPolicies.every(policy => {
      const excluded = policy.conditions?.users?.excludeUsers || [];
      return excluded.includes(admin.id);
    });
  });

  const breakGlassDetected  = breakGlassCandidates.length >= 2;
  const breakGlassCount     = breakGlassCandidates.length;

  // Score:
  // 5 = 2+ break-glass cloud-only confirmados (excluídos de todas as CA)
  // 4 = 1 break-glass confirmado
  // 3 = tem GAs cloud-only mas não confirmados como break-glass (CA ausente/inconclusivo)
  // 2 = sem GAs cloud-only (todos sincronizados do AD — maior risco)
  // 1 = sem Global Admins encontrados (anomalia)
  const score =
    breakGlassCount >= 2       ? 5 :
    breakGlassCount === 1      ? 4 :
    cloudOnlyAdmins.length > 0 ? 3 :
    globalAdminCount > 0       ? 2 : 1;

  logger.info({ event: 'collector_done', collector: 'breakGlass', tenantId, globalAdminCount, breakGlassDetected, breakGlassCount, cloudOnlyCount: cloudOnlyAdmins.length, score });

  return {
    collector: 'breakGlass',
    score,
    summary: {
      globalAdminCount,
      breakGlassDetected,
      breakGlassCandidatesCount: breakGlassCount,
      cloudOnlyAdmins: cloudOnlyAdmins.length,
      caPoliciesChecked: caPolicies.length,
    },
    breakGlassCandidates: breakGlassCandidates.map(a => a.userPrincipalName),
  };
}

module.exports = { collectBreakGlass };
