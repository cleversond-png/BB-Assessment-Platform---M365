const { graphGet } = require('../../graph/graphClient');
const { collectSpf } = require('./spfCollector');
const { collectDmarc } = require('./dmarcCollector');
const { collectDkim } = require('./dkimCollector');
const logger = require('../../logger');

const COLLECTOR_WEIGHTS = { spf: 3, dmarc: 3, dkim: 2 };
const TOTAL_WEIGHT = Object.values(COLLECTOR_WEIGHTS).reduce((a, b) => a + b, 0);
const MAX_DOMAINS = 10; // cap to avoid rate-limit storms on tenants with many domains

async function getVerifiedDomains(tenantId) {
  const data = await graphGet(tenantId, '/organization', { $select: 'verifiedDomains' });
  const org = data.value?.[0] || {};
  return (org.verifiedDomains || [])
    .filter((d) => !d.name.endsWith('.onmicrosoft.com'))
    .slice(0, MAX_DOMAINS);
}

async function assessDomain(tenantId, domainName) {
  const [spfR, dmarcR, dkimR] = await Promise.allSettled([
    collectSpf(tenantId, domainName),
    collectDmarc(tenantId, domainName),
    collectDkim(tenantId, domainName),
  ]);
  return {
    spf:   spfR.status   === 'fulfilled' ? spfR.value   : null,
    dmarc: dmarcR.status === 'fulfilled' ? dmarcR.value : null,
    dkim:  dkimR.status  === 'fulfilled' ? dkimR.value  : null,
  };
}

async function runEmailSecurityAssessment(tenantId) {
  logger.info({ event: 'assessment_start', domain: 'emailSecurity', tenantId });

  let domains;
  try {
    domains = await getVerifiedDomains(tenantId);
  } catch (err) {
    logger.error({ event: 'domain_fetch_failed', tenantId, error: err.message });
    return {
      domain: 'emailSecurity',
      tenantId,
      assessedAt: new Date().toISOString(),
      domainScore: null,
      error: 'Não foi possível obter os domínios verificados do tenant.',
    };
  }

  if (domains.length === 0) {
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

  // Run all collectors for all domains in parallel
  const domainAssessments = await Promise.allSettled(
    domains.map(async (d) => ({ domain: d.name, isDefault: !!d.isDefault, ...await assessDomain(tenantId, d.name) }))
  );

  const domainData = domainAssessments
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);

  // Primary domain = isDefault, fallback to first
  const primary = domainData.find((d) => d.isDefault) || domainData[0];
  const checkedDomain = primary?.domain || domains[0].name;

  // Collectors from primary domain (for scoring)
  const results = {
    spf:   primary?.spf   || null,
    dmarc: primary?.dmarc || null,
    dkim:  primary?.dkim  || null,
  };

  let weightedSum = 0;
  for (const [name, weight] of Object.entries(COLLECTOR_WEIGHTS)) {
    if (results[name]?.score != null) weightedSum += results[name].score * weight;
  }
  const domainScore = Math.round((weightedSum / (TOTAL_WEIGHT * 5)) * 5 * 10) / 10;

  // Matrix for multi-domain display (only when > 1 domain)
  const domainsMatrix = domains.length > 1
    ? domainData.map((d) => ({
        domain: d.domain,
        isPrimary: d.isDefault,
        spf:   d.spf   ? { present: d.spf.summary?.present,   qualifier: d.spf.summary?.qualifier }   : null,
        dmarc: d.dmarc ? { present: d.dmarc.summary?.present, policy:    d.dmarc.summary?.policy }     : null,
        dkim:  d.dkim  ? { configured: d.dkim.summary?.configured }                                    : null,
      }))
    : undefined;

  logger.info({ event: 'assessment_done', domain: 'emailSecurity', tenantId, checkedDomain, domainsCount: domains.length, domainScore });

  return {
    domain: 'emailSecurity',
    tenantId,
    assessedAt: new Date().toISOString(),
    domainScore,
    checkedDomain,
    collectors: results,
    domainsMatrix,
  };
}

module.exports = { runEmailSecurityAssessment };
