const express = require('express');
const { runBaselineAssessment } = require('../collectors/baseline');
const { runEntraIdAssessment } = require('../collectors/entraId');
const { runSharePointAssessment } = require('../collectors/sharePoint');
const { runGovernanceAssessment } = require('../collectors/governance');
const { runEmailSecurityAssessment } = require('../collectors/emailSecurity');
const { assessIAReadiness } = require('../collectors/iaReadiness');
const { generateRecommendations } = require('../recommendations');
const { generatePDF } = require('../pdf/pdfGenerator');
const tokenStore = require('../auth/tokenStore');
const resultsStore = require('../store/resultsStore');
const logger = require('../logger');

const router = express.Router();

// In-memory job tracker: tenantId → { status, domains, startedAt, completedAt?, error? }
const jobs = new Map();

// Mapa collector → permissão Graph. Quando um collector retorna unavailable,
// inferimos qual permissão precisa ser adicionada à App Registration / consent.
// Apenas collectors que dependem ÚNICA E EXCLUSIVAMENTE da permissão listada —
// se o unavailable pode vir de outras razões (licença ausente, etc), não mapeamos.
const PERMISSION_BY_COLLECTOR = {
  oversharing:        'Sites.Read.All',
  dlp:                'DataLossPreventionPolicy.Read.All',
  retentionPolicies:  'RecordsManagement.Read.All',
  copilotExtensions:  'ExternalConnection.Read.All',
};

function detectMissingPermissions(domainResults) {
  const missing = new Set();
  for (const domain of Object.values(domainResults)) {
    const collectors = domain?.collectors || {};
    for (const [name, c] of Object.entries(collectors)) {
      if (c?.unavailable && PERMISSION_BY_COLLECTOR[name]) {
        missing.add(PERMISSION_BY_COLLECTOR[name]);
      }
    }
  }
  return [...missing].sort();
}

function requireConsent(req, res, next) {
  const { tenantId } = req.body;
  if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
  if (!tokenStore.hasConsent(tenantId)) {
    return res.status(403).json({ error: 'No active consent for this tenant. Complete the auth flow first.' });
  }
  next();
}

async function runAssessmentBackground(tenantId) {
  const job = jobs.get(tenantId);
  logger.info({ event: 'full_assessment_started', tenantId });

  try {
    const domainResults = {};
    const runners = [
      { key: 'baseline',      fn: () => runBaselineAssessment(tenantId) },
      { key: 'entraId',       fn: () => runEntraIdAssessment(tenantId) },
      { key: 'sharePoint',    fn: () => runSharePointAssessment(tenantId) },
      { key: 'governance',    fn: () => runGovernanceAssessment(tenantId) },
      { key: 'emailSecurity', fn: () => runEmailSecurityAssessment(tenantId) },
    ];

    await Promise.allSettled(runners.map(async ({ key, fn }) => {
      try {
        domainResults[key] = await fn();
        job.domains[key] = 'done';
      } catch (err) {
        domainResults[key] = { error: err.response?.data?.error?.message || err.message };
        job.domains[key] = 'error';
        logger.error({ event: 'domain_error', domain: key, tenantId, error: err.message });
      }
    }));

    domainResults.iaReadiness = assessIAReadiness(tenantId, domainResults);

    const scores = Object.values(domainResults)
      .map((d) => d.domainScore)
      .filter((s) => typeof s === 'number');
    const overallScore = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;

    const missingPermissions = detectMissingPermissions(domainResults);

    const result = {
      tenantId,
      tenantName: domainResults.baseline?.collectors?.tenantInfo?.displayName || null,
      entraIdTier: domainResults.baseline?.entraIdTier || null,
      assessedAt: new Date().toISOString(),
      overallScore,
      missingPermissions,
      reconsentNeeded: missingPermissions.length > 0,
      domains: domainResults,
      recommendations: generateRecommendations(domainResults),
    };

    resultsStore.save(tenantId, result);
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    logger.info({ event: 'full_assessment_completed', tenantId, overallScore });
  } catch (err) {
    job.status = 'failed';
    job.error = err.message;
    logger.error({ event: 'assessment_failed', tenantId, error: err.message });
  }
}

// POST /assessment/start — starts async assessment, returns immediately
router.post('/start', requireConsent, (req, res) => {
  const { tenantId } = req.body;

  // If already running, return current status (don't start a second job)
  const existing = jobs.get(tenantId);
  if (existing?.status === 'running') {
    return res.json({ status: 'running', tenantId });
  }

  const job = { status: 'running', domains: {}, startedAt: new Date().toISOString() };
  jobs.set(tenantId, job);

  runAssessmentBackground(tenantId); // fire and forget — no await
  logger.info({ event: 'assessment_queued', tenantId });
  res.json({ status: 'running', tenantId });
});

// GET /assessment/jobs/:tenantId — polling endpoint for async assessment progress
router.get('/jobs/:tenantId', (req, res) => {
  const { tenantId } = req.params;
  const job = jobs.get(tenantId);
  if (job) return res.json(job);

  // No in-memory job — check disk (e.g. server restarted after a completed assessment)
  const saved = resultsStore.getLatest(tenantId);
  if (saved) return res.json({ status: 'completed', domains: {}, completedAt: saved.assessedAt });

  res.status(404).json({ error: 'No job found for this tenant' });
});

// POST /assessment/entra
router.post('/entra', requireConsent, async (req, res) => {
  const { tenantId } = req.body;
  try {
    res.json(await runEntraIdAssessment(tenantId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /assessment/sharepoint
router.post('/sharepoint', requireConsent, async (req, res) => {
  const { tenantId } = req.body;
  try {
    res.json(await runSharePointAssessment(tenantId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /assessment/emailsecurity
router.post('/emailsecurity', requireConsent, async (req, res) => {
  const { tenantId } = req.body;
  try {
    res.json(await runEmailSecurityAssessment(tenantId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /assessment/governance
router.post('/governance', requireConsent, async (req, res) => {
  const { tenantId } = req.body;
  try {
    res.json(await runGovernanceAssessment(tenantId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /assessment/results/:tenantId/pdf — gera e devolve o PDF do último assessment
router.get('/results/:tenantId/pdf', (req, res) => {
  const result = resultsStore.getLatest(req.params.tenantId);
  if (!result) return res.status(404).json({ error: 'No results found for this tenant' });

  const safeName = (result.tenantName || result.tenantId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `M365_Assessment_${safeName}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  try {
    generatePDF(result, res);
  } catch (err) {
    logger.error({ event: 'pdf_generation_error', tenantId: req.params.tenantId, error: err.message });
    if (!res.headersSent) res.status(500).json({ error: 'PDF generation failed' });
  }
});

// GET /assessment/results — lista resumo de todos os tenants já avaliados
router.get('/results', (_req, res) => {
  res.json(resultsStore.listLatestAll());
});

// GET /assessment/results/:tenantId — resultado mais recente de um tenant
router.get('/results/:tenantId', (req, res) => {
  const result = resultsStore.getLatest(req.params.tenantId);
  if (!result) return res.status(404).json({ error: 'No results found for this tenant' });
  res.json(result);
});

module.exports = router;
