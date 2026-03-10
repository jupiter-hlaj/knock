const { verifyAuthentication } = require('../webauthn');

// All auth outcomes return HTTP 200. Never 401 or 403. (Rule 5, Pitfall 2)
module.exports = function createAuthVerifyHandler(config, storage, db) {
  return async (req, res) => {
    const { challengeId, userId, credential } = req.body || {};
    // Even missing fields → 200 with verified: false
    if (!challengeId || !userId || !credential) {
      return res.status(200).json({ verified: false, error: 'INVALID_REQUEST' });
    }
    try {
      const result = await verifyAuthentication(config, storage, db, { challengeId, userId, credential });
      return res.status(200).json(result);
    } catch (err) {
      if (err.name === 'KnockError') {
        // All KnockErrors → 200 with verified: false
        return res.status(200).json({ verified: false, error: err.code });
      }
      // Only genuine internal errors get 500
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
};
