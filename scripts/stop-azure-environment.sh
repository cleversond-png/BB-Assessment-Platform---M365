#!/usr/bin/env bash
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-EDUGEST-ZERO_TRUST}"
WEBAPP_NAME="${WEBAPP_NAME:-bbassessment-zt}"
PLAN_NAME="${PLAN_NAME:-asp-bbassess-zt-cus}"
HIBERNATE_SKU="${HIBERNATE_SKU:-F1}"

echo "Target resource group: ${RESOURCE_GROUP}"
echo "Stopping Web App: ${WEBAPP_NAME}"
az webapp stop \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${WEBAPP_NAME}" \
  --output none

echo "Attempting to reduce App Service Plan ${PLAN_NAME} to ${HIBERNATE_SKU}."
echo "Note: stopping the Web App alone does not stop Basic/Dedicated App Service Plan billing."
if az appservice plan update \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${PLAN_NAME}" \
  --sku "${HIBERNATE_SKU}" \
  --output none; then
  echo "Environment hibernated: Web App stopped and plan changed to ${HIBERNATE_SKU}."
else
  cat <<EOF
Web App was stopped, but the plan could not be changed to ${HIBERNATE_SKU}.

This means the App Service Plan may still generate compute cost while the environment is stopped.
For the current Linux App Service plan, Azure may not allow Free/Shared SKUs in this region.

Options:
- Re-run with another SKU: HIBERNATE_SKU=B1 scripts/stop-azure-environment.sh
- Delete/recreate compute resources for true zero compute cost, after confirming app settings, custom domains, certs, identity, and CI/CD recovery.
EOF
  exit 1
fi

echo "Current state:"
az webapp show \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${WEBAPP_NAME}" \
  --query "{name:name,state:state,defaultHostName:defaultHostName}" \
  --output table

az appservice plan show \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${PLAN_NAME}" \
  --query "{name:name,sku:sku.name,tier:sku.tier,capacity:sku.capacity}" \
  --output table
