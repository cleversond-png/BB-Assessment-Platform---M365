import { Bell } from 'lucide-react'
import { Btn, Pill } from '../primitives/index.jsx'

function BrandMark() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: 'linear-gradient(135deg, var(--brand-500), var(--brand-700))',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--shadow-2)',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <span translate="no" style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>Big Brain</span>
        <span translate="no" style={{ fontWeight: 400, fontSize: 11, color: 'var(--fg-3)' }}>Assessment Platform</span>
      </div>
    </div>
  )
}

function TenantPill({ result }) {
  if (!result) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderRadius: 999,
        background: 'var(--bg-subtle)', border: '1px solid var(--border-1)',
        fontSize: 13, color: 'var(--fg-3)', fontStyle: 'italic',
      }}>
        Nenhum tenant carregado
      </div>
    )
  }
  const tier = result.entraIdTier || 'Free'
  const initials = (result.tenantName || '??').slice(0, 2).toUpperCase()
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 12px 6px 8px', borderRadius: 999,
      background: 'var(--bg-subtle)', border: '1px solid var(--border-1)',
      fontSize: 13, color: 'var(--fg-1)', fontFamily: 'inherit',
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: 4, fontSize: 9, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--brand-100)', color: 'var(--brand-700)',
      }}>{initials}</div>
      <span style={{ fontWeight: 500 }}>{result.tenantName}</span>
      <Pill tone={tier === 'P2' ? 'brand' : tier === 'P1' ? 'info' : 'neutral'} style={{ height: 18, fontSize: 10, padding: '0 6px' }}>
        Entra {tier}
      </Pill>
    </div>
  )
}

export default function AppHeader({ result, onRun, loading, tenantId, setTenantId, user, onLogout }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 56, padding: '0 24px', flexShrink: 0,
      background: 'var(--bg-card)', borderBottom: '1px solid var(--border-1)',
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <BrandMark />
        <div style={{ width: 1, height: 20, background: 'var(--border-2)' }} />
        <TenantPill result={result} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          value={tenantId}
          onChange={e => setTenantId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && onRun()}
          placeholder={result ? 'Novo tenant ID…' : 'Tenant ID (UUID)'}
          style={{
            height: 34, padding: '0 12px', borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-2)', background: '#fff',
            fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)',
            outline: 'none', width: result ? 220 : 280,
          }}
        />
        {result && (
          <Btn variant="secondary" size="sm" icon="download" onClick={() => window.open(`/assessment/results/${result.tenantId}/pdf`, '_blank')}>Exportar PDF</Btn>
        )}
        <Btn variant="primary" size="sm" icon="play" onClick={onRun} disabled={loading || (!result && !tenantId.trim())}>
          {loading ? 'Executando…' : result ? 'Re-rodar' : 'Rodar assessment'}
        </Btn>
        <div style={{ width: 1, height: 20, background: 'var(--border-2)', margin: '0 4px' }} />
        <button style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: '1px solid transparent', cursor: 'pointer', color: 'var(--fg-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bell size={16} strokeWidth={1.75} />
        </button>
        <div title={user?.username} style={{ width: 32, height: 32, borderRadius: 999, background: 'linear-gradient(135deg, var(--brand-400), var(--brand-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600 }}>BB</div>
        <Btn variant="ghost" size="sm" icon="x" onClick={onLogout}>Sair</Btn>
      </div>
    </header>
  )
}
