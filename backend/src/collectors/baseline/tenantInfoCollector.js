const { graphGet } = require('../../graph/graphClient');

async function collectTenantInfo(tenantId) {
  const data = await graphGet(tenantId, '/organization', {
    '$select': 'displayName,verifiedDomains,countryLetterCode,createdDateTime',
  });

  const org = data.value?.[0] || {};
  const verifiedDomains = org.verifiedDomains || [];
  const defaultDomain = verifiedDomains.find((d) => d.isDefault)?.name || null;
  const initialDomain = verifiedDomains.find((d) => d.isInitial)?.name || null;

  return {
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
  };
}

module.exports = { collectTenantInfo };
