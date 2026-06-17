const { graphGet } = require('../../graph/graphClient');
const logger = require('../../logger');

const CONSISTENCY_EVENTUAL = { extraHeaders: { 'ConsistencyLevel': 'eventual' } };

async function safeCount(tenantId, path) {
  try {
    const val = await graphGet(tenantId, path, {}, CONSISTENCY_EVENTUAL);
    return typeof val === 'number' ? val : parseInt(val, 10) || null;
  } catch {
    return null;
  }
}

async function collectTenantInfo(tenantId) {
  const [orgData, groupCount, appCount, deviceCount] = await Promise.allSettled([
    graphGet(tenantId, '/organization', {
      '$select': 'displayName,verifiedDomains,countryLetterCode,createdDateTime',
    }),
    safeCount(tenantId, '/groups/$count'),
    safeCount(tenantId, '/applications/$count'),
    safeCount(tenantId, '/devices/$count'),
  ]);

  const org = orgData.status === 'fulfilled' ? (orgData.value?.value?.[0] || {}) : {};
  const verifiedDomains = org.verifiedDomains || [];
  const defaultDomain = verifiedDomains.find((d) => d.isDefault)?.name || null;
  const initialDomain = verifiedDomains.find((d) => d.isInitial)?.name || null;

  logger.info({ event: 'collector_done', collector: 'tenantInfo', tenantId, defaultDomain });

  return {
    informational: true,
    displayName: org.displayName || null,
    defaultDomain,
    initialDomain,
    country: org.countryLetterCode || null,
    createdDateTime: org.createdDateTime || null,
    verifiedDomains: verifiedDomains.map((d) => ({
      name: d.name,
      isDefault: !!d.isDefault,
      isInitial: !!d.isInitial,
    })),
    groupCount: groupCount.status === 'fulfilled' ? groupCount.value : null,
    appCount: appCount.status === 'fulfilled' ? appCount.value : null,
    deviceCount: deviceCount.status === 'fulfilled' ? deviceCount.value : null,
  };
}

module.exports = { collectTenantInfo };
