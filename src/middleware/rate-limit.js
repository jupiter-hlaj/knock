const ipLimits = new Map();
const userIdLimits = new Map();

const LIMITS = {
  globalPerIp: 100,
  authOptionsPerUser: 10,
  registerOptionsPerUser: 5,
  authVerifyFailPerIp: 20,
};

const WINDOW = 60 * 1000;

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of ipLimits.entries()) {
    if (val.resetAt < now) ipLimits.delete(key);
  }
  for (const [key, val] of userIdLimits.entries()) {
    if (val.resetAt < now) userIdLimits.delete(key);
  }
}, 5 * 60 * 1000).unref();

const rateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userId = req.body?.userId;
  const path = req.path;
  const now = Date.now();

  // Check per-IP global limit
  if (!ipLimits.has(ip)) ipLimits.set(ip, { count: 0, resetAt: now + WINDOW });
  const ipTracker = ipLimits.get(ip);
  if (ipTracker.resetAt < now) {
    ipTracker.count = 0;
    ipTracker.resetAt = now + WINDOW;
  }
  ipTracker.count++;
  if (ipTracker.count > LIMITS.globalPerIp) {
    return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', retryAfter: Math.ceil((ipTracker.resetAt - now) / 1000) });
  }

  // Check per-userId endpoint limits
  if (userId) {
    if (!userIdLimits.has(userId)) userIdLimits.set(userId, { resetAt: now + WINDOW });
    const userTracker = userIdLimits.get(userId);

    if (userTracker.resetAt < now) {
      userTracker.resetAt = now + WINDOW;
      delete userTracker['/auth/options'];
      delete userTracker['/register/options'];
    }

    if (path === '/auth/options') {
      userTracker['/auth/options'] = (userTracker['/auth/options'] || 0) + 1;
      if (userTracker['/auth/options'] > LIMITS.authOptionsPerUser) {
        return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', retryAfter: Math.ceil((userTracker.resetAt - now) / 1000) });
      }
    } else if (path === '/register/options') {
      userTracker['/register/options'] = (userTracker['/register/options'] || 0) + 1;
      if (userTracker['/register/options'] > LIMITS.registerOptionsPerUser) {
        return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', retryAfter: Math.ceil((userTracker.resetAt - now) / 1000) });
      }
    }
  }

  next();
};

module.exports = rateLimit;
