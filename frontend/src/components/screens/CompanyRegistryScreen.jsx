import { useEffect, useMemo, useState } from 'react'
import { Btn, Pill } from '../primitives/index.jsx'

const EMPTY_FORM = {
  tenantId: '',
  companyName: '',
  tenantType: 'educational',
  address: {
    street: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Brasil',
  },
  contacts: {
    technical: { name: '', email: '', phone: '' },
    responsible: { name: '', email: '', phone: '' },
  },
}

const TENANT_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9-]+\.onmicrosoft\.com)$/i

function cloneForm(company = EMPTY_FORM) {
  return {
    tenantId: company.tenantId || '',
    companyName: company.companyName || '',
    tenantType: company.tenantType || 'educational',
    address: { ...EMPTY_FORM.address, ...(company.address || {}) },
    contacts: {
      technical: { ...EMPTY_FORM.contacts.technical, ...(company.contacts?.technical || {}) },
      responsible: { ...EMPTY_FORM.contacts.responsible, ...(company.contacts?.responsible || {}) },
    },
  }
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle = {
  height: 34,
  padding: '0 10px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--border-2)',
  background: '#fff',
  fontSize: 13,
  fontFamily: 'inherit',
  color: 'var(--fg-1)',
  outline: 'none',
  minWidth: 0,
}

function TextInput({ value, onChange, placeholder, mono = false, invalid = false }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      style={{
        ...inputStyle,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        borderColor: invalid ? 'var(--err-border, #dc2626)' : 'var(--border-2)',
      }}
    />
  )
}

function Section({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)' }}>{title}</div>
      {children}
    </div>
  )
}

function ContactFields({ title, value, onChange }) {
  function setField(field, next) {
    onChange({ ...value, [field]: next })
  }

  return (
    <Section title={title}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 0.8fr', gap: 10 }}>
        <Field label="Nome">
          <TextInput value={value.name} onChange={(next) => setField('name', next)} placeholder="Nome completo" />
        </Field>
        <Field label="Email">
          <TextInput value={value.email} onChange={(next) => setField('email', next)} placeholder="email@empresa.com.br" />
        </Field>
        <Field label="Telefone">
          <TextInput value={value.phone} onChange={(next) => setField('phone', next)} placeholder="+55..." />
        </Field>
      </div>
    </Section>
  )
}

function tenantTypeLabel(type) {
  return type === 'educational' ? 'Educacional' : 'Corporativo'
}

function formatAddress(address = {}) {
  return [
    [address.street, address.number].filter(Boolean).join(', '),
    address.complement,
    address.district,
    [address.city, address.state].filter(Boolean).join(' - '),
    address.postalCode,
    address.country,
  ].filter(Boolean).join(' · ')
}

export default function CompanyRegistryScreen() {
  const [companies, setCompanies] = useState([])
  const [form, setForm] = useState(cloneForm())
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const tenantTrimmed = form.tenantId.trim()
  const tenantValid = tenantTrimmed === '' || TENANT_RE.test(tenantTrimmed)
  const canSave = form.companyName.trim() && tenantTrimmed && tenantValid && !saving
  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === editingId) || null,
    [companies, editingId]
  )

  useEffect(() => {
    loadCompanies()
  }, [])

  async function loadCompanies() {
    setLoading(true)
    try {
      const res = await fetch('/companies')
      const data = await res.json()
      setCompanies(data.companies || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function setAddress(field, value) {
    setForm((current) => ({ ...current, address: { ...current.address, [field]: value } }))
  }

  function setContact(role, value) {
    setForm((current) => ({
      ...current,
      contacts: { ...current.contacts, [role]: value },
    }))
  }

  function startNew() {
    setEditingId(null)
    setForm(cloneForm())
    setError(null)
  }

  function startEdit(company) {
    setEditingId(company.id)
    setForm(cloneForm(company))
    setError(null)
  }

  async function saveCompany() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const method = editingId ? 'PUT' : 'POST'
      const url = editingId ? `/companies/${editingId}` : '/companies'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      await loadCompanies()
      setEditingId(data.company?.id || null)
      setForm(cloneForm(data.company))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteCompany(company) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/companies/${company.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      await loadCompanies()
      if (editingId === company.id) startNew()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div className="t-h1">Cadastro</div>
          <div className="t-sm" style={{ marginTop: 4 }}>
            Empresas, contatos e dados institucionais para consentimento, assessment e relatórios.
          </div>
        </div>
        <Btn variant="secondary" icon="building-2" onClick={startNew}>Nova empresa</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 0.85fr) minmax(560px, 1.25fr)', gap: 18, alignItems: 'start' }}>
        <div style={{
          borderRadius: 'var(--r-lg)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-1)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="t-h3">Empresas ({companies.length})</div>
            <Btn variant="ghost" size="sm" icon="download" onClick={loadCompanies} disabled={loading}>
              {loading ? '...' : 'Atualizar'}
            </Btn>
          </div>

          {companies.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
              Nenhuma empresa cadastrada.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {companies.map((company) => {
                const active = company.id === editingId
                return (
                  <button
                    key={company.id}
                    onClick={() => startEdit(company)}
                    style={{
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                      padding: '13px 16px',
                      background: active ? 'var(--brand-50)' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border-1)',
                      borderLeft: active ? '3px solid var(--brand-500)' : '3px solid transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {company.companyName}
                        </span>
                        <Pill tone={company.tenantType === 'educational' ? 'info' : 'neutral'} style={{ height: 18, fontSize: 10 }}>
                          {tenantTypeLabel(company.tenantType)}
                        </Pill>
                      </div>
                      <div translate="no" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {company.tenantId}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {company.contacts?.technical?.name || company.contacts?.responsible?.name || 'Contatos pendentes'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div style={{
          padding: 20,
          borderRadius: 'var(--r-lg)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg-1)' }}>
                {editingId ? 'Editar empresa' : 'Nova empresa'}
              </div>
              {selectedCompany && (
                <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 3 }}>
                  Atualizado em {new Date(selectedCompany.updatedAt).toLocaleString('pt-BR')}
                </div>
              )}
            </div>
            {editingId && (
              <Btn variant="danger" size="sm" icon="x" onClick={() => selectedCompany && deleteCompany(selectedCompany)} disabled={saving}>
                Excluir
              </Btn>
            )}
          </div>

          <Section title="Empresa">
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 10 }}>
              <Field label="Nome da empresa">
                <TextInput value={form.companyName} onChange={(value) => setForm((current) => ({ ...current, companyName: value }))} placeholder="Razão social ou nome fantasia" />
              </Field>
              <Field label="Tipo de tenant">
                <select
                  value={form.tenantType}
                  onChange={(event) => setForm((current) => ({ ...current, tenantType: event.target.value }))}
                  style={inputStyle}
                >
                  <option value="educational">Educacional</option>
                  <option value="corporate">Corporativo</option>
                </select>
              </Field>
            </div>
            <Field label="Tenant ID ou domínio onmicrosoft.com">
              <TextInput
                mono
                invalid={!tenantValid}
                value={form.tenantId}
                onChange={(value) => setForm((current) => ({ ...current, tenantId: value }))}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </Field>
          </Section>

          <Section title="Endereço completo">
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.35fr 0.8fr', gap: 10 }}>
              <Field label="Logradouro">
                <TextInput value={form.address.street} onChange={(value) => setAddress('street', value)} placeholder="Rua, avenida..." />
              </Field>
              <Field label="Número">
                <TextInput value={form.address.number} onChange={(value) => setAddress('number', value)} placeholder="Nº" />
              </Field>
              <Field label="Complemento">
                <TextInput value={form.address.complement} onChange={(value) => setAddress('complement', value)} placeholder="Sala, bloco..." />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1fr 0.35fr 0.55fr 0.7fr', gap: 10 }}>
              <Field label="Bairro">
                <TextInput value={form.address.district} onChange={(value) => setAddress('district', value)} placeholder="Bairro" />
              </Field>
              <Field label="Cidade">
                <TextInput value={form.address.city} onChange={(value) => setAddress('city', value)} placeholder="Cidade" />
              </Field>
              <Field label="UF">
                <TextInput value={form.address.state} onChange={(value) => setAddress('state', value)} placeholder="UF" />
              </Field>
              <Field label="CEP">
                <TextInput value={form.address.postalCode} onChange={(value) => setAddress('postalCode', value)} placeholder="00000-000" />
              </Field>
              <Field label="País">
                <TextInput value={form.address.country} onChange={(value) => setAddress('country', value)} placeholder="Brasil" />
              </Field>
            </div>
            {formatAddress(form.address) && (
              <div style={{ fontSize: 12, color: 'var(--fg-3)', padding: '8px 10px', borderRadius: 6, background: 'var(--bg-subtle)', border: '1px solid var(--border-1)' }}>
                {formatAddress(form.address)}
              </div>
            )}
          </Section>

          <ContactFields
            title="Contato técnico"
            value={form.contacts.technical}
            onChange={(value) => setContact('technical', value)}
          />

          <ContactFields
            title="Responsável pela instituição"
            value={form.contacts.responsible}
            onChange={(value) => setContact('responsible', value)}
          />

          {!tenantValid && (
            <div style={{ padding: '8px 12px', borderRadius: 'var(--r-md)', background: 'var(--err-bg)', border: '1px solid var(--err-border)', color: 'var(--err-fg)', fontSize: 12 }}>
              Use o Directory ID ou o domínio inicial *.onmicrosoft.com.
            </div>
          )}

          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 'var(--r-md)', background: 'var(--err-bg)', border: '1px solid var(--err-border)', color: 'var(--err-fg)', fontSize: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
            <Btn variant="secondary" onClick={startNew} disabled={saving}>Limpar</Btn>
            <Btn variant="primary" icon="check" onClick={saveCompany} disabled={!canSave}>
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar empresa'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
