const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { Knock } = require('../src/index');

const PORT = process.env.PORT || 3000;

const knock = new Knock({
  rpId:   process.env.KNOCK_RP_ID   || 'localhost',
  rpName: process.env.KNOCK_RP_NAME || 'Knock Demo',
  origin: process.env.KNOCK_ORIGIN  || `http://localhost:${PORT}`,
  dbPath: process.env.KNOCK_DB_PATH || './knock-demo.db',
});

const app = express();
app.use(express.json());

// In-memory session store: sessionId → userId
const sessions = new Map();

// Mount Knock auth router
app.use('/auth', knock.router());

// Mount credential management under /credentials so dashboard can call it
// (Knock's router already has /credentials/:userId and /credentials/:credentialId
//  but they're under /auth — we re-use them via the router)

// Session endpoints
app.post('/session/create', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, userId);
  return res.json({ sessionId });
});

app.get('/session/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const sessionId = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;
  const userId = sessionId && sessions.get(sessionId);
  if (!userId) return res.status(401).json({ error: 'NO_SESSION' });
  return res.json({ userId });
});

// Dashboard route — check cookie, redirect if no session
app.get('/dashboard', (req, res) => {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(/knock_session=([^;]+)/);
  const sessionId = match ? match[1] : null;
  const userId = sessionId && sessions.get(sessionId);
  if (!userId) return res.redirect('/login.html');
  return res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Root redirect
app.get('/', (req, res) => res.redirect('/dev.html'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Knock demo running at http://localhost:${PORT}`);
});
