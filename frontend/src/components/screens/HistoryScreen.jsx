import { PageHeader, Card, Btn, MetricStat } from '../primitives/index.jsx'

const MOCK_HISTORY = [
  { date: '2026-01-15', overall: 1.8, baseline: 2.6, entraId: 1.0, sharePoint: 2.0, governance: 1.5, emailSecurity: 3.2, iaReadiness: 0.5 },
  { date: '2026-02-12', overall: 2.0, baseline: 2.8, entraId: 1.2, sharePoint: 2.2, governance: 1.8, emailSecurity: 3.6, iaReadiness: 0.8 },
  { date: '2026-03-10', overall: 2.1, baseline: 2.9, entraId: 1.4, sharePoint: 2.4, governance: 1.9, emailSecurity: 3.8, iaReadiness: 1.0 },
  { date: '2026-04-08', overall: 2.3, baseline: 3.0, entraId: 1.6, sharePoint: 2.5, governance: 2.0, emailSecurity: 4.0, iaReadiness: 1.2 },
  { date: '2026-04-30', overall: 2.4, baseline: 3.1, entraId: 1.8, sharePoint: 2.6, governance: 2.0, emailSecurity: 4.0, iaReadiness: 1.5 },
]

const SERIES = [
  { id: 'overall',       label: 'Score consolidado', color: 'var(--brand-500)', width: 2.5 },
  { id: 'entraId',       label: 'Entra ID',          color: '#DC2626', width: 1.5 },
  { id: 'sharePoint',    label: 'SharePoint',         color: '#EA580C', width: 1.5 },
  { id: 'governance',    label: 'Governança',         color: '#D97706', width: 1.5 },
  { id: 'iaReadiness',   label: 'Copilot',            color: '#7C3AED', width: 1.5 },
  { id: 'emailSecurity', label: 'Email Sec',          color: '#15803D', width: 1.5 },
]

export default function HistoryScreen({ result }) {
  const h = MOCK_HISTORY
  const W = 980, H = 280
  const P = { l: 40, r: 24, t: 24, b: 40 }
  const innerW = W - P.l - P.r
  const innerH = H - P.t - P.b
  const xFor = i => P.l + (i / (h.length - 1)) * innerW
  const yFor = v => P.t + innerH - (v / 5) * innerH
  const pathD = key => h.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(p[key])}`).join(' ')

  const last = h[h.length - 1]
  const first = h[0]
  const delta = (last.overall - first.overall).toFixed(1)

  const recentScore = result?.overallScore
  const currentData = recentScore != null
    ? [...h.slice(0, -1), { ...last, overall: recentScore }]
    : h

  return (
    <>
      <PageHeader
        kicker={`Tendência · ${h.length} assessments`}
        title="Histórico"
        subtitle="Evolução do score consolidado e por domínio. Dados de histórico são mockados — assessments futuros serão persistidos automaticamente."
        right={[
          <Btn key="1" variant="secondary" size="md" icon="calendar-range">Últimos 90 dias</Btn>,
          <Btn key="2" variant="secondary" size="md" icon="download">Exportar série</Btn>,
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <MetricStat label="Score atual" value={recentScore != null ? recentScore.toFixed(1) : last.overall.toFixed(1)} sub={`vs. ${first.overall.toFixed(1)} (15 jan)`} />
        <MetricStat label="Δ desde início" value={`+${delta}`} sub={`${h.length} assessments`} tone="ok" />
        <MetricStat label="Maior salto" value="Email Sec" sub="+0.8 desde início" />
        <MetricStat label="Próximo assessment" value="28 mai" sub="agendado" />
      </div>

      <Card padding={20} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          {SERIES.map(s => (
            <div key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-2)' }}>
              <span style={{ width: 14, height: 2.5, background: s.color, borderRadius: 999, display: 'block' }} />
              {s.label}
            </div>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {[0, 1, 2, 3, 4, 5].map(v => (
            <g key={v}>
              <line x1={P.l} x2={W - P.r} y1={yFor(v)} y2={yFor(v)} stroke="var(--border-1)" strokeDasharray={v === 0 || v === 5 ? '' : '2 4'} />
              <text x={P.l - 8} y={yFor(v) + 4} fontSize="10" fill="var(--fg-3)" textAnchor="end" fontFamily="var(--font-mono)">{v.toFixed(1)}</text>
            </g>
          ))}
          {h.map((p, i) => (
            <text key={i} x={xFor(i)} y={H - 14} fontSize="10" fill="var(--fg-3)" textAnchor="middle" fontFamily="var(--font-sans)">
              {new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </text>
          ))}
          {SERIES.map(s => (
            <path key={s.id} d={pathD(s.id)} stroke={s.color} strokeWidth={s.width} fill="none"
              strokeLinecap="round" strokeLinejoin="round" opacity={s.id === 'overall' ? 1 : 0.7} />
          ))}
          {h.map((p, i) => (
            <circle key={i} cx={xFor(i)} cy={yFor(p.overall)} r="3.5" fill="white" stroke="var(--brand-500)" strokeWidth="2" />
          ))}
        </svg>
      </Card>

      <div className="t-h2" style={{ marginBottom: 12 }}>Mudanças recentes</div>
      <Card padding={0}>
        {h.slice().reverse().slice(0, 4).map((p, i, arr) => {
          const prev = arr[i + 1]
          const d = prev ? (p.overall - prev.overall) : 0
          const changes = [
            i === 0 && '+0.2 Entra ID · MFA cobertura subiu de 58% → 65%',
            i === 1 && '+0.1 SharePoint · Sites órfãos resolvidos',
            i === 2 && '+0.4 Email Security · DMARC escalado para p=quarantine',
            i === 3 && 'Primeiro assessment registrado',
          ].filter(Boolean)[0]
          return (
            <div key={p.date} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 120px 80px', alignItems: 'center', gap: 16, padding: '14px 20px', borderTop: i === 0 ? 'none' : '1px solid var(--border-1)' }}>
              <div className="t-mono-lg">{new Date(p.date).toLocaleDateString('pt-BR')}</div>
              <div className="t-sm" style={{ color: 'var(--fg-2)' }}>{changes}</div>
              <div className="t-mono" style={{ textAlign: 'right' }}>score {p.overall.toFixed(1)}</div>
              <div style={{ textAlign: 'right' }}>
                {prev && <span style={{ fontSize: 12, fontWeight: 500, color: d > 0 ? 'var(--ok-fg)' : 'var(--err-fg)' }}>{d > 0 ? '+' : ''}{d.toFixed(1)}</span>}
              </div>
            </div>
          )
        })}
      </Card>
    </>
  )
}
