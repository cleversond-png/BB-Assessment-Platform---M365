const { graphGet, graphGetAll } = require('../../graph/graphClient');
const logger = require('../../logger');

// App registrations with excessive Graph API permissions are a major attack surface.
// A compromised app with Mail.ReadWrite or Files.ReadWrite.All can silently
// exfiltrate data or escalate privileges without any user interaction.
// Also detects secrets and certificates expiring within 30 days.
// Requires: Application.Read.All (new permission — must be in consent)

const HIGH_RISK_PERMISSIONS = new Set([
  'Mail.ReadWrite',
  'Mail.Read',
  'Files.ReadWrite.All',
  'Files.Read.All',
  'Directory.ReadWrite.All',
  'User.ReadWrite.All',
  'RoleManagement.ReadWrite.Directory',
  'Sites.ReadWrite.All',
  'Group.ReadWrite.All',
  'TeamSettings.ReadWrite.All',
  'MailboxSettings.ReadWrite',
  'Calendars.ReadWrite',
  'Contacts.ReadWrite',
]);

const EXPIRY_WARNING_DAYS = 30;

async function collectAppPermissions(tenantId) {
  logger.info({ event: 'collector_start', collector: 'appPermissions', tenantId });

  // Service principals (apps com admin consent)
  let servicePrincipals = [];
  try {
    servicePrincipals = await graphGetAll(tenantId, '/servicePrincipals', {
      $filter: "servicePrincipalType eq 'Application'",
      $select: 'id,displayName,appId',
      $top: '100',
    });
  } catch (err) {
    const status = err?.response?.status ?? err?.statusCode;
    if (status === 403 || status === 401) {
      logger.info({ event: 'collector_unavailable', collector: 'appPermissions', tenantId, reason: 'Application.Read.All ausente' });
      return {
        collector: 'appPermissions',
        score: 0,
        unavailable: true,
        reason: 'Permissao Application.Read.All ausente — necessario re-consent para incluir esta permissao.',
      };
    }
    throw err;
  }

  // App registrations (para checar secrets/certs expirando)
  let applications = [];
  try {
    applications = await graphGetAll(tenantId, '/applications', {
      $select: 'displayName,passwordCredentials,keyCredentials',
      $top: '100',
    });
  } catch {
    // Continua sem dados de credenciais se falhar
  }

  // Checar permissoes de alto impacto via appRoleAssignments
  const highRiskApps = [];
  const now = Date.now();

  for (const sp of servicePrincipals.slice(0, 50)) { // limit API calls
    try {
      const assignRes = await graphGet(tenantId, `/servicePrincipals/${sp.id}/appRoleAssignments`, {
        $select: 'principalDisplayName,resourceDisplayName,appRoleId',
        $top: '20',
      });
      const assignments = assignRes.value || [];

      // Verificar permissoes de alto risco pelo resourceDisplayName + appRole
      // Como não temos os GUIDs de todos os app roles, checamos via
      // oauth2PermissionGrants (delegated) e appRoleAssignments (application)
      if (assignments.length > 0) {
        // Obter detalhes do SP incluindo oauth2Permissions
        const spDetail = await graphGet(tenantId, `/servicePrincipals/${sp.id}`, {
          $select: 'displayName,oauth2PermissionScopes,appRoles,requiredResourceAccess',
        });

        const requiredPerms = spDetail.requiredResourceAccess || [];
        const highRiskFound = [];

        for (const resource of requiredPerms) {
          for (const access of resource.resourceAccess || []) {
            if (HIGH_RISK_PERMISSIONS.has(access.id)) {
              highRiskFound.push(access.id);
            }
          }
        }

        if (highRiskFound.length > 0) {
          highRiskApps.push({
            displayName: sp.displayName,
            appId: sp.appId,
            permissions: highRiskFound,
          });
        }
      }
    } catch {
      // App pode estar indisponível — pular
    }
  }

  // Checar secrets e certificados expirando em 30 dias
  const warnDate = new Date(now + EXPIRY_WARNING_DAYS * 86400_000);
  let secretsExpiringSoon = 0;

  for (const app of applications) {
    for (const cred of [...(app.passwordCredentials || []), ...(app.keyCredentials || [])]) {
      if (cred.endDateTime && new Date(cred.endDateTime) <= warnDate) {
        secretsExpiringSoon++;
      }
    }
  }

  const appsWithHighRiskPerms = highRiskApps.length;
  const totalApps = servicePrincipals.length;

  const score =
    appsWithHighRiskPerms === 0 ? 5 :
    appsWithHighRiskPerms <= 2  ? 3 :
    appsWithHighRiskPerms <= 5  ? 2 : 1;

  logger.info({ event: 'collector_done', collector: 'appPermissions', tenantId, totalApps, appsWithHighRiskPerms, secretsExpiringSoon, score });

  return {
    collector: 'appPermissions',
    score,
    summary: { totalApps, appsWithHighRiskPerms, secretsExpiringSoon },
    highRiskApps: highRiskApps.slice(0, 10),
  };
}

module.exports = { collectAppPermissions };
