import { useState } from 'react'
import { PageHeader, Card, Btn, Pill, ScoreDonut, Icon } from '../primitives/index.jsx'

function ChecklistRow({ check, divider }) {
  const tone = check.unavailable ? 'neutral'
    : check.passed ? 'ok'
    : check.impact === 'critical' ? 'critical'
    : check.impact === 'high' ? 'high'
    : 'medium'
  const iconName = check.unavailable ? 'minus' : check.passed ? 'check' : 'x'
  const iconBg = check.unavailable ? 'var(--bg-subtle)' : check.passed ? 'var(--ok-bg)' : 'var(--sev-critical-bg)'
  const iconBd = check.unavailable ? 'var(--border-2)' : check.passed ? 'var(--ok-bd)' : 'var(--sev-critical-bd)'
  const iconFg = check.unavailable ? 'var(--fg-3)' : check.passed ? 'var(--ok-fg)' : 'var(--sev-critical-fg)'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 130px 90px', alignItems: 'center', gap: 16, padding: '16px 20px', borderTop: divider ? '1px solid var(--border-1)' : 'none' }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6,
        background: iconBg, border: `1px solid ${iconBd}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconFg,
      }}>
        <Icon name={iconName} size={14} />
      </div>
      <div>
        <div className="t-body" style={{ fontWeight: 500 }}>{check.label || check.id}</div>
        {check.detail && <div className="t-sm" style={{ color: 'var(--fg-2)', marginTop: 2 }}>{check.detail}</div>}
      </div>
      <Pill tone={tone} dot>{check.unavailable ? 'Não verificado' : check.passed ? 'Atendido' : 'Pendente'}</Pill>
      <span className="t-xs">peso <b>{check.weight}</b> · <span style={{ color: 'var(--fg-1)' }}>{check.impact}</span></span>
    </div>
  )
}

function ReadinessExplainerCard({ checks }) {
  const [open, setOpen] = useState(false)
  if (!checks?.length) return null

  const GREEN_BG  = '#f0fdf4'
  const GREEN_BD  = '#bbf7d0'
  const GREEN_FG  = '#166534'
  const GREEN_ROW = '#dcfce7'
  const GREEN_ICN = '#86efac'

  const impactLabel = { critical: 'Crítico', high: 'Alto', medium: 'Médio' }

  return (
    <div style={{ marginBottom: 24, border: `1px solid ${GREEN_BD}`, borderRadius: 'var(--r-xl)', overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', background: GREEN_BG, cursor: 'pointer', userSelect: 'none' }}
      >
        <Icon name="book-open" size={15} style={{ color: GREEN_FG, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 13, color: GREEN_FG, flex: 1 }}>O que significa cada pré-requisito?</span>
        <span style={{ fontSize: 11, color: GREEN_FG, opacity: 0.7, marginRight: 4 }}>{open ? 'Fechar' : 'Ver explicações'}</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} style={{ color: GREEN_FG }} />
      </div>

      {open && (
        <div style={{ background: GREEN_BG }}>
          {checks.map((check) => {
            const unavail = check.unavailable
            const passed  = !unavail && check.passed

            const iconName = unavail ? 'minus' : passed ? 'check' : 'x'
            const iconBg   = unavail ? 'var(--bg-subtle)' : passed ? GREEN_ROW : 'var(--sev-critical-bg)'
            const iconBd   = unavail ? 'var(--border-2)'  : passed ? GREEN_ICN : 'var(--sev-critical-bd)'
            const iconFg   = unavail ? 'var(--fg-3)'      : passed ? GREEN_FG  : 'var(--sev-critical-fg)'
            const pillBg   = unavail ? 'var(--bg-subtle)' : passed ? GREEN_ROW : 'var(--sev-critical-bg)'
            const pillBd   = unavail ? 'var(--border-1)'  : passed ? GREEN_ICN : 'var(--sev-critical-bd)'
            const pillFg   = unavail ? 'var(--fg-3)'      : passed ? GREEN_FG  : 'var(--sev-critical-fg)'
            const pillText = unavail ? 'Não verificado'   : passed ? 'Atendido' : 'Pendente'

            return (
              <div key={check.id} style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto', alignItems: 'flex-start', gap: 12, padding: '12px 18px', borderTop: `1px solid ${GREEN_BD}` }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 1, background: iconBg, border: `1px solid ${iconBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconFg }}>
                  <Icon name={iconName} size={13} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg-0)' }}>{check.label}</div>
                  {check.detail && <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 3, lineHeight: 1.55 }}>{check.detail}</div>}
                  {check.impact && <div style={{ fontSize: 11, color: GREEN_FG, marginTop: 4, opacity: 0.7 }}>Impacto: {impactLabel[check.impact] ?? check.impact} · Peso: {check.weight}</div>}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: pillBg, color: pillFg, border: `1px solid ${pillBd}`, whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: 1 }}>
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

export default function CopilotReadinessScreen({ result }) {
  const ia = result?.domains?.iaReadiness
  const checks = ia?.checks || []
  const blockers = checks.filter(c => !c.passed && !c.unavailable && c.impact === 'critical')
  const passed = checks.filter(c => c.passed).length
  const unavailable = checks.filter(c => c.unavailable).length
  const total = checks.length
  const score = ia?.domainScore ?? 0
  const readinessLabel = ia?.readinessLevel || (ia?.copilotReady ? 'Pronto' : 'Não Pronto')

  return (
    <>
      <PageHeader
        kicker="Domínio · Copilot Readiness"
        title="Copilot Readiness"
        subtitle="Checklist de pré-requisitos técnicos para deployment seguro do Microsoft 365 Copilot. Cada bloqueador crítico impede rollout responsável."
        right={[<Btn key="1" variant="primary" size="md" icon="play">Re-rodar checklist</Btn>]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, marginBottom: 24 }}>
        <Card padding={28} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="t-2xs">Status geral</div>
          <ScoreDonut value={score} label={readinessLabel} />
          <div className="t-sm" style={{ textAlign: 'center' }}>
            <b>{passed} de {total}</b> pré-requisitos atendidos
            {unavailable > 0 && <span style={{ color: 'var(--fg-3)', display: 'block', marginTop: 4 }}>{unavailable} não verificado(s) — permissão ausente no consent</span>}
          </div>
        </Card>

        <Card padding={24}>
          <div className="t-h2" style={{ marginBottom: 12 }}>Bloqueadores críticos</div>
          {blockers.length === 0 ? (
            <div style={{ display: 'flex', gap: 12, padding: 12, background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', borderRadius: 10 }}>
              <Icon name="check" size={18} style={{ color: 'var(--ok-fg)', flexShrink: 0, marginTop: 1 }} />
              <div className="t-body" style={{ fontWeight: 600, color: 'var(--ok-fg)' }}>Nenhum bloqueador crítico identificado.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {blockers.map(b => (
                <div key={b.id} style={{ display: 'flex', gap: 12, padding: 12, background: 'var(--sev-critical-bg)', border: '1px solid var(--sev-critical-bd)', borderRadius: 10 }}>
                  <Icon name="octagon-x" size={18} style={{ color: 'var(--sev-critical-fg)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div className="t-body" style={{ fontWeight: 600 }}>{b.label || b.id}</div>
                    {b.detail && <div className="t-sm" style={{ color: 'var(--fg-2)', marginTop: 2 }}>{b.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ReadinessExplainerCard checks={checks} />

      <div className="t-h2" style={{ marginBottom: 12 }}>Checklist completo</div>
      {checks.length === 0 ? (
        <Card padding={32}>
          <div className="t-sm" style={{ textAlign: 'center', color: 'var(--fg-3)' }}>Dados de IA Readiness não disponíveis.</div>
        </Card>
      ) : (
        <Card padding={0}>
          {checks.map((c, i) => <ChecklistRow key={c.id} check={c} divider={i > 0} />)}
        </Card>
      )}
    </>
  )
}
