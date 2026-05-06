# Design — M365 Assessment Platform

Documento de trabalho para evolução de design. Descreve decisões arquiteturais, contratos de interface, modelo de scoring, gaps conhecidos e roadmap.

---

## 1. Visão Geral Arquitetural

```
┌─────────────┐     consent URL     ┌──────────────────┐
│   Frontend  │ ─────────────────── │  Auth Routes     │
│  (React)    │                     │  /auth/consent   │
└─────────────┘                     │  /auth/callback  │
       │                            └──────┬───────────┘
       │ POST /assessment/start            │ OAuth2 client_credentials
       │                                   ▼
       ▼                            ┌──────────────────┐
┌─────────────────────┐            │   tokenStore     │ ← in-memory Map
│  Assessment Routes  │            │  (per tenantId)  │
│  /assessment/start  │            └──────────────────┘
│  /assessment/:domain│
└──────────┬──────────┘
           │ Promise.allSettled
           ▼
┌──────────────────────────────────────────────────────────┐
│                    Collectors (por domínio)               │
│  baseline │ entraId │ sharePoint │ governance │ email    │
│  (4)      │ (5)     │ (5)        │ (4)        │ (3)      │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  graphClient.js │  graphGet / graphGetAll / graphGetBeta
              │                 │  + retry (429) + paginação automática
              └────────┬────────┘
                       │ HTTPS / TLS
                       ▼
              Microsoft Graph API (v1.0 + beta)
```

**Princípios que guiam a arquitetura:**
- Zero write no tenant do cliente — todos os endpoints são GET
- Zero content — sem acesso a corpo de e-mail, conteúdo de arquivo, chats
- Least privilege — cada permissão Graph está justificada por um collector
- Isolamento por tenant — token indexado por tenantId, sem cross-tenant leakage
- Resiliência por domínio — falha em um collector não bloqueia outros (`Promise.allSettled`)

---

## 2. Fluxo de Consentimento Multi-Tenant

```
Operador                  Backend                   Azure AD (tenant cliente)
   │                         │                               │
   │  GET /auth/consent       │                               │
   │  ?tenant_id=<UUID>       │                               │
   │ ──────────────────────── │                               │
   │                          │  Gera state (CSRF)            │
   │  ← URL de consentimento  │                               │
   │                          │                               │
   │  Navega para URL ──────────────────────────────────────► │
   │                          │         admin consent dialog  │
   │  ◄──────────────── redirect para /auth/callback?code=... │
   │                          │                               │
   │           POST /auth/callback                            │
   │ ──────────────────────── │                               │
   │                          │  Valida state (CSRF)          │
   │                          │  POST /token (client_creds)   │
   │                          │ ────────────────────────────► │
   │                          │  ◄──── { access_token, ... } │
   │                          │  saveToken(tenantId, ...)     │
   │                          │  consentStore.add(tenantId)   │
   │  ← { status: "consented"}│                               │
```

**Estado persistido:**
- `data/consented_tenants.json` — lista de tenantIds que já concederam consent
- tokenStore (in-memory) — recarregado com client_credentials ao reiniciar o servidor

**Vulnerabilidade conhecida:** token em memória não sobrevive a crash/restart sem reacquisição. Ao reiniciar, o servidor percorre `consented_tenants.json` e reacquire tokens. Isso funciona mas adiciona latência no cold start.

---

## 3. Interface de Collector

Todo collector deve retornar o mesmo shape:

```js
{
  score: Number,          // 0–5 obrigatório (exceto collectors de metadata)
  summary: Object,        // dados agregados — o que vai para o relatório
  details: Object,        // dados brutos ou listas completas (opcional)
  unavailable: Boolean,   // true quando o recurso requer licença ausente
}
```

**Feature gate (licença):** quando um endpoint Graph retorna 403 com código `Forbidden` por falta de licença (P1/P2), o collector retorna `{ score: 0, unavailable: true, summary: {...} }`. O domínio conta como 0 com peso total — o gap é visível no score, não escondido.

**Erros inesperados:** o `index.js` do domínio captura exceções de collectors individuais via `Promise.allSettled` e registra em `errors[name]`. O domínio prossegue sem o collector que falhou.

**Como adicionar um novo collector:**

1. Criar `backend/src/collectors/<dominio>/<nome>Collector.js` com a interface acima
2. Importar no `index.js` do domínio
3. Adicionar à lista de `collectors` e definir peso em `COLLECTOR_WEIGHTS`
4. Adicionar regras relacionadas em `recommendations/index.js` (opcional)

---

## 4. Domínios e Cobertura

| Domínio | Collector | Peso | Status | Permissões Graph |
|---------|-----------|-----:|--------|-----------------|
| **Baseline** | tenantInfo | — (metadata) | ✅ | `Organization.Read.All` |
| | licensing | 3 | ✅ | `Organization.Read.All` |
| | users | 3 | ✅ | `User.Read.All` |
| | usage | 2 | ✅ | `Reports.Read.All` |
| **Entra ID** | mfa | 2 | ✅ (requer P1) | `UserAuthenticationMethod.Read.All` |
| | conditionalAccess | 2 | ✅ (requer P1) | `Policy.Read.All` |
| | privileged | 2 | ✅ | `RoleManagement.Read.Directory` |
| | guests | 1 | ✅ | `User.Read.All` |
| | riskyUsers | 2 | ✅ (requer P2) | `IdentityRiskyUser.Read.All` |
| **SharePoint** | permissions | 3 | ✅ | `Sites.Read.All` |
| | ownership | 3 | ✅ | `Sites.Read.All`, `User.Read.All` |
| | staleContent | 2 | ✅ | `Sites.Read.All` |
| | files | 2 | ⚠️ stub | `Sites.Read.All`, `Files.Read.All` |
| | storage | 2 | ⚠️ stub | `Sites.Read.All` |
| **Governance** | sensitivityLabels | 3 | ✅ | `InformationProtectionPolicy.Read.All` |
| | audit | 3 | ✅ | `AuditLog.Read.All` |
| | dlp | 2 | ❌ fora do Graph | `—` (só PowerShell) |
| | retention | 2 | ❌ fora do Graph | `—` (só PowerShell) |
| **Email Security** | spf | 2 | ✅ (DNS) | sem Graph |
| | dmarc | 2 | ✅ (DNS) | sem Graph |
| | dkim | 2 | ✅ (DNS) | sem Graph |
| **IA Readiness** | synthesis | — | ✅ (sem API) | nenhuma |

**Legenda:** ✅ completo · ⚠️ stub (retorna scores placeholder) · ❌ inviável via Graph

---

## 5. Motor de Scoring

### Escala semântica 0–5

| Score | Significado |
|------:|-------------|
| 5.0 | Excelente — controle implementado, sem gaps |
| 4.0 | Bom — controle presente com pequenas lacunas |
| 3.0 | Aceitável — base presente, melhorias necessárias |
| 2.0 | Fraco — controles parciais ou incompletos |
| 1.0 | Crítico — risco alto, controles ausentes ou falhos |
| 0.0 | Ausente — recurso indisponível ou inacessível |

### Cálculo por domínio

**Baseline** — denominator dinâmico (apenas collectors disponíveis):
```js
const COLLECTOR_WEIGHTS = { licensing: 3, users: 3, usage: 2 };

domainScore = weightedSum / usedWeight  // só collectors que rodaram
```

**EntraId e SharePoint** — denominator fixo (penaliza ausência):
```js
domainScore = (weightedSum / (TOTAL_WEIGHT * 5)) * 5
// TOTAL_WEIGHT = 9 (entraId) | 12 (sharePoint)
// Collectors ausentes contribuem 0 com peso completo → score cai
```

**Decisão de design:** EntraId/SharePoint usam denominador fixo porque a ausência de um collector (ex: riskyUsers sem P2) é um risco real — deve aparecer no score, não ser ignorada. Baseline usa denominador dinâmico porque tenantInfo é metadata, não risco.

### Score final

```js
overallScore = mean([baseline, entraId, sharePoint, governance, emailSecurity, iaReadiness])
```

**Decisão aberta:** todos os domínios têm peso 1. Considerar pesos maiores para Identidade (Entra ID) e Dados (SharePoint + Governance) — são os bloqueadores mais críticos para Copilot.

---

## 6. Motor de Recomendações

### Estrutura de uma regra

```js
{
  id: 'ENTRA_NO_PREMIUM_P1',          // único, usado como chave em relatórios
  check: (result) => Boolean,          // retorna true se o problema existe
  severity: 'critical|high|medium|low',
  category: 'Identidade|Dados|Governança|Email Security|IA Readiness|Adoção',
  finding: String | (result) => String, // pode ser dinâmico com dados reais
  recommendation: String,              // ação concreta
  effort: 'low|medium|high',
  reference: String,                   // URL learn.microsoft.com (opcional)
}
```

### Como a `check` é avaliada

```js
for (const rule of RULES) {
  try {
    if (!rule.check(assessmentResult)) continue;
    // gera recomendação
  } catch {
    // acesso a dado ausente → skip silencioso
  }
}
```

O try/catch silencioso é intencional: collectors podem não ter rodado, então `r.entraId?.collectors?.mfa?.summary` pode ser undefined. A regra simplesmente não dispara.

### Ordenação e agrupamento

```js
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
triggered.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
```

### Regras por categoria (contagem atual)

| Categoria | Regras |
|-----------|-------:|
| Identidade | 8 |
| Dados (SharePoint) | 9 |
| Governança | 3 |
| Email Security | 5 |
| IA Readiness | 4 |
| Adoção | 2 |
| **Total** | **31** |

### Como adicionar uma regra

1. Abrir `backend/src/recommendations/index.js`
2. Adicionar objeto na array `RULES` com todos os campos obrigatórios
3. Testar `check` manualmente com um result JSON real de `data/results/`

---

## 7. Modelo de Dados

### Schema do resultado de assessment

```jsonc
{
  "tenantId": "uuid",
  "tenantName": "Acme Corp",
  "entraIdTier": "P1|P2|Free",
  "assessedAt": "ISO8601",
  "overallScore": 2.4,           // 0–5, 1 casa decimal
  "domains": {
    "baseline": {
      "domain": "baseline",
      "domainScore": 3.1,
      "entraIdTier": "P1",
      "collectors": {
        "tenantInfo": { "displayName": "...", "domains": [...], "country": "BR" },
        "licensing": { "score": 3, "summary": { "totalLicenses": 150, ... }, "skus": [...] },
        "users": { "score": 2, "summary": { "totalUsers": 180, "activeUsers": 120, ... } },
        "usage": { "score": 3, "summary": { "adoptionPercent": 68, "services": {...} } }
      },
      "errors": {}
    },
    "entraId": { ... },
    "sharePoint": { ... },
    "governance": { ... },
    "emailSecurity": {
      "checkedDomain": "acme.com.br",
      "collectors": { "spf": {...}, "dmarc": {...}, "dkim": {...} }
    },
    "iaReadiness": {
      "domainScore": 1.5,
      "readinessLevel": "Não Pronto|Em Progresso|Pronto",
      "copilotReady": false,
      "checks": [{ "id": "...", "label": "...", "passed": false, "weight": 2, "impact": "critical" }],
      "blockers": [{ "id": "...", "label": "...", "impact": "critical" }],
      "summary": { "passedCount": 2, "totalChecks": 6, "criticalBlockers": 2 }
    }
  },
  "recommendations": {
    "total": 12,
    "bySeverity": { "critical": 4, "high": 5, "medium": 3, "low": 0 },
    "items": [{
      "id": "MFA_LOW_COVERAGE",
      "severity": "critical",
      "category": "Identidade",
      "finding": "Cobertura de MFA abaixo de 80% — 65% dos usuários registrados.",
      "recommendation": "...",
      "effort": "medium",
      "reference": "https://..."
    }]
  }
}
```

### Ciclo de vida dos dados

```
Assessment rodado
      │
      ▼
data/results/{tenantId}_{timestamp}.json   ← timestamped (permanente)
data/results/latest_{tenantId}.json        ← sobrescrito a cada run
data/consented_tenants.json                ← lista de tenantIds (append-only)
```

**Retenção atual:** indefinida — sem cleanup automático. Dados são excluídos manualmente.

---

## 8. Segurança e Isolamento

### Multi-tenant isolation

```js
// tokenStore: Map<tenantId, { accessToken, expiresAt }>
// Cada chamada Graph passa o token do próprio tenant
function getAuthHeader(tenantId) {
  const entry = tokenStore.getToken(tenantId);
  if (!entry) throw new Error(`No valid token for tenant ${tenantId}`);
  return { Authorization: `Bearer ${entry.accessToken}` };
}
```

Não há risco de cross-tenant: o token de um tenant só acessa recursos daquele tenant. O escopo do App Registration é `app-only` — sem delegated permissions.

### O que as permissões Graph NÃO acessam

| Permissão usada | O que ela não permite |
|----------------|----------------------|
| `User.Read.All` | Corpo de e-mails, calendários, arquivos pessoais |
| `Sites.Read.All` | Conteúdo de documentos (apenas metadata e permissões) |
| `Reports.Read.All` | Dados de atividade agregados — sem detalhes por usuário |
| `AuditLog.Read.All` | Apenas metadata de eventos — sem payload dos eventos |

### Gaps de segurança conhecidos

| Gap | Risco | Mitigation planejada |
|-----|-------|---------------------|
| Token store in-memory | Token perdido em crash; todos tokens visíveis no processo | Migrar para Redis com TTL e criptografia |
| Results JSON sem criptografia | Dados de configuração do tenant em plaintext | Criptografar em repouso ou mover para DB |
| UI sem autenticação | Qualquer pessoa com acesso à URL pode rodar assessments | Adicionar auth básico (API key ou OIDC) |
| CORS permissivo | Aceita requests de qualquer origem | Restringir para domínios conhecidos |
| Sem rate limit por tenant | Um tenant pode disparar assessments em loop | Implementar rate limit (1 assessment/5min por tenant) |

### Logs

Logs estruturados em JSON via `logger.js`. Campos presentes: `event`, `domain`, `tenantId`, `error`. Sem PII — nenhum campo de conteúdo de usuário é logado.

---

## 9. Lacunas e Decisões Abertas

### Collectors incompletos

**SharePoint `filesCollector` (stub)**
- Retorna scores placeholder
- Precisa implementar: detecção de arquivos grandes via usage reports, duplicatas por nome/tamanho, ratio de arquivos obsoletos
- Dependência: `Reports.Read.All` para usage reports; `Files.Read.All` para metadata de arquivos

**SharePoint `storageCollector` (stub)**
- Precisa implementar: uso por site via `GET /sites/{id}`, concentração top-20%

**Governance: DLP e Retention**
- Políticas de DLP e Retention não estão expostas na Graph API
- Opções: (a) marcar como `unavailable` permanentemente com recomendação de verificar manualmente, (b) integrar com Purview API (preview, instável), (c) verificar via PowerShell num módulo separado
- **Decisão pendente:** continuar como unavailable (impacta score) ou adicionar integração alternativa

### Scoring

**Pesos por domínio** — todos têm peso 1 no score final. Para assessments focados em Copilot readiness, faz sentido ponderar:
- Entra ID: peso 2 (identidade é bloqueador crítico)
- SharePoint + Governance: peso 2 (exposição de dados é risco primário de IA)
- Email Security: peso 1
- Baseline: peso 1 (contexto, não risco)

**IA Readiness scoring** — checklist com 6 checks. Considerar escala contínua em vez de binária por check.

### Infraestrutura

**Token store** — o comentário no código já indica: "Replace with Redis or encrypted DB before production." A interface (`saveToken`, `getToken`) está limpa — troca é cirúrgica sem mudar consumers.

**Testes** — sem nenhum teste automatizado. Collectors são testáveis com fixtures de resposta Graph mockada. Candidatos para primeiros testes:
- `mfaCollector`: cálculo de `coveragePercent`
- `generateRecommendations`: verificar que regras disparam nos inputs corretos

**Autenticação do operador** — UI não tem nenhuma auth. Qualquer pessoa com acesso ao endpoint pode rodar assessments e ver resultados de todos os tenants. Para produção: API key mínima ou OIDC.

---

## 10. Roadmap de Evolução

### Fase 1 — Completar MVP (agora)
- [ ] Implementar `filesCollector` (arquivos grandes + stale ratio)
- [ ] Implementar `storageCollector` (uso por site + concentração)
- [ ] Adicionar API key simples na UI (env var `OPERATOR_KEY`)
- [ ] Restringir CORS para origens configuradas

### Fase 2 — Produção
- [ ] Migrar tokenStore para Redis com TTL e criptografia
- [ ] Rate limiting: 1 assessment por tenant a cada 5 minutos
- [ ] Criptografar results JSON em repouso (ou mover para banco)
- [ ] Configurar retenção automática de results (30 dias padrão da spec)
- [ ] Testes de regressão para collectors críticos (mfa, ca, permissions)

### Fase 3 — Expansão de Cobertura
- [ ] Teams: canais públicos sem owner, acesso guest em Teams, apps instaladas
- [ ] Exchange: regras de encaminhamento externo, shared mailboxes sem owner
- [ ] OneDrive: separar análise de OneDrive pessoal da análise de SharePoint sites
- [ ] Histórico: comparativo entre assessments do mesmo tenant (delta de score)

### Fase 4 — Outputs e Integração
- [ ] PDF completo com páginas por domínio e visualizações
- [ ] Exportação CSV/Excel das recomendações
- [ ] Webhook/callback ao finalizar assessment (para integração com CRM)
- [ ] Dashboard histórico com evolução do score ao longo do tempo
