const dns = require('dns').promises;
const logger = require('../../logger');

async function collectDmarc(tenantId, domain) {
  logger.info({ event: 'collector_start', collector: 'dmarc', tenantId, domain });
  let records;
  try {
    records = await dns.resolveTxt(`_dmarc.${domain}`);
  } catch (err) {
    if (err.code === 'ENODATA' || err.code === 'ENOTFOUND' || err.code === 'ESERVFAIL') {
      return { collector: 'dmarc', score: 0, summary: { present: false, record: null, policy: null, pct: null } };
    }
    throw err;
  }

  const dmarcRecord = records.flat().find((r) => r.startsWith('v=DMARC1'));
  if (!dmarcRecord) {
    return { collector: 'dmarc', score: 0, summary: { present: false, record: null, policy: null, pct: null } };
  }

  const pMatch = dmarcRecord.match(/p=(\w+)/);
  const pctMatch = dmarcRecord.match(/pct=(\d+)/);
  const policy = pMatch ? pMatch[1] : null;
  const pct = pctMatch ? parseInt(pctMatch[1], 10) : 100;

  const score = policy === 'reject' ? 5
    : policy === 'quarantine' ? (pct >= 100 ? 4 : 3)
    : policy === 'none' ? 2 : 1;

  logger.info({ event: 'collector_done', collector: 'dmarc', tenantId, domain, policy, pct, score });
  return { collector: 'dmarc', score, summary: { present: true, record: dmarcRecord, policy, pct } };
}

module.exports = { collectDmarc };
