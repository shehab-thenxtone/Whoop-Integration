require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { exchangeCode, whoopGet } = require('./whoop');

const app = express();
const PORT = process.env.PORT || 3000;

const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const SCOPES = 'read:recovery read:cycles read:sleep read:workouts read:profile offline';

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false },
}));

app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Auth routes ──────────────────────────────────────────────────────────────

app.get('/auth/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID,
    redirect_uri: process.env.WHOOP_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
  });
  res.redirect(`${WHOOP_AUTH_URL}?${params}`);
});

app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect('/?error=oauth_denied');
  }
  try {
    const tokens = await exchangeCode(code);
    req.session.access_token = tokens.access_token;
    req.session.refresh_token = tokens.refresh_token;
    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.redirect('/?error=token_exchange_failed');
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ── API proxy routes (Phase 3) ───────────────────────────────────────────────

function requireAuth(req, res, next) {
  if (!req.session.access_token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

app.get('/api/profile', requireAuth, async (req, res) => {
  try {
    const data = await whoopGet('user/profile/basic', req.session.access_token, req.session);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/recovery', requireAuth, async (req, res) => {
  try {
    const data = await whoopGet('recovery?limit=7', req.session.access_token, req.session);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/cycle', requireAuth, async (req, res) => {
  try {
    const data = await whoopGet('cycle?limit=1', req.session.access_token, req.session);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/sleep', requireAuth, async (req, res) => {
  try {
    const data = await whoopGet('activity/sleep?limit=1', req.session.access_token, req.session);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/workouts', requireAuth, async (req, res) => {
  try {
    const data = await whoopGet('activity/workout?limit=5', req.session.access_token, req.session);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
