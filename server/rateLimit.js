const fs   = require('fs');
const path = require('path');

const FILE     = path.join(__dirname, '../files/rate-limit-stats.json');
const MAX_ROWS = 200;

function blank() {
  return {
    summary: {
      totalCalls: 0,
      total429s:  0,
      lastCallAt: null,
      last429At:  null,
      endpoints:  {},
    },
    recentCalls: [],
  };
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return blank();
  }
}

function hdr(headers, name) {
  return typeof headers.get === 'function'
    ? headers.get(name)
    : (headers[name] ?? headers[name.toLowerCase()] ?? null);
}

function num(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function record(endpoint, status, headers) {
  const entry = {
    ts:         new Date().toISOString(),
    endpoint,
    status,
    limit:      num(hdr(headers, 'x-ratelimit-limit')),
    remaining:  num(hdr(headers, 'x-ratelimit-remaining')),
    reset:      num(hdr(headers, 'x-ratelimit-reset')),
    retryAfter: status === 429 ? num(hdr(headers, 'retry-after')) : null,
  };

  const data = load();

  data.recentCalls.push(entry);
  if (data.recentCalls.length > MAX_ROWS) {
    data.recentCalls = data.recentCalls.slice(-MAX_ROWS);
  }

  data.summary.totalCalls++;
  data.summary.lastCallAt = entry.ts;
  if (status === 429) {
    data.summary.total429s++;
    data.summary.last429At = entry.ts;
  }

  const ep = data.summary.endpoints;
  if (!ep[endpoint]) {
    ep[endpoint] = { calls: 0, errors: 0, lastRemaining: null, limit: null, lastCalledAt: null };
  }
  ep[endpoint].calls++;
  ep[endpoint].lastCalledAt = entry.ts;
  if (status >= 400) ep[endpoint].errors++;
  if (entry.remaining !== null) ep[endpoint].lastRemaining = entry.remaining;
  if (entry.limit     !== null) ep[endpoint].limit         = entry.limit;

  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[rateLimit] write failed:', e.message);
  }
}

function getStats()  { return load(); }

function clearStats() {
  const data = blank();
  try { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); } catch (e) {
    console.error('[rateLimit] clear failed:', e.message);
  }
  return data;
}

module.exports = { record, getStats, clearStats };
