module.exports = function createCredentialsListHandler(config, storage, db) {
  return async (req, res) => {
    const { userId } = req.params;
    const authHeader = req.headers.authorization;

    // In a real app, verify the session token here
    // For now, just check that authHeader exists (app-specific auth)
    if (!authHeader) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    try {
      const credentials = await storage.listCredentials(db, userId);
      return res.status(200).json(credentials);
    } catch (err) {
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
};
