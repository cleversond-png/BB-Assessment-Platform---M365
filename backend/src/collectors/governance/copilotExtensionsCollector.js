const { graphGetAll } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: ExternalConnection.Read.All (Application)
// Inventories Microsoft Graph Connectors — external data sources the Copilot can query
// (CRM, ERP, ticketing, custom systems). Each active connector expands the Copilot's
// data surface beyond M365. Unreviewed connectors risk combining internal + external
// data in AI responses without the tenant admin's awareness.

async function collectCopilotExtensions(tenantId) {
  logger.info({ event: 'collector_start', collector: 'copilotExtensions', tenantId });

  let connections;
  try {
    connections = await graphGetAll(tenantId, '/external/connections', {
      $select: 'id,name,description,state,connectorId',
    });
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 404) {
      logger.warn({ event: 'collector_unavailable', collector: 'copilotExtensions', tenantId });
      return {
        collector: 'copilotExtensions',
        score: 5,
        unavailable: true,
        reason: 'ExternalConnection.Read.All required. No connectors may be configured.',
      };
    }
    throw err;
  }

  const totalConnections = connections.length;
  const activeConnections = connections.filter((c) => c.state === 'ready' || c.state === 'enabled');
  const activeCount = activeConnections.length;

  // Score: 0 connectors = full score (no external surface from connectors).
  // Each batch of active connectors adds governance burden.
  let score = 5;
  if (activeCount > 10) score = 2;
  else if (activeCount > 5) score = 3;
  else if (activeCount > 0) score = 4;

  logger.info({
    event: 'collector_done', collector: 'copilotExtensions', tenantId,
    totalConnections, activeConnections: activeCount, score,
  });

  return {
    collector: 'copilotExtensions',
    score,
    summary: {
      totalConnections,
      activeConnectionsCount: activeCount,
    },
    connections: connections.slice(0, 20).map((c) => ({
      id: c.id,
      name: c.name,
      state: c.state,
      connectorId: c.connectorId,
    })),
  };
}

module.exports = { collectCopilotExtensions };
