export function mapZeroTrustPillars(result) {
  const entra = result?.domains?.entraId?.collectors || {}
  const gov   = result?.domains?.governance?.collectors || {}

  return [
    {
      id: 'pim',
      label: 'PIM / Privilégios',
      icon: 'key-round',
      collector: entra.privileged,
      domainNav: 'entraId',
      licenceBadge: null,
      metric: c => c?.summary?.globalAdminCount != null
        ? `${c.summary.globalAdminCount} Global Admins` : null,
    },
    {
      id: 'mfa',
      label: 'MFA',
      icon: 'shield-check',
      collector: entra.mfa,
      domainNav: 'entraId',
      licenceBadge: 'Entra P1/P2',
      metric: c => c?.summary?.coveragePercent != null
        ? `${c.summary.coveragePercent}% cobertura` : null,
    },
    {
      id: 'ca',
      label: 'Conditional Access',
      icon: 'shield-check',
      collector: entra.conditionalAccess,
      domainNav: 'entraId',
      licenceBadge: 'Entra P1',
      metric: c => c?.summary?.enabled != null
        ? `${c.summary.enabled} políticas ativas` : null,
    },
    {
      id: 'identityProtection',
      label: 'Entradas arriscadas',
      icon: 'alert-triangle',
      collector: entra.riskySignIns,
      domainNav: 'entraId',
      licenceBadge: 'Entra P1/P2',
      metric: c => c?.summary?.total != null
        ? `${c.summary.total} entradas arriscadas` : null,
    },
    {
      id: 'audit',
      label: 'Auditoria',
      icon: 'scroll-text',
      collector: gov.audit,
      domainNav: 'governance',
      licenceBadge: null,
      metric: c => c?.summary?.recentEventsFound != null
        ? (c.summary.recentEventsFound > 0 ? 'Auditoria ativa' : 'Auditoria inativa') : null,
    },
  ]
}
