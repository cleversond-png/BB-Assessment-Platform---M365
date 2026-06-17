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

- Ambiente oficial atual:
  - Tenant: `PlantaoTiservicos.onmicrosoft.com`.
  - Tenant ID: `71d33acc-618c-419d-95b9-c82d3802396b`.
  - Assinatura: `PROJETO EDUGEST`.
  - Subscription ID: `ad59449c-90b3-40e6-8ffa-6fe1fa88aedb`.
  - Resource group: `EDUGEST-ZERO_TRUST`.
  - Regiao principal usada: `centralus` para App Service, `eastus` para Key Vault/Storage.
  - Web App: `bbassessment-zt`.
  - URL temporaria funcional: `https://bbassessment-zt.azurewebsites.net`.
  - App Service Plan: `asp-bbassess-zt-cus` (`B1`, Linux).
  - App Registration multi-tenant: `BB Assessment Platform - M365`.
  - Application Client ID: `a2408244-c10b-4783-9174-3db32c146eb7`.
  - Key Vault: `kv-bbassess-zt`.
  - Storage Account: `stbbassesszt`.
  - Azure Files share: `assessment-data`, montado no Web App como `/home/data`.
  - Runtime `AZURE_CLIENT_SECRET`: Key Vault reference, nao valor em claro.
  - GitHub Actions: ultimo deploy validado com sucesso no run `27723108443`.
- Assinatura adicional habilitada com nome `Azure subscription 1`.
  - Resource group relacionado ao projeto: `BB_Assessment_Platform`.
  - Web App relacionado ao projeto: `BBAssessment`.
  - Host padrao: `bbassessment-g6hvg7f3ecfeasfb.brazilsouth-01.azurewebsites.net`.
  - Host customizado: `assessment.plantaoti.com.br`.
  - Estado observado: `AdminDisabled`.

## Dominio Customizado

Dominio desejado: `assessment.plantaoti.com.br`.

Estado atual: o CNAME ainda aponta para o Web App antigo:

- `assessment.plantaoti.com.br` -> `bbassessment-g6hvg7f3ecfeasfb.brazilsouth-01.azurewebsites.net`

Para migrar para o novo Web App:

- Atualizar CNAME `assessment.plantaoti.com.br` para `bbassessment-zt.azurewebsites.net`.
- Criar TXT `asuid.assessment.plantaoti.com.br` com o valor de verificacao do Web App:
  `43BC8B56EAA9134B360AB4D973BDBD0290C4743C391E5D1B8F92437F24CCC794`
- Apos propagacao, adicionar o hostname no Web App `bbassessment-zt`, habilitar TLS gerenciado e trocar `AZURE_REDIRECT_URI` para `https://assessment.plantaoti.com.br/auth/callback`.

Enquanto o DNS nao for migrado, o runtime usa `https://bbassessment-zt.azurewebsites.net/auth/callback`.
