const express = require('express');
const {
  listEnvironmentResources,
  getEnvironmentBilling,
  controlWebApp,
} = require('../azure/environmentService');
const logger = require('../logger');

const router = express.Router();

function handleEnvironmentError(res, err, event) {
  logger.error({ event, error: err.message });
  res.status(500).json({ error: err.message });
}

router.get('/', async (_req, res) => {
  try {
    const [inventory, billing] = await Promise.all([
      listEnvironmentResources(),
      getEnvironmentBilling().catch((err) => ({ unavailable: true, error: err.message })),
    ]);
    res.json({ ...inventory, billing });
  } catch (err) {
    handleEnvironmentError(res, err, 'environment_fetch_failed');
  }
});

router.get('/billing', async (_req, res) => {
  try {
    res.json(await getEnvironmentBilling());
  } catch (err) {
    handleEnvironmentError(res, err, 'environment_billing_failed');
  }
});

router.post('/resources/:name/:action', async (req, res) => {
  try {
    const updated = await controlWebApp(req.params.name, req.params.action);
    res.json(updated);
  } catch (err) {
    handleEnvironmentError(res, err, 'environment_action_failed');
  }
});

module.exports = router;
