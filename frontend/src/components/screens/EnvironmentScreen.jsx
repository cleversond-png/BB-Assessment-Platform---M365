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
  if (state === 'Running' || state === 'Ready') return 'ok'
  if (state === 'Stopped') return 'warn'
  return 'neutral'
}

function ResourceRow({ environmentId, resource, busy, onAction }) {
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
              onClick={() => onAction(environmentId, resource.name, 'start')}
            >
              Iniciar
            </Btn>
            <Btn
              size="sm"
              icon="square"
              variant="danger"
              disabled={busy || !resource.canStop}
              onClick={() => onAction(environmentId, resource.name, 'stop')}
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

function EnvironmentPanel({ environment, open, loading, busyResource, onToggle, onAction }) {
  const resources = (environment?.resources || []).filter((r) => r.startStopCapable)
  const billing = environment?.billing

  return (
    <Card padding={0}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          minHeight: 64,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="cloud" size={18} style={{ color: 'var(--brand-600)' }} />
            <div className="t-h2" style={{ margin: 0 }}>{environment.label}</div>
          </div>
          <div className="t-xs" style={{ marginTop: 4, color: 'var(--fg-3)' }}>{environment.resourceGroupName}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {loading && <Pill tone="info">Carregando</Pill>}
          <Pill tone="brand">{resources.length} start/stop</Pill>
          <Pill tone={billing?.unavailable ? 'warn' : 'neutral'}>
            {billing?.unavailable ? 'Billing indisponível' : money(billing?.total, billing?.currency)}
          </Pill>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} style={{ color: 'var(--fg-3)' }} />
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
            <div style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--r-md)', padding: 14, background: 'var(--bg-subtle)' }}>
              <div className="t-2xs">Resource group</div>
              <div className="t-sm" style={{ fontWeight: 600, color: 'var(--fg-1)', marginTop: 4 }}>{environment.resourceGroupName}</div>
            </div>
            <div style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--r-md)', padding: 14, background: 'var(--bg-subtle)' }}>
              <div className="t-2xs">Serviços com start/stop</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-1)', marginTop: 4 }}>{resources.length}</div>
            </div>
            <div style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--r-md)', padding: 14, background: 'var(--bg-subtle)' }}>
              <div className="t-2xs">Gasto no mês</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-1)', marginTop: 4 }}>
                {billing?.unavailable ? 'Indisponível' : money(billing?.total, billing?.currency)}
              </div>
              <div className="t-xs" style={{ marginTop: 3 }}>
                {billing?.period ? `${billing.period.from} até ${billing.period.to}` : 'Cost Management'}
              </div>
            </div>
          </div>

          {billing?.unavailable && (
            <div className="t-sm" style={{ color: 'var(--warn-fg)', background: 'var(--warn-bg)', border: '1px solid var(--warn-bd)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
              Billing não disponível: {billing.error}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
              <div>
                <div className="t-h2">Serviços</div>
                <div className="t-xs" style={{ marginTop: 3 }}>
                  Apenas serviços com start/stop são exibidos. Alguns serviços parados ainda podem manter custos residuais.
                </div>
              </div>
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
                environmentId={environment.id}
                resource={resource}
                busy={busyResource === `${environment.id}:${resource.name}`}
                onAction={onAction}
              />
            ))}

            {!loading && resources.length === 0 && (
              <div className="t-sm" style={{ padding: '20px 0', color: 'var(--fg-3)' }}>Nenhum serviço com start/stop encontrado.</div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

export default function EnvironmentScreen() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyResource, setBusyResource] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState({ assessment: true, 'super-admin': true })

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

  async function runAction(environmentId, name, action) {
    setBusyResource(`${environmentId}:${name}`)
    setError(null)
    try {
      const res = await fetch(`/environment/${encodeURIComponent(environmentId)}/resources/${encodeURIComponent(name)}/${action}`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setData((current) => ({
        ...current,
        environments: (current?.environments || []).map((item) => item.id === environmentId ? body : item),
      }))
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

  const environments = data?.environments || (data?.resourceGroupName ? [data] : [])
  const totals = useMemo(() => {
    const resources = environments.flatMap((environment) => environment.resources || [])
    const billings = environments
      .map((environment) => environment.billing)
      .filter((billing) => billing && !billing.unavailable && typeof billing.total === 'number')
    const currencies = [...new Set(billings.map((billing) => billing.currency).filter(Boolean))]
    return {
      actionable: resources.filter((resource) => resource.startStopCapable).length,
      billing: billings.reduce((sum, billing) => sum + billing.total, 0),
      billingCurrency: currencies.length === 1 ? currencies[0] : null,
      billingAvailable: billings.length > 0,
      billingMixedCurrency: currencies.length > 1,
    }
  }, [environments])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <PageHeader
        kicker="Configuração"
        title="Ambiente"
        subtitle="Inventário operacional dos ambientes de produção e ações controladas para serviços que suportam start/stop."
        right={<Btn icon="refresh-cw" variant="secondary" onClick={load} disabled={loading}>Atualizar</Btn>}
      />

      {error && (
        <div className="t-sm" style={{ color: 'var(--err-fg)', background: 'var(--err-bg)', border: '1px solid var(--err-bd)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        <Card padding={18}>
          <div className="t-2xs">Ambientes</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-1)', marginTop: 4 }}>{environments.length}</div>
        </Card>
        <Card padding={18}>
          <div className="t-2xs">Gasto atual total</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-1)', marginTop: 4 }}>
            {totals.billingAvailable ? money(totals.billing, totals.billingCurrency || 'BRL') : 'Indisponível'}
          </div>
          {totals.billingMixedCurrency && <div className="t-xs" style={{ marginTop: 3 }}>Moedas diferentes</div>}
        </Card>
        <Card padding={18}>
          <div className="t-2xs">Serviços com start/stop</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-1)', marginTop: 4 }}>{totals.actionable}</div>
        </Card>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {environments.map((environment) => (
          <EnvironmentPanel
            key={environment.id}
            environment={environment}
            open={open[environment.id] !== false}
            loading={loading}
            busyResource={busyResource}
            onToggle={() => setOpen((current) => ({ ...current, [environment.id]: current[environment.id] === false }))}
            onAction={runAction}
          />
        ))}
      </div>
    </div>
  )
}
