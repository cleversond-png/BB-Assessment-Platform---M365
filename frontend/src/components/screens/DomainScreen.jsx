import { useState } from 'react'
import { PageHeader, Card, Btn, Pill, MetricStat, Icon } from '../primitives/index.jsx'

const DOMAIN_META = {
  baseline:      { label: 'Baseline',         icon: 'building-2',   subtitle: 'Coletores que avaliam licenciamento, usuários e adoção de serviços Microsoft 365.' },
  entraId:       { label: 'Entra ID',          icon: 'shield-check', subtitle: 'Coletores que avaliam identidade, autenticação, privilégios e proteção de risco no tenant.' },
  sharePoint:    { label: 'SharePoint',        icon: 'folder-tree',  subtitle: 'Coletores que avaliam permissões, ownership, conteúdo obsoleto, arquivos e armazenamento.' },
  governance:    { label: 'Governança',        icon: 'scale',        subtitle: 'Coletores que avaliam classificação de dados, auditoria, DLP e retenção.' },
  emailSecurity: { label: 'Email Security',    icon: 'mail-check',   subtitle: 'Coletores que verificam registros DNS de segurança de email (SPF, DMARC, DKIM).' },
  iaReadiness:   { label: 'Copilot Readiness', icon: 'sparkles',     subtitle: 'Síntese dos pré-requisitos técnicos para deployment seguro do Microsoft 365 Copilot.' },
}

const COLLECTOR_META = {
  // Baseline
  tenantInfo:         { label: 'Informações do Tenant', weight: null, requires: 'Organization.Read.All' },
  licensing:          { label: 'Licenciamento',          weight: 3,    requires: 'Organization.Read.All' },
  users:              { label: 'Usuários',               weight: 3,    requires: 'User.Read.All' },
  usage:              { label: 'Adoção / MAU',           weight: 2,    requires: 'Reports.Read.All' },
  // Entra ID
  mfa:                { label: 'MFA Coverage',                       weight: 2, requires: 'Entra P1 + UserAuthenticationMethod.Read.All' },
  conditionalAccess:  { label: 'Conditional Access',                 weight: 2, requires: 'Entra P1 + Policy.Read.All' },
  privileged:         { label: 'Privileged Roles',                   weight: 2, requires: 'RoleManagement.Read.Directory' },
  guests:             { label: 'Guest Users',                        weight: 1, requires: 'User.Read.All' },
  riskyUsers:         { label: 'Risky Users (Identity Protection)',  weight: 2, requires: 'Entra P2 + IdentityRiskyUser.Read.All' },
  // SharePoint
  permissions:        { label: 'Permissões / Sharing',   weight: 3, requires: 'Sites.Read.All' },
  ownership:          { label: 'Ownership de Sites',      weight: 3, requires: 'Sites.Read.All, User.Read.All' },
  staleContent:       { label: 'Conteúdo Obsoleto',       weight: 2, requires: 'Sites.Read.All' },
  files:              { label: 'Arquivos (grandes/dupl)', weight: 2, requires: 'Sites.Read.All, Files.Read.All' },
  storage:            { label: 'Armazenamento',           weight: 2, requires: 'Sites.Read.All' },
  // Governance
  sensitivityLabels:  { label: 'Sensitivity Labels',      weight: 3, requires: 'InformationProtectionPolicy.Read.All' },
  audit:              { label: 'Unified Audit Log',        weight: 3, requires: 'AuditLog.Read.All' },
  dlp:                { label: 'DLP Policies',             weight: 2, requires: 'Indisponível via Graph' },
  retention:          { label: 'Retention Policies',       weight: 2, requires: 'Indisponível via Graph' },
  // Email Security
  spf:                { label: 'SPF',   weight: 2, requires: 'DNS lookup' },
  dmarc:              { label: 'DMARC', weight: 2, requires: 'DNS lookup' },
  dkim:               { label: 'DKIM',  weight: 2, requires: 'DNS lookup' },
}

function scoreColor(score) {
  if (score == null) return 'var(--neutral-fg)'
  if (score >= 4) return 'var(--score-5)'
  if (score >= 3) return 'var(--score-3)'
  if (score >= 2) return 'var(--score-2)'
  return 'var(--score-0)'
}

function collectorStatus(data) {
  if (!data) return 'neutral'
  if (data.unavailable) return 'neutral'
  if (data.score == null) return 'neutral'
  if (data.score >= 4) return 'ok'
  if (data.score >= 3) return 'warn'
  return 'err'
}

function collectorMetric(id, data) {
  if (!data || data.unavailable) return { value: '—', sub: 'indisponível' }
  const s = data.summary || {}
  switch (id) {
    case 'tenantInfo': return { value: data.defaultDomain || data.displayName || '—', sub: data.country || 'domínio padrão' }
    case 'mfa': return { value: `${s.coveragePercent ?? '?'}%`, sub: `${s.registered ?? '?'} / ${s.total ?? '?'} usuários` }
    case 'conditionalAccess': return { value: `${s.enabled ?? 0}`, sub: 'políticas ativas' }
    case 'privileged': return { value: `${s.globalAdminCount ?? '?'}`, sub: 'Global Admins' }
    case 'guests': return { value: `${s.total ?? '?'}`, sub: `${s.inactive ?? 0} inativos` }
    case 'riskyUsers': return { value: `${(s.highRisk || 0) + (s.mediumRisk || 0)}`, sub: 'usuários em risco' }
    case 'licensing': return { value: `${s.totalLicenses ?? '?'}`, sub: `${s.totalAvailable ?? 0} disponíveis` }
    case 'users': return { value: `${s.total ?? '?'}`, sub: `${s.active ?? '?'} membros ativos` }
    case 'usage': return { value: `${s.adoptionPercent ?? '?'}%`, sub: 'adoção M365 (30d)' }
    case 'permissions': return { value: s.anonymousLinksAllowed ? 'Habilitado' : 'Restrito', sub: 'links anônimos' }
    case 'ownership': return { value: `${(s.ownerlessCount || 0) + (s.disabledOwnerCount || 0)}`, sub: 'sites sem owner válido' }
    case 'staleContent': return { value: `${s.staleRatioPercent ?? '?'}%`, sub: `sites inativos >${s.stalePeriodDays ?? 90}d` }
    case 'files': return { value: `${s.largeFilesCount ?? 0}`, sub: 'arquivos >100MB' }
    case 'storage': return { value: `${s.utilizationPercent ?? '?'}%`, sub: `${formatGB(s.totalStorageGB)} de ${formatGB(s.totalAllocatedGB)}` }
    case 'sensitivityLabels': return { value: `${s.totalLabels ?? 0}`, sub: 'labels publicadas' }
    case 'audit': return { value: s.recentEventsFound > 0 ? 'Ativo' : 'Inativo', sub: 'últimos 30 dias' }
    case 'dlp': return { value: '—', sub: 'fora do Graph API' }
    case 'retention': return { value: '—', sub: 'fora do Graph API' }
    case 'spf': return { value: s.present ? 'Presente' : 'Ausente', sub: s.qualifier || '—' }
    case 'dmarc': return { value: s.present ? 'Presente' : 'Ausente', sub: `p=${s.policy || '?'}` }
    case 'dkim': return { value: s.configured ? 'Configurado' : 'Ausente', sub: 'Exchange Online' }
    default: return { value: `${data.score?.toFixed(1) ?? '?'}`, sub: 'score' }
  }
}

function collectorDetail(id, data) {
  if (!data || data.unavailable) return 'Recurso indisponível — verifique a licença ou a permissão necessária.'
  const s = data.summary || {}
  switch (id) {
    case 'tenantInfo': {
      const domains = data.verifiedDomains?.length ?? 0
      const created = data.createdDateTime ? new Date(data.createdDateTime).toLocaleDateString('pt-BR') : '?'
      return `${data.displayName || '?'}. Domínio padrão: ${data.defaultDomain || '?'}. País: ${data.country || '?'}. ${domains} domínio(s) verificado(s). Tenant criado em ${created}.`
    }
    case 'mfa': return `${s.registered ?? '?'} usuários com pelo menos um método MFA registrado. ${(s.total || 0) - (s.registered || 0)} contas sem método.`
    case 'conditionalAccess': return s.enabled === 0 ? 'Nenhuma política de CA configurada.' : `${s.enabled} políticas ativas. MFA enforced: ${s.mfaEnforced ? 'sim' : 'não'}. Legacy auth bloqueado: ${s.blockLegacyAuth ? 'sim' : 'não'}.`
    case 'privileged': return `${s.globalAdminCount ?? '?'} Global Administrators. PIM em uso: ${s.pimEnabled ? 'sim' : 'não'}.`
    case 'guests': return `${s.total ?? '?'} contas guest. ${s.inactive ?? 0} inativas há >90 dias.`
    case 'riskyUsers': return `${s.highRisk ?? 0} usuários de risco alto, ${s.mediumRisk ?? 0} médio. ${s.confirmedCompromised ?? 0} comprometidos.`
    case 'licensing': return `${s.totalLicenses ?? '?'} licenças totais (${s.paidLicenses ?? 0} pagas, ${s.freeLicenses ?? 0} gratuitas). ${s.totalAssigned ?? 0} atribuídas, ${s.totalAvailable ?? 0} disponíveis (${s.unusedRatioPercent ?? 0}% ociosas). Tier Entra ID: ${data.entraIdTier || '?'}.`
    case 'users': return `${s.total ?? '?'} usuários totais — ${s.members ?? 0} membros, ${s.guests ?? 0} guests. ${s.active ?? '?'} membros ativos. ${s.disabled ?? 0} contas desabilitadas (${s.disabledRatioPercent ?? 0}%). Proporção de guests: ${s.guestRatioPercent ?? 0}%.`
    case 'usage': {
      const svc = s.services || {}
      const parts = []
      if (svc.exchange?.adoptionPercent != null) parts.push(`Exchange ${svc.exchange.adoptionPercent}%`)
      if (svc.teams?.adoptionPercent != null) parts.push(`Teams ${svc.teams.adoptionPercent}%`)
      if (svc.sharePoint?.adoptionPercent != null) parts.push(`SharePoint ${svc.sharePoint.adoptionPercent}%`)
      if (svc.oneDrive?.adoptionPercent != null) parts.push(`OneDrive ${svc.oneDrive.adoptionPercent}%`)
      return `${s.adoptionPercent ?? '?'}% dos usuários M365 ativos nos últimos 30 dias (${s.m365Active ?? '?'} de ${s.m365Total ?? '?'}).${parts.length ? ' Por serviço: ' + parts.join(', ') + '.' : ''}`
    }
    case 'permissions': {
      const sharingLabels = {
        disabled: 'Compartilhamento externo desabilitado',
        existingExternalUserSharingOnly: 'Apenas usuários externos já convidados',
        externalUserSharingOnly: 'Usuários externos autenticados',
        externalUserAndGuestSharing: 'Usuários externos e convidados anônimos (mais permissivo)',
      }
      const sharingLabel = sharingLabels[s.sharingCapability] || s.sharingCapability || '?'
      return `Links anônimos: ${s.anonymousLinksAllowed ? 'habilitados' : 'desabilitados'}. Nível de sharing: ${sharingLabel}.`
    }
    case 'ownership': return `${s.ownerlessCount ?? 0} sites sem owner. ${s.disabledOwnerCount ?? 0} sites com owner desativado.`
    case 'staleContent': return `${s.staleSiteCount ?? 0} sites sem atividade há >${s.stalePeriodDays ?? 90} dias (${s.staleRatioPercent ?? '?'}% do total).`
    case 'files': return `${s.largeFilesCount ?? 0} arquivos acima de 100MB. ${s.duplicateGroupsCount ?? 0} grupos de duplicatas.`
    case 'storage': return `${s.totalStorageGB ?? '?'} GB usados de ${s.totalAllocatedGB ?? '?'} GB alocados (${s.utilizationPercent ?? '?'}% utilização). ${s.sitesCritical ?? 0} sites críticos, ${s.sitesNearing ?? 0} próximos do limite.`
    case 'sensitivityLabels': return `${s.totalLabels ?? 0} labels publicadas. ${s.sublabelCount ?? 0} sublabels. Auto-label: ${s.autoLabelEnabled ? 'ativo' : 'inativo'}.`
    case 'audit': return s.recentEventsFound > 0 ? 'Unified Audit Log ativo com eventos nos últimos 30 dias.' : 'Nenhum evento encontrado — UAL pode estar inativo.'
    case 'spf': return s.present ? `Registro SPF presente. Qualifier: ${s.qualifier || '?'}.` : 'Registro SPF ausente — domínio vulnerável a spoofing.'
    case 'dmarc': return s.present ? `DMARC configurado com p=${s.policy || '?'}.` : 'Registro DMARC ausente.'
    case 'dkim': return s.configured ? 'DKIM configurado para Exchange Online.' : 'DKIM não detectado para Exchange Online.'
    default: return JSON.stringify(data.summary || data || {}, null, 2).slice(0, 300)
  }
}

function formatGB(gb) {
  if (gb == null || gb === '?') return '—'
  const n = typeof gb === 'string' ? parseFloat(gb) : gb
  if (isNaN(n)) return '—'
  if (n >= 1024) return `${(n / 1024).toFixed(1)} TB`
  return `${n} GB`
}

function formatMB(mb) {
  if (mb == null) return '—'
  if (mb >= 1024 * 1024) return `${(mb / (1024 * 1024)).toFixed(1)} TB`
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}

function FilesDetailContent({ data }) {
  const s = data?.summary || {}
  const largeFiles = data?.largeFiles || []
  const dupGroups = data?.duplicates || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Arquivos grandes (>100MB)', value: s.largeFilesCount ?? 0 },
          { label: 'Grupos de duplicatas',      value: s.duplicateGroupsCount ?? 0 },
          { label: 'Arquivos obsoletos (>12m)', value: s.staleFilesCount ?? 0 },
        ].map(m => (
          <div key={m.label} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-1)' }}>
            <div className="t-2xs" style={{ marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontWeight: 700, fontSize: 22, lineHeight: 1, color: m.value > 0 ? 'var(--score-0)' : 'var(--score-5)' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {largeFiles.length > 0 && (
        <div>
          <div className="t-2xs" style={{ marginBottom: 8 }}>Top {largeFiles.length} arquivos grandes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {largeFiles.map((f, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center',
                padding: '8px 10px', borderRadius: 6, background: 'var(--bg-subtle)', border: '1px solid var(--border-1)',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div className="t-sm" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </div>
                  <div className="t-xs" style={{ color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.site}
                  </div>
                </div>
                <span className="t-xs" style={{ color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                  {f.lastModifiedDateTime ? new Date(f.lastModifiedDateTime).toLocaleDateString('pt-BR') : '—'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--score-0)', whiteSpace: 'nowrap' }}>
                  {formatMB(Math.round(f.sizeBytes / (1024 * 1024)))}
                </span>
              </div>
            ))}
          </div>
          {s.coverage && (
            <div className="t-xs" style={{ color: 'var(--fg-3)', marginTop: 6 }}>Cobertura: {s.coverage}</div>
          )}
        </div>
      )}

      {dupGroups.length > 0 && (
        <div>
          <div className="t-2xs" style={{ marginBottom: 8 }}>Top {dupGroups.length} grupos de duplicatas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dupGroups.map((g, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center',
                padding: '6px 10px', borderRadius: 6, background: 'var(--bg-subtle)', border: '1px solid var(--border-1)',
              }}>
                <div className="t-sm" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.files?.[0]?.name || '—'}
                </div>
                <span className="t-xs" style={{ color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{g.copies}× cópias</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--warn-fg)', whiteSpace: 'nowrap' }}>
                  {formatMB(Math.round(g.wastedBytes / (1024 * 1024)))} desperdiçados
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EmailSecurityMatrixContent({ domainData }) {
  const matrix = domainData?.domainsMatrix
  if (!matrix || matrix.length === 0) return null

  function StatusDot({ ok }) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontWeight: 600, fontSize: 12,
        color: ok ? 'var(--ok-fg)' : 'var(--err-fg)',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: ok ? 'var(--ok-fg)' : 'var(--err-fg)', flexShrink: 0 }} />
        {ok ? 'OK' : 'Ausente'}
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="t-2xs" style={{ marginBottom: 8 }}>Status por domínio ({matrix.length} domínios)</div>
      <div style={{ border: '1px solid var(--border-1)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
          padding: '8px 12px', background: 'var(--bg-subtle)',
          borderBottom: '1px solid var(--border-1)',
        }}>
          <span className="t-2xs">Domínio</span>
          <span className="t-2xs" style={{ textAlign: 'center' }}>SPF</span>
          <span className="t-2xs" style={{ textAlign: 'center' }}>DMARC</span>
          <span className="t-2xs" style={{ textAlign: 'center' }}>DKIM</span>
        </div>
        {matrix.map((row, i) => (
          <div key={row.domain} style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
            padding: '10px 12px', alignItems: 'center',
            background: row.isPrimary ? 'var(--brand-50)' : 'transparent',
            borderTop: i === 0 ? 'none' : '1px solid var(--border-1)',
          }}>
            <div style={{ minWidth: 0 }}>
              <span translate="no" className="t-sm" style={{ fontWeight: row.isPrimary ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                {row.domain}
              </span>
              {row.isPrimary && <span className="t-xs" style={{ color: 'var(--brand-600)' }}>primário</span>}
            </div>
            <div style={{ textAlign: 'center' }}>
              {row.spf ? <StatusDot ok={row.spf.present} /> : <span className="t-xs" style={{ color: 'var(--fg-3)' }}>—</span>}
            </div>
            <div style={{ textAlign: 'center' }}>
              {row.dmarc
                ? <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <StatusDot ok={row.dmarc.present} />
                    {row.dmarc.present && row.dmarc.policy && <span className="t-xs" style={{ color: 'var(--fg-3)' }}>p={row.dmarc.policy}</span>}
                  </div>
                : <span className="t-xs" style={{ color: 'var(--fg-3)' }}>—</span>}
            </div>
            <div style={{ textAlign: 'center' }}>
              {row.dkim ? <StatusDot ok={row.dkim.configured} /> : <span className="t-xs" style={{ color: 'var(--fg-3)' }}>—</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const GRAPH_PERM_DOCS = 'https://learn.microsoft.com/en-us/graph/permissions-reference'
const ENTRA_DOCS = 'https://learn.microsoft.com/en-us/entra/identity/authentication/concept-mfa-licensing'

function RequirementBadges({ requires }) {
  if (!requires) return null
  const parts = requires.split(/\s*[,+]\s*/).map(p => p.trim()).filter(Boolean)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {parts.map((p, i) => {
        const lower = p.toLowerCase()
        const isUnavailable = lower.includes('indisponível') || lower.includes('fora do')
        const isDns = lower === 'dns lookup'
        const isLicense = lower.includes('entra p') || lower.startsWith('p1') || lower.startsWith('p2')
        const isGraphPerm = !isUnavailable && !isDns && !isLicense

        let bg, fg, border, href
        if (isUnavailable) { bg = 'var(--bg-subtle)'; fg = 'var(--fg-3)'; border = 'var(--border-1)' }
        else if (isDns)    { bg = 'var(--warn-bg)';   fg = 'var(--warn-fg)'; border = 'var(--warn-bd)'; href = null }
        else if (isLicense){ bg = 'var(--sev-medium-bg)'; fg = 'var(--sev-medium-fg)'; border = 'var(--sev-medium-bd)'; href = ENTRA_DOCS }
        else               { bg = 'var(--brand-50)';  fg = 'var(--brand-600)'; border = 'var(--brand-200)'; href = GRAPH_PERM_DOCS }

        const badge = (
          <span key={i} translate="no" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 5,
            background: bg, color: fg, border: `1px solid ${border}`,
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
            whiteSpace: 'nowrap',
          }}>{p}</span>
        )
        return href
          ? <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{badge}</a>
          : badge
      })}
    </div>
  )
}

const SVC_CONFIG = [
  { key: 'exchange',   label: 'Exchange',   color: '#0078D4' },
  { key: 'teams',      label: 'Teams',       color: '#6264A7' },
  { key: 'sharePoint', label: 'SharePoint',  color: '#038387' },
  { key: 'oneDrive',   label: 'OneDrive',    color: '#0F6CBD' },
]

function UsageDetailContent({ data }) {
  const s = data?.summary || {}
  const svcData = s.services || {}
  const overall = s.adoptionPercent ?? null
  const overallColor = overall == null ? 'var(--fg-3)' : overall >= 65 ? 'var(--score-5)' : overall >= 35 ? 'var(--score-3)' : 'var(--score-0)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 28, lineHeight: 1, color: overallColor }}>{overall ?? '?'}%</span>
        <span className="t-sm" style={{ color: 'var(--fg-2)' }}>
          M365 ativos (30d) · {s.m365Active ?? '?'} de {s.m365Total ?? '?'} usuários
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SVC_CONFIG.map(svc => {
          const d = svcData[svc.key]
          const pct = d?.adoptionPercent ?? null
          return (
            <div key={svc.key} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 38px', gap: 10, alignItems: 'center' }}>
              <span className="t-sm" style={{ color: 'var(--fg-2)' }}>{svc.label}</span>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                {pct != null && (
                  <div style={{ width: `${pct}%`, height: '100%', background: svc.color, borderRadius: 4 }} />
                )}
              </div>
              <span className="t-sm" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--fg-1)' }}>
                {pct != null ? `${pct}%` : '—'}
              </span>
            </div>
          )
        })}
      </div>
      {s.reportDate && (
        <span className="t-xs" style={{ color: 'var(--fg-3)' }}>Relatório de {s.reportDate}</span>
      )}
    </div>
  )
}

const SUFFIX_MAP = {
  '_STUUSEBNFT': ' (Estudantes - Benefício)',
  '_STUDENT':    ' (Estudantes)',
  '_FACULTY':    ' (Docentes)',
  '_IW':         '',
  '_GOV':        ' (Gov)',
  '_GCC':        ' (Gov)',
}

function friendlySkuName(sku) {
  if (sku.displayName && sku.displayName !== sku.skuPartNumber) return sku.displayName
  let name = sku.skuPartNumber
  for (const [suffix, replacement] of Object.entries(SUFFIX_MAP)) {
    if (name.toUpperCase().endsWith(suffix)) {
      name = name.slice(0, -suffix.length) + replacement
      break
    }
  }
  return name
    .replace(/[_]+/g, ' ')
    .replace(/\(([^)]+)\)/g, (_, inner) => `(${inner.trim()})`)
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

function LicensingDetailContent({ data }) {
  const skus = data?.skus || []
  const paid = skus.filter(s => !s.isFree)
  const benefit = skus.filter(s => s.isFree)

  function SkuGroup({ items, color, emptyMsg }) {
    if (items.length === 0) return <div className="t-xs" style={{ color: 'var(--fg-3)' }}>{emptyMsg}</div>
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(sku => {
          const pct = sku.enabled > 0 ? Math.round((sku.assigned / sku.enabled) * 100) : 0
          return (
            <div key={sku.skuPartNumber}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span translate="no" className="t-sm" style={{ fontWeight: 500, color: 'var(--fg-1)' }}>{friendlySkuName(sku)}</span>
                <span className="t-xs" style={{ color: 'var(--fg-3)', flexShrink: 0, marginLeft: 8 }}>
                  {sku.assigned.toLocaleString('pt-BR')} / {sku.enabled.toLocaleString('pt-BR')} · {pct}%
                </span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-subtle)', border: '1px solid var(--border-1)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 5 }} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {paid.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--brand-500)', flexShrink: 0 }} />
            <span className="t-2xs">Licenças pagas</span>
          </div>
          <SkuGroup items={paid} color="var(--brand-500)" emptyMsg="Nenhuma licença paga." />
        </div>
      )}
      {benefit.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: '#0D9488', flexShrink: 0 }} />
            <span className="t-2xs">Benefícios educacionais / governo</span>
          </div>
          <SkuGroup items={benefit} color="#0D9488" emptyMsg="Nenhuma licença de benefício." />
        </div>
      )}
      {data?.entraIdTier && (
        <div className="t-xs" style={{ color: 'var(--fg-3)', borderTop: '1px solid var(--border-1)', paddingTop: 10 }}>
          Tier <span translate="no">Entra ID</span> detectado: <b translate="no">{data.entraIdTier}</b>
        </div>
      )}
    </div>
  )
}

function StorageDetailContent({ data }) {
  const s = data?.summary || {}
  const topSites = (data?.topSitesByStorage || []).slice(0, 10)
  const maxMB = Math.max(...topSites.map(t => t.storageMB), 1)
  const utilizationPct = s.utilizationPercent ?? 0
  const concentrationPct = s.top20PercentStoragePercent ?? null
  const healthy = (s.sitesSampled ?? 0) - (s.sitesNearing ?? 0) - (s.sitesCritical ?? 0)

  function SectionHeader({ color, label }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
        <span className="t-2xs">{label}</span>
      </div>
    )
  }

  function Bar({ label, value, total, pct, color, sub }) {
    const p = pct ?? (total > 0 ? Math.round((value / total) * 100) : 0)
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span className="t-sm" style={{ fontWeight: 500, color: 'var(--fg-1)' }}>{label}</span>
          <span className="t-xs" style={{ color: 'var(--fg-3)', flexShrink: 0, marginLeft: 8 }}>
            {value !== undefined ? `${typeof value === 'number' && value >= 1024 ? `${(value/1024).toFixed(1)} GB` : `${value} ${total !== undefined ? 'sites' : ''}`}${total !== undefined ? ` / ${s.sitesSampled ?? '?'} amostrados` : ''} · ${p}%` : `${p}%`}
          </span>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-subtle)', border: '1px solid var(--border-1)', overflow: 'hidden' }}>
          <div style={{ width: `${p}%`, height: '100%', background: color, borderRadius: 5 }} />
        </div>
        {sub && <div className="t-xs" style={{ color: 'var(--fg-3)', marginTop: 3 }}>{sub}</div>}
      </div>
    )
  }

  const utilizationColor = utilizationPct >= 85 ? '#DC2626' : utilizationPct >= 70 ? '#D97706' : 'var(--brand-500)'
  const concentrationColor = concentrationPct == null ? 'var(--fg-3)' : concentrationPct >= 85 ? '#DC2626' : concentrationPct >= 70 ? '#D97706' : '#16A34A'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <SectionHeader color="var(--brand-500)" label="Utilização de armazenamento (sites amostrados)" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span className="t-sm" style={{ fontWeight: 500 }}>
            <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: utilizationColor }}>{formatGB(s.totalStorageGB)}</span>
            <span className="t-xs" style={{ marginLeft: 6 }}>de {formatGB(s.totalAllocatedGB)} alocados</span>
          </span>
          <span className="t-xs" style={{ color: 'var(--fg-3)' }}>{utilizationPct}% utilizado</span>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-subtle)', border: '1px solid var(--border-1)', overflow: 'hidden' }}>
          <div style={{ width: `${utilizationPct}%`, height: '100%', background: utilizationColor, borderRadius: 5 }} />
        </div>
        {concentrationPct != null && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <span className="t-sm" style={{ fontWeight: 500 }}>Concentração (top 20% dos sites)</span>
              <span className="t-xs" style={{ color: 'var(--fg-3)' }}>
                {s.top20PercentSiteCount ?? '?'} sites · {concentrationPct}%
              </span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-subtle)', border: '1px solid var(--border-1)', overflow: 'hidden' }}>
              <div style={{ width: `${concentrationPct}%`, height: '100%', background: concentrationColor, borderRadius: 5 }} />
            </div>
            <div className="t-xs" style={{ color: 'var(--fg-3)', marginTop: 3 }}>
              Os {s.top20PercentSiteCount ?? '?'} maiores sites concentram {concentrationPct}% do armazenamento amostrado
            </div>
          </div>
        )}
      </div>

      <div>
        <SectionHeader color="#D97706" label="Status de cota dos sites amostrados" />
        {[
          { label: 'Saudáveis',           value: healthy,            color: '#16A34A' },
          { label: 'Próximos do limite',  value: s.sitesNearing ?? 0, color: '#D97706' },
          { label: 'Críticos / Excedidos',value: s.sitesCritical ?? 0,color: '#DC2626' },
        ].map(bar => {
          const total = s.sitesSampled ?? 0
          const pct = total > 0 ? Math.round((bar.value / total) * 100) : 0
          return (
            <div key={bar.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                <span className="t-sm" style={{ fontWeight: 500, color: 'var(--fg-1)' }}>{bar.label}</span>
                <span className="t-xs" style={{ color: 'var(--fg-3)' }}>{bar.value} / {total} sites · {pct}%</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-subtle)', border: '1px solid var(--border-1)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: bar.color, borderRadius: 5 }} />
              </div>
            </div>
          )
        })}
      </div>

      {topSites.length > 0 && (
        <div>
          <SectionHeader color="#7C3AED" label={`Top ${topSites.length} sites por armazenamento`} />
          {topSites.map((site, i) => {
            const pct = Math.round((site.storageMB / maxMB) * 100)
            const color = site.quotaState === 'critical' || site.quotaState === 'exceeded' ? '#DC2626'
              : site.quotaState === 'nearing' ? '#D97706' : '#7C3AED'
            const sizeLabel = formatMB(site.storageMB)
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span translate="no" className="t-sm" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                    {site.displayName || 'Site sem nome'}
                  </span>
                  <span className="t-xs" style={{ color: 'var(--fg-3)', flexShrink: 0 }}>{sizeLabel}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-subtle)', border: '1px solid var(--border-1)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {s.note && (
        <div className="t-xs" style={{ color: 'var(--fg-3)', borderTop: '1px solid var(--border-1)', paddingTop: 10 }}>
          Amostragem: {s.note}. Score baseado nos {s.sitesSampled ?? '?'} sites amostrados de {(s.totalSites ?? 0).toLocaleString('pt-BR')} totais.
        </div>
      )}
    </div>
  )
}

function UsersDetailContent({ data }) {
  const s = data?.summary || {}
  const cats = [
    { label: 'Membros ativos',        value: s.active ?? 0,    total: s.members ?? 0,   color: '#16A34A', sub: `${s.disabledRatioPercent ?? 0}% dos membros estão desabilitados` },
    { label: 'Contas desabilitadas',  value: s.disabled ?? 0,  total: s.members ?? 0,   color: '#DC2626', sub: `de ${(s.members ?? 0).toLocaleString('pt-BR')} membros totais` },
    { label: 'Convidados (Guest)',     value: s.guests ?? 0,    total: s.total ?? 0,     color: '#7C3AED', sub: `${s.guestRatioPercent ?? 0}% do total de usuários` },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {cats.map(cat => {
        const pct = cat.total > 0 ? Math.round((cat.value / cat.total) * 100) : 0
        return (
          <div key={cat.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <span className="t-sm" style={{ fontWeight: 500, color: 'var(--fg-1)' }}>{cat.label}</span>
              <span className="t-xs" style={{ color: 'var(--fg-3)', flexShrink: 0, marginLeft: 8 }}>
                {cat.value.toLocaleString('pt-BR')} / {cat.total.toLocaleString('pt-BR')} · {pct}%
              </span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-subtle)', border: '1px solid var(--border-1)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: cat.color, borderRadius: 5 }} />
            </div>
            <div className="t-xs" style={{ color: 'var(--fg-3)', marginTop: 3 }}>{cat.sub}</div>
          </div>
        )
      })}
    </div>
  )
}

function PrivilegedDetailContent({ data }) {
  const users = data?.privilegedUsers || []
  const s = data?.summary || {}
  const mfaAvailable = s.mfaDataAvailable !== false

  if (users.length === 0) {
    return <div className="t-sm" style={{ color: 'var(--fg-3)' }}>Nenhum usuário privilegiado encontrado.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {!mfaAvailable && (
        <div className="t-xs" style={{ color: 'var(--fg-3)', marginBottom: 8 }}>
          Status de MFA indisponível — Entra P1 necessário para este relatório.
        </div>
      )}
      {users.map((u, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', borderRadius: 8,
          background: 'var(--bg-subtle)', border: '1px solid var(--border-1)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-sm" style={{ fontWeight: 500, color: 'var(--fg-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {u.displayName || u.userPrincipalName}
            </div>
            <div className="t-xs" style={{ color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {u.userPrincipalName}
            </div>
          </div>
          <span translate="no" style={{
            flexShrink: 0, fontSize: 10, fontWeight: 500,
            padding: '2px 6px', borderRadius: 4,
            background: 'var(--brand-50)', color: 'var(--brand-600)',
            border: '1px solid var(--brand-200)', whiteSpace: 'nowrap',
          }}>
            {u.role}
          </span>
          {mfaAvailable && (
            <span style={{
              flexShrink: 0, fontSize: 11, fontWeight: 600, minWidth: 44, textAlign: 'right',
              color: u.mfaRegistered ? '#16A34A' : '#DC2626',
            }}>
              {u.mfaRegistered ? '✓ MFA' : '✗ MFA'}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function ScoreChip({ value, compact }) {
  const color = scoreColor(value)
  if (compact) {
    return (
      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}1A`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
        {value != null ? value.toFixed(1) : '—'}
      </div>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: `${color}1A`, color, fontWeight: 600, fontSize: 12 }}>
      {value != null ? `${value.toFixed(1)} / 5` : '—'}
    </span>
  )
}

function CollectorDetail({ id, data, weight }) {
  if (!id) return <div className="t-sm" style={{ color: 'var(--fg-3)' }}>Selecione um coletor</div>
  const meta = COLLECTOR_META[id] || { label: id, requires: '—' }
  const metric = collectorMetric(id, data)
  const detail = collectorDetail(id, data)
  const status = collectorStatus(data)
  const statusLabel = { ok: 'OK', warn: 'Atenção', err: 'Crítico', neutral: 'Indisponível' }[status]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="t-2xs">Coletor</div>
        <div translate="no" className="t-h2" style={{ marginTop: 2 }}>{meta.label}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, padding: '16px 0', borderTop: '1px solid var(--border-1)', borderBottom: '1px solid var(--border-1)' }}>
        <MetricStat label="Score" value={data?.score != null ? `${data.score.toFixed(1)} / 5` : '—'} />
        {weight != null && <MetricStat label="Peso no domínio" value={String(weight)} />}
        <MetricStat label="Métrica" value={metric.value} sub={metric.sub} />
      </div>
      <div>
        <div className="t-2xs" style={{ marginBottom: 6 }}>Achado</div>
        {id === 'usage'       ? <UsageDetailContent data={data} />
          : id === 'licensing'  ? <LicensingDetailContent data={data} />
          : id === 'users'      ? <UsersDetailContent data={data} />
          : id === 'storage'    ? <StorageDetailContent data={data} />
          : id === 'privileged' ? <PrivilegedDetailContent data={data} />
          : id === 'files'      ? <FilesDetailContent data={data} />
          : <div className="t-body">{detail}</div>
        }
      </div>
      <div>
        <div className="t-2xs" style={{ marginBottom: 6 }}>Status</div>
        <Pill tone={status} dot>{statusLabel}</Pill>
      </div>
      <div>
        <div className="t-2xs" style={{ marginBottom: 6 }}>Pré-requisito</div>
        <RequirementBadges requires={meta.requires} />
      </div>
    </div>
  )
}

export default function DomainScreen({ domainId, result, onBack }) {
  const meta = DOMAIN_META[domainId] || { label: domainId, subtitle: '', icon: 'layout-dashboard' }
  const domain = result?.domains?.[domainId]
  const collectors = domain?.collectors || {}
  const collectorIds = Object.keys(collectors)
  const [selected, setSelected] = useState(collectorIds[0] || null)

  const score = domain?.domainScore ?? 0
  const availableCount = collectorIds.filter(id => !collectors[id]?.unavailable && collectors[id]?.score != null).length

  return (
    <>
      <PageHeader
        breadcrumb={['Overview', 'Domínios', meta.label]}
        kicker={`Domínio · ${meta.label}`}
        title={`${meta.label} · score ${score.toFixed(1)} / 5`}
        subtitle={meta.subtitle}
        right={[
          <Btn key="1" variant="secondary" size="md" icon="arrow-left" onClick={onBack}>Voltar</Btn>,
        ]}
      />

      {domainId === 'emailSecurity' && domain?.domainsMatrix && (
        <Card padding={20} style={{ marginBottom: 16 }}>
          <div className="t-h3" style={{ marginBottom: 4 }}>Coletores por domínio</div>
          <EmailSecurityMatrixContent domainData={domain} />
        </Card>
      )}

      {collectorIds.length === 0 ? (
        <Card padding={32}>
          <div className="t-sm" style={{ textAlign: 'center', color: 'var(--fg-3)' }}>Nenhum dado disponível para este domínio.</div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 16 }}>
          <Card padding={0}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="t-h3">Coletores ({collectorIds.length})</div>
              <Pill tone="info">{availableCount}/{collectorIds.length} disponíveis</Pill>
            </div>
            {collectorIds.map(id => {
              const data = collectors[id]
              const cMeta = COLLECTOR_META[id] || { label: id, weight: null }
              const status = collectorStatus(data)
              const metric = collectorMetric(id, data)
              const isSelected = selected === id
              return (
                <button key={id} onClick={() => setSelected(id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '14px 16px', textAlign: 'left',
                  background: isSelected ? 'var(--brand-50)' : 'transparent',
                  borderTop: 'none', borderRight: 'none',
                  borderLeft: isSelected ? '3px solid var(--brand-500)' : '3px solid transparent',
                  borderBottom: '1px solid var(--border-1)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <ScoreChip value={data?.score} compact />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div translate="no" className="t-body" style={{ fontWeight: 600 }}>{cMeta.label}</div>
                    <div className="t-sm" style={{ color: 'var(--fg-2)' }}>
                      {metric.value} · <span className="t-xs">{metric.sub}</span>
                    </div>
                  </div>
                  <Pill tone={status} dot>{({ ok: 'OK', warn: 'Atenção', err: 'Crítico', neutral: 'N/A' })[status]}</Pill>
                </button>
              )
            })}
          </Card>
          <Card padding={24}>
            <CollectorDetail id={selected} data={selected ? collectors[selected] : null} weight={selected ? (COLLECTOR_META[selected]?.weight) : null} />
          </Card>
        </div>
      )}
    </>
  )
}
