require('dotenv').config();

const REQUIRED_VARS = ['AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_REDIRECT_URI'];

function validateConfig() {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = {
  validateConfig,
  azure: {
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
    redirectUri: process.env.AZURE_REDIRECT_URI,
    authority: 'https://login.microsoftonline.com',
    graphScope: 'https://graph.microsoft.com/.default',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
  },
};
