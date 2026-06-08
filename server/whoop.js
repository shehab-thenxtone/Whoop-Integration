const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const API_BASE  = 'https://api.prod.whoop.com/developer';
const { record: recordRateLimit } = require('./rateLimit');

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
    console.error('[WHOOP] Token exchange failed — status:', res.status, '— body:', text);
    throw new Error(`Token exchange failed: ${res.status} — ${text}`);
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
    console.error('[WHOOP] Token refresh failed — status:', res.status, '— body:', text);
    throw new Error(`Token refresh failed: ${res.status} — ${text}`);
  }

  return res.json();
}

async function whoopGet(path, token, session) {
  const MAX_RETRIES = 3;
  let currentToken = token;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const url = `${API_BASE}/${path}`;
    console.log(`[WHOOP] → ${url}`);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${currentToken}` },
    });

    try { recordRateLimit(path, res.status, res.headers); } catch (_) {}

    if (res.status === 401 && attempt === 0) {
      const tokens = await refreshAccessToken(session.refresh_token);
      currentToken = tokens.access_token;
      session.access_token = tokens.access_token;
      if (tokens.refresh_token) session.refresh_token = tokens.refresh_token;
      continue;
    }

    if (res.status === 429) {
      // Consume body to free the socket, then wait with exponential backoff
      await res.text();
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(`[WHOOP] ${path} → HTTP ${res.status} (${res.headers.get('content-type')}):`, text);
      throw new Error(`Whoop API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  throw new Error('Whoop API request failed after retries');
}

module.exports = { exchangeCode, refreshAccessToken, whoopGet };
