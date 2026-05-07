#!/usr/bin/env bash
# Aplica o manifest de permissões na App Registration multi-tenant.
# Requer Azure CLI logado com permissão de Application Administrator no tenant da App Reg.
#
# Uso:
#   export AZURE_CLIENT_ID=<client_id da App Registration>
#   ./update-permissions.sh

set -euo pipefail

if [ -z "${AZURE_CLIENT_ID:-}" ]; then
  echo "ERRO: defina AZURE_CLIENT_ID com o client_id da App Registration." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="${SCRIPT_DIR}/app-registration-permissions.json"

if [ ! -f "${MANIFEST}" ]; then
  echo "ERRO: manifest não encontrado em ${MANIFEST}" >&2
  exit 1
fi

echo "→ Atualizando requiredResourceAccess da App ${AZURE_CLIENT_ID}…"
az ad app update --id "${AZURE_CLIENT_ID}" \
  --required-resource-accesses "@${MANIFEST}"

echo
echo "✓ Manifest aplicado."
echo
echo "PRÓXIMO PASSO: cada tenant já consentido precisa fazer RE-CONSENT."
echo "Use a tela /consent da plataforma para gerar a URL de cada tenant."
echo "Ou monte manualmente:"
echo "  https://login.microsoftonline.com/<TENANT_ID>/adminconsent?client_id=${AZURE_CLIENT_ID}"
