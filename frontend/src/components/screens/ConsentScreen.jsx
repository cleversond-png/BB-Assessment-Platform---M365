import { useState, useEffect, useCallback } from 'react'
import { Copy, Check, RefreshCw, Trash2, ExternalLink } from 'lucide-react'
import { Btn, Pill } from '../primitives/index.jsx'

function StatusPill({ status }) {
  const map = {
    consented: { tone: 'ok',      label: 'Consentido' },
    pending:   { tone: 'neutral', label: 'Pendente'   },
    revoked:   { tone: 'err',     label: 'Revogado'   },
  }
  const { tone, label } = map[status] || { tone: 'neutral', label: status }
  return <Pill tone={tone}>{label}</Pill>
}

function CopyField({ value }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 12px', borderRadius: 'var(--r-md)',
      background: 'var(--bg-subtle)', border: '1px solid var(--border-1)',
    }}>
      <span translate="no" style={{
        flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--fg-2)', wordBreak: 'break-all', lineHeight: 1.5,
      }}>{value}</span>
      <button
        onClick={copy}
        style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: 6,
          border: '1px solid var(--border-2)', background: copied ? 'var(--ok-bg)' : '#fff',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: copied ? 'var(--ok-fg)' : 'var(--fg-2)', transition: 'all 0.15s',
        }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  )
}

function DeleteButton({ tenantId, onDeleted }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function confirm() {
    setLoading(true)
    try {
      await fetch(`/auth/tenants/${tenantId}`, { method: 'DELETE' })
      onDeleted(tenantId)
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>Confirmar?</span>
        <button
          onClick={confirm}
          disabled={loading}
          style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
            background: 'var(--err-bg)', border: '1px solid var(--err-border)',
            color: 'var(--err-fg)', fontWeight: 500,
          }}
        >{loading ? '…' : 'Sim'}</button>
        <button
          onClick={() => setConfirming(false)}
          style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--border-2)', color: 'var(--fg-3)',
          }}
        >Não</button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      style={{
        width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-2)',
        background: 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--fg-3)',
      }}
    >
      <Trash2 size={13} />
    </button>
  )
}

const TENANT_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9-]+\.onmicrosoft\.com)$/i

export default function ConsentScreen({ initialTenantId = '', initialClientName = '' }) {
  const [form, setForm] = useState({ tenantId: initialTenantId, clientName: initialClientName })
  const [generatedUrl, setGeneratedUrl] = useState(null)
  const [loadingGen, setLoadingGen] = useState(false)
  const [genError, setGenError] = useState(null)
  const [tenants, setTenants] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [permissions, setPermissions] = useState([])

  const tenantTrimmed = form.tenantId.trim()
  const tenantValid = tenantTrimmed === '' || TENANT_RE.test(tenantTrimmed)

  useEffect(() => {
    setForm((current) => ({
      tenantId: current.tenantId || initialTenantId,
      clientName: current.clientName || initialClientName,
    }))
  }, [initialTenantId, initialClientName])

  const loadTenants = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch('/auth/tenants')
      const data = await res.json()
      setTenants(data.tenants || [])
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => { loadTenants() }, [loadTenants])

  useEffect(() => {
    fetch('/auth/required-permissions')
      .then(r => r.ok ? r.json() : { permissions: [] })
      .then(d => setPermissions(d.permissions || []))
      .catch(() => {})
  }, [])

  async function generate() {
    if (!form.tenantId.trim()) return
    setLoadingGen(true)
    setGenError(null)
    setGeneratedUrl(null)
    try {
      const params = new URLSearchParams({ tenant_id: form.tenantId.trim() })
      if (form.clientName.trim()) params.set('client_name', form.clientName.trim())
      const res = await fetch(`/auth/consent?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setGeneratedUrl(data.consentUrl)
      loadTenants()
    } catch (err) {
      setGenError(err.message)
    } finally {
      setLoadingGen(false)
    }
  }

  function handleDeleted(tenantId) {
    setTenants((prev) => prev.filter((t) => t.tenantId !== tenantId))
  }

  const consentedCount = tenants.filter((t) => t.status === 'consented').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 960 }}>
      <div>
        <div className="t-h1">Consent Multi-Tenant</div>
        <div className="t-sm" style={{ marginTop: 4 }}>
          Gere URLs de consentimento administrativo e gerencie os tenants autorizados.
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Tenants totais',    value: tenants.length },
          { label: 'Consentidos',        value: consentedCount },
          { label: 'Pendentes',          value: tenants.filter(t => t.status === 'pending').length },
        ].map(({ label, value }) => (
          <div key={label} style={{
            padding: '12px 20px', borderRadius: 'var(--r-md)',
            background: 'var(--bg-card)', border: '1px solid var(--border-1)',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-1)', lineHeight: 1 }}>{value}</span>
            <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Generator panel */}
        <div style={{
          padding: 20, borderRadius: 'var(--r-lg)',
          background: 'var(--bg-card)', border: '1px solid var(--border-1)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-1)' }}>Gerar URL de Consent</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 500 }}>Tenant ID (Directory ID)</label>
            <input
              value={form.tenantId}
              onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && !loadingGen && tenantValid && generate()}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              style={{
                height: 34, padding: '0 10px', borderRadius: 'var(--r-md)',
                border: `1px solid ${tenantValid ? 'var(--border-2)' : 'var(--err-border, #dc2626)'}`, background: '#fff',
                fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)',
                outline: 'none',
              }}
            />
            {!tenantValid && (
              <div style={{ fontSize: 11, color: 'var(--err-fg, #dc2626)', marginTop: 2 }}>
                Use o Directory ID (UUID) ou domínio <code>*.onmicrosoft.com</code> — não o nome da empresa.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 500 }}>Nome do Cliente</label>
            <input
              value={form.clientName}
              onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && !loadingGen && generate()}
              placeholder="Ex: Empresa Acme Ltda"
              style={{
                height: 34, padding: '0 10px', borderRadius: 'var(--r-md)',
                border: '1px solid var(--border-2)', background: '#fff',
                fontSize: 13, fontFamily: 'inherit', color: 'var(--fg-1)',
                outline: 'none',
              }}
            />
          </div>

          <Btn
            variant="primary"
            size="sm"
            icon="play"
            onClick={generate}
            disabled={loadingGen || !tenantTrimmed || !tenantValid}
          >
            {loadingGen ? 'Gerando…' : 'Gerar URL'}
          </Btn>

          {genError && (
            <div style={{
              padding: '8px 12px', borderRadius: 'var(--r-md)',
              background: 'var(--err-bg)', border: '1px solid var(--err-border)',
              color: 'var(--err-fg)', fontSize: 12,
            }}>{genError}</div>
          )}

          {generatedUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 500 }}>URL gerada — envie ao administrador do tenant:</div>
              <CopyField value={generatedUrl} />
              <a
                href={generatedUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, color: 'var(--brand-500)', textDecoration: 'none',
                }}
              >
                <ExternalLink size={12} /> Abrir no navegador
              </a>
            </div>
          )}
        </div>

        {/* Tenants list */}
        <div style={{
          borderRadius: 'var(--r-lg)',
          background: 'var(--bg-card)', border: '1px solid var(--border-1)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border-1)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-1)' }}>
              Tenants Registrados
            </span>
            <button
              onClick={loadTenants}
              disabled={loadingList}
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: '1px solid var(--border-2)', background: 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--fg-3)',
              }}
            >
              <RefreshCw size={13} style={{ animation: loadingList ? 'spin 0.8s linear infinite' : 'none' }} />
            </button>
          </div>

          {tenants.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
              Nenhum tenant registrado ainda.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-1)' }}>
                  {['Cliente', 'Tenant ID', 'Status', 'Data', ''].map(h => (
                    <th key={h} style={{
                      padding: '8px 16px', textAlign: 'left',
                      fontSize: 11, color: 'var(--fg-3)', fontWeight: 600,
                      background: 'var(--bg-subtle)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.tenantId} style={{ borderBottom: '1px solid var(--border-1)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--fg-1)', fontWeight: 500 }}>
                      {t.clientName || <span style={{ color: 'var(--fg-3)', fontStyle: 'italic' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span translate="no" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)' }}>
                        {t.tenantId}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <StatusPill status={t.status} />
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                      {t.consentedAt
                        ? new Date(t.consentedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <DeleteButton tenantId={t.tenantId} onDeleted={handleDeleted} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {permissions.length > 0 && <PermissionsPanel permissions={permissions} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function PermissionsPanel({ permissions }) {
  const [copied, setCopied] = useState(false)
  const text = permissions.map(p => `${p.name}  —  ${p.collectors.join(', ')}`).join('\n')
  function copyAll() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  const grouped = permissions.reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p)
    return acc
  }, {})
  return (
    <div style={{
      borderRadius: 'var(--r-lg)',
      background: 'var(--bg-card)', border: '1px solid var(--border-1)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border-1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-1)' }}>
            Permissões da App Registration
          </div>
          <div className="t-xs" style={{ marginTop: 2 }}>
            {permissions.length} permissões Microsoft Graph (application). Quando uma nova é adicionada, todos os tenants precisam fazer re-consent.
          </div>
        </div>
        <button onClick={copyAll} style={{
          padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
          background: copied ? 'var(--ok-bg)' : '#fff', border: '1px solid var(--border-2)',
          color: copied ? 'var(--ok-fg)' : 'var(--fg-2)', fontWeight: 500, fontFamily: 'inherit',
        }}>{copied ? 'Copiado!' : 'Copiar lista'}</button>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.04em' }}>{cat}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {list.map(p => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '4px 0' }}>
                  <span translate="no" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-1)', minWidth: 280 }}>
                    {p.name}
                  </span>
                  <span className="t-xs" style={{ color: 'var(--fg-3)', flex: 1 }}>
                    {p.collectors.join(', ')}
                    {p.requires && <span style={{ marginLeft: 8, color: 'var(--warn-fg)' }}>· requer {p.requires}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
