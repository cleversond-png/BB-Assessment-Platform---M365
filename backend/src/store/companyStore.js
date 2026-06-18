const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { TENANT_RE } = require('../config');
const logger = require('../logger');

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const FILE = path.join(DATA_DIR, 'companies.json');

const TENANT_TYPES = new Set(['educational', 'corporate']);

function load() {
  try {
    if (!fs.existsSync(FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(companies) {
  fs.writeFileSync(FILE, JSON.stringify(companies, null, 2));
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeContact(contact = {}) {
  return {
    name: cleanString(contact.name),
    email: cleanString(contact.email),
    phone: cleanString(contact.phone),
  };
}

function normalizeAddress(address = {}) {
  return {
    street: cleanString(address.street),
    number: cleanString(address.number),
    complement: cleanString(address.complement),
    district: cleanString(address.district),
    city: cleanString(address.city),
    state: cleanString(address.state),
    postalCode: cleanString(address.postalCode),
    country: cleanString(address.country) || 'Brasil',
  };
}

function normalize(input = {}) {
  const tenantId = cleanString(input.tenantId);
  const companyName = cleanString(input.companyName);
  const tenantType = TENANT_TYPES.has(input.tenantType) ? input.tenantType : 'corporate';

  if (!companyName) throw new Error('companyName is required');
  if (!tenantId) throw new Error('tenantId is required');
  if (!TENANT_RE.test(tenantId)) {
    throw new Error('tenantId inválido — use o Directory ID (UUID) ou domínio *.onmicrosoft.com');
  }

  return {
    tenantId,
    companyName,
    tenantType,
    address: normalizeAddress(input.address),
    contacts: {
      technical: normalizeContact(input.contacts?.technical),
      responsible: normalizeContact(input.contacts?.responsible),
    },
  };
}

function listCompanies() {
  return load().sort((a, b) => a.companyName.localeCompare(b.companyName, 'pt-BR'));
}

function upsertCompany(input, id = null) {
  const companies = load();
  const now = new Date().toISOString();
  const normalized = normalize(input);
  const index = id
    ? companies.findIndex((company) => company.id === id)
    : companies.findIndex((company) => company.tenantId.toLowerCase() === normalized.tenantId.toLowerCase());

  const duplicate = companies.find((company) =>
    company.tenantId.toLowerCase() === normalized.tenantId.toLowerCase() &&
    (!id || company.id !== id)
  );
  if (duplicate) throw new Error('Já existe uma empresa cadastrada para este tenant');

  if (index >= 0) {
    companies[index] = {
      ...companies[index],
      ...normalized,
      updatedAt: now,
    };
    save(companies);
    logger.info({ event: 'company_updated', companyId: companies[index].id, tenantId: normalized.tenantId });
    return companies[index];
  }

  const company = {
    id: crypto.randomUUID(),
    ...normalized,
    createdAt: now,
    updatedAt: now,
  };
  companies.push(company);
  save(companies);
  logger.info({ event: 'company_created', companyId: company.id, tenantId: company.tenantId });
  return company;
}

function removeCompany(id) {
  const companies = load();
  const next = companies.filter((company) => company.id !== id);
  if (next.length === companies.length) return false;
  save(next);
  logger.info({ event: 'company_deleted', companyId: id });
  return true;
}

module.exports = { listCompanies, upsertCompany, removeCompany };
