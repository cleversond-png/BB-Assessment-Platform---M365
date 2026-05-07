const logger = require('../../logger');

// DLP policies do Microsoft Purview NÃO são expostas via Microsoft Graph (Application).
// Não há permissão `DataLossPreventionPolicy.Read.All` no Graph — verificado na referência
// oficial. As policies do Purview (Exchange, SharePoint, Teams, Copilot workload) só
// podem ser lidas via Security & Compliance PowerShell (`Get-DlpCompliancePolicy`).
//
// Este collector retorna sempre `unavailable: true` com razão clara. A cobertura DLP
// para Copilot é entregue como recomendação manual (ver `recommendations/index.js`,
// regra `DLP_COPILOT_MANUAL_REVIEW`).
async function collectDlp(tenantId) {
  logger.info({
    event: 'collector_skipped',
    collector: 'dlp',
    tenantId,
    reason: 'DLP do Purview não é exposto via Microsoft Graph',
  });

  return {
    collector: 'dlp',
    score: 0,
    unavailable: true,
    reason: 'DLP do Microsoft Purview não é exposto via Microsoft Graph (Application). Verificação manual via Microsoft Purview / Security & Compliance PowerShell.',
  };
}

module.exports = { collectDlp };
