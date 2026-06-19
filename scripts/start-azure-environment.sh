#!/usr/bin/env bash
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-EDUGEST-ZERO_TRUST}"
WEBAPP_NAME="${WEBAPP_NAME:-bbassessment-zt}"
PLAN_NAME="${PLAN_NAME:-asp-bbassess-zt-cus}"
ACTIVE_SKU="${ACTIVE_SKU:-B1}"

echo "Target resource group: ${RESOURCE_GROUP}"
echo "Restoring App Service Plan ${PLAN_NAME} to ${ACTIVE_SKU}."
az appservice plan update \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${PLAN_NAME}" \
  --sku "${ACTIVE_SKU}" \
  --output none

echo "Starting Web App: ${WEBAPP_NAME}"
az webapp start \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${WEBAPP_NAME}" \
  --output none

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
