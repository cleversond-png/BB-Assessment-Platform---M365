const logger = require('../../logger');

// Synthesis domain — no API calls.
// Reads completed domain results and computes Copilot readiness score.
// Each check represents a prerequisite for safe, effective Copilot deployment.

// Weights must sum to 1.00 — verified below.
// critical = Copilot blocker; high = significant risk; medium = recommended practice.
const READINESS_CHECKS = [
  {
    id: 'ANON_LINKS_DISABLED',
    label: 'Links anônimos desabilitados (SharePoint e OneDrive)',
    detail: 'Links anônimos permitem acesso a arquivos sem nenhuma autenticação. O Copilot indexa esse conteúdo e pode entregá-lo na resposta de qualquer usuário do tenant que fizer a pergunta certa.',
    weight: 0.10,
    impact: 'critical',
    check: (d) => {
      const s = d.sharePoint?.collectors?.permissions?.summary;
      if (!s) return false;
      const spOk = s.anonymousLinksAllowed === false;
      const odCap = s.oneDriveSharingCapability;
      const odOk = !odCap || odCap !== 'externalUserAndGuestSharing';
      return spOk && odOk;
    },
  },
  {
    id: 'NO_EVERYONE_OVERSHARING',
    label: 'Sem permissões Everyone em sites ativos',
    detail: 'Permissões para "Everyone" concedem acesso automático a todos no tenant, incluindo contas de serviço e recém-contratados. O Copilot amplifica isso: documentos antes ignorados passam a ser encontrados e citados nas respostas de qualquer colaborador.',
    weight: 0.15,
    impact: 'critical',
    check: (d) => {
      const s = d.sharePoint?.collectors?.oversharing;
      if (!s || s.unavailable) return null; // Sites.Read.All ausente no consent — não pode verificar
      return s.summary?.sitesWithEveryoneCount === 0;
    },
  },
  {
    id: 'MFA_HIGH_COVERAGE',
    label: 'Cobertura MFA ≥ 80%',
    detail: 'Sem MFA, uma senha vazada é suficiente para comprometer uma conta. O invasor ganha acesso ao Copilot com as permissões do usuário — podendo consultar, resumir e exfiltrar dados confidenciais via IA.',
    weight: 0.20,
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
    detail: 'Sem Conditional Access, qualquer dispositivo ou rede pode acessar o Copilot — inclusive dispositivos não gerenciados e redes públicas. Políticas CA definem quem, como e de onde a IA pode ser usada.',
    check: (d) => {
      const ca = d.entraId?.collectors?.conditionalAccess;
      return ca && !ca.unavailable && ca.summary?.enabled > 0;
    },
  },
  {
    id: 'SENSITIVITY_LABELS_CONFIGURED',
    label: 'Sensitivity Labels configurados',
    weight: 0.10,
    impact: 'high',
    detail: 'Sem labels de sensibilidade, o Copilot não distingue dados públicos de confidenciais. Ele pode incluir trechos de documentos marcados como "Confidencial" em respostas compartilhadas com pessoas sem autorização para ver o original.',
    check: (d) => {
      const sl = d.governance?.collectors?.sensitivityLabels;
      if (!sl || sl.unavailable) return false;
      return sl.summary?.totalLabels > 0;
    },
  },
  {
    id: 'AUDIT_ACTIVE',
    label: 'Audit Log com eventos recentes',
    weight: 0.04,
    impact: 'high',
    detail: 'Sem auditoria ativa, não há como rastrear quais dados o Copilot acessou, quais prompts foram feitos ou o que foi gerado. Isso inviabiliza investigações de incidentes e demonstração de compliance.',
    check: (d) => {
      const a = d.governance?.collectors?.audit;
      return a && !a.unavailable && a.summary?.recentEventsFound > 0;
    },
  },
  {
    id: 'COPILOT_DLP_POLICY',
    label: 'Política DLP cobrindo Copilot for M365',
    weight: 0.10,
    impact: 'high',
    detail: 'Políticas DLP genéricas para Exchange e SharePoint não cobrem o Copilot automaticamente. Sem uma política específica para o workload Copilot, a IA pode processar e exibir CPF, dados de cartão ou PII sem nenhum bloqueio. Verificação indireta via alertas de DLP — cobertura específica para Copilot requer auditoria manual no Purview.',
    check: (d) => {
      const dlp = d.governance?.collectors?.dlp;
      if (!dlp || dlp.unavailable) return null;
      // Proxy via DLP alerts: se há alertas recentes, políticas estão ativas.
      // Não confirma cobertura do workload Copilot — retorna null (não verificável).
      if (dlp.proxy) return dlp.summary?.alertsInPeriod > 0 ? true : null;
      return (dlp.summary?.copilotDlpPoliciesCount ?? 0) > 0;
    },
  },
  {
    id: 'OFFICE_CURRENT_CHANNEL',
    label: 'M365 Apps ativos em dispositivos desktop',
    weight: 0.10,
    impact: 'high',
    detail: 'O Copilot só aparece nas aplicações Office instaladas no Current Channel ou Monthly Enterprise Channel. Usuários no Semi-Annual Channel simplesmente não veem o botão do Copilot, independente da licença.',
    check: (d) => {
      const apps = d.baseline?.collectors?.appsChannel;
      if (!apps || apps.unavailable) return false;
      return (apps.summary?.desktopPercent ?? 0) >= 60;
    },
  },
  {
    id: 'COPILOT_PLUGINS_GOVERNED',
    label: 'Plugins do Copilot controlados pelo admin',
    weight: 0.03,
    impact: 'medium',
    detail: 'Cada Graph Connector ativo amplia os dados que o Copilot pode acessar e combinar nas respostas, incluindo sistemas externos como CRM e ERP. Conectores não revisados tornam-se vetores de exposição de dados fora do M365.',
    check: (d) => {
      const ext = d.governance?.collectors?.copilotExtensions;
      if (!ext || ext.unavailable) return true; // no connectors found = no risk
      return ext.summary?.activeConnectionsCount <= 5;
    },
  },
  {
    id: 'LEGACY_AUTH_BLOCKED',
    label: 'Autenticação legada bloqueada (SMTP/IMAP/Basic Auth)',
    weight: 0.08,
    impact: 'critical',
    detail: 'Protocolos legados (SMTP, IMAP, POP3, Exchange ActiveSync) ignoram MFA e Conditional Access. Um usuário com Basic Auth habilitado pode ser comprometido sem acionar nenhuma política de proteção — e o invasor herda acesso ao Copilot.',
    check: (d) => {
      const la = d.entraId?.collectors?.legacyAuth;
      if (!la || la.unavailable) return null;
      return la.summary?.legacySignInCount === 0;
    },
  },
];
// Weight sum: 0.10+0.15+0.20+0.15+0.10+0.04+0.10+0.10+0.03+0.03+0.08 = 1.00
// AUDIT_ACTIVE: 0.05→0.04 | COPILOT_PLUGINS_GOVERNED: 0.05→0.03 | +LEGACY_AUTH_BLOCKED: 0.08

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
  let usedWeight = 0;
  const checks = READINESS_CHECKS.map((c) => {
    let raw;
    try { raw = c.check(domains); } catch { raw = false; }
    const unavailable = raw === null || raw === undefined;
    const passed = unavailable ? false : !!raw;
    if (!unavailable) {
      usedWeight += c.weight;
      if (passed) weightedScore += c.weight;
    }
    return { id: c.id, label: c.label, detail: c.detail, passed, unavailable, weight: c.weight, impact: c.impact };
  });

  const domainScore = usedWeight > 0
    ? Math.round((weightedScore / usedWeight) * 5 * 10) / 10
    : 0;
  const level = READINESS_LEVELS.find((l) => domainScore >= l.min);
  const blockers = checks.filter((c) => !c.unavailable && !c.passed && (c.impact === 'critical' || c.impact === 'high'));

  logger.info({ event: 'assessment_done', domain: 'iaReadiness', tenantId, domainScore, readinessLevel: level.label });

  return {
    domain: 'iaReadiness',
    tenantId,
    assessedAt: new Date().toISOString(),
    domainScore,
    readinessLevel: level.label,
    copilotReady: level.copilotReady,
    checks,
    blockers: blockers.map(({ id, label, detail, impact }) => ({ id, label, detail, impact })),
    summary: {
      passedCount: checks.filter((c) => c.passed).length,
      totalChecks: checks.length,
      unavailableCount: checks.filter((c) => c.unavailable).length,
      criticalBlockers: blockers.filter((b) => b.impact === 'critical').length,
      highBlockers: blockers.filter((b) => b.impact === 'high').length,
    },
  };
}

module.exports = { assessIAReadiness };
