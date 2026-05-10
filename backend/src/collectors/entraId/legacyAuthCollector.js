const { graphGet } = require('../../graph/graphClient');
const logger = require('../../logger');

// Legacy authentication protocols bypass MFA and Conditional Access.
// Any sign-in via SMTP, IMAP, POP3, Basic Auth, or Exchange ActiveSync
// can compromise an account even if MFA is enforced for modern auth.
// Requires: AuditLog.Read.All (already in consent scope)

const PERIOD_DAYS = 30;
const LEGACY_PROTOCOLS = new Set([
  'SMTP', 'IMAP4', 'POP3', 'Exchange ActiveSync',
  'Exchange Online PowerShell', 'Authenticated SMTP',
  'Other clients', 'MAPI over HTTP', 'Offline Address Book',
]);

async function collectLegacyAuth(tenantId) {
  logger.info({ event: 'collector_start', collector: 'legacyAuth', tenantId });

  const since = new Date(Date.now() - PERIOD_DAYS * 86400_000).toISOString();
  let signIns = [];

  try {
    const res = await graphGet(tenantId, '/auditLogs/signIns', {
      $filter: `createdDateTime ge ${since} and signInEventTypes/any(t: t eq 'interactiveUser')`,
      $select: 'id,clientAppUsed,userPrincipalName,createdDateTime',
      $top: '500',
    });
    signIns = res.value || [];
  } catch (err) {
    const status = err?.response?.status ?? err?.statusCode;
    if (status === 403 || status === 401) {
      logger.info({ event: 'collector_unavailable', collector: 'legacyAuth', tenantId, reason: 'AuditLog.Read.All ausente' });
      return {
        collector: 'legacyAuth',
        score: 0,
        unavailable: true,
        reason: 'Permissao AuditLog.Read.All ausente — sign-in logs nao acessiveis.',
      };
    }
    logger.warn({ event: 'legacy_auth_fetch_failed', tenantId, error: err.message });
    return {
      collector: 'legacyAuth',
      score: 0,
      unavailable: true,
      reason: `Erro ao consultar sign-in logs: ${err.message}`,
    };
  }

  // Filtrar apenas sign-ins com protocolo legado
  const legacySignIns = signIns.filter(s => LEGACY_PROTOCOLS.has(s.clientAppUsed));

  const legacySignInCount = legacySignIns.length;
  const distinctUPNs = [...new Set(legacySignIns.map(s => s.userPrincipalName).filter(Boolean))];

  // Contagem por protocolo
  const protocolBreakdown = {};
  for (const s of legacySignIns) {
    const proto = s.clientAppUsed || 'Unknown';
    protocolBreakdown[proto] = (protocolBreakdown[proto] || 0) + 1;
  }

  const score =
    legacySignInCount === 0 ? 5 :
    legacySignInCount <= 5  ? 3 :
    legacySignInCount <= 20 ? 2 : 1;

  logger.info({ event: 'collector_done', collector: 'legacyAuth', tenantId, legacySignInCount, distinctUsers: distinctUPNs.length, score });

  return {
    collector: 'legacyAuth',
    score,
    summary: {
      legacySignInCount,
      distinctUsers: distinctUPNs.length,
      periodDays: PERIOD_DAYS,
    },
    usersWithLegacyAuth: distinctUPNs.slice(0, 20),
    protocolBreakdown,
  };
}

module.exports = { collectLegacyAuth };
