const { graphGetAll } = require('../../graph/graphClient');

// SKUs que não representam licenças reais — excluídos do cálculo e da exibição
const EXCLUDE_KEYWORDS = [
  'VIRAL', '_DEV', 'DEVELOPER', 'TRIAL',
  // Licenças de fluxo livre — provisionadas automaticamente pela Microsoft, sem custo ou usuário real
  'FLOW_FREE', 'TEAMS_FREE', 'TEAMS_EXPLORATORY', 'WINDOWS_STORE',
  'POWERAPPS_VIRAL', 'POWER_VIRTUAL_AGENTS_VIRAL',
];

// SKUs marcados como gratuitos para fins de exibição (contam usuários reais, mas sem custo pago)
const FREE_KEYWORDS = ['DESKLESS', 'POWER_BI_STANDARD', '_A1_', 'STANDARDWOFFPACK'];

// Nomes amigáveis para SKUs conhecidos
const SKU_DISPLAY_NAMES = {
  // Commercial
  'O365_BUSINESS_ESSENTIALS':          'Microsoft 365 Business Basic',
  'O365_BUSINESS_PREMIUM':             'Microsoft 365 Business Standard',
  'SPB':                               'Microsoft 365 Business Premium',
  'ENTERPRISEPACK':                    'Office 365 E3',
  'ENTERPRISEPREMIUM':                 'Office 365 E5',
  'SPE_E3':                            'Microsoft 365 E3',
  'SPE_E5':                            'Microsoft 365 E5',
  'SPE_F1':                            'Microsoft 365 F1',
  'DESKLESSPACK':                      'Microsoft 365 F1',
  'EXCHANGESTANDARD':                  'Exchange Online (Plano 1)',
  'EXCHANGEENTERPRISE':                'Exchange Online (Plano 2)',
  'AAD_PREMIUM':                       'Entra ID P1',
  'AAD_PREMIUM_P2':                    'Entra ID P2',
  'EMS':                               'Enterprise Mobility + Security E3',
  'EMSPREMIUM':                        'Enterprise Mobility + Security E5',
  'INTUNE_A':                          'Microsoft Intune',
  'POWER_BI_PRO':                      'Power BI Pro',
  'POWER_BI_PREMIUM_PER_USER':         'Power BI Premium Per User',
  'POWER_BI_STANDARD':                 'Power BI Free',
  'PROJECTPROFESSIONAL':               'Project Plano 3',
  'PROJECTPREMIUM':                    'Project Plano 5',
  'VISIOONLINE_PLAN1':                 'Visio Plano 1',
  'VISIOCLIENT':                       'Visio Plano 2',
  'TEAMS_ROOMS_STANDARD':              'Teams Rooms Standard',
  'MCOCAP':                            'Teams Phone Standard',
  'MCOPSTN1':                          'Teams Calling Plano 1',
  'MCOPSTN2':                          'Teams Calling Plano 2',
  'DYN365_ENTERPRISE_P1_IW':           'Dynamics 365 Enterprise P1',
  'DYN365_ENTERPRISE_PLAN1':           'Dynamics 365 Enterprise Plano 1',
  'DYN365_BUSINESS':                   'Dynamics 365 Business',
  // Education — Faculty (Docente)
  'M365EDU_A1_FACULTY':                'Microsoft 365 A1 Docentes',
  'M365EDU_A3_FACULTY':                'Microsoft 365 A3 Docentes',
  'M365EDU_A5_FACULTY':                'Microsoft 365 A5 Docentes',
  'ENTERPRISEPACKPLUS_FACULTY':        'Microsoft 365 A3 Docentes',
  'ENTERPRISEPREMIUM_FACULTY':         'Microsoft 365 A5 Docentes',
  'STANDARDWOFFPACK_FACULTY':          'Office 365 A1 Docentes (Gratuito)',
  'WOFFPACK_FACULDADE':                'Office 365 A1 Docentes (Gratuito)',
  'POWER_BI_PRO_FACULTY':              'Power BI Pro Docentes',
  'PROJECTESSENTIALS_FACULTY':         'Project Essentials Docentes',
  'RIGHTSMANAGEMENT_STANDARD_FACULTY': 'Azure Rights Management Docentes',
  'EXCHANGEENTERPRISE_FACULTY':        'Exchange Online (Plano 2) Docentes',
  'EXCHANGESTANDARD_FACULTY':          'Exchange Online (Plano 1) Docentes',
  // Education — Student (Estudante)
  'M365EDU_A1_STUDENT':                'Microsoft 365 A1 Estudantes',
  'M365EDU_A3_STUDENT':                'Microsoft 365 A3 Estudantes',
  'M365EDU_A3_ESTUDANTEBNFT':          'Microsoft 365 A3 Estudantes (Benefício)',
  'M365EDU_A5_STUDENT':                'Microsoft 365 A5 Estudantes',
  'ENTERPRISEPACKPLUS_STUUSEBNFT':     'Microsoft 365 A3 Estudantes (Benefício)',
  'ENTERPRISEPREMIUM_STUDENT':         'Microsoft 365 A5 Estudantes',
  'STANDARDWOFFPACK_STUDENT':          'Office 365 A1 Estudantes (Gratuito)',
  'STANDARDWOFFPACK_STUDENTEN':        'Office 365 A1 Estudantes (Gratuito)',
  'RIGHTSMANAGEMENT_STANDARD_STUDENT': 'Azure Rights Management Estudantes',
  // Outros
  'FLOW_FREE':                         'Power Automate Free',
  'POWERAPPS_VIRAL':                   'Power Apps Free',
};

function shouldExclude(skuPartNumber) {
  const p = skuPartNumber?.toUpperCase() || '';
  return EXCLUDE_KEYWORDS.some((k) => p.includes(k));
}

function isFree(skuPartNumber) {
  const p = skuPartNumber?.toUpperCase() || '';
  return FREE_KEYWORDS.some((k) => p.includes(k));
}

function getDisplayName(skuPartNumber) {
  return SKU_DISPLAY_NAMES[skuPartNumber] || skuPartNumber;
}

// SKUs que incluem Entra ID P2 como service plan embutido
const P2_BUNDLE_SKUS = new Set([
  'SPE_E5',               // Microsoft 365 E5
  'EMSPREMIUM',           // Enterprise Mobility + Security E5
  'M365EDU_A5_FACULTY',   // Microsoft 365 A5 Docentes
  'M365EDU_A5_STUDENT',   // Microsoft 365 A5 Estudantes
  'ENTERPRISEPREMIUM_FACULTY', // Microsoft 365 A5 Docentes (alias)
  'ENTERPRISEPREMIUM_STUDENT', // Microsoft 365 A5 Estudantes (alias)
]);

// SKUs que incluem Entra ID P1 como service plan embutido (mas não P2)
const P1_BUNDLE_SKUS = new Set([
  'SPB',                        // Microsoft 365 Business Premium
  'SPE_E3',                     // Microsoft 365 E3
  'EMS',                        // Enterprise Mobility + Security E3
  'ENTERPRISEPACKPLUS_FACULTY', // Microsoft 365 A3 Docentes
  'ENTERPRISEPACKPLUS_STUUSEBNFT', // Microsoft 365 A3 Estudantes (Benefício)
  'M365EDU_A3_FACULTY',         // Microsoft 365 A3 Docentes
  'M365EDU_A3_STUDENT',         // Microsoft 365 A3 Estudantes
  'M365EDU_A3_ESTUDANTEBNFT',   // Microsoft 365 A3 Estudantes (Benefício)
  'SPE_F3',                     // Microsoft 365 F3
]);

// Detecta o tier do Entra ID a partir dos SKUs ativos.
// Prioridade: SKU standalone > service plan embutido > SKU bundle conhecido.
function detectEntraIdTier(skus) {
  const parts = skus.map((s) => s.skuPartNumber?.toUpperCase() || '');
  const planNames = skus.flatMap((s) =>
    (s.servicePlans || []).map((p) => p.servicePlanName?.toUpperCase() || '')
  );

  // P2 — SKU standalone, service plan ou bundle P2 conhecido
  if (
    parts.some((p) => p === 'AAD_PREMIUM_P2' || p.includes('ENTRA_P2') || p.includes('EMS_P2')) ||
    planNames.some((p) => p === 'AAD_PREMIUM_P2') ||
    skus.some((s) => P2_BUNDLE_SKUS.has(s.skuPartNumber?.toUpperCase() || ''))
  ) return 'P2';

  // P1 — SKU standalone, service plan ou bundle P1 conhecido
  if (
    parts.some((p) => p === 'AAD_PREMIUM' || p.includes('ENTRA_P1')) ||
    planNames.some((p) => p === 'AAD_PREMIUM') ||
    skus.some((s) => P1_BUNDLE_SKUS.has(s.skuPartNumber?.toUpperCase() || ''))
  ) return 'P1';

  if (parts.some((p) => p === 'AAD_BASIC')) return 'Basic';
  return 'Free';
}

// Quantidades típicas de licenças de fluxo livre / placeholder do Graph — não representam assentos reais
const PHANTOM_QUANTITIES = new Set([1000, 1000000]);

function isPhantom(sku) {
  const qty = sku.prepaidUnits?.enabled;
  return PHANTOM_QUANTITIES.has(qty);
}

async function collectLicensing(tenantId) {
  const rawSkus = await graphGetAll(tenantId, '/subscribedSkus');
  const userSkus = rawSkus.filter(
    (s) =>
      s.appliesTo === 'User' &&
      s.capabilityStatus !== 'Deleted' &&
      !shouldExclude(s.skuPartNumber) &&
      !isPhantom(s)
  );

  let totalLicenses = 0;
  let totalAssigned = 0;
  let totalAvailable = 0;
  let paidLicenses = 0;
  let freeLicenses = 0;

  const skuList = userSkus.map((sku) => {
    const enabled = sku.prepaidUnits?.enabled || 0;
    const assigned = sku.consumedUnits || 0;
    const available = Math.max(0, enabled - assigned);
    const free = isFree(sku.skuPartNumber);

    totalLicenses += enabled;
    totalAssigned += assigned;
    totalAvailable += available;
    if (free) freeLicenses += enabled;
    else paidLicenses += enabled;

    return {
      skuPartNumber: sku.skuPartNumber,
      displayName: getDisplayName(sku.skuPartNumber),
      enabled,
      assigned,
      available,
      isFree: free,
    };
  });

  const unusedRatio = totalLicenses > 0 ? totalAvailable / totalLicenses : 0;
  let score;
  if (unusedRatio <= 0.05) score = 5;
  else if (unusedRatio <= 0.15) score = 4;
  else if (unusedRatio <= 0.25) score = 3;
  else if (unusedRatio <= 0.40) score = 2;
  else score = 1;

  const entraIdTier = detectEntraIdTier(rawSkus);

  return {
    score,
    entraIdTier,
    summary: {
      totalSkus: userSkus.length,
      totalLicenses,
      totalAssigned,
      totalAvailable,
      unusedRatioPercent: Math.round(unusedRatio * 100),
      paidLicenses,
      freeLicenses,
    },
    skus: skuList.sort((a, b) => b.assigned - a.assigned),
  };
}

module.exports = { collectLicensing };
