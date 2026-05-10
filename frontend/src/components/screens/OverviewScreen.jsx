import { useState } from 'react'
import { PageHeader, Card, Btn, Pill, ScoreDonut, ScoreBar, MetricStat, Icon } from '../primitives/index.jsx'

const DOMAIN_META = {
  baseline:      { label: 'Baseline',         icon: 'building-2',     totalCollectors: 4 },
  entraId:       { label: 'Entra ID',          icon: 'shield-check',   totalCollectors: 9 },
  sharePoint:    { label: 'SharePoint',        icon: 'folder-tree',    totalCollectors: 5 },
  governance:    { label: 'Governança',        icon: 'scale',          totalCollectors: 4 },
  emailSecurity: { label: 'Email Security',    icon: 'mail-check',     totalCollectors: 3 },
  teams:         { label: 'Teams',             icon: 'message-square', totalCollectors: 2 },
  iaReadiness:   { label: 'Copilot Readiness', icon: 'sparkles',       totalCollectors: 1 },
}

function domainSummary(id, domain) {
  const c = domain?.collectors || {}
  switch (id) {
    case 'baseline': {
      const parts = []
      if (c.licensing?.summary?.totalLicenses) parts.push(`${c.licensing.summary.totalLicenses} licenças`)
      if (c.users?.summary?.totalUsers) parts.push(`${c.users.summary.totalUsers} usuários`)
      if (c.usage?.summary?.adoptionPercent != null) parts.push(`${c.usage.summary.adoptionPercent}% adoção`)
      return parts.join(' · ') || '—'
    }
    case 'entraId': {
      const parts = []
      if (c.mfa && !c.mfa.unavailable) parts.push(`MFA ${c.mfa.summary?.coveragePercent ?? '?'}%`)
      else parts.push('MFA indisponível')
      if (c.conditionalAccess && !c.conditionalAccess.unavailable) parts.push(`${c.conditionalAccess.summary?.enabled ?? 0} pol. CA`)
      if (c.privileged?.summary?.globalAdminCount != null) parts.push(`${c.privileged.summary.globalAdminCount} Global Admins`)
      return parts.join(' · ') || '—'
    }
    case 'sharePoint': {
      const parts = []
      if (c.permissions?.summary) parts.push(`Links anônimos: ${c.permissions.summary.anonymousLinksAllowed ? 'sim' : 'não'}`)
      const orphaned = (c.ownership?.summary?.ownerlessCount || 0) + (c.ownership?.summary?.disabledOwnerCount || 0)
      if (orphaned > 0) parts.push(`${orphaned} sites s/ owner`)
      if (c.staleContent?.summary?.staleRatioPercent != null) parts.push(`${c.staleContent.summary.staleRatioPercent}% stale`)
      return parts.join(' · ') || '—'
    }
    case 'governance': {
      const parts = []
      const labels = c.sensitivityLabels
      if (labels && !labels.unavailable) parts.push(`${labels.summary?.totalLabels || 0} labels`)
      else parts.push('Sem labels')
      if (c.audit?.summary) parts.push(c.audit.summary.recentEventsFound > 0 ? 'Auditoria ativa' : 'Auditoria inativa')
      if (c.dlp?.unavailable) parts.push('DLP indisponível')
      return parts.join(' · ') || '—'
    }
    case 'emailSecurity': {
      const parts = []
      if (c.spf?.summary) parts.push(c.spf.summary.present ? 'SPF ✓' : 'SPF ✗')
      if (c.dmarc?.summary) parts.push(`DMARC p=${c.dmarc.summary.policy || '?'}`)
      if (c.dkim?.summary) parts.push(c.dkim.summary.configured ? 'DKIM ✓' : 'DKIM ✗')
      return parts.join(' · ') || '—'
    }
    case 'teams': {
      const parts = []
      const ext = c.teamsExternalAccess
      const apps = c.teamsSettings
      if (ext && !ext.unavailable) parts.push(ext.summary?.allowsAllExternalDomains ? 'Federação aberta' : 'Federação restrita')
      if (apps && !apps.unavailable) parts.push(apps.summary?.thirdPartyAppsAllowed ? 'Apps sem controle' : 'Apps governadas')
      return parts.join(' · ') || '—'
    }
    case 'iaReadiness': {
      const s = domain?.summary
      if (s) return `${s.passedCount}/${s.totalChecks} checks · ${s.criticalBlockers} bloqueadores críticos`
      return domain?.copilotReady ? 'Pronto para Copilot' : 'Não pronto para Copilot'
    }
    default: return '—'
  }
}

function countAvailable(id, domain) {
  if (!domain?.collectors) return 0
  return Object.values(domain.collectors).filter(c => !c.unavailable && c.score != null).length
}

function DomainCard({ id, domain, onClick }) {
  const meta = DOMAIN_META[id]
  if (!meta) return null
  const score = domain?.domainScore ?? 0
  const color = score >= 4 ? 'var(--score-5)'
    : score >= 3 ? 'var(--score-3)'
    : score >= 2 ? 'var(--score-2)'
    : 'var(--score-0)'
  const available = countAvailable(id, domain)
  const summary = domainSummary(id, domain)
  return (
    <div onClick={onClick} style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-1)',
      borderRadius: 'var(--r-xl)', padding: 20, cursor: 'pointer',
      boxShadow: 'var(--shadow-1)', display: 'flex', flexDirection: 'column', gap: 16,
      transition: '150ms',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-2)' }}>
          <Icon name={meta.icon} size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="t-h3">{meta.label}</div>
          <div className="t-xs" style={{ marginTop: 2 }}>{available}/{meta.totalCollectors} coletores</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color, letterSpacing: '-0.02em' }}>{score.toFixed(1)}</span>
          <span className="t-xs">/ 5</span>
        </div>
      </div>
      <ScoreBar value={score} />
      <div className="t-sm" style={{ color: 'var(--fg-2)' }}>{summary}</div>
    </div>
  )
}

function ReconsentBanner({ result, tenantId }) {
  if (!result?.reconsentNeeded) return null
  const missing = result.missingPermissions || []
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 20px', borderRadius: 'var(--r-xl)',
      background: 'var(--warn-bg)', border: '1px solid var(--warn-bd)', marginBottom: 16,
    }}>
      <div style={{ flexShrink: 0, color: 'var(--warn-fg)' }}>
        <Icon name="triangle-alert" size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, color: 'var(--warn-fg)', fontSize: 14 }}>Re-consent necessário</span>
        <span className="t-sm" style={{ color: 'var(--warn-fg)', marginLeft: 10, opacity: 0.88 }}>
          {missing.length} permissão(ões) ausente(s) na App Registration deste tenant — alguns checks ficaram <b>Não verificados</b>.
        </span>
        <div className="t-xs" style={{ color: 'var(--warn-fg)', marginTop: 6, fontFamily: 'var(--font-mono)', opacity: 0.85 }}>
          {missing.join('  ·  ')}
        </div>
      </div>
      <Btn variant="secondary" size="sm" icon="external-link"
        onClick={() => {
          const url = `/auth/consent?tenant_id=${encodeURIComponent(tenantId || result.tenantId)}`
          fetch(url).then(r => r.json()).then(d => {
            if (d.consentUrl) window.open(d.consentUrl, '_blank', 'noopener')
          })
        }}>
        Gerar URL de re-consent
      </Btn>
    </div>
  )
}

function CopilotReadinessBanner({ iaReadiness }) {
  if (!iaReadiness) return null
  const { copilotReady, readinessLevel, blockers = [], summary = {} } = iaReadiness

  const isWarning = !copilotReady &&
    (readinessLevel?.includes('Parcial') || readinessLevel?.includes('Moderada'))
  const isBlocked = !copilotReady && !isWarning

  let bg, fg, bd, iconName, phrase
  if (copilotReady) {
    bg = 'var(--ok-bg)'; fg = 'var(--ok-fg)'; bd = 'var(--ok-bd)'
    iconName = 'sparkles'
    phrase = 'O tenant atende os pré-requisitos técnicos para deploy do Copilot for Microsoft 365.'
  } else if (isWarning) {
    bg = 'var(--warn-bg)'; fg = 'var(--warn-fg)'; bd = 'var(--warn-bd)'
    iconName = 'triangle-alert'
    phrase = `${summary.passedCount ?? '?'}/${summary.totalChecks ?? '?'} pré-requisitos atendidos — resolva os itens pendentes antes de expandir o Copilot para toda a organização.`
  } else {
    bg = 'var(--sev-critical-bg)'; fg = 'var(--sev-critical-fg)'; bd = 'var(--sev-critical-bd)'
    iconName = 'lock'
    phrase = `${summary.criticalBlockers ?? 0} bloqueador(es) crítico(s) impedem o deploy seguro — o Copilot exporia dados sensíveis sem os controles de governança necessários.`
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 20px', borderRadius: 'var(--r-xl)',
      background: bg, border: `1px solid ${bd}`, marginBottom: 24,
    }}>
      <div style={{ flexShrink: 0, color: fg }}>
        <Icon name={iconName} size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, color: fg, fontSize: 14 }}>{readinessLevel}</span>
        <span className="t-sm" style={{ color: fg, marginLeft: 10, opacity: 0.88 }}>{phrase}</span>
      </div>
      {!copilotReady && blockers.length > 0 && (
        <div style={{ flexShrink: 0, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 320 }}>
          {blockers.slice(0, 2).map(b => (
            <span key={b.id} style={{
              fontSize: 11, fontWeight: 600, padding: '3px 9px',
              borderRadius: 999, background: bd, color: fg, whiteSpace: 'nowrap',
            }}>{b.label}</span>
          ))}
          {blockers.length > 2 && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 9px',
              borderRadius: 999, background: bd, color: fg, whiteSpace: 'nowrap',
            }}>+{blockers.length - 2} mais</span>
          )}
        </div>
      )}
    </div>
  )
}

function ReadinessExplainerCard({ iaReadiness }) {
  const [open, setOpen] = useState(false)
  const checks = iaReadiness?.checks
  if (!checks?.length) return null

  const GREEN_BG   = '#f0fdf4'
  const GREEN_BD   = '#bbf7d0'
  const GREEN_FG   = '#166534'
  const GREEN_ROW  = '#dcfce7'
  const GREEN_ICON = '#86efac'

  const impactLabel = { critical: 'Crítico', high: 'Alto', medium: 'Médio' }

  return (
    <div style={{ marginBottom: 24, borderRadius: 'var(--r-xl)', border: `1px solid ${GREEN_BD}`, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 20px', background: GREEN_BG, cursor: 'pointer', userSelect: 'none',
        }}
      >
        <Icon name="book-open" size={16} style={{ color: GREEN_FG, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 13, color: GREEN_FG, flex: 1 }}>
          O que significa cada pré-requisito do Copilot?
        </span>
        <span style={{ fontSize: 11, color: GREEN_FG, opacity: 0.7, marginRight: 6 }}>
          {open ? 'Fechar guia' : 'Ver explicações'}
        </span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={15} style={{ color: GREEN_FG }} />
      </div>

      {open && (
        <div style={{ background: GREEN_BG }}>
          {checks.map((check, i) => {
            const unavail = check.unavailable
            const passed  = !unavail && check.passed
            const failed  = !unavail && !check.passed

            const iconName = unavail ? 'minus' : passed ? 'check' : 'x'
            const iconBg   = unavail ? 'var(--bg-subtle)' : passed ? GREEN_ROW : 'var(--sev-critical-bg)'
            const iconBd   = unavail ? 'var(--border-2)'  : passed ? GREEN_ICON : 'var(--sev-critical-bd)'
            const iconFg   = unavail ? 'var(--fg-3)'      : passed ? GREEN_FG   : 'var(--sev-critical-fg)'

            const pillBg   = unavail ? 'var(--bg-subtle)' : passed ? GREEN_ROW : 'var(--sev-critical-bg)'
            const pillBd   = unavail ? 'var(--border-1)'  : passed ? GREEN_ICON : 'var(--sev-critical-bd)'
            const pillFg   = unavail ? 'var(--fg-3)'      : passed ? GREEN_FG   : 'var(--sev-critical-fg)'
            const pillText = unavail ? 'Não verificado'   : passed ? 'Atendido' : 'Pendente'

            return (
              <div
                key={check.id}
                style={{
                  display: 'grid', gridTemplateColumns: '28px 1fr auto',
                  alignItems: 'flex-start', gap: 12, padding: '13px 20px',
                  borderTop: `1px solid ${GREEN_BD}`,
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 1,
                  background: iconBg, border: `1px solid ${iconBd}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconFg,
                }}>
                  <Icon name={iconName} size={13} />
                </div>

                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg-0)' }}>{check.label}</div>
                  {check.detail && (
                    <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 3, lineHeight: 1.55 }}>{check.detail}</div>
                  )}
                  {check.impact && (
                    <div style={{ fontSize: 11, color: GREEN_FG, marginTop: 5, opacity: 0.75 }}>
                      Impacto: {impactLabel[check.impact] ?? check.impact} · Peso: {check.weight}
                    </div>
                  )}
                </div>

                <div style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                  background: pillBg, color: pillFg, border: `1px solid ${pillBd}`,
                  whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: 1,
                }}>
                  {pillText}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SeverityCount({ tone, count, label }) {
  const colorMap = {
    critical: 'var(--sev-critical-fg)',
    high: 'var(--sev-high-fg)',
    medium: 'var(--sev-medium-fg)',
    low: 'var(--sev-low-fg)',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="t-2xs">{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: colorMap[tone], lineHeight: 1 }}>{count}</span>
        <span className="t-xs">recomendações</span>
      </div>
    </div>
  )
}

export default function OverviewScreen({ result, onSelectDomain, onOpenRec }) {
  const recs = result.recommendations?.items || []
  const critical = recs.filter(r => r.severity === 'critical')
  const high = recs.filter(r => r.severity === 'high')
  const medium = recs.filter(r => r.severity === 'medium')
  const domains = ['baseline', 'entraId', 'sharePoint', 'governance', 'emailSecurity', 'teams', 'iaReadiness']

  const assessedAt = result.assessedAt ? new Date(result.assessedAt) : null
  const dateStr = assessedAt ? assessedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const timeStr = assessedAt ? assessedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—'

  return (
    <>
      <PageHeader
        kicker={`Assessment · ${dateStr}`}
        title={result.tenantName || result.tenantId}
        subtitle="Resumo do último assessment técnico Microsoft 365. Score consolidado, distribuição por domínio, e bloqueadores críticos para deployment de Copilot."
        right={[
          <Btn key="2" variant="secondary" size="md" icon="share">Compartilhar</Btn>,
        ]}
      />

      <ReconsentBanner result={result} tenantId={result.tenantId} />
      <CopilotReadinessBanner iaReadiness={result.domains?.iaReadiness} />
      <ReadinessExplainerCard iaReadiness={result.domains?.iaReadiness} />

      {/* HERO row: donut + metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, marginBottom: 24 }}>
        <Card padding={28} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="t-2xs">Score consolidado</div>
          <ScoreDonut value={result.overallScore || 0} />
        </Card>
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 24 }}>
          <Card padding={24}>
            {(() => {
              const ti = result.domains?.baseline?.collectors?.tenantInfo
              const users = result.domains?.baseline?.collectors?.users?.summary?.total
              const tier = result.entraIdTier
              const tierSub = tier === 'P2' ? 'Tier máximo' : tier === 'P1' ? 'P2 recomendado' : tier === 'Basic' ? 'P1/P2 recomendado' : 'P1/P2 recomendado'
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                  <MetricStat label="Tenant" value={result.tenantName || '—'} sub={<span className="t-mono">{(result.tenantId || '').slice(0, 8)}…</span>} />
                  <MetricStat label="Domínio primário" value={ti?.defaultDomain || '—'} sub={`${ti?.verifiedDomains?.length ?? '?'} domínio(s) verificado(s)`} />
                  <MetricStat label="Licença Entra" value={tier || '—'} sub={tierSub} />
                  <MetricStat label="Última execução" value={timeStr} sub={dateStr} />
                  <MetricStat label="Usuários" value={users != null ? users.toLocaleString('pt-BR') : '—'} sub="total no tenant" />
                  <MetricStat label="Grupos" value={ti?.groupCount != null ? ti.groupCount.toLocaleString('pt-BR') : '—'} sub="grupos M365 e segurança" />
                  <MetricStat label="Aplicativos" value={ti?.appCount != null ? ti.appCount.toLocaleString('pt-BR') : '—'} sub="app registrations" />
                  <MetricStat label="Dispositivos" value={ti?.deviceCount != null ? ti.deviceCount.toLocaleString('pt-BR') : '—'} sub="registrados no Entra" />
                </div>
              )
            })()}
          </Card>
          <Card padding={24}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, alignItems: 'center' }}>
              <SeverityCount tone="critical" count={critical.length} label="Críticos" />
              <SeverityCount tone="high" count={high.length} label="Altos" />
              <SeverityCount tone="medium" count={medium.length} label="Médios" />
              <Btn variant="primary" size="lg" icon="list-checks" iconRight="arrow-right" onClick={() => onOpenRec()}>
                Ver {recs.length} recomendações
              </Btn>
            </div>
          </Card>
        </div>
      </div>

      {/* Domain grid */}
      <div className="t-h2" style={{ marginBottom: 12 }}>Score por domínio</div>
      <div className="t-sm" style={{ marginBottom: 16 }}>Cada domínio agrupa coletores que rodam contra Microsoft Graph. Clique para abrir o drill-down.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {domains.map(id => (
          <DomainCard key={id} id={id} domain={result.domains?.[id]} onClick={() => onSelectDomain(id)} />
        ))}
      </div>

      {/* Top blockers */}
      {critical.length > 0 && (
        <>
          <div className="t-h2" style={{ marginBottom: 12 }}>Top bloqueadores</div>
          <Card padding={0}>
            {critical.slice(0, 3).map((r, i) => (
              <div key={r.id} onClick={() => onOpenRec(r.id)} style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                borderTop: i === 0 ? 'none' : '1px solid var(--border-1)', cursor: 'pointer',
              }}>
                <Pill tone="critical" dot>critical</Pill>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-body" style={{ fontWeight: 600 }}>{r.id.replace(/_/g, ' ')}</div>
                  <div className="t-sm" style={{ marginTop: 2, color: 'var(--fg-2)' }}>{r.finding}</div>
                </div>
                <Pill tone="neutral">{r.category}</Pill>
                <Icon name="arrow-right" size={16} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  )
}
