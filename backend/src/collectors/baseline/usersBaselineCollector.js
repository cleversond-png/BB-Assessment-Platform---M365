const { graphGet } = require('../../graph/graphClient');

const EVENTUAL = { extraHeaders: { ConsistencyLevel: 'eventual' } };

async function countUsers(tenantId, filter) {
  const params = { '$count': 'true', '$top': '1', '$select': 'id' };
  if (filter) params['$filter'] = filter;
  const res = await graphGet(tenantId, '/users', params, EVENTUAL);
  return res['@odata.count'] || 0;
}

async function collectUsersBaseline(tenantId) {
  const [total, guests, disabled] = await Promise.all([
    countUsers(tenantId, null),
    countUsers(tenantId, "userType eq 'Guest'"),
    countUsers(tenantId, 'accountEnabled eq false'),
  ]);

  const members = total - guests;
  const guestRatio = total > 0 ? guests / total : 0;
  const disabledRatio = members > 0 ? disabled / members : 0;

  let score;
  if (guestRatio <= 0.10 && disabledRatio <= 0.10) score = 5;
  else if (guestRatio <= 0.20 && disabledRatio <= 0.20) score = 4;
  else if (guestRatio <= 0.30 && disabledRatio <= 0.30) score = 3;
  else if (guestRatio <= 0.45) score = 2;
  else score = 1;

  return {
    score,
    summary: {
      total,
      members,
      guests,
      disabled,
      active: members - disabled,
      guestRatioPercent: Math.round(guestRatio * 100),
      disabledRatioPercent: Math.round(disabledRatio * 100),
    },
  };
}

module.exports = { collectUsersBaseline };
