const express = require('express');
const companyStore = require('../store/companyStore');
const logger = require('../logger');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ companies: companyStore.listCompanies() });
});

router.post('/', (req, res) => {
  try {
    const company = companyStore.upsertCompany(req.body);
    res.status(201).json({ company });
  } catch (err) {
    logger.warn({ event: 'company_create_failed', error: err.message });
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const company = companyStore.upsertCompany(req.body, req.params.id);
    res.json({ company });
  } catch (err) {
    logger.warn({ event: 'company_update_failed', companyId: req.params.id, error: err.message });
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const deleted = companyStore.removeCompany(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Empresa não encontrada' });
  res.json({ success: true, id: req.params.id });
});

module.exports = router;
