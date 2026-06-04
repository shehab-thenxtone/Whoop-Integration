# Whoop Integration

A Node.js + Express web app that connects to the Whoop API and displays your health data in a real-time dashboard.

## Prerequisites

- Node.js 18+
- A Whoop account with an active membership
- A Whoop developer application registered at https://developer.whoop.com

## Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open http://localhost:3000 and click **Connect Whoop**.

## Environment variables

| Variable              | Description                                     |
|-----------------------|-------------------------------------------------|
| `WHOOP_CLIENT_ID`     | OAuth client ID from developer.whoop.com        |
| `WHOOP_CLIENT_SECRET` | OAuth client secret from developer.whoop.com    |
| `WHOOP_REDIRECT_URI`  | Must match the URI registered in your app       |
| `SESSION_SECRET`      | Any long random string for session encryption   |
| `PORT`                | Server port (default: 3000)                     |

## Getting Whoop client credentials

1. Go to https://developer.whoop.com
2. Sign in and create an application
3. Set the redirect URI to `http://localhost:3000/auth/callback`
4. Copy the **Client ID** and **Client Secret** into your `.env`

## API routes

| Route            | Description                        |
|------------------|------------------------------------|
| `GET /`          | Dashboard (served from `public/`)  |
| `GET /health`    | Health check — returns `{"status":"ok"}` |
| `GET /auth/login`    | Initiates Whoop OAuth flow     |
| `GET /auth/callback` | OAuth redirect callback        |
| `GET /auth/logout`   | Destroys session, redirects to `/` |
| `GET /api/profile`   | Authenticated user profile     |
| `GET /api/recovery`  | Last 7 recovery records        |
| `GET /api/cycle`     | Current day cycle              |
| `GET /api/sleep`     | Most recent sleep record       |
| `GET /api/workouts`  | Last 5 workouts                |

## Known limitations

- **No sandbox** — Whoop does not provide a sandbox environment; all data comes from a real Whoop account.
- **Subscription required** — The Whoop API requires an active Whoop membership.
- **Data is not real-time** — Metrics are fetched on page load; refresh the page to see updated data.
- **Session storage** — Tokens are stored in the in-process session; restarting the server logs you out.
- **Token persistence** — For production use, replace the default in-memory session store with a persistent store (e.g. `connect-redis`).
