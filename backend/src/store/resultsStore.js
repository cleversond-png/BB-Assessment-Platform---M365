const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const RESULTS_DIR = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'results')
  : path.resolve(__dirname, '../../data/results');

function ensureDir() {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

function save(tenantId, result) {
  ensureDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(RESULTS_DIR, `${tenantId}_${ts}.json`);
  const latest = path.join(RESULTS_DIR, `latest_${tenantId}.json`);

  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  fs.writeFileSync(latest, JSON.stringify(result, null, 2));

  logger.info({ event: 'result_saved', tenantId, file });
  return file;
}

function getLatest(tenantId) {
  ensureDir();
  const latest = path.join(RESULTS_DIR, `latest_${tenantId}.json`);
  if (!fs.existsSync(latest)) return null;
  return JSON.parse(fs.readFileSync(latest, 'utf8'));
}

function listLatestAll() {
  ensureDir();
  return fs.readdirSync(RESULTS_DIR)
    .filter((f) => f.startsWith('latest_'))
    .map((f) => {
      const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf8'));
      return {
        tenantId: data.tenantId,
        tenantName: data.tenantName || null,
        assessedAt: data.assessedAt,
        overallScore: data.overallScore,
        recommendations: data.recommendations?.bySeverity,
      };
    })
    .sort((a, b) => (a.overallScore ?? 99) - (b.overallScore ?? 99));
}

function deleteAllForTenant(tenantId) {
  ensureDir();
  const files = fs.readdirSync(RESULTS_DIR).filter(
    (f) => f.startsWith(`${tenantId}_`) || f === `latest_${tenantId}.json`
  );
  for (const f of files) {
    fs.unlinkSync(path.join(RESULTS_DIR, f));
  }
  logger.info({ event: 'results_deleted', tenantId, count: files.length });
  return files.length;
}

module.exports = { save, getLatest, listLatestAll, deleteAllForTenant };
