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
3. Set the redirect URI to `http://localhost:3000/auth/callback` (update this after the step below)
4. Copy the **Client ID** and **Client Secret** into your `.env`

## Using a public redirect URI (required for Whoop OAuth)

Whoop's OAuth flow must redirect to a publicly reachable URL — `localhost` only works if you expose it. The easiest way when running inside VS Code is to use the built-in **Ports** tab:

1. Start the server (`npm start`).
2. Open the **Ports** tab in VS Code (bottom panel → **Ports**, or **View → Open View → Ports**).
3. Find port **3000** in the list. If it isn't there, click **Forward a Port** and enter `3000`.
4. Right-click the forwarded port entry and select **Port Visibility → Public**.
5. Hover over the **Forwarded Address** column to reveal the full URL (e.g. `https://abc123-3000.app.github.dev`). Click the copy icon.
6. Open your `.env` file and set:

   ```env
   WHOOP_REDIRECT_URI=https://abc123-3000.app.github.dev/auth/callback
   ```

   Replace the example hostname with the URL you copied.
7. Go back to <https://developer.whoop.com>, open your application, and update the **Redirect URI** field to the same URL (`https://abc123-3000.app.github.dev/auth/callback`). Save the application.
8. Restart the server.

> **Note:** The forwarded URL changes every time you reopen the workspace. Repeat steps 4–8 whenever the URL changes.

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
| `GET /activity/sleep`     | Most recent sleep record       |
| `GET /activity/workout`  | Last 5 workouts                |

## Known limitations

- **No sandbox** — Whoop does not provide a sandbox environment; all data comes from a real Whoop account.
- **Subscription required** — The Whoop API requires an active Whoop membership.
- **Data is not real-time** — Metrics are fetched on page load; refresh the page to see updated data.
- **Session storage** — Tokens are stored in the in-process session; restarting the server logs you out.
- **Token persistence** — For production use, replace the default in-memory session store with a persistent store (e.g. `connect-redis`).
