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

  // Score 0–5: privileged access hygiene
  // Deduct points for over-provisioning
  let score = 5;
  if (globalAdminCount > 5) score -= 2;
  else if (globalAdminCount > 2) score -= 1;
  if (guestPrivileged.length > 0) score -= 2;
  score = Math.max(score, 0);

  logger.info({ event: 'collector_done', collector: 'privileged', tenantId, totalPrivileged: privilegedUsers.length, globalAdminCount });

  return {
    collector: 'privileged',
    score,
    summary: {
      totalPrivilegedAssignments: privilegedUsers.length,
      globalAdminCount,
      guestPrivilegedCount: guestPrivileged.length,
    },
    privilegedUsers,
    guestPrivileged,
  };
}

module.exports = { collectPrivileged };
