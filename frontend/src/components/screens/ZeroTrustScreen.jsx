import { useState } from 'react'
import { PageHeader, Card, Btn, Pill, ScoreBar, Icon } from '../primitives/index.jsx'
import { mapZeroTrustPillars } from '../../utils/mapZeroTrustPillars.js'

function scoreColor(v) {
  if (v == null) return 'var(--fg-3)'
  if (v >= 4) return 'var(--score-5)'
  if (v >= 3) return 'var(--score-3)'
  if (v >= 2) return 'var(--score-2)'
  return 'var(--score-0)'
}

function scoreLabel(v) {
  if (v == null) return 'Indisponível'
  if (v >= 4) return 'Maduro'
  if (v >= 3) return 'Aceitável'
  if (v >= 2) return 'Em risco'
  return 'Crítico'
}

function PillarCard({ pillar, onNav }) {
  const { label, icon, collector, licenceBadge, metric } = pillar
  const unavailable = !collector || collector.unavailable
  const score = unavailable ? null : (collector.score ?? null)
  const color = scoreColor(score)
  const metricText = !unavailable ? metric(collector) : null

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-1)',
      borderRadius: 'var(--r-xl)', padding: 20, boxShadow: 'var(--shadow-1)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: unavailable ? 'var(--bg-subtle)' : `${color}1A`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: unavailable ? 'var(--fg-3)' : color,
        }}>
          <Icon name={icon} size={16} />
        </div>
        <div className="t-h3" style={{ flex: 1 }}>{label}</div>
        {unavailable && licenceBadge && (
          <Pill tone="warn">{licenceBadge}</Pill>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: unavailable ? 'var(--fg-3)' : color, letterSpacing: '-0.02em' }}>
          {score != null ? score.toFixed(1) : 'N/A'}
        </span>
        {score != null && <span className="t-xs">/ 5</span>}
        <span className="t-xs" style={{ color: unavailable ? 'var(--fg-3)' : color, marginLeft: 4, fontWeight: 600 }}>
          {scoreLabel(score)}
        </span>
      </div>

      {score != null && <ScoreBar value={score} />}

      {metricText && (
        <div className="t-sm" style={{ color: 'var(--fg-2)' }}>{metricText}</div>
      )}
      {unavailable && !metricText && (
        <div className="t-sm" style={{ color: 'var(--fg-3)' }}>
          {licenceBadge ? `Requer licença ${licenceBadge}` : 'Dados não coletados'}
        </div>
      )}

      <Btn variant="ghost" size="sm" iconRight="arrow-right" onClick={() => onNav(pillar.domainNav)}
        style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>
        Ver detalhes
      </Btn>
    </div>
  )
}

function TopActions({ recs, onOpenRec }) {
  const [filter, setFilter] = useState('all')

  const filtered = recs
    .filter(r => filter === 'all' || r.severity === filter)
    .slice(0, 10)

  const counts = {
    all: recs.length,
    critical: recs.filter(r => r.severity === 'critical').length,
    high: recs.filter(r => r.severity === 'high').length,
  }

  const tabs = [
    { id: 'all',      label: 'Todas',    tone: 'neutral' },
    { id: 'critical', label: 'Críticas', tone: 'critical' },
    { id: 'high',     label: 'Altas',    tone: 'high' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="t-h2">Top Ações</div>
        <Btn variant="ghost" size="sm" iconRight="arrow-right" onClick={() => onOpenRec()}>
          Ver todas as recomendações
        </Btn>
      </div>
      <div className="t-sm" style={{ color: 'var(--fg-2)', marginBottom: 12 }}>
        Ações priorizadas por severidade. Exibindo as 10 primeiras do filtro selecionado.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 999,
            background: filter === t.id ? 'var(--fg-1)' : 'var(--bg-card)',
            border: `1px solid ${filter === t.id ? 'var(--fg-1)' : 'var(--border-1)'}`,
            color: filter === t.id ? '#fff' : 'var(--fg-1)',
            fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
          }}>
            {t.label}
            <span style={{ fontSize: 11, opacity: 0.7 }}>{counts[t.id] ?? recs.length}</span>
          </button>
        ))}
      </div>

      <Card padding={0}>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <div className="t-sm" style={{ color: 'var(--fg-3)' }}>Nenhuma recomendação nessa categoria.</div>
          </div>
        )}
        {filtered.map((r, i) => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
            borderTop: i === 0 ? 'none' : '1px solid var(--border-1)',
          }}>
            <Pill tone={r.severity} dot>{r.severity}</Pill>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-body" style={{ fontWeight: 600 }}>{r.id.replace(/_/g, ' ')}</div>
              <div className="t-sm" style={{ color: 'var(--fg-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.finding}
              </div>
            </div>
            <Pill tone="neutral">{r.category}</Pill>
          </div>
        ))}
      </Card>
    </div>
  )
}

function BlockersPanel({ result, onReconsent }) {
  const missing = result?.missingPermissions || []
  const errors  = result?.assessmentErrors || {}
  const hasErrors = Object.keys(errors).length > 0
  const [errOpen, setErrOpen] = useState(hasErrors)

  return (
    <div>
      <div className="t-h2" style={{ marginBottom: 12 }}>Bloqueios e Erros</div>

      {result?.reconsentNeeded && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
          borderRadius: 'var(--r-xl)', background: 'var(--warn-bg)', border: '1px solid var(--warn-bd)', marginBottom: 16,
        }}>
          <Icon name="alert-triangle" size={20} style={{ color: 'var(--warn-fg)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: 'var(--warn-fg)', fontSize: 14 }}>Re-consent necessário</span>
            <span className="t-sm" style={{ color: 'var(--warn-fg)', marginLeft: 10, opacity: 0.88 }}>
              {missing.length} permissão(ões) ausente(s) na App Registration deste tenant.
            </span>
          </div>
          <Btn variant="secondary" size="sm" icon="external-link" onClick={onReconsent}>
            Gerar URL de re-consent
          </Btn>
        </div>
      )}

      <Card padding={20} style={{ marginBottom: 16 }}>
        <div className="t-2xs" style={{ marginBottom: 10 }}>Permissões ausentes</div>
        {missing.length === 0
          ? <div className="t-sm" style={{ color: 'var(--fg-3)' }}>Nenhuma permissão ausente detectada.</div>
          : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {missing.map(p => (
                <span key={p} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12, padding: '3px 8px',
                  background: 'var(--err-bg)', border: '1px solid var(--err-bd)',
                  color: 'var(--err-fg)', borderRadius: 6,
                }}>{p}</span>
              ))}
            </div>
          )
        }
        <div className="t-xs" style={{ color: 'var(--fg-3)', marginTop: 12 }}>
          <b>Falta de permissão</b> — a App Registration não tem o escopo Graph necessário; o administrador do tenant precisa re-consentir.{' '}
          <b>Falta de licença</b> — o tenant não possui Entra ID P1/P2 e o collector ficou indisponível; nenhuma ação de permissão resolve isso.
        </div>
      </Card>

      {hasErrors && (
        <Card padding={0}>
          <button onClick={() => setErrOpen(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '14px 20px', background: 'transparent', border: 'none',
            fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
          }}>
            <Icon name="octagon-x" size={16} style={{ color: 'var(--err-fg)' }} />
            <span className="t-body" style={{ fontWeight: 600, flex: 1 }}>
              Erros de coleta ({Object.keys(errors).length} domínio{Object.keys(errors).length > 1 ? 's' : ''})
            </span>
            <Icon name={errOpen ? 'chevron-up' : 'chevron-down'} size={14} style={{ color: 'var(--fg-3)' }} />
          </button>
          {errOpen && (
            <div style={{ padding: '0 20px 20px' }}>
              {Object.entries(errors).map(([domain, errs]) => (
                <div key={domain} style={{ marginBottom: 12 }}>
                  <div className="t-2xs" style={{ marginBottom: 4, textTransform: 'capitalize' }}>{domain}</div>
                  {typeof errs === 'string'
                    ? <div className="t-mono" style={{ fontSize: 12, color: 'var(--err-fg)' }}>{errs}</div>
                    : Object.entries(errs).map(([k, v]) => (
                      <div key={k} className="t-mono" style={{ fontSize: 12, color: 'var(--err-fg)', marginBottom: 2 }}>
                        {k}: {v}
                      </div>
                    ))
                  }
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

export default function ZeroTrustScreen({ result, onSelectDomain, onOpenRec }) {
  const pillars = mapZeroTrustPillars(result)
  const recs = result?.recommendations?.items || []

  const assessedAt = result?.assessedAt ? new Date(result.assessedAt) : null
  const dateStr = assessedAt
    ? assessedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  function handleReconsent() {
    const url = `/auth/consent?tenant_id=${encodeURIComponent(result?.tenantId || '')}`
    fetch(url).then(r => r.json()).then(d => {
      if (d.consentUrl) window.open(d.consentUrl, '_blank', 'noopener')
    })
  }

  return (
    <>
      <PageHeader
        kicker={`Zero Trust Hub · ${dateStr}`}
        title={result?.tenantName || result?.tenantId || '—'}
        subtitle="Visão executiva dos pilares Zero Trust do tenant. Identidade, acesso privilegiado, auditoria e bloqueadores para deployment seguro do Copilot."
      />

      {/* Bloco B — Pilares Zero Trust */}
      <div className="t-h2" style={{ marginBottom: 12 }}>Pilares Zero Trust</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 32 }}>
        {pillars.map(p => (
          <PillarCard key={p.id} pillar={p} onNav={onSelectDomain} />
        ))}
      </div>

      {/* Bloco C — Top Ações */}
      <div style={{ marginBottom: 32 }}>
        <TopActions recs={recs} onOpenRec={onOpenRec} />
      </div>

      {/* Bloco D — Bloqueios e Erros */}
      <BlockersPanel result={result} onReconsent={handleReconsent} />
    </>
  )
}
