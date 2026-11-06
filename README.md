# Elsisyy Clip Manager

A Kick-connected workspace foundation for Elsisyy.

## What is implemented

- Official Kick OAuth authorization-code flow with PKCE (S256).
- Minimal OAuth scopes: `user:read channel:read`.
- Server-side sessions stored in SQLite.
- Kick profile lookup through the documented `GET /public/v1/users` endpoint.
- Access-token refresh and disconnect/revocation handling.
- No sample clip records and no fake delete actions.
- Security headers, HttpOnly/SameSite session cookie, OAuth state validation and same-origin check for disconnect.

## Important Clips API limitation

The current official Kick Public API reference does not list a native Clips listing or deletion endpoint. The app therefore returns an explicit `501` for clip listing/deletion rather than pretending to manage real clips or using undocumented private endpoints.

Do not collect Kick passwords, browser cookies, session tokens, or bypass Kick permissions. Native clip management must only be enabled after a documented and authorized integration is verified.

## Configure Kick OAuth

1. Create an application in the Kick Developer settings: https://dev.kick.com
2. Set its Redirect URL to exactly the value of `KICK_REDIRECT_URI`.
3. Copy the app Client ID and Client Secret into the hosting environment.
4. Set a random `SESSION_SECRET` with at least 32 characters.
5. Set `KICK_REDIRECT_URI` to your deployed callback, for example:
   `https://YOUR-DOMAIN/auth/kick/callback`
6. Deploy and open the app. Click **Connect with Kick**.

The application requests only `user:read` and `channel:read`. It does not request moderation, chat, rewards, stream-key, or email access.

## Railway deployment

Set these variables in the service:

- `NODE_ENV=production`
- `SESSION_SECRET` = a long random secret
- `KICK_CLIENT_ID`
- `KICK_CLIENT_SECRET`
- `KICK_REDIRECT_URI` = exact public callback URL
- `SESSION_DB_PATH=/data/sessions.sqlite`

Attach a Railway persistent volume mounted at `/data` so sessions survive restarts. Without a persistent volume, stored sessions may be lost on redeploy/restart.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Set the Kick app redirect URL to `http://localhost:3000/auth/kick/callback` for local testing.

## API

- `GET /api/health` — service status and capability flag
- `GET /api/me` — current connected Kick account
- `GET /auth/kick` — begin OAuth
- `GET /auth/kick/callback` — OAuth callback
- `POST /auth/logout` — revoke tokens where possible and end the session
- `GET /api/clips` — explicit unsupported response until a documented Clips endpoint is available
- `DELETE /api/clips/:clipId` — explicit unsupported response until a documented deletion endpoint is available

## Official references

- Kick OAuth flow: https://docs.kick.com/getting-started/generating-tokens-oauth2-flow
- Kick scopes: https://docs.kick.com/getting-started/scopes
- Kick Public API: https://api.kick.com/swagger/index.html
