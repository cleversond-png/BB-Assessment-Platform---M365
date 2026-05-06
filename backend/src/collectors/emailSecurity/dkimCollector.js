const dns = require('dns').promises;
const logger = require('../../logger');

async function resolveSelector(selector, domain) {
  try {
    const records = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
    const flat = records.flat().join('');
    return flat.includes('v=DKIM1') || flat.includes('p=');
  } catch {
    return false;
  }
}

async function collectDkim(tenantId, domain) {
  logger.info({ event: 'collector_start', collector: 'dkim', tenantId, domain });
  const [sel1, sel2] = await Promise.all([
    resolveSelector('selector1', domain),
    resolveSelector('selector2', domain),
  ]);

  const count = (sel1 ? 1 : 0) + (sel2 ? 1 : 0);
  const score = count === 2 ? 5 : count === 1 ? 4 : 1;

  logger.info({ event: 'collector_done', collector: 'dkim', tenantId, domain, sel1, sel2, score });
  return {
    collector: 'dkim',
    score,
    summary: { configured: count > 0, selector1: sel1, selector2: sel2 },
  };
}

module.exports = { collectDkim };
