# Microsoft 365 Assessment Platform

Ferramenta de diagnóstico técnico Microsoft 365 para pré-vendas, focada em:

- Governança
- Segurança
- Dados
- SharePoint / OneDrive
- Prontidão para IA (Copilot)

## Como começar

1. Criar App Registration multi-tenant no Azure
2. Aplicar o manifest de permissões: [`azure/update-permissions.sh`](azure/update-permissions.sh)
3. Preencher variáveis de ambiente (`backend/.env`)
4. Deploy automático para Azure App Service via push para `main`
5. Gerar URL de consent na tela `/consent` e enviar ao admin do tenant

## Setup da App Registration

A App Registration multi-tenant precisa ter permissões Microsoft Graph application aprovadas. A lista canônica é versionada em [`azure/app-registration-permissions.json`](azure/app-registration-permissions.json).

Para aplicar/atualizar:

```sh
export AZURE_CLIENT_ID=<client_id da App Registration>
./azure/update-permissions.sh
```

Detalhes: [`azure/README.md`](azure/README.md).

**Importante:** quando uma nova permissão é adicionada, todos os tenants já consentidos precisam fazer **re-consent**. A plataforma detecta isso automaticamente — se algum collector retornar `unavailable` por permissão faltante, o overview mostra banner amarelo "Re-consent necessário" e o operador pode gerar nova URL de consent diretamente da UI.

## Princípios

- Read-only no tenant do cliente
- Multi-tenant isolation
- Zero acesso a conteúdo (e-mail, arquivos, chats)
- Least privilege

## Documentação

- [`design.md`](design.md) — arquitetura, contratos, motor de scoring
- [`spec.md`](spec.md) — especificação funcional
- [`especialista.md`](especialista.md) — lacunas para Copilot Readiness (todas implementadas)
- [`playbook.md`](playbook.md) — operação
- [`claude.md`](claude.md) — diretrizes de colaboração com Claude Code
