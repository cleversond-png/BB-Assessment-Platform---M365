const { graphGet } = require('../../graph/graphClient');
const { collectSpf } = require('./spfCollector');
const { collectDmarc } = require('./dmarcCollector');
const { collectDkim } = require('./dkimCollector');
const logger = require('../../logger');

const COLLECTOR_WEIGHTS = { spf: 3, dmarc: 3, dkim: 2 };
const TOTAL_WEIGHT = Object.values(COLLECTOR_WEIGHTS).reduce((a, b) => a + b, 0);

async function getPrimaryDomain(tenantId) {
  const data = await graphGet(tenantId, '/organization', {
    $select: 'verifiedDomains',
  });
  const org = data.value?.[0] || {};
  const domains = (org.verifiedDomains || [])
    .filter((d) => !d.name.endsWith('.onmicrosoft.com'));
  if (domains.length === 0) return null;
  return domains.find((d) => d.isDefault)?.name || domains[0].name;
}

async function runEmailSecurityAssessment(tenantId) {
  logger.info({ event: 'assessment_start', domain: 'emailSecurity', tenantId });

  let domain;
  try {
    domain = await getPrimaryDomain(tenantId);
  } catch (err) {
    logger.error({ event: 'domain_fetch_failed', tenantId, error: err.message });
    return {
      domain: 'emailSecurity',
      tenantId,
      assessedAt: new Date().toISOString(),
      domainScore: null,
      error: 'Não foi possível obter o domínio primário do tenant.',
    };
  }

  if (!domain) {
    return {
      domain: 'emailSecurity',
      tenantId,
      assessedAt: new Date().toISOString(),
      domainScore: null,
      collectors: {},
      checkedDomain: null,
      error: 'Nenhum domínio customizado verificado encontrado.',
    };
  }

  const results = {};
  await Promise.allSettled([
    collectSpf(tenantId, domain).then((r) => { results.spf = r; }),
    collectDmarc(tenantId, domain).then((r) => { results.dmarc = r; }),
    collectDkim(tenantId, domain).then((r) => { results.dkim = r; }),
  ]);

  let weightedSum = 0;
  for (const [name, weight] of Object.entries(COLLECTOR_WEIGHTS)) {
    if (results[name]) weightedSum += results[name].score * weight;
  }
  const domainScore = Math.round((weightedSum / (TOTAL_WEIGHT * 5)) * 5 * 10) / 10;

  logger.info({ event: 'assessment_done', domain: 'emailSecurity', tenantId, checkedDomain: domain, domainScore });

  return {
    domain: 'emailSecurity',
    tenantId,
    assessedAt: new Date().toISOString(),
    domainScore,
    checkedDomain: domain,
    collectors: results,
  };
}

module.exports = { runEmailSecurityAssessment };
