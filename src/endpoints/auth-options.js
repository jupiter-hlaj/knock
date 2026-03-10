const { generateAuthenticationOptions } = require('../webauthn');

module.exports = function createAuthOptionsHandler(config, storage, db) {
  return async (req, res) => {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'INVALID_REQUEST' });
    }
    try {
      const result = await generateAuthenticationOptions(config, storage, db, { userId });
      return res.status(200).json(result);
    } catch (err) {
      if (err.name === 'KnockError') {
        if (err.code === 'NO_CREDENTIALS') {
          // 200 — expected state, not an error (Pitfall 3)
          return res.status(200).json({ error: 'NO_CREDENTIALS' });
        }
        return res.status(400).json({ error: err.code });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
};
