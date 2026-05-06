import { useState } from 'react'
import { PageHeader, Card, Btn, Pill, Icon } from '../primitives/index.jsx'

export default function RecommendationsScreen({ result }) {
  const recs = result?.recommendations?.items || []
  const [filter, setFilter] = useState('all')
  const [openId, setOpenId] = useState(recs[0]?.id || null)

  const counts = {
    all: recs.length,
    critical: recs.filter(r => r.severity === 'critical').length,
    high: recs.filter(r => r.severity === 'high').length,
    medium: recs.filter(r => r.severity === 'medium').length,
    low: recs.filter(r => r.severity === 'low').length,
  }
  const filtered = recs.filter(r => filter === 'all' || r.severity === filter)

  const filterTabs = [
    { id: 'all', label: 'Todas', tone: 'neutral' },
    { id: 'critical', label: 'Críticas', tone: 'critical' },
    { id: 'high', label: 'Altas', tone: 'high' },
    { id: 'medium', label: 'Médias', tone: 'medium' },
    { id: 'low', label: 'Baixas', tone: 'low' },
  ]

  return (
    <>
      <PageHeader
        kicker={`${recs.length} recomendações priorizadas`}
        title="Recomendações"
        subtitle="Ações priorizadas por severidade. Cada regra é avaliada contra o resultado do assessment — falhas silenciosas para coletores ausentes."
        right={[
          <Btn key="2" variant="secondary" size="md" icon="download">Exportar CSV</Btn>,
        ]}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {filterTabs.map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 999,
            background: filter === t.id ? 'var(--fg-1)' : 'var(--bg-card)',
            border: `1px solid ${filter === t.id ? 'var(--fg-1)' : 'var(--border-1)'}`,
            color: filter === t.id ? '#fff' : 'var(--fg-1)',
            fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
          }}>
            {t.label}
            <span style={{ fontSize: 11, opacity: 0.7 }}>{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <Card padding={0}>
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div className="t-sm" style={{ color: 'var(--fg-3)' }}>Nenhuma recomendação nessa categoria.</div>
          </div>
        )}
        {filtered.map((r, i) => {
          const isOpen = openId === r.id
          const effortColor = { low: 'var(--ok-fg)', medium: 'var(--warn-fg)', high: 'var(--err-fg)' }[r.effort] || 'var(--fg-3)'
          return (
            <div key={r.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-1)' }}>
              <button onClick={() => setOpenId(isOpen ? null : r.id)} style={{
                display: 'grid', gridTemplateColumns: '100px 1fr 130px 90px 24px', alignItems: 'center', gap: 16,
                width: '100%', padding: '14px 20px', background: isOpen ? 'var(--brand-50)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}>
                <Pill tone={r.severity} dot>{r.severity}</Pill>
                <div style={{ minWidth: 0 }}>
                  <div className="t-body" style={{ fontWeight: 600 }}>{r.id.replace(/_/g, ' ')}</div>
                  <div className="t-sm" style={{ color: 'var(--fg-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.finding}</div>
                </div>
                <Pill tone="neutral">{r.category}</Pill>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: effortColor, fontWeight: 500 }}>
                  <Icon name="zap" size={12} />
                  esforço <b>{r.effort}</b>
                </span>
                <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} style={{ color: 'var(--fg-3)' }} />
              </button>

              {isOpen && (
                <div style={{ padding: '0 20px 20px 136px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div className="t-2xs" style={{ marginBottom: 4 }}>Achado</div>
                    <div className="t-body" style={{ color: 'var(--fg-2)' }}>{r.finding}</div>
                  </div>
                  <div>
                    <div className="t-2xs" style={{ marginBottom: 4 }}>Recomendação</div>
                    <div className="t-body" style={{ color: 'var(--fg-1)' }}>{r.recommendation}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="t-mono" style={{ padding: '2px 6px', background: 'var(--bg-subtle)', border: '1px solid var(--border-1)', borderRadius: 4, fontSize: 10 }}>{r.id}</span>
                    {r.reference && (
                      <a href={r.reference} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--brand-600)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        learn.microsoft.com <Icon name="external-link" size={12} />
                      </a>
                    )}
                    <div style={{ flex: 1 }} />
                    <Btn variant="secondary" size="sm">Marcar como resolvida</Btn>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </Card>
    </>
  )
}
