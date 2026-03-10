const express = require('express');
const path = require('path');
const fs = require('fs');
const rateLimit = require('./middleware/rate-limit');

const registerOptionsHandler = require('./endpoints/register-options');
const registerVerifyHandler = require('./endpoints/register-verify');
const authOptionsHandler = require('./endpoints/auth-options');
const authVerifyHandler = require('./endpoints/auth-verify');
const credentialsListHandler = require('./endpoints/credentials-list');
const credentialsRevokeHandler = require('./endpoints/credentials-revoke');

function buildRouter(config, storage, db) {
  const router = express.Router();

  router.use(express.json());
  router.use(rateLimit);

  router.post('/register/options', registerOptionsHandler(config, storage, db));
  router.post('/register/verify', registerVerifyHandler(config, storage, db));
  router.post('/auth/options', authOptionsHandler(config, storage, db));
  router.post('/auth/verify', authVerifyHandler(config, storage, db));
  router.get('/credentials/:userId', credentialsListHandler(config, storage, db));
  router.delete('/credentials/:credentialId', credentialsRevokeHandler(config, storage, db));

  // Serve client SDK
  router.get('/sdk.js', (req, res) => {
    const sdkPath = path.join(__dirname, 'sdk', 'knock-sdk.js');
    res.setHeader('Content-Type', 'application/javascript');
    res.send(fs.readFileSync(sdkPath, 'utf8'));
  });

  return router;
}

module.exports = { buildRouter };
