# Project Control

Este documento define como o controle operacional do projeto deve ser mantido sem expor dados sensiveis no repositorio.

## Repositorio

- Remoto GitHub: `git@github.com:cleversond-png/BB-Assessment-Platform---M365.git`
- Branch de deploy: `main`
- Deploy: GitHub Actions para Azure App Service em `.github/workflows/azure.yml`
- Regra operacional: toda alteracao versionada deve ser commitada e enviada por `git push` imediatamente.

## Dados Que Nunca Devem Ir Para O Git

- Tenant ID de producao do publicador, se considerado sensivel pelo cliente.
- Client secret da App Registration.
- Publish profile do Azure App Service.
- Resultados de assessments de clientes.
- Arquivos `.env` reais.
- Tokens, refresh tokens, access tokens ou dumps de configuracao do Azure.

## Armazenamento Seguro Definido

### GitHub Actions

Usar GitHub Secrets para dados exigidos pelo pipeline:

- `AZURE_WEBAPP_NAME`
- `AZURE_WEBAPP_PUBLISH_PROFILE`

### Azure Runtime

Usar App Service Application Settings ou Azure Key Vault para variaveis de runtime:

- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_REDIRECT_URI`
- `NODE_ENV=production`
- `DATA_DIR`, quando houver storage persistente montado

Preferencia de seguranca:

1. Azure Key Vault com Managed Identity do App Service.
2. App Service Application Settings quando Key Vault ainda nao estiver provisionado.
3. `.env` apenas para desenvolvimento local e nunca versionado.

### Dados De Assessment

Resultados de clientes e lista de tenants consentidos devem sair de disco local antes de escala real. Opcao recomendada:

- Azure Storage Account privado, com criptografia em repouso e acesso via Managed Identity; ou
- Banco de dados com criptografia, segregacao por tenant e politica de retencao.

## Informacoes Necessarias Para Publicacao

Solicitar ao responsavel do projeto antes de qualquer configuracao:

- Tenant ID do Azure onde o app sera publicado.
- Subscription ID.
- Resource Group.
- Nome do Azure App Service.
- URL publica final do app.
- Nome da App Registration multi-tenant.
- Application Client ID da App Registration.
- Confirmacao de onde o segredo sera guardado: Key Vault ou App Service Application Settings.
- Confirmacao se o GitHub Actions usara publish profile ou federated credentials/OIDC.

## Estado Atual Confirmado

- O repositorio local aponta para o GitHub por SSH.
- A branch local `main` esta alinhada com `origin/main` no momento desta revisao.
- O CLI `gh` local esta autenticado como `cleversond-png` com escopos `repo` e `workflow`.
- Os secrets `AZURE_WEBAPP_NAME` e `AZURE_WEBAPP_PUBLISH_PROFILE` existem no repositorio GitHub.
- `backend/.env`, `backend/data`, `frontend/dist` e artefatos locais sensiveis estao ignorados pelo Git.

## Inventario Azure Nao Secreto

Ambientes encontrados via Azure CLI:

- Assinatura ativa: `PROJETO EDUGEST`.
  - Resource groups: `rg-edugest-ops-prd-brs`, `rg-edugest-core-prd-brs`, `EDUGEST-ZERO_TRUST`.
  - Key Vaults: `kv-edugest-ops-prd-brs`, `kv-edugest-core-7qwfay`.
  - Container App publico encontrado: `ca-edugest-core-prd-brs`.
- Assinatura adicional habilitada com nome `Azure subscription 1`.
  - Resource group relacionado ao projeto: `BB_Assessment_Platform`.
  - Web App relacionado ao projeto: `BBAssessment`.
  - Host padrao: `bbassessment-g6hvg7f3ecfeasfb.brazilsouth-01.azurewebsites.net`.
  - Host customizado: `assessment.plantaoti.com.br`.
  - Estado observado: `AdminDisabled`.

Pendencia: confirmar qual assinatura/tenant sera o alvo oficial de publicacao antes de alterar secrets, App Settings ou pipeline.
