const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const FILE = path.resolve(__dirname, '../../data/consented_tenants.json');

function load() {
  try {
    if (!fs.existsSync(FILE)) return [];
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return [];
  }
}

function save(tenants) {
  fs.writeFileSync(FILE, JSON.stringify(tenants, null, 2));
}

function addPending(tenantId, clientName, consentUrl) {
  const tenants = load();
  const existing = tenants.find((t) => t.tenantId === tenantId);
  if (existing) {
    existing.clientName = clientName || existing.clientName;
    existing.consentUrl = consentUrl;
    existing.status = 'pending';
  } else {
    tenants.push({ tenantId, clientName: clientName || '', consentUrl, consentedAt: null, status: 'pending' });
  }
  save(tenants);
  logger.info({ event: 'consent_pending', tenantId, clientName });
}

function markConsented(tenantId) {
  const tenants = load();
  const entry = tenants.find((t) => t.tenantId === tenantId);
  if (entry) {
    entry.status = 'consented';
    entry.consentedAt = new Date().toISOString();
  } else {
    tenants.push({ tenantId, clientName: '', consentUrl: null, consentedAt: new Date().toISOString(), status: 'consented' });
  }
  save(tenants);
  logger.info({ event: 'consent_persisted', tenantId });
}

function removeTenant(tenantId) {
  const tenants = load().filter((t) => t.tenantId !== tenantId);
  save(tenants);
  logger.info({ event: 'consent_removed', tenantId });
}

function listTenants() {
  return load();
}

function hasTenant(tenantId) {
  return load().some((t) => t.tenantId === tenantId && t.status === 'consented');
}

module.exports = { addPending, markConsented, removeTenant, listTenants, hasTenant };
