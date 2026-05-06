const dns = require('dns').promises;
const logger = require('../../logger');

async function collectSpf(tenantId, domain) {
  logger.info({ event: 'collector_start', collector: 'spf', tenantId, domain });
  let records;
  try {
    records = await dns.resolveTxt(domain);
  } catch (err) {
    if (err.code === 'ENODATA' || err.code === 'ENOTFOUND' || err.code === 'ESERVFAIL') {
      return { collector: 'spf', score: 0, summary: { present: false, record: null, qualifier: null } };
    }
    throw err;
  }

  const spfRecord = records.flat().find((r) => r.startsWith('v=spf1'));
  if (!spfRecord) {
    return { collector: 'spf', score: 0, summary: { present: false, record: null, qualifier: null } };
  }

  const qualifier = spfRecord.includes('-all') ? '-all'
    : spfRecord.includes('~all') ? '~all'
    : spfRecord.includes('?all') ? '?all'
    : spfRecord.includes('+all') ? '+all' : 'unknown';

  const score = qualifier === '-all' ? 5 : qualifier === '~all' ? 4
    : qualifier === '?all' ? 2 : qualifier === '+all' ? 1 : 3;

  logger.info({ event: 'collector_done', collector: 'spf', tenantId, domain, qualifier, score });
  return { collector: 'spf', score, summary: { present: true, record: spfRecord, qualifier } };
}

module.exports = { collectSpf };
