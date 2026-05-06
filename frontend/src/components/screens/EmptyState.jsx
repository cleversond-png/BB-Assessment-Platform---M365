function scoreColor(v) {
  if (v == null) return 'var(--fg-3)'
  if (v >= 4) return 'var(--score-5)'
  if (v >= 3) return 'var(--score-3)'
  if (v >= 2) return 'var(--score-2)'
  return 'var(--score-0)'
}

export default function EmptyState({ tenantId, setTenantId, onRun, loading, error, savedReports = [], onLoad }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 24, padding: 32 }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'linear-gradient(135deg, var(--brand-500), var(--brand-700))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--shadow-pop)',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <h1 className="t-h1" style={{ marginBottom: 8 }}>Assessment Platform</h1>
        <p className="t-sm">Insira o Tenant ID do cliente Microsoft 365 e clique em Rodar Assessment para iniciar a análise técnica completa.</p>
      </div>

      {savedReports.length > 0 && (
        <div style={{ width: '100%', maxWidth: 560 }}>
          <div className="t-2xs" style={{ marginBottom: 10, textAlign: 'center' }}>Relatórios salvos — clique para carregar</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {savedReports.map(r => {
              const color = scoreColor(r.overallScore)
              const date = r.assessedAt
                ? new Date(r.assessedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '—'
              return (
                <button key={r.tenantId} onClick={() => onLoad(r.tenantId)} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px', borderRadius: 'var(--r-xl)',
                  background: 'var(--bg-card)', border: '1px solid var(--border-1)',
                  boxShadow: 'var(--shadow-1)', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'inherit',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    background: `${color}1A`, color, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 700, fontSize: 14,
                  }}>
                    {r.overallScore != null ? r.overallScore.toFixed(1) : '—'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-sm" style={{ fontWeight: 600, color: 'var(--fg-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.tenantName || r.tenantId}
                    </div>
                    <div className="t-xs" style={{ color: 'var(--fg-3)', marginTop: 2 }}>{date}</div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--brand-500)', fontWeight: 500 }}>Ver →</span>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-1)' }} />
            <span className="t-xs" style={{ color: 'var(--fg-3)' }}>ou rodar novo assessment</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-1)' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={tenantId}
          onChange={e => setTenantId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && onRun()}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          style={{
            height: 40, padding: '0 14px', borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-2)', background: '#fff',
            fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)',
            outline: 'none', width: 340,
            boxShadow: 'var(--shadow-1)',
          }}
        />
        <button
          onClick={onRun}
          disabled={loading || !tenantId.trim()}
          style={{
            height: 40, padding: '0 18px', borderRadius: 'var(--r-md)',
            background: 'var(--brand-500)', color: '#fff', border: 'none',
            fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
            cursor: loading || !tenantId.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !tenantId.trim() ? 0.6 : 1,
            boxShadow: 'var(--shadow-1)',
          }}
        >
          {loading ? 'Executando…' : 'Rodar Assessment'}
        </button>
      </div>
      {error && (
        <div style={{ padding: '10px 16px', background: 'var(--err-bg)', border: '1px solid var(--err-bd)', borderRadius: 'var(--r-md)', color: 'var(--err-fg)', fontSize: 13, maxWidth: 480, textAlign: 'center' }}>
          {error}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 560, marginTop: 8 }}>
        {[
          { label: '6 domínios', sub: 'Baseline, Entra ID, SharePoint, Governança, Email, IA' },
          { label: '24 coletores', sub: 'Microsoft Graph API v1.0 + beta' },
          { label: '31 regras', sub: 'Motor de recomendações por severidade' },
        ].map(item => (
          <div key={item.label} style={{ padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-1)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-1)', textAlign: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--fg-1)', marginBottom: 4 }}>{item.label}</div>
            <div className="t-xs">{item.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
