const express = require('express');
const cors = require('cors');
const path = require('path');
const { validateConfig, server: serverConfig } = require('./config');
const authRoutes = require('./routes/authRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const { acquireTokenForTenant } = require('./auth/authService');
const consentStore = require('./store/consentStore');
const logger = require('./logger');

validateConfig();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/assessment', assessmentRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(serverConfig.port, async () => {
  logger.info({ event: 'server_started', port: serverConfig.port });

  // Re-acquire tokens for all previously consented tenants (client_credentials — no user interaction needed)
  const tenants = consentStore.listTenants();
  if (tenants.length > 0) {
    logger.info({ event: 'restoring_tokens', count: tenants.length });
    for (const { tenantId } of tenants) {
      try {
        await acquireTokenForTenant(tenantId);
        logger.info({ event: 'token_restored', tenantId });
      } catch (err) {
        logger.error({ event: 'token_restore_failed', tenantId, error: err.message });
      }
    }
  }
});
