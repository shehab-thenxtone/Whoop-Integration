# Whoop Integration

A Node.js + Express web app that connects to the Whoop API and displays your health data.

## Prerequisites

- Node.js 18+
- A Whoop developer account with an OAuth app registered at https://developer.whoop.com

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
   node server/index.js
   ```

4. Open http://localhost:3000

## Getting Whoop Client Credentials

1. Go to https://developer.whoop.com
2. Create an application
3. Set the redirect URI to `http://localhost:3000/auth/callback`
4. Copy the Client ID and Client Secret into `.env`

## Known Limitations

- **No sandbox** — Whoop does not provide a sandbox environment; all data is live from a real Whoop account.
- **Subscription required** — The Whoop API requires an active Whoop membership.
- **Data is not real-time** — Data is fetched on page load; refresh the page to see updated metrics.
- **Session storage** — Tokens are stored in the server-side session; restarting the server logs you out.
