const logger = require('../../logger');

// Synthesis domain — no API calls.
// Reads completed domain results and computes Copilot readiness score.
// Each check represents a prerequisite for safe, effective Copilot deployment.

const READINESS_CHECKS = [
  {
    id: 'ANON_LINKS_DISABLED',
    label: 'Links anônimos desabilitados',
    weight: 0.30,
    impact: 'critical',
    check: (d) => d.sharePoint?.collectors?.permissions?.summary?.anonymousLinksAllowed === false,
  },
  {
    id: 'MFA_HIGH_COVERAGE',
    label: 'Cobertura MFA ≥ 80%',
    weight: 0.25,
    impact: 'critical',
    check: (d) => {
      const mfa = d.entraId?.collectors?.mfa;
      return mfa && !mfa.unavailable && mfa.summary?.coveragePercent >= 80;
    },
  },
  {
    id: 'CA_POLICIES_ACTIVE',
    label: 'Conditional Access ativo',
    weight: 0.15,
    impact: 'high',
    check: (d) => {
      const ca = d.entraId?.collectors?.conditionalAccess;
      return ca && !ca.unavailable && ca.summary?.enabled > 0;
    },
  },
  {
    id: 'SENSITIVITY_LABELS_CONFIGURED',
    label: 'Sensitivity Labels configurados',
    weight: 0.15,
    impact: 'high',
    check: (d) => {
      const sl = d.governance?.collectors?.sensitivityLabels;
      // unavailable = no Purview license, also means not configured
      if (!sl || sl.unavailable) return false;
      return sl.summary?.totalLabels > 0;
    },
  },
  {
    id: 'AUDIT_ACTIVE',
    label: 'Audit Log com eventos recentes',
    weight: 0.10,
    impact: 'high',
    check: (d) => {
      const a = d.governance?.collectors?.audit;
      return a && !a.unavailable && a.summary?.recentEventsFound > 0;
    },
  },
  {
    id: 'LOW_STALE_CONTENT',
    label: 'Conteúdo atualizado (sites inativos < 30%)',
    weight: 0.05,
    impact: 'medium',
    check: (d) => {
      const s = d.sharePoint?.collectors?.staleContent?.summary;
      return s && s.staleRatioPercent <= 30;
    },
  },
];

const READINESS_LEVELS = [
  { min: 4.5, label: 'Pronto para IA', copilotReady: true },
  { min: 3.5, label: 'Prontidão Moderada', copilotReady: false },
  { min: 2.5, label: 'Prontidão Parcial', copilotReady: false },
  { min: 1.5, label: 'Baixa Prontidão', copilotReady: false },
  { min: 0,   label: 'Não Pronto', copilotReady: false },
];

function assessIAReadiness(tenantId, domains) {
  logger.info({ event: 'assessment_start', domain: 'iaReadiness', tenantId });

  let weightedScore = 0;
  const checks = READINESS_CHECKS.map((c) => {
    let passed = false;
    try { passed = !!c.check(domains); } catch { /* missing data = not passed */ }
    if (passed) weightedScore += c.weight;
    return { id: c.id, label: c.label, passed, weight: c.weight, impact: c.impact };
  });

  const domainScore = Math.round(weightedScore * 5 * 10) / 10;
  const level = READINESS_LEVELS.find((l) => domainScore >= l.min);
  const blockers = checks.filter((c) => !c.passed && (c.impact === 'critical' || c.impact === 'high'));

  logger.info({ event: 'assessment_done', domain: 'iaReadiness', tenantId, domainScore, readinessLevel: level.label });

  return {
    domain: 'iaReadiness',
    tenantId,
    assessedAt: new Date().toISOString(),
    domainScore,
    readinessLevel: level.label,
    copilotReady: level.copilotReady,
    checks,
    blockers: blockers.map(({ id, label, impact }) => ({ id, label, impact })),
    summary: {
      passedCount: checks.filter((c) => c.passed).length,
      totalChecks: checks.length,
      criticalBlockers: blockers.filter((b) => b.impact === 'critical').length,
      highBlockers: blockers.filter((b) => b.impact === 'high').length,
    },
  };
}

module.exports = { assessIAReadiness };
