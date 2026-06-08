require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const path = require('path');
const { exchangeCode, whoopGet } = require('./whoop');
const { renderErrorPage, renderGallery } = require('./errorPage');
const { getStats, clearStats } = require('./rateLimit');

const app = express();
const PORT = process.env.PORT || 3000;

const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const SCOPES = 'read:recovery read:cycles read:sleep read:workout read:body_measurement read:profile offline';

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false },
}));

app.use((req, res, next) => {
  console.log(`[req] ${req.method} ${req.path}`);
  next();
});

app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/privacy.html'));
});

// ── Auth routes ──────────────────────────────────────────────────────────────

app.get('/auth/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID,
    redirect_uri: process.env.WHOOP_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    state,
  });
  res.redirect(`${WHOOP_AUTH_URL}?${params}`);
});

app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.status(400).send(renderErrorPage(400, 'OAuth authorisation was denied or the request was invalid.'));
  }
  try {
    const tokens = await exchangeCode(code);
    req.session.access_token = tokens.access_token;
    req.session.refresh_token = tokens.refresh_token;
    res.redirect('/');
  } catch (err) {
    console.error('[auth/callback]', err.message);
    res.status(502).send(renderErrorPage(502, err.message));
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ── Auth guard ────────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  if (!req.session.access_token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// ── API proxy routes (v2) ─────────────────────────────────────────────────────

app.get('/api/profile', requireAuth, async (req, res) => {
  try {
    const data = await whoopGet('v2/user/profile/basic', req.session.access_token, req.session);
    console.log('[GET /api/profile] ok');
    res.json(data);
  } catch (err) {
    console.error('[GET /api/profile]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// Body measurements — height, weight, max heart rate
app.get('/api/body', requireAuth, async (req, res) => {
  try {
    const data = await whoopGet('v2/user/measurement/body', req.session.access_token, req.session);
    console.log('[GET /api/body] ok');
    res.json(data);
  } catch (err) {
    console.error('[GET /api/body]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// 25 records — overview charts + recovery history tab
app.get('/api/recovery', requireAuth, async (req, res) => {
  try {
    const data = await whoopGet('v2/recovery?limit=25', req.session.access_token, req.session);
    console.log('[GET /api/recovery] records:', data?.records?.length ?? 0);
    res.json(data);
  } catch (err) {
    console.error('[GET /api/recovery]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// 25 sleep sessions — overview (latest = records[0]), history tab, sleep performance chart
app.get('/api/sleep-history', requireAuth, async (req, res) => {
  try {
    const data = await whoopGet('v2/activity/sleep?limit=25', req.session.access_token, req.session);
    console.log('[GET /api/sleep-history] records:', data?.records?.length ?? 0);
    res.json(data);
  } catch (err) {
    console.error('[GET /api/sleep-history]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// Current day cycle — strain + calories
app.get('/api/cycle', requireAuth, async (req, res) => {
  try {
    const data = await whoopGet('v2/cycle?limit=1', req.session.access_token, req.session);
    console.log('[GET /api/cycle] records:', data?.records?.length ?? 0);
    res.json(data);
  } catch (err) {
    console.error('[GET /api/cycle]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// Last 5 workouts
app.get('/api/workouts', requireAuth, async (req, res) => {
  try {
    const data = await whoopGet('v2/activity/workout?limit=5', req.session.access_token, req.session);
    console.log('[GET /api/workouts] records:', data?.records?.length ?? 0);
    res.json(data);
  } catch (err) {
    console.error('[GET /api/workouts]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Admin (no auth) ───────────────────────────────────────────────────────────

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('/api/admin/stats', (req, res) => {
  res.json(getStats());
});

app.post('/api/admin/clear', (req, res) => {
  res.json(clearStats());
});

// ── Status page gallery & preview ────────────────────────────────────────────

app.get('/status', (req, res) => {
  res.send(renderGallery());
});

app.get('/status/:code', (req, res) => {
  const code = parseInt(req.params.code, 10);
  if (isNaN(code) || code < 100 || code > 599) {
    return res.status(400).send(renderErrorPage(400, 'Status code must be a number between 100 and 599.'));
  }
  res.status(code).send(renderErrorPage(code));
});

// ── 404 catch-all ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  console.warn('[404]', req.method, req.path);
  res.status(404).send(renderErrorPage(404));
});

// ── Global error handler ──────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[500]', err.message);
  const code = err.status || err.statusCode || 500;
  res.status(code).send(renderErrorPage(code, err.message));
});

app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
  console.log('[server] v2 routes: /api/profile  /api/body  /api/recovery  /api/sleep-history  /api/cycle  /api/workouts');
});
