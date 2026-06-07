'use strict';

// ── Status code metadata ──────────────────────────────────────────────────────

const STATUS = {
  // 3xx — Redirects
  300: { title: 'Multiple Choices',      category: '3xx Redirect',     desc: 'The request has more than one possible response. The browser or agent should choose one.' },
  301: { title: 'Moved Permanently',     category: '3xx Redirect',     desc: 'This resource has been permanently moved to a new URL. Update your bookmarks.' },
  302: { title: 'Found',                 category: '3xx Redirect',     desc: 'This resource is temporarily located at a different URL. The original URL remains valid.' },
  303: { title: 'See Other',             category: '3xx Redirect',     desc: 'The response to the request can be found at a different URI using a GET method.' },
  304: { title: 'Not Modified',          category: '3xx Redirect',     desc: 'The resource has not changed since your last request. Your cached version is current.' },
  307: { title: 'Temporary Redirect',    category: '3xx Redirect',     desc: 'The resource is temporarily at a different URL. The method and body are preserved on redirect.' },
  308: { title: 'Permanent Redirect',    category: '3xx Redirect',     desc: 'The resource has permanently moved. The method and body are preserved on all future requests.' },

  // 4xx — Client errors
  400: { title: 'Bad Request',           category: '4xx Client Error', desc: 'The server couldn\'t understand the request due to invalid syntax or missing parameters.' },
  401: { title: 'Unauthorized',          category: '4xx Client Error', desc: 'Authentication is required. Connect your WHOOP account to access this resource.' },
  403: { title: 'Forbidden',             category: '4xx Client Error', desc: 'You don\'t have permission to access this resource, even with valid authentication.' },
  404: { title: 'Not Found',             category: '4xx Client Error', desc: 'The page or resource you\'re looking for doesn\'t exist or has been removed.' },
  405: { title: 'Method Not Allowed',    category: '4xx Client Error', desc: 'The HTTP method used is not supported for this endpoint.' },
  408: { title: 'Request Timeout',       category: '4xx Client Error', desc: 'The server timed out waiting for the request to complete. Please try again.' },
  409: { title: 'Conflict',              category: '4xx Client Error', desc: 'The request conflicts with the current state of the server.' },
  410: { title: 'Gone',                  category: '4xx Client Error', desc: 'This resource has been permanently deleted and will not be available again.' },
  422: { title: 'Unprocessable Entity',  category: '4xx Client Error', desc: 'The request was well-formed but couldn\'t be processed due to semantic errors.' },
  429: { title: 'Too Many Requests',     category: '4xx Client Error', desc: 'You\'ve hit the rate limit. Please wait a moment before trying again.' },

  // 5xx — Server errors
  500: { title: 'Internal Server Error', category: '5xx Server Error', desc: 'Something went wrong on our end. This is not your fault — please try again in a moment.' },
  501: { title: 'Not Implemented',       category: '5xx Server Error', desc: 'The server does not support the functionality required to fulfill this request.' },
  502: { title: 'Bad Gateway',           category: '5xx Server Error', desc: 'The server received an invalid response from an upstream service (WHOOP API).' },
  503: { title: 'Service Unavailable',   category: '5xx Server Error', desc: 'The server is temporarily unable to handle requests. Please try again in a few minutes.' },
  504: { title: 'Gateway Timeout',       category: '5xx Server Error', desc: 'The upstream service (WHOOP API) didn\'t respond in time. Please try again.' },
};

function categoryColor(code) {
  if (code < 400) return '#6b7280';
  if (code < 500) return '#f59e0b';
  return '#ef4444';
}

function categoryAccent(code) {
  if (code < 400) return '#6b728022';
  if (code < 500) return '#f59e0b22';
  return '#ef444422';
}

// ── Error page HTML ───────────────────────────────────────────────────────────

function renderErrorPage(code, customMessage) {
  const meta    = STATUS[code] || { title: 'Error', category: 'HTTP Error', desc: 'An unexpected error occurred.' };
  const color   = categoryColor(code);
  const bg      = categoryAccent(code);
  const message = customMessage || meta.desc;
  const btnLabel = code === 401 ? 'Connect WHOOP' : code >= 500 ? 'Try Again' : 'Go to Dashboard';
  const btnHref  = code === 401 ? '/auth/login' : '/';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${code} ${meta.title} — Whoop Dashboard</title>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0b0f; --bg-card: #13151d; --border: #1f2233;
      --text: #f0f2f8; --muted: #6b7280; --accent: #00e5c0;
      --status: ${color}; --status-bg: ${bg};
      --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    body {
      background: var(--bg); color: var(--text); font-family: var(--font);
      min-height: 100vh; display: flex; flex-direction: column;
      -webkit-font-smoothing: antialiased;
    }
    nav {
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem; display: flex; align-items: center; gap: 1rem;
    }
    nav img { border-radius: 6px; }
    nav a { color: var(--muted); text-decoration: none; font-size: 0.9rem; transition: color .15s; }
    nav a:hover { color: var(--accent); }
    main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 3rem 2rem; }
    .card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 20px; padding: 3.5rem 3rem;
      max-width: 520px; width: 100%; text-align: center;
    }
    .code {
      font-size: clamp(5rem, 18vw, 8rem); font-weight: 800;
      letter-spacing: -0.04em; line-height: 1;
      color: var(--status); margin-bottom: 0.5rem;
    }
    .badge {
      display: inline-block; background: var(--status-bg); color: var(--status);
      border: 1px solid color-mix(in srgb, var(--status) 35%, transparent);
      border-radius: 6px; font-size: 0.7rem; font-weight: 600;
      letter-spacing: 0.1em; text-transform: uppercase;
      padding: 0.2rem 0.65rem; margin-bottom: 1.5rem;
    }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.75rem; letter-spacing: -0.01em; }
    p { color: #9ca3b0; font-size: 0.95rem; line-height: 1.65; margin-bottom: 2rem; }
    .btn {
      display: inline-block; background: var(--accent); color: #000;
      font-weight: 700; font-size: 0.9rem; padding: 0.7rem 1.75rem;
      border-radius: 8px; text-decoration: none; letter-spacing: 0.02em;
      transition: opacity .15s;
    }
    .btn:hover { opacity: 0.85; }
    footer {
      border-top: 1px solid var(--border); padding: 1rem 2rem;
      font-size: 0.75rem; color: var(--muted);
      display: flex; justify-content: space-between; flex-wrap: wrap; gap: .5rem;
    }
    footer a { color: var(--muted); text-decoration: none; }
    footer a:hover { color: var(--accent); }
  </style>
</head>
<body>
  <nav>
    <a href="/"><img src="/logo.png" alt="WHOOP Dashboard" width="28" height="28" /></a>
    <a href="/">← Back to Dashboard</a>
  </nav>

  <main>
    <div class="card">
      <div class="code">${code}</div>
      <div class="badge">${meta.category}</div>
      <h1>${meta.title}</h1>
      <p>${message}</p>
      <a href="${btnHref}" class="btn">${btnLabel}</a>
    </div>
  </main>

  <footer>
    <span>WHOOP Dashboard</span>
    <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>
  </footer>
</body>
</html>`;
}

// ── Gallery page (preview all status codes) ───────────────────────────────────

function renderGallery() {
  const groups = [
    { label: '3xx — Redirects',     codes: [300, 301, 302, 303, 304, 307, 308] },
    { label: '4xx — Client Errors', codes: [400, 401, 403, 404, 405, 408, 409, 410, 422, 429] },
    { label: '5xx — Server Errors', codes: [500, 501, 502, 503, 504] },
  ];

  const sections = groups.map(({ label, codes }) => {
    const tiles = codes.map(code => {
      const meta  = STATUS[code];
      const color = categoryColor(code);
      return `<a href="/status/${code}" class="tile">
        <span class="tile-code" style="color:${color}">${code}</span>
        <span class="tile-title">${meta.title}</span>
      </a>`;
    }).join('');
    return `<section><h2>${label}</h2><div class="grid">${tiles}</div></section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HTTP Status Pages — Whoop Dashboard</title>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0b0f; --bg-card: #13151d; --border: #1f2233;
      --text: #f0f2f8; --muted: #6b7280; --accent: #00e5c0;
      --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    body { background: var(--bg); color: var(--text); font-family: var(--font); min-height: 100vh; -webkit-font-smoothing: antialiased; }
    nav { border-bottom: 1px solid var(--border); padding: 1rem 2rem; display: flex; align-items: center; gap: 1rem; }
    nav img { border-radius: 6px; }
    nav a { color: var(--muted); text-decoration: none; font-size: 0.9rem; transition: color .15s; }
    nav a:hover { color: var(--accent); }
    .page { max-width: 860px; margin: 0 auto; padding: 3.5rem 2rem 5rem; }
    .page-header { margin-bottom: 3rem; }
    .page-header h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); font-weight: 700; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
    .page-header p { color: var(--muted); font-size: 0.95rem; }
    section { margin-bottom: 2.5rem; }
    h2 {
      font-size: 0.75rem; font-weight: 600; letter-spacing: 0.09em;
      text-transform: uppercase; color: var(--muted);
      margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; }
    .tile {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 12px; padding: 1.1rem 1rem; text-decoration: none;
      display: flex; flex-direction: column; gap: 0.3rem;
      transition: border-color .15s, transform .15s;
    }
    .tile:hover { border-color: var(--accent); transform: translateY(-2px); }
    .tile-code { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1; }
    .tile-title { font-size: 0.78rem; color: var(--muted); line-height: 1.3; }
    footer {
      border-top: 1px solid var(--border); padding: 1rem 2rem;
      font-size: 0.75rem; color: var(--muted);
      display: flex; justify-content: space-between; flex-wrap: wrap; gap: .5rem;
    }
    footer a { color: var(--muted); text-decoration: none; }
    footer a:hover { color: var(--accent); }
  </style>
</head>
<body>
  <nav>
    <a href="/"><img src="/logo.png" alt="WHOOP Dashboard" width="28" height="28" /></a>
    <a href="/">← Back to Dashboard</a>
  </nav>
  <div class="page">
    <div class="page-header">
      <h1>HTTP Status Pages</h1>
      <p>Click any code to preview its error page.</p>
    </div>
    ${sections}
  </div>
  <footer>
    <span>WHOOP Dashboard</span>
    <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>
  </footer>
</body>
</html>`;
}

module.exports = { renderErrorPage, renderGallery, STATUS };
