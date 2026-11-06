require("dotenv").config();

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const helmet = require("helmet");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const SESSION_SECRET = process.env.SESSION_SECRET;
const KICK_CLIENT_ID = process.env.KICK_CLIENT_ID;
const KICK_CLIENT_SECRET = process.env.KICK_CLIENT_SECRET;
const KICK_REDIRECT_URI = process.env.KICK_REDIRECT_URI;
const SESSION_DB_PATH = process.env.SESSION_DB_PATH || path.join(__dirname, "data", "sessions.sqlite");

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error("SESSION_SECRET must be set and contain at least 32 characters.");
  process.exit(1);
}

const dbDirectory = path.dirname(path.resolve(SESSION_DB_PATH));
fs.mkdirSync(dbDirectory, { recursive: true });

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: "20kb" }));
app.use(session({
  name: "elsisyy.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore({
    db: path.basename(SESSION_DB_PATH),
    dir: dbDirectory,
    table: "sessions"
  }),
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PRODUCTION,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, "public"), {
  etag: true,
  maxAge: IS_PRODUCTION ? "1h" : 0
}));

function oauthConfigured() {
  return Boolean(KICK_CLIENT_ID && KICK_CLIENT_SECRET && KICK_REDIRECT_URI);
}

function randomBase64Url(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function sha256Base64Url(value) {
  return crypto.createHash("sha256").update(value).digest("base64url");
}

function safeProfile(user) {
  if (!user || typeof user !== "object") return null;
  return {
    id: String(user.user_id || user.id || ""),
    username: String(user.name || user.username || "Kick user"),
    profilePicture: typeof user.profile_picture === "string" ? user.profile_picture : "",
    isVerified: Boolean(user.is_verified)
  };
}

async function kickRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) {
    const error = new Error(body.message || body.error || "Kick API request failed");
    error.status = response.status;
    throw error;
  }
  return body;
}

async function refreshKickToken(req) {
  const auth = req.session.kick;
  if (!auth || !auth.refreshToken || !oauthConfigured()) return false;
  if (auth.expiresAt && Date.now() < auth.expiresAt - 60000) return true;

  const form = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: KICK_CLIENT_ID,
    client_secret: KICK_CLIENT_SECRET,
    refresh_token: auth.refreshToken
  });

  try {
    const refreshed = await kickRequest("https://id.kick.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form
    });
    req.session.kick = {
      ...auth,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || auth.refreshToken,
      expiresAt: Date.now() + Number(refreshed.expires_in || 3600) * 1000,
      scope: refreshed.scope || auth.scope
    };
    return true;
  } catch (error) {
    console.error("Kick token refresh failed:", error.message);
    return false;
  }
}

async function getKickProfile(req) {
  if (!await refreshKickToken(req)) return null;
  const result = await kickRequest("https://api.kick.com/public/v1/users", {
    headers: { Authorization: `Bearer ${req.session.kick.accessToken}` }
  });
  const raw = Array.isArray(result.data) ? result.data[0] : result.data;
  return safeProfile(raw);
}

function requireSameOrigin(req, res, next) {
  const origin = req.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== req.get("host")) {
        return res.status(403).json({ error: "Request origin was not accepted." });
      }
    } catch {
      return res.status(403).json({ error: "Invalid request origin." });
    }
  }
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "Elsisyy Clip Manager",
    kickOAuthConfigured: oauthConfigured(),
    clipManagement: "not_available_in_documented_public_api"
  });
});

app.get("/api/me", async (req, res) => {
  if (!req.session.kick) return res.json({ connected: false, oauthConfigured: oauthConfigured() });
  try {
    const profile = await getKickProfile(req);
    if (!profile) {
      req.session.kick = null;
      return res.json({ connected: false, oauthConfigured: oauthConfigured(), reconnectRequired: true });
    }
    req.session.kick.profile = profile;
    return res.json({
      connected: true,
      oauthConfigured: oauthConfigured(),
      profile,
      scopes: req.session.kick.scope || ""
    });
  } catch (error) {
    console.error("Unable to load Kick profile:", error.message);
    return res.status(502).json({ error: "Connected to Kick, but profile information could not be loaded." });
  }
});

app.get("/auth/kick", (req, res) => {
  if (!oauthConfigured()) {
    return res.redirect("/?notice=oauth_not_configured");
  }

  const state = randomBase64Url(32);
  const verifier = randomBase64Url(48);
  const challenge = sha256Base64Url(verifier);
  req.session.oauthState = state;
  req.session.codeVerifier = verifier;

  const authorize = new URL("https://id.kick.com/oauth/authorize");
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: KICK_CLIENT_ID,
    redirect_uri: KICK_REDIRECT_URI,
    scope: "user:read channel:read",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  }).toString();

  req.session.save((error) => {
    if (error) return res.status(500).send("Could not start Kick authorization.");
    res.redirect(authorize.toString());
  });
});

app.get("/auth/kick/callback", async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect("/?notice=kick_denied");
  if (typeof code !== "string" || typeof state !== "string" ||
      !req.session.oauthState || state !== req.session.oauthState ||
      !req.session.codeVerifier) {
    return res.status(400).send("Invalid or expired Kick authorization state. Please connect again.");
  }

  const verifier = req.session.codeVerifier;
  delete req.session.oauthState;
  delete req.session.codeVerifier;

  try {
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: KICK_CLIENT_ID,
      client_secret: KICK_CLIENT_SECRET,
      redirect_uri: KICK_REDIRECT_URI,
      code_verifier: verifier,
      code
    });

    const token = await kickRequest("https://id.kick.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form
    });

    if (!token.access_token) throw new Error("Kick did not return an access token.");

    req.session.kick = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || "",
      expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
      scope: token.scope || ""
    };

    const profile = await getKickProfile(req);
    if (!profile) throw new Error("Kick authorization succeeded, but no user profile was returned.");
    req.session.kick.profile = profile;

    req.session.save((saveError) => {
      if (saveError) return res.status(500).send("Could not save the connected session.");
      res.redirect("/?connected=1");
    });
  } catch (callbackError) {
    console.error("Kick OAuth callback failed:", callbackError.message);
    req.session.kick = null;
    res.redirect("/?notice=kick_connection_failed");
  }
});

app.post("/auth/logout", requireSameOrigin, async (req, res) => {
  const auth = req.session.kick;
  if (auth && oauthConfigured()) {
    for (const [token, hint] of [[auth.accessToken, "access_token"], [auth.refreshToken, "refresh_token"]]) {
      if (!token) continue;
      try {
        const revokeUrl = new URL("https://id.kick.com/oauth/revoke");
        revokeUrl.search = new URLSearchParams({ token, token_hint_type: hint }).toString();
        await kickRequest(revokeUrl.toString(), { method: "POST" });
      } catch (error) {
        console.warn("Kick token revocation did not complete:", error.message);
      }
    }
  }

  req.session.destroy(() => {
    res.clearCookie("elsisyy.sid", { httpOnly: true, sameSite: "lax", secure: IS_PRODUCTION });
    res.json({ ok: true });
  });
});

app.get("/api/clips", (_req, res) => {
  res.status(501).json({
    error: "Kick's documented public API does not currently expose a Clips listing endpoint for this integration.",
    supported: false,
    source: "https://api.kick.com/swagger/index.html"
  });
});

app.delete("/api/clips/:clipId", (_req, res) => {
  res.status(501).json({
    error: "Clip deletion is not enabled because a documented, authorized Kick Clips deletion endpoint has not been verified.",
    supported: false
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Elsisyy Clip Manager listening on port ${PORT}`);
});
