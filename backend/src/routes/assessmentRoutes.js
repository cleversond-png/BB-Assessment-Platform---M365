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

function requireConsent(req, res, next) {
  const { tenantId } = req.body;
  if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
  if (!tokenStore.hasConsent(tenantId)) {
    return res.status(403).json({ error: 'No active consent for this tenant. Complete the auth flow first.' });
  }
  next();
}

// POST /assessment/start — runs all domains + generates recommendations
router.post('/start', requireConsent, async (req, res) => {
  const { tenantId } = req.body;
  logger.info({ event: 'full_assessment_requested', tenantId });

  try {
    const [baseline, entraId, sharePoint, governance, emailSecurity] = await Promise.allSettled([
      runBaselineAssessment(tenantId),
      runEntraIdAssessment(tenantId),
      runSharePointAssessment(tenantId),
      runGovernanceAssessment(tenantId),
      runEmailSecurityAssessment(tenantId),
    ]);

    const domains = {
      baseline:      baseline.status === 'fulfilled'      ? baseline.value      : { error: baseline.reason?.message },
      entraId:       entraId.status === 'fulfilled'       ? entraId.value       : { error: entraId.reason?.message },
      sharePoint:    sharePoint.status === 'fulfilled'    ? sharePoint.value    : { error: sharePoint.reason?.message },
      governance:    governance.status === 'fulfilled'    ? governance.value    : { error: governance.reason?.message },
      emailSecurity: emailSecurity.status === 'fulfilled' ? emailSecurity.value : { error: emailSecurity.reason?.message },
    };

    // iaReadiness is synchronous — runs after domain data is ready
    domains.iaReadiness = assessIAReadiness(tenantId, domains);

    const scores = Object.values(domains)
      .map((d) => d.domainScore)
      .filter((s) => typeof s === 'number');
    const overallScore = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;

    const tenantName = domains.baseline?.collectors?.tenantInfo?.displayName || null;
    const entraIdTier = domains.baseline?.entraIdTier || null;

    const result = {
      tenantId,
      tenantName,
      entraIdTier,
      assessedAt: new Date().toISOString(),
      overallScore,
      domains,
      recommendations: generateRecommendations(domains),
    };

    resultsStore.save(tenantId, result);
    res.json(result);
  } catch (err) {
    logger.error({ event: 'assessment_failed', tenantId, error: err.message });
    res.status(500).json({ error: 'Assessment failed', detail: err.message });
  }
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
