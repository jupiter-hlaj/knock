const express = require('express');
const path = require('path');
const fs = require('fs');
const rateLimit = require('./middleware/rate-limit');

function buildRouter(config, storage, db) {
  const router = express.Router();

  router.use(express.json());
  router.use(rateLimit);

  // Endpoint stubs (replaced in Step 3)
  router.post('/register/options', async (req, res) => res.status(501).json({ error: 'Not implemented' }));
  router.post('/register/verify', async (req, res) => res.status(501).json({ error: 'Not implemented' }));
  router.post('/auth/options', async (req, res) => res.status(501).json({ error: 'Not implemented' }));
  router.post('/auth/verify', async (req, res) => res.status(501).json({ error: 'Not implemented' }));

  // Credential management endpoints
  router.get('/credentials/:userId', async (req, res) => res.status(501).json({ error: 'Not implemented' }));
  router.delete('/credentials/:credentialId', async (req, res) => res.status(501).json({ error: 'Not implemented' }));

  // Serve client SDK
  router.get('/sdk.js', (req, res) => {
    const sdkPath = path.join(__dirname, 'sdk', 'knock-sdk.js');
    res.setHeader('Content-Type', 'application/javascript');
    res.send(fs.readFileSync(sdkPath, 'utf8'));
  });

  return router;
}

module.exports = { buildRouter };
