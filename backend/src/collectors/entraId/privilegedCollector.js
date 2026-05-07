const { graphGetAll, graphGet } = require('../../graph/graphClient');
const logger = require('../../logger');

// High-value roles to track (display names)
const SENSITIVE_ROLES = new Set([
  'Global Administrator',
  'Privileged Role Administrator',
  'Security Administrator',
  'Exchange Administrator',
  'SharePoint Administrator',
  'User Administrator',
  'Application Administrator',
  'Cloud Application Administrator',
  'Hybrid Identity Administrator',
]);

// Requires: Directory.Read.All
async function collectPrivileged(tenantId) {
  logger.info({ event: 'collector_start', collector: 'privileged', tenantId });

  const roles = await graphGetAll(tenantId, '/directoryRoles');
  const sensitiveRoles = roles.filter((r) => SENSITIVE_ROLES.has(r.displayName));

  const privilegedUsers = [];

  for (const role of sensitiveRoles) {
    const members = await graphGetAll(
      tenantId,
      `/directoryRoles/${role.id}/members`,
      { $select: 'id,displayName,userPrincipalName,userType' }
    );
    for (const member of members) {
      privilegedUsers.push({
        role: role.displayName,
        displayName: member.displayName,
        userPrincipalName: member.userPrincipalName,
        userType: member.userType,
      });
    }
  }

  const globalAdminCount = privilegedUsers.filter((u) => u.role === 'Global Administrator').length;
  const guestPrivileged = privilegedUsers.filter((u) => u.userType === 'Guest');

  // Enrich users with MFA status (requires Entra P1)
  let mfaByUpn = null;
  try {
    const mfaData = await graphGetAll(tenantId, '/reports/authenticationMethods/userRegistrationDetails', {
      $select: 'userPrincipalName,isMfaRegistered',
    });
    mfaByUpn = new Map(mfaData.map((u) => [u.userPrincipalName?.toLowerCase(), u.isMfaRegistered]));
  } catch (err) {
    logger.warn({ event: 'mfa_data_unavailable', collector: 'privileged', tenantId, status: err.response?.status });
  }

  for (const user of privilegedUsers) {
    user.mfaRegistered = mfaByUpn ? (mfaByUpn.get(user.userPrincipalName?.toLowerCase()) ?? null) : null;
  }

  const adminsWithoutMfa = mfaByUpn
    ? privilegedUsers.filter((u) => u.mfaRegistered === false).length
    : null;

  // PIM check: eligible (just-in-time) vs permanent role assignments (requires Entra P2)
  let pimAvailable = null;
  let eligibleAdminCount = 0;
  try {
    const sensitiveTemplateIds = new Set(sensitiveRoles.map((r) => r.roleTemplateId).filter(Boolean));
    const schedules = await graphGetAll(tenantId, '/roleManagement/directory/roleEligibilitySchedules', {
      $select: 'id,roleDefinitionId,status',
    });
    pimAvailable = true;
    eligibleAdminCount = schedules.filter(
      (s) => sensitiveTemplateIds.has(s.roleDefinitionId) && s.status === 'provisioned'
    ).length;
  } catch (err) {
    if (err.response?.status === 403) {
      pimAvailable = false;
      logger.warn({ event: 'pim_unavailable', collector: 'privileged', tenantId, reason: 'Entra P2 required' });
    } else {
      logger.warn({ event: 'pim_check_failed', collector: 'privileged', tenantId, error: err.message });
    }
  }

  // Score 0–5: privileged access hygiene
  let score = 5;
  if (globalAdminCount > 5) score -= 2;
  else if (globalAdminCount > 2) score -= 1;
  if (guestPrivileged.length > 0) score -= 2;
  if (adminsWithoutMfa > 0) score -= 1;
  if (pimAvailable === true && eligibleAdminCount === 0) score -= 1;
  score = Math.max(score, 0);

  logger.info({
    event: 'collector_done', collector: 'privileged', tenantId,
    totalPrivileged: privilegedUsers.length, globalAdminCount, adminsWithoutMfa,
    pimAvailable, eligibleAdminCount,
  });

  return {
    collector: 'privileged',
    score,
    summary: {
      totalPrivilegedAssignments: privilegedUsers.length,
      globalAdminCount,
      guestPrivilegedCount: guestPrivileged.length,
      mfaDataAvailable: mfaByUpn !== null,
      adminsWithoutMfa,
      pimAvailable,
      eligibleAdminCount,
    },
    privilegedUsers,
    guestPrivileged,
  };
}

module.exports = { collectPrivileged };
