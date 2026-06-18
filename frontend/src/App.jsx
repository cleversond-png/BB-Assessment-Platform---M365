import { useState, useEffect } from 'react'
import AppHeader from './components/shell/AppHeader.jsx'
import SideNav from './components/shell/SideNav.jsx'
import EmptyState from './components/screens/EmptyState.jsx'
import OverviewScreen from './components/screens/OverviewScreen.jsx'
import DomainScreen from './components/screens/DomainScreen.jsx'
import RecommendationsScreen from './components/screens/RecommendationsScreen.jsx'
import CopilotReadinessScreen from './components/screens/CopilotReadinessScreen.jsx'
import HistoryScreen from './components/screens/HistoryScreen.jsx'
import ConsentScreen from './components/screens/ConsentScreen.jsx'
import ZeroTrustScreen from './components/screens/ZeroTrustScreen.jsx'
import CompanyRegistryScreen from './components/screens/CompanyRegistryScreen.jsx'

const DOMAIN_IDS = ['baseline', 'entraId', 'sharePoint', 'governance', 'emailSecurity', 'teams']

function scoreColor(v) {
  if (v == null) return 'var(--fg-3)'
  if (v >= 4) return 'var(--score-5)'
  if (v >= 3) return 'var(--score-3)'
  if (v >= 2) return 'var(--score-2)'
  return 'var(--score-0)'
}

function SavedReportsList({ reports, onLoad, activeId }) {
  if (reports.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="t-h1">Clientes</div>
        <div className="t-sm" style={{ color: 'var(--fg-3)' }}>Nenhum relatório salvo ainda. Execute um assessment para ver os resultados aqui.</div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="t-h1">Clientes</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {reports.map(r => {
          const isActive = r.tenantId === activeId
          const date = r.assessedAt ? new Date(r.assessedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
          const color = scoreColor(r.overallScore)
          const critical = r.recommendations?.critical ?? 0
          const high = r.recommendations?.high ?? 0
          return (
            <div key={r.tenantId} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '14px 18px', borderRadius: 'var(--r-xl)',
              background: isActive ? 'var(--brand-50)' : 'var(--bg-card)',
              border: `1px solid ${isActive ? 'var(--brand-200)' : 'var(--border-1)'}`,
              boxShadow: 'var(--shadow-1)',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: `${color}1A`, color, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 700, fontSize: 15,
              }}>
                {r.overallScore != null ? r.overallScore.toFixed(1) : '—'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-sm" style={{ fontWeight: 600, color: 'var(--fg-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.tenantName || r.tenantId}
                </div>
                <div className="t-xs" style={{ color: 'var(--fg-3)', display: 'flex', gap: 10, marginTop: 2 }}>
                  <span>{date}</span>
                  {(critical > 0 || high > 0) && (
                    <span style={{ color: critical > 0 ? 'var(--score-0)' : 'var(--score-2)' }}>
                      {critical > 0 ? `${critical} crítico${critical > 1 ? 's' : ''}` : `${high} alto${high > 1 ? 's' : ''}`}
                    </span>
                  )}
                </div>
              </div>
              {isActive
                ? <span className="t-xs" style={{ color: 'var(--brand-500)', fontWeight: 600, flexShrink: 0 }}>Ativo</span>
                : (
                  <button onClick={() => onLoad(r.tenantId)} style={{
                    flexShrink: 0, height: 32, padding: '0 14px', borderRadius: 'var(--r-md)',
                    background: 'var(--brand-500)', color: '#fff', border: 'none',
                    fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                  }}>
                    Ver relatório
                  </button>
                )
              }
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function App() {
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [screen, setScreen] = useState('overview')
  const [savedReports, setSavedReports] = useState([])
  const [progress, setProgress] = useState(null)

  useEffect(() => {
    fetch('/assessment/results')
      .then(r => r.ok ? r.json() : [])
      .then(setSavedReports)
      .catch(() => {})
  }, [])

  async function loadResult(id) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/assessment/results/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setResult(data)
      setScreen('overview')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function refreshSavedReports() {
    fetch('/assessment/results')
      .then(r => r.ok ? r.json() : [])
      .then(setSavedReports)
      .catch(() => {})
  }

  async function pollJobStatus(id) {
    for (;;) {
      await new Promise(r => setTimeout(r, 4000))
      try {
        const res = await fetch(`/assessment/jobs/${id}`)
        if (!res.ok) continue
        const job = await res.json()
        setProgress(job)
        if (job.status === 'completed') {
          const r = await fetch(`/assessment/results/${id}`)
          if (!r.ok) throw new Error('Falha ao carregar resultado')
          const data = await r.json()
          setResult(data)
          setScreen('overview')
          refreshSavedReports()
          setLoading(false)
          setProgress(null)
          return
        }
        if (job.status === 'failed') {
          throw new Error(job.error || 'Assessment falhou')
        }
      } catch (err) {
        if (err.message.includes('falhou') || err.message.includes('Falha')) {
          setError(err.message)
          setLoading(false)
          setProgress(null)
          return
        }
        // Network hiccup — keep polling
      }
    }
  }

  async function runAssessment() {
    const id = tenantId.trim() || result?.tenantId
    if (!id) return
    setLoading(true)
    setError(null)
    setProgress(null)
    try {
      const res = await fetch('/assessment/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 403 && body.error?.includes('No active consent')) {
          setError('Consentimento administrativo necessário. Gere a URL de consentimento e peça para o admin do tenant aprovar antes de rodar o assessment.')
          setScreen('consent')
          setLoading(false)
          return
        }
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      pollJobStatus(id).catch(err => {
        setError(err.message)
        setLoading(false)
        setProgress(null)
      })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  function renderScreen() {
    // Telas independentes de assessment — acessíveis sempre
    if (screen === 'consent') return <ConsentScreen initialTenantId={tenantId} />

    if (loading) {
      const DOMAIN_LABELS = [
        { key: 'baseline',      label: 'Baseline' },
        { key: 'entraId',       label: 'Entra ID' },
        { key: 'sharePoint',    label: 'SharePoint' },
        { key: 'governance',    label: 'Governança' },
        { key: 'emailSecurity', label: 'Email Security' },
        { key: 'teams',         label: 'Teams' },
      ]
      const doneCount = progress ? Object.values(progress.domains || {}).filter(v => v === 'done' || v === 'error').length : 0
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20 }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--border-1)', borderTopColor: 'var(--brand-500)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div className="t-sm" style={{ color: 'var(--fg-2)' }}>
            {progress ? `Coletando dados… ${doneCount}/6 domínios` : 'Iniciando assessment…'}
          </div>
          {progress && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
              {DOMAIN_LABELS.map(({ key, label }) => {
                const s = progress.domains?.[key]
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 999, flexShrink: 0,
                      background: s === 'done' ? '#16A34A' : s === 'error' ? '#DC2626' : 'var(--bg-subtle)',
                      border: `1px solid ${s === 'done' ? '#16A34A' : s === 'error' ? '#DC2626' : 'var(--border-2)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#fff', fontWeight: 700,
                    }}>
                      {s === 'done' ? '✓' : s === 'error' ? '✗' : ''}
                    </div>
                    <span className="t-sm" style={{ color: s ? 'var(--fg-1)' : 'var(--fg-3)' }}>{label}</span>
                  </div>
                )
              })}
            </div>
          )}
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )
    }

    if (!result) {
      return (
        <EmptyState
          tenantId={tenantId}
          setTenantId={setTenantId}
          onRun={runAssessment}
          onOpenConsent={() => setScreen('consent')}
          loading={loading}
          error={error}
          savedReports={savedReports}
          onLoad={loadResult}
        />
      )
    }

    if (DOMAIN_IDS.includes(screen)) {
      return <DomainScreen domainId={screen} result={result} onBack={() => setScreen('overview')} />
    }

    switch (screen) {
      case 'overview':
        return (
          <OverviewScreen
            result={result}
            onSelectDomain={id => setScreen(id)}
            onOpenRec={() => setScreen('recommendations')}
          />
        )
      case 'baseline':
        return (
          <ZeroTrustScreen
            result={result}
            onSelectDomain={id => setScreen(id)}
            onOpenRec={() => setScreen('recommendations')}
          />
        )
      case 'recommendations':
        return <RecommendationsScreen result={result} />
      case 'iaReadiness':
        return <CopilotReadinessScreen result={result} />
      case 'history':
        return <HistoryScreen result={result} />
      case 'logs':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="t-h1">Logs de execução</div>
            <div className="t-sm">Em breve — esta seção mostrará os logs estruturados de cada collector por assessment.</div>
          </div>
        )
      case 'tenants':
        return <SavedReportsList reports={savedReports} onLoad={loadResult} activeId={result?.tenantId} />
      case 'cadastro':
        return <CompanyRegistryScreen />
      case 'consent':
        return <ConsentScreen initialTenantId={tenantId} />
      default:
        return <OverviewScreen result={result} onSelectDomain={id => setScreen(id)} onOpenRec={() => setScreen('recommendations')} />
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader
        result={result}
        tenantId={tenantId}
        setTenantId={setTenantId}
        onRun={runAssessment}
        loading={loading}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <SideNav active={screen} onSelect={setScreen} result={result} />
        <main style={{ flex: 1, overflow: 'auto', padding: 32, background: 'var(--bg-app)' }}>
          {renderScreen()}
        </main>
      </div>
    </div>
  )
}
