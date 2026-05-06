import { useState } from 'react'
import AppHeader from './components/shell/AppHeader.jsx'
import SideNav from './components/shell/SideNav.jsx'
import EmptyState from './components/screens/EmptyState.jsx'
import OverviewScreen from './components/screens/OverviewScreen.jsx'
import DomainScreen from './components/screens/DomainScreen.jsx'
import RecommendationsScreen from './components/screens/RecommendationsScreen.jsx'
import CopilotReadinessScreen from './components/screens/CopilotReadinessScreen.jsx'
import HistoryScreen from './components/screens/HistoryScreen.jsx'
import ConsentScreen from './components/screens/ConsentScreen.jsx'

const DOMAIN_IDS = ['baseline', 'entraId', 'sharePoint', 'governance', 'emailSecurity']

export default function App() {
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [screen, setScreen] = useState('overview')

  async function runAssessment() {
    const id = tenantId.trim() || result?.tenantId
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/assessment/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setResult(data)
      setScreen('overview')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function renderScreen() {
    // Telas independentes de assessment — acessíveis sempre
    if (screen === 'consent') return <ConsentScreen />

    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--border-1)', borderTopColor: 'var(--brand-500)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div className="t-sm">Executando assessment — pode levar até 60 segundos…</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )
    }

    if (!result) {
      return <EmptyState tenantId={tenantId} setTenantId={setTenantId} onRun={runAssessment} loading={loading} error={error} />
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
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="t-h1">Tenants</div>
            <div className="t-sm">Em breve — esta seção listará todos os tenants com consent ativo e permitirá gerenciar o ciclo de vida.</div>
          </div>
        )
      case 'consent':
        return <ConsentScreen />
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
