# Especialista — Lacunas e Melhorias para Copilot Readiness Assessment

> **Contexto**: Este documento registra as lacunas identificadas na análise técnica da plataforma de assessment, comparando o que está implementado com o framework completo que a Microsoft usa internamente para qualificar tenants para o Copilot for Microsoft 365. Cada item inclui o motivo técnico, o impacto real para o Copilot, e a especificação de implementação.

---

## Status Atual

O app cobre corretamente os 6 pré-requisitos mais críticos (módulo `iaReadiness`) e tem 30+ regras de recomendação bem fundamentadas. O que está descrito abaixo são **lacunas reais** que, quando cobertas, elevam o produto ao nível de ferramenta de assessment certificável pela Microsoft.

---

## Lacuna 1 — Oversharing Interno: "Everyone" e "Everyone Except External Users" ✅

### O que é
Além de links anônimos (que o app já detecta), existe outra forma crítica de oversharing: sites, pastas e arquivos com permissões concedidas para os grupos especiais `Everyone` ou `Everyone except external users` do Azure AD. Qualquer usuário do tenant, incluindo contas de serviço, aplicações e usuários recém-adicionados, tem acesso automático a esse conteúdo.

### Por que importa para o Copilot
O Copilot respeita as permissões do usuário que está fazendo a pergunta. Se um usuário do financeiro perguntar ao Copilot "qual é a estratégia de produto?", e existirem documentos de estratégia com permissão `Everyone`, o Copilot vai incluir esse conteúdo na resposta — mesmo que o documento nunca tenha sido compartilhado intencionalmente com essa pessoa. A Microsoft chama isso de **oversharing via AI amplification**: conteúdo que ficava "perdido" agora é descoberto e entregue pela IA.

### Como detectar
A API do Microsoft Graph permite verificar quais sites têm permissões atribuídas a esses grupos especiais via `/_api/web/roleassignments` por site, ou por inspeção de grupos que contêm todos os usuários. Uma abordagem mais pragmática é verificar nas configurações do SharePoint Admin se o grupo `Everyone` foi incluído em alguma coleção de sites raiz ou em sites de comunicação públicos.

**Permissão necessária**: `Sites.Read.All`

### Como implementar
- Novo collector: `backend/src/collectors/sharePoint/oversharing​EveryoneCollector.js`
- Verificar via Graph: `GET /sites/{site-id}/permissions` e checar se `grantedToIdentities` inclui `everyone@{tenant}` ou `everyoneExceptExternalUsers@{tenant}`
- Amostragem nos top 50 sites por atividade (já disponível via `staleContentCollector`)
- Novo check no `iaReadiness/index.js`:
  ```js
  {
    id: 'NO_EVERYONE_OVERSHARING',
    label: 'Sem permissões Everyone em sites ativos',
    weight: 0.20,  // substituir ou adicionar ao peso atual
    impact: 'critical',
    check: (d) => d.sharePoint?.collectors?.oversharing?.summary?.sitesWithEveryoneCount === 0,
  }
  ```
- Nova regra em `recommendations/index.js` com severidade `critical`

---

## Lacuna 2 — DLP com Workload Copilot Explícito ⚠️ (recomendação manual)

> A verificação automática via Graph **não é possível**: a permissão `DataLossPreventionPolicy.Read.All` não existe no Microsoft Graph e o endpoint `/security/informationProtection/dataLossPreventionPolicies` não expõe DLP policies do Microsoft Purview. As policies do Purview são lidas apenas via Security & Compliance PowerShell (`Get-DlpCompliancePolicy`). A cobertura é entregue como **recomendação manual** (`DLP_COPILOT_MANUAL_REVIEW`) que dispara para todo tenant — o consultor verifica via Purview. O collector `dlp` retorna `unavailable: true` permanentemente.

### O que é
O app já verifica se existem políticas DLP no tenant (`dlpCollector`), mas não verifica se alguma dessas políticas cobre especificamente o **Copilot for Microsoft 365** como workload protegido. Desde outubro de 2024, a Microsoft adicionou suporte explícito para DLP aplicado às interações do Copilot — incluindo restrição de quais tipos de conteúdo o Copilot pode processar e quais prompts são bloqueados.

### Por que importa para o Copilot
Uma política DLP genérica que protege Exchange e SharePoint **não cobre automaticamente o Copilot**. Sem uma política DLP explícita para Copilot, um usuário pode pedir ao Copilot para resumir um documento que contém dados de cartão de crédito ou CPF, e o Copilot vai processar e exibir esses dados sem nenhum aviso ou bloqueio.

### Como detectar
A API beta do Graph expõe as políticas DLP com o campo `workload` indicando os serviços cobertos. Verificar se alguma política ativa tem `workload` que inclui `CopilotForMicrosoft365` ou `AIApps`.

**Permissão necessária**: `DataLossPreventionPolicy.Read.All`

### Como implementar
- Atualizar `dlpCollector.js` para extrair e analisar o campo `workload` de cada política
- Adicionar ao `summary`:
  ```js
  copilotDlpPoliciesCount: policies.filter(p => p.workload?.includes('CopilotForMicrosoft365')).length
  ```
- Nova regra em `recommendations/index.js`:
  ```js
  {
    id: 'DLP_NO_COPILOT_POLICY',
    check: (r) => r.governance?.collectors?.dlp?.summary?.copilotDlpPoliciesCount === 0,
    severity: 'high',
    category: 'Governança',
    finding: 'Nenhuma política DLP cobre o Copilot for Microsoft 365 — dados sensíveis processados sem restrição.',
    recommendation: 'Criar política DLP no Purview com workload "Copilot for Microsoft 365". Definir quais tipos de informação sensível (CPF, cartão, PII) o Copilot não pode processar ou exibir.',
    reference: 'https://learn.microsoft.com/en-us/purview/dlp-microsoft365-copilot',
  }
  ```
- Adicionar novo check no `iaReadiness/index.js` com peso 0.10 e impacto `high`

---

## Lacuna 3 — Contas Internas Inativas (Usuários Desligados) ✅

### O que é
O app detecta **guests inativos** (externos), mas não detecta **usuários internos** cujas contas estão habilitadas mas sem nenhum sinal de login nos últimos 90 dias. Essas são tipicamente contas de ex-funcionários, contas de serviço abandonadas ou contas de teste que nunca foram desativadas.

### Por que importa para o Copilot
Contas internas inativas são um risco de segurança clássico, mas ganham uma dimensão nova com IA: se uma dessas contas for comprometida, o atacante terá acesso ao Copilot com as permissões acumuladas durante toda a vida útil da conta. Além disso, contas de ex-funcionários frequentemente têm acesso a dados sensíveis de projetos passados que nunca foram revisados.

### Como detectar
O Microsoft Graph fornece o campo `signInActivity.lastSignInDateTime` no endpoint de usuários. Usuários com esse campo nulo ou com data superior a 90 dias e conta ainda habilitada são candidatos a limpeza.

**Permissão necessária**: `AuditLog.Read.All` + `User.Read.All`

### Como implementar
- Atualizar `usersBaselineCollector.js` para incluir verificação de inatividade:
  ```js
  GET /users?$select=id,userPrincipalName,accountEnabled,signInActivity&$filter=accountEnabled eq true
  ```
- Adicionar ao `summary`:
  ```js
  inactiveEnabledUsersCount: users.filter(u => isInactive(u.signInActivity?.lastSignInDateTime, 90) && u.accountEnabled).length
  ```
- Nova regra em `recommendations/index.js` com severidade `medium`
- Observação: esse endpoint requer Entra ID P1 — tratar `unavailable` adequadamente (igual ao padrão já usado em `mfaCollector`)

---

## Lacuna 4 — Retenção Específica para Teams e Exchange ✅

### O que é
O app verifica a existência de retention labels no Purview (`retentionCollector`), mas não verifica se existem **políticas de retenção aplicadas especificamente a Teams (chats, canais) e Exchange (caixas de entrada)**. Retention labels são diferentes de retention policies — uma label é aplicada manualmente ou por auto-labeling em documentos; uma policy é aplicada automaticamente a workloads inteiros.

### Por que importa para o Copilot
O Copilot for Microsoft 365 acessa e processa emails (Exchange) e mensagens de Teams como fontes de contexto. Se não houver políticas de retenção nesses workloads, dois problemas surgem: (1) dados antigos e irrelevantes são usados como contexto, degradando a qualidade das respostas; (2) em caso de investigação ou auditoria, não há garantia de que os dados existam pelo período exigido por compliance.

### Como detectar
A API do Purview via Graph Beta expõe retention policies separadas de retention labels:
```
GET /beta/security/informationProtection/retentionPolicies
```
Verificar se existem políticas com `workload` cobrindo `Teams` e `Exchange`.

**Permissão necessária**: `RecordsManagement.Read.All`

### Como implementar
- Criar novo collector: `backend/src/collectors/governance/retentionPoliciesCollector.js` (distinto do `retentionCollector.js` existente que trata *labels*)
- Verificar presença de políticas por workload: `teamsChannelMessages`, `teamsChatMessages`, `exchangeEmail`
- Adicionar ao summary um flag por workload: `teamsRetentionConfigured`, `exchangeRetentionConfigured`
- Nova regra de recomendação com severidade `medium` para ausência em Teams e `high` para ausência em Exchange

---

## Lacuna 5 — Canal de Atualização do Microsoft 365 Apps ✅

### O que é
O Copilot for Microsoft 365 requer que os aplicativos Office instalados nos dispositivos dos usuários estejam no **Current Channel** ou **Monthly Enterprise Channel** — não é possível usar o Copilot com versões em Semi-Annual Channel (o canal mais atrasado, comum em ambientes corporativos conservadores). Versões desatualizadas do Office simplesmente não mostram o botão do Copilot.

### Por que importa para o Copilot
Este é um bloqueador técnico direto: mesmo que o tenant tenha licença Copilot e toda a governança correta, usuários com Office em Semi-Annual Channel não conseguem usar o produto. Em ambientes corporativos grandes, é comum que o time de TI configure o Semi-Annual Channel por política de estabilidade.

### Como detectar
O Microsoft Graph Reports API fornece dados de versão dos apps instalados:
```
GET /reports/getM365AppUserDetail(period='D30')
```
Esse relatório indica quais versões do Office estão sendo usadas pelos usuários ativos.

**Permissão necessária**: `Reports.Read.All`

### Como implementar
- Novo collector: `backend/src/collectors/baseline/appsChannelCollector.js`
- Parsear o CSV retornado pelo endpoint de reports (padrão já usado pelo `usageCollector`)
- Verificar se versões detectadas correspondem ao Current ou Monthly Enterprise Channel (comparar número de build mínimo)
- Adicionar ao módulo de `iaReadiness` um check com impacto `high`:
  ```js
  {
    id: 'OFFICE_CURRENT_CHANNEL',
    label: 'M365 Apps em canal compatível com Copilot',
    weight: 0.10,
    impact: 'high',
  }
  ```
- Regra de recomendação com link direto para a documentação de requisitos de canal

---

## Lacuna 6 — OneDrive Sharing Settings (Separado do SharePoint Global) ✅

### O que é
O app verifica as configurações de sharing do SharePoint tenant-level (`permissionsCollector`), mas as configurações do **OneDrive for Business** podem ser configuradas de forma independente no Admin Center — e frequentemente são mais permissivas que o SharePoint. Um tenant pode ter SharePoint restrito a "Existing guests" mas OneDrive configurado para "Anyone" (links anônimos).

### Por que importa para o Copilot
O Copilot for Microsoft 365 acessa arquivos do OneDrive do usuário como contexto prioritário. Se o OneDrive tem políticas de compartilhamento mais permissivas que o SharePoint, arquivos pessoais de trabalho (rascunhos, apresentações, planilhas financeiras) podem ser expostos via links anônimos sem que o assessment atual detecte.

### Como detectar
A API do Graph Admin para SharePoint retorna settings separadas que incluem OneDrive:
```
GET /admin/sharepoint/settings
```
O campo `oneDriveForBusinessSharingCapability` é distinto de `sharingCapability` (que é o SharePoint global).

**Permissão necessária**: `SharePointTenantSettings.Read.All` (já disponível)

### Como implementar
- Atualizar `permissionsCollector.js` para extrair `oneDriveForBusinessSharingCapability` do mesmo endpoint já consultado
- Adicionar ao `summary`:
  ```js
  oneDriveSharingCapability: settings.oneDriveForBusinessSharingCapability
  ```
- Nova regra de recomendação quando OneDrive é mais permissivo que SharePoint
- Atualizar o check `ANON_LINKS_DISABLED` no `iaReadiness` para incluir OneDrive

---

## Lacuna 7 — Privileged Identity Management (PIM) ✅

### O que é
O app detecta quantos Global Administrators existem e se há guests com roles admin (`privilegedCollector`). Porém, não verifica se o tenant usa **Privileged Identity Management (PIM)** — o mecanismo da Microsoft para que roles privilegiadas sejam *just-in-time* (JIT): o administrador solicita elevação temporária, usa a permissão por um período limitado, e ela expira automaticamente.

### Por que importa para o Copilot
Sem PIM, um Global Administrator está permanentemente com todas as permissões ativas — 24 horas por dia, 7 dias por semana. Se essa conta for comprometida (e o Copilot estiver habilitado para ela), o atacante tem acesso irrestrito tanto ao tenant quanto às capacidades da IA com privilégio máximo. Com PIM, mesmo uma conta comprometida não tem poder admin fora das janelas de elevação.

### Como detectar
O Microsoft Graph fornece endpoints para verificar roles elegíveis vs. ativas no PIM:
```
GET /roleManagement/directory/roleEligibilitySchedules
```
Se existem role eligibility schedules para Global Admin, o PIM está configurado.

**Permissão necessária**: `RoleManagement.Read.Directory`

### Como implementar
- Atualizar `privilegedCollector.js` para tentar consultar os role eligibility schedules
- Se o endpoint retornar 403 (Entra P2 não licenciado), marcar `pimAvailable: false`
- Se retornar dados, verificar se as sensitive roles monitoradas têm pelo menos algumas atribuições via PIM (eligible) vs. todas permanentes (active)
- Nova regra de recomendação:
  ```js
  {
    id: 'PRIVILEGED_NO_PIM',
    severity: 'high',
    finding: 'Roles privilegiadas permanentes sem Privileged Identity Management (PIM). Admins com acesso 24/7 são vetor de risco para Copilot.',
    recommendation: 'Habilitar PIM (requer Entra ID P2) e converter roles permanentes em eligible. Global Admin deve ser just-in-time.',
  }
  ```

---

## Lacuna 8 — Plugins e Conectores do Copilot (Extensibility Risk) ✅

### O que é
O Copilot for Microsoft 365 suporta extensões via **Graph Connectors**, **Teams Message Extensions** e **Declarative Agents** (plugins de terceiros). Cada plugin instalado expande o que o Copilot pode acessar — incluindo sistemas externos como CRM, ERP, ticketing — criando novas superfícies de ataque e riscos de exfiltração para dados fora do M365.

### Por que importa para o Copilot
Um usuário pode instalar um plugin do Copilot que conecta a um CRM externo. Se o plugin não tiver controles adequados, o Copilot pode combinar dados internos sensíveis com dados do CRM e expor informações de clientes em respostas. A Microsoft está colocando fortes controles aqui (Copilot extensibility admin controls) mas a maioria dos tenants ainda não os configurou.

### Como detectar
- **Graph Connectors**: `GET /external/connections` — lista conectores externos ativos
- **Apps do Copilot autorizadas**: via Microsoft 365 admin settings (Integrated Apps)
- **Teams apps com Copilot extensibility**: verificar apps instaladas que usam o manifest field `copilotExtensions`

**Permissão necessária**: `ExternalConnection.Read.All` para Graph Connectors

### Como implementar
- Novo collector: `backend/src/collectors/iaReadiness/copilotExtensionsCollector.js`
- Verificar: número de Graph Connectors ativos, apps com copilot extensibility habilitadas, se o admin desabilitou plugins de terceiros
- Novo check no `iaReadiness`:
  ```js
  {
    id: 'COPILOT_PLUGINS_GOVERNED',
    label: 'Plugins do Copilot controlados pelo admin',
    weight: 0.05,
    impact: 'medium',
  }
  ```

---

## Correção de Bug — `iaReadiness` no JSON salvo

### O que é
Na inspeção do arquivo JSON mais recente, o campo `iaReadiness` apareceu como `None` quando acessado da raiz do resultado. Isso ocorre porque na rota de assessment (`assessmentRoutes.js`), todos os domínios são armazenados sob `result.domains`, mas o `iaReadiness` é calculado e adicionado ao objeto `domainResults` antes de ser aninhado.

### Causa raiz
```js
// assessmentRoutes.js linha ~57
domainResults.iaReadiness = assessIAReadiness(tenantId, domainResults);

const result = {
  ...
  domains: domainResults,          // iaReadiness está aqui: result.domains.iaReadiness
  recommendations: generateRecommendations(domainResults),
};
```

O resultado salvo no disco tem estrutura `result.domains.iaReadiness`, não `result.iaReadiness`. Isso é consistente internamente — o recommendations engine acessa `r.iaReadiness` via `domainResults` que é o objeto completo antes do aninhamento. A estrutura está correta; a confusão é apenas na leitura direta do JSON salvo.

**Ação**: Nenhuma correção necessária no código. Documentar a estrutura do JSON na spec para evitar confusão futura ao consumir os resultados via API ou frontend.

---

## Resumo de Priorização

| # | Lacuna | Impacto no Copilot | Esforço de Implementação | Prioridade |
|---|---|---|---|---|
| 1 | Oversharing "Everyone" interno | Crítico | Médio | **Alta** |
| 2 | DLP com workload Copilot | Alto | Baixo | **Alta** |
| 3 | Contas internas inativas | Alto | Baixo | **Alta** |
| 4 | Retenção Teams e Exchange | Médio | Médio | Média |
| 5 | Canal de atualização Office | Alto (bloqueador técnico) | Médio | **Alta** |
| 6 | OneDrive sharing settings | Alto | Baixo | **Alta** |
| 7 | PIM (just-in-time admin) | Alto | Médio | Média |
| 8 | Plugins e conectores Copilot | Médio | Alto | Baixa |

---

## Permissões Adicionais Necessárias (App Registration) ✅

Lista canônica versionada agora vive em [`azure/app-registration-permissions.json`](azure/app-registration-permissions.json) com aplicação automatizada via [`azure/update-permissions.sh`](azure/update-permissions.sh). Permissões novas adicionadas para cobrir as lacunas: `Sites.Read.All`, `AuditLog.Read.All`, `RecordsManagement.Read.All`, `RoleManagement.Read.Directory`, `ExternalConnection.Read.All`. **Não inclui** `DataLossPreventionPolicy.Read.All` — não existe no Microsoft Graph (ver Lacuna 2 acima).

Após aplicar o manifest no Azure, **todos os tenants já consentidos precisam fazer re-consent** — a tela `/consent` mostra a lista completa de permissões e o overview de cada tenant exibe banner amarelo "Re-consent necessário" quando há permissão ausente.

---

*Documento gerado em: 2026-05-06 — revisão técnica baseada em análise do código-fonte + framework Microsoft Copilot Readiness.*
