const fetch = require('node-fetch');

const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const API_BASE = 'https://api.prod.whoop.com/developer/v1';

async function exchangeCode(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: process.env.WHOOP_CLIENT_ID,
    client_secret: process.env.WHOOP_CLIENT_SECRET,
    redirect_uri: process.env.WHOOP_REDIRECT_URI,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.WHOOP_CLIENT_ID,
    client_secret: process.env.WHOOP_CLIENT_SECRET,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  return res.json();
}

async function whoopGet(path, token, session, retried = false) {
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 && !retried) {
    const tokens = await refreshAccessToken(session.refresh_token);
    session.access_token = tokens.access_token;
    if (tokens.refresh_token) session.refresh_token = tokens.refresh_token;
    return whoopGet(path, tokens.access_token, session, true);
  }

  if (res.status === 429 && !retried) {
    await new Promise((r) => setTimeout(r, 1000));
    return whoopGet(path, token, session, true);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whoop API error ${res.status}: ${text}`);
  }

  return res.json();
}

module.exports = { exchangeCode, refreshAccessToken, whoopGet };
