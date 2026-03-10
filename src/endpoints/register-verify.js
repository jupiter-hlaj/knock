const { verifyRegistration } = require('../webauthn');

module.exports = function createRegisterVerifyHandler(config, storage, db) {
  return async (req, res) => {
    const { challengeId, userId, credential } = req.body || {};
    if (!challengeId || !userId || !credential || typeof credential !== 'object') {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'challengeId, userId, and credential are required' });
    }
    try {
      const result = await verifyRegistration(config, storage, db, { challengeId, userId, credential });
      return res.status(200).json(result);
    } catch (err) {
      if (err.name === 'KnockError') {
        if (err.code === 'CHALLENGE_EXPIRED' || err.code === 'VERIFICATION_FAILED') {
          return res.status(400).json({ registered: false, error: err.code });
        }
        return res.status(400).json({ error: err.code });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
};
