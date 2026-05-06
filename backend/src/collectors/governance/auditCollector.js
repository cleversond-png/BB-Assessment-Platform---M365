const { graphGet } = require('../../graph/graphClient');
const logger = require('../../logger');

// Requires: AuditLog.Read.All (Application)
// Checks whether Azure AD audit logging is active by querying recent directory audit events.
// A tenant with active audit logging will have events from the last 7 days.
// No events could mean: logging disabled, tenant too new, or permission just granted.

const RECENT_DAYS = 30;

async function collectAudit(tenantId) {
  logger.info({ event: 'collector_start', collector: 'audit', tenantId });

  let recentEvents;
  let totalFetched = 0;

  try {
    const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const data = await graphGet(tenantId, '/auditLogs/directoryAudits', {
      $top: 20,
      $orderby: 'activityDateTime desc',
      $filter: `activityDateTime ge ${cutoff}`,
    });
    recentEvents = data.value ?? [];
    totalFetched = recentEvents.length;
  } catch (err) {
    if (err.response?.status === 403 || err.response?.status === 404) {
      logger.warn({ event: 'collector_unavailable', collector: 'audit', tenantId });
      return {
        collector: 'audit',
        score: 0,
        unavailable: true,
        reason: 'AuditLog.Read.All required for audit log verification.',
      };
    }
    // 400 may occur if filter syntax unsupported — retry without filter
    if (err.response?.status === 400) {
      try {
        const fallback = await graphGet(tenantId, '/auditLogs/directoryAudits', { $top: 5 });
        recentEvents = fallback.value ?? [];
        totalFetched = recentEvents.length;
      } catch (fallbackErr) {
        if (fallbackErr.response?.status === 403 || fallbackErr.response?.status === 404) {
          return {
            collector: 'audit',
            score: 0,
            unavailable: true,
            reason: 'AuditLog.Read.All required for audit log verification.',
          };
        }
        throw fallbackErr;
      }
    } else {
      throw err;
    }
  }

  // Summarize event categories to show what's being audited
  const categoryCounts = recentEvents.reduce((acc, e) => {
    const cat = e.category ?? 'Unknown';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const mostRecentEvent = recentEvents[0]?.activityDateTime ?? null;

  // Score: 0 if no events (logging may be off), scales with event presence
  // We can't definitively say logging is "off" from absence — but absence is a risk signal
  let score;
  if (totalFetched === 0) score = 1;        // permission granted but no recent events
  else if (totalFetched < 5) score = 3;
  else score = 5;

  logger.info({
    event: 'collector_done', collector: 'audit', tenantId,
    recentEventsFound: totalFetched, mostRecentEvent, score,
  });

  return {
    collector: 'audit',
    score,
    summary: {
      recentEventsFound: totalFetched,
      lookbackDays: RECENT_DAYS,
      mostRecentEvent,
      categoryCounts,
      note: totalFetched === 0
        ? 'No recent audit events found. Logging may be inactive or tenant is new.'
        : undefined,
    },
    recentEvents: recentEvents.slice(0, 10).map((e) => ({
      activityDateTime: e.activityDateTime,
      activityDisplayName: e.activityDisplayName,
      category: e.category,
      result: e.result,
      initiatedBy: e.initiatedBy?.user?.userPrincipalName ?? e.initiatedBy?.app?.displayName ?? null,
    })),
  };
}

module.exports = { collectAudit };
