# Azure App Registration — Permissões

Configuração da App Registration multi-tenant que sustenta a plataforma.

## Arquivos

- `app-registration-permissions.json` — manifest no formato `requiredResourceAccess` com todas as permissões Microsoft Graph application que o app precisa
- `update-permissions.sh` — script Azure CLI para aplicar o manifest

## Permissões (todas application/Role)

| ID | Permissão | Justificativa |
|----|-----------|---------------|
| `498476ce-…` | Organization.Read.All | tenantInfo, licensing |
| `df021288-…` | User.Read.All | users, guests, ownership |
| `230c1aed-…` | Reports.Read.All | usage, appsChannel |
| `38d9df27-…` | UserAuthenticationMethod.Read.All | mfa (requer Entra P1) |
| `246dd0d5-…` | Policy.Read.All | conditionalAccess (requer Entra P1) |
| `483bed4a-…` | RoleManagement.Read.Directory | privileged (+ PIM com P2) |
| `dc5007c0-…` | IdentityRiskyUser.Read.All | riskyUsers (requer Entra P2) |
| `332a536c-…` | Sites.Read.All | permissions, ownership, oversharing |
| `01d4889c-…` | Files.Read.All | files (stub) |
| `19da66cb-…` | InformationProtectionPolicy.Read.All | sensitivityLabels |
| `b0afded3-…` | AuditLog.Read.All | audit, inactiveUsers |
| `83d4163d-…` | SharePointTenantSettings.Read.All | permissions (OneDrive global) |
| `ac3a2b8e-…` | RecordsManagement.Read.All | retentionPolicies |
| `1914711b-…` | ExternalConnection.Read.All | copilotExtensions |
| `4f02b4ae-…` | DataLossPreventionPolicy.Read.All | dlp |

## Como aplicar

```sh
export AZURE_CLIENT_ID=<o client_id da App Registration de produção>
./update-permissions.sh
```

O script faz:

1. `az ad app update --required-resource-accesses @app-registration-permissions.json` — atualiza o manifest
2. Imprime URL de admin consent que precisa ser visitada por **cada tenant já consentido** para aprovar as novas permissões

## Re-consent obrigatório

Quando uma nova permissão é adicionada à App Registration, **todos os tenants já consentidos precisam re-aprovar** o app — caso contrário, os novos collectors continuarão retornando 403/`unavailable`. Use a tela `/consent` do app para gerar a URL de consent de cada tenant.

## Validar IDs antes de aplicar

Os IDs neste manifest são os IDs públicos das permissões do Microsoft Graph (resourceAppId `00000003-0000-0000-c000-000000000000`). Se algum ID parecer suspeito, valide com:

```sh
az ad sp show --id 00000003-0000-0000-c000-000000000000 \
  --query "appRoles[?value=='Sites.Read.All'].{id:id,value:value}" -o table
```
