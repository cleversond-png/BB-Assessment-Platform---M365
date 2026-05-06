# Especificação Técnica — Microsoft 365 Assessment Platform

## 1. Modelo de Execução
- Assessment pontual (on-demand)
- Sem execução contínua
- Execução assíncrona
- Tempo alvo: < 10 minutos por tenant

## 2. Domínios e Collectors

### Identidade (Entra ID)
- MFA status
- Conditional Access
- Usuários privilegiados
- Convidados
- PIM


### 5.0 Fundamentos do Tenant (Baseline)

Avalia a base do ambiente Microsoft 365, fornecendo uma visão inicial de custo, risco e maturidade operacional.

#### Licenciamento
- Quantidade total de licenças atribuídas
- Quantidade de licenças pagas vs gratuitas
- Licenças atribuídas sem uso efetivo
- Distribuição de SKUs (M365, O365, EMS, etc.)

#### Usuários
- Quantidade total de usuários criados
- Usuários ativos vs inativos
- Usuários convidados (B2B)
- Contas técnicas e de serviço
- Usuários sem atividade recente
- Usuários em ambos os dominios
- Usuários por domínio

#### Administração e Privilégios
- Quantidade total de usuários com funções administrativas
- Distribuição por tipo de função (Global Admin, Security, Exchange, SharePoint, etc.)
- Usuários com múltiplas funções administrativas
- Contas administrativas sem uso recente

#### MFA e Segurança Básica
- Percentual de usuários com MFA configurado
- Percentual de administradores com MFA
- Administradores sem MFA (risco crítico)
- Métodos de autenticação fracos habilitados

#### Governança Inicial
- Uso de PIM para funções administrativas
- Contas de break‑glass existentes
- Falta de revisão periódica de privilégios

### 5.2 SharePoint / OneDrive — Saúde e Governança de Dados

Avalia a saúde do ambiente SharePoint/OneDrive considerando crescimento orgânico, saída de usuários e ausência de processos de higienização de dados.

#### Estrutura e Ownership
- Sites sem owner ativo
- Sites com owner que não pertence mais à organização
- Bibliotecas sem responsável definido
- Pastas e arquivos cujo criador/proprietário foi desligado

#### Higienização e Obsolescência
- Arquivos sem modificação há mais de 12 meses
- Sites sem atividade recente
- Documentos órfãos (sem owner válido)
- Pastas herdadas de usuários desligados

#### Arquivos Duplicados
- Identificação de arquivos duplicados por:
  - Nome
  - Tamanho
  - Hash (quando aplicável)
- Top ocorrências de duplicidade por site
- Impacto estimado em armazenamento

#### Arquivos Grandes
- Arquivos acima de 100MB
- Top 20 maiores arquivos por site
- Top 20 sites com maior volume de arquivos grandes
- Identificação de possíveis usos indevidos (ex: backups, mídia pesada)

#### Permissões e Compartilhamento
- Uso de links anônimos
- Compartilhamento externo ativo
- Permissões únicas excessivas
- Quebra excessiva de herança

#### Governança e Organização
- Uso de metadados versus pastas
- Documentos sem metadados obrigatórios
- Falta de classificação (labels)
- Ausência de políticas de expiração

#### Crescimento e Capacidade
- Uso de armazenamento por site
- Crescimento acelerado sem controle
- Concentração excessiva de dados em poucos sites

### Governança de Dados
- Sensitivity Labels
- Retention
- DLP (existência)
- Auditoria

### Compliance
- Unified Audit Log
- Purview
- eDiscovery

### IA Readiness
- Superexposição de dados
- Falta de classificação
- Permissões herdadas
- Falta de contexto semântico

## 3. Scoring
- Escala 0–5
- Peso maior para dados e identidade
- Score final agregado
- Mapeamento direto para risco de IA

## 4. Segurança
- Isolamento por tenant
- Retenção padrão: 30 dias
- Exclusão manual
- Criptografia em repouso
- Logs auditáveis

## 4.X Consent — Consentimento Multi-Tenant

### Objetivo
Centralizar controle de tenants com consentimento administrativo concedido,
com rastreabilidade por cliente, geração de URL e monitoramento de status.

### Funcionalidades

#### Geração de URL
- Entrada: Tenant ID + Nome do Cliente
- Saída: URL de Admin Consent pronta para envio
- URL construída via Microsoft Identity Platform (`/adminconsent`)

#### Registro Persistido (por tenant)
| Campo       | Tipo     | Descrição                              |
|-------------|----------|----------------------------------------|
| tenantId    | string   | Directory ID do tenant                 |
| clientName  | string   | Nome do cliente (entrada manual)       |
| consentUrl  | string   | URL gerada (para referência)           |
| consentedAt | datetime | Data/hora do callback de consentimento |
| status      | enum     | `pending` / `consented` / `revoked`    |

#### Status
- `pending` — URL gerada, sem callback recebido ainda
- `consented` — callback recebido + token adquirido com sucesso
- `revoked` — removido manualmente ou token inválido

#### Operações de API
- `GET /auth/consent?tenant_id=&client_name=` — gera URL, registra entrada `pending`
- `GET /auth/callback` — atualiza status para `consented` após consentimento
- `GET /auth/tenants` — lista todos os registros com status atual
- `DELETE /auth/tenants/:tenantId` — remove registro e token em memória

#### Regras de Segurança
- Nenhum assessment executado sem consentimento `consented`
- Tokens armazenados somente em memória (nunca em disco)
- Exclusão manual disponível via API e interface
- Todas as ações registradas em structured logs

#### Fora de Escopo
- Consentimento implícito ou automático
- Permissões delegadas (somente `client_credentials`)
- Write no tenant do cliente

## 5. Saídas
- Relatório técnico
- Relatório executivo
- Dataset estruturado (JSON)