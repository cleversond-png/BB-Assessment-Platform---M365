import { useEffect, useMemo, useState } from 'react'
import { Btn, Card, Icon, PageHeader, Pill } from '../primitives/index.jsx'

function money(value, currency) {
  if (value == null) return 'Indisponível'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(value)
}

function stateTone(state) {
  if (state === 'Running') return 'ok'
  if (state === 'Stopped') return 'warn'
  return 'neutral'
}

function ResourceRow({ resource, busy, onAction }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(180px, 1.1fr) minmax(220px, 1.4fr) 120px 190px',
      gap: 16,
      alignItems: 'center',
      padding: '14px 0',
      borderTop: '1px solid var(--border-1)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div className="t-sm" style={{ fontWeight: 600, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {resource.name}
        </div>
        <div className="t-xs" style={{ marginTop: 2 }}>{resource.location}</div>
      </div>
      <div className="t-xs" style={{ color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {resource.type}
      </div>
      <Pill tone={stateTone(resource.state)} dot>{resource.state || 'N/A'}</Pill>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {resource.startStopCapable ? (
          <>
            <Btn
              size="sm"
              icon="play"
              variant="secondary"
              disabled={busy || !resource.canStart}
              onClick={() => onAction(resource.name, 'start')}
            >
              Iniciar
            </Btn>
            <Btn
              size="sm"
              icon="square"
              variant="danger"
              disabled={busy || !resource.canStop}
              onClick={() => onAction(resource.name, 'stop')}
            >
              Parar
            </Btn>
          </>
        ) : resource.selfHosted ? (
          <span className="t-xs" style={{ color: 'var(--fg-3)' }}>Host atual</span>
        ) : (
          <span className="t-xs" style={{ color: 'var(--fg-3)' }}>Sem start/stop</span>
        )}
      </div>
    </div>
  )
}

export default function EnvironmentScreen() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyResource, setBusyResource] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/environment')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setData(body)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function runAction(name, action) {
    setBusyResource(name)
    setError(null)
    try {
      const res = await fetch(`/environment/resources/${encodeURIComponent(name)}/${action}`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setData((current) => ({ ...current, ...body }))
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyResource(null)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const resources = data?.resources || []
  const actionable = useMemo(() => resources.filter((r) => r.startStopCapable), [resources])
  const billing = data?.billing

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <PageHeader
        kicker="Configuração"
        title="Ambiente"
        subtitle="Inventário operacional do resource group de produção e ações controladas para serviços que suportam start/stop."
        right={<Btn icon="refresh-cw" variant="secondary" onClick={load} disabled={loading}>Atualizar</Btn>}
      />

      {error && (
        <div className="t-sm" style={{ color: 'var(--err-fg)', background: 'var(--err-bg)', border: '1px solid var(--err-bd)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        <Card padding={18}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="cloud" size={18} style={{ color: 'var(--brand-600)' }} />
            <div>
              <div className="t-2xs">Resource group</div>
              <div className="t-sm" style={{ fontWeight: 600, color: 'var(--fg-1)' }}>{data?.resourceGroupName || 'EDUGEST-ZERO_TRUST'}</div>
            </div>
          </div>
        </Card>
        <Card padding={18}>
          <div className="t-2xs">Serviços com start/stop</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-1)', marginTop: 4 }}>{actionable.length}</div>
        </Card>
        <Card padding={18}>
          <div className="t-2xs">Gasto no mês</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-1)', marginTop: 4 }}>
            {billing?.unavailable ? 'Indisponível' : money(billing?.total, billing?.currency)}
          </div>
          <div className="t-xs" style={{ marginTop: 3 }}>
            {billing?.period ? `${billing.period.from} até ${billing.period.to}` : 'Cost Management'}
          </div>
        </Card>
      </div>

      {billing?.unavailable && (
        <div className="t-sm" style={{ color: 'var(--warn-fg)', background: 'var(--warn-bg)', border: '1px solid var(--warn-bd)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
          Billing não disponível: {billing.error}
        </div>
      )}

      <Card padding={20}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <div>
            <div className="t-h2">Recursos</div>
            <div className="t-xs" style={{ marginTop: 3 }}>
              Parar o Web App interrompe a aplicação. O App Service Plan B1 pode continuar gerando custo enquanto existir.
            </div>
          </div>
          {loading && <Pill tone="info">Carregando</Pill>}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 1.1fr) minmax(220px, 1.4fr) 120px 190px',
          gap: 16,
          padding: '10px 0',
          color: 'var(--fg-3)',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          <span>Nome</span>
          <span>Tipo</span>
          <span>Status</span>
          <span style={{ textAlign: 'right' }}>Ações</span>
        </div>

        {resources.map((resource) => (
          <ResourceRow
            key={resource.id}
            resource={resource}
            busy={busyResource === resource.name}
            onAction={runAction}
          />
        ))}

        {!loading && resources.length === 0 && (
          <div className="t-sm" style={{ padding: '20px 0', color: 'var(--fg-3)' }}>Nenhum recurso encontrado.</div>
        )}
      </Card>
    </div>
  )
}
