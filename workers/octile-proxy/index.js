/**
 * Octile Score Proxy — Cloudflare Worker
 *
 * Sits between the client and backend to provide:
 *   1. Turnstile verification (proves real browser, not curl/bot)
 *   2. IP-based rate limiting via KV (fast, no DB query)
 *   3. HMAC request signing (backend trusts only Worker-signed requests)
 *   4. Cookie-based player UUID (HttpOnly, Secure — replaces client-side browser_uuid)
 *
 * Environment variables (set via wrangler secret put):
 *   CF_TURNSTILE_SECRET  — Turnstile secret key
 *   WORKER_HMAC_SECRET   — shared secret for HMAC signing
 *   BACKEND_ORIGIN       — backend URL (e.g. https://m.taleon.work.gd)
 *
 * KV namespace binding:
 *   RATE_LIMIT — for IP-based rate limiting
 */

// Endpoints exempt from force-update version gate (minimum viable path)
const VERSION_GATE_WHITELIST = ["/health", "/version", "/auth/magic-link/verify"];

const COOKIE_NAME = "octile_uid";
const COOKIE_MAX_AGE = 10 * 365 * 24 * 3600; // ~10 years

const ALLOWED_ORIGINS = [
  "https://app.octile.eu.cc",
  "https://octileapp.gitlab.io",
  "https://mtaleon.github.io",
  "http://localhost:8080",
  "http://localhost:8371",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8371",
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- Per-request context (no module-level mutable state) ---
    const reqOrigin = request.headers.get("Origin");
    const corsOrigin = (reqOrigin && ALLOWED_ORIGINS.some(o => reqOrigin === o)) ? reqOrigin : "*";
    const existingUUID = getCookieUUID(request);
    const isNewCookie = !existingUUID;
    const cookieUUID = existingUUID || crypto.randomUUID();
    const isAllowedOrigin = corsOrigin !== "*";

    const ctx = { corsOrigin, cookieUUID, isNewCookie, isAllowedOrigin };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse(ctx, new Response(null, { status: 204 }));
    }

    // --- Force update version gate (Layer 2) ---
    // MIN_VERSION_CODE is set via wrangler secret; 0 or absent = disabled
    const minVersion = parseInt(env.MIN_VERSION_CODE || "0", 10);
    if (minVersion > 0) {
      const clientVersion = parseInt(request.headers.get("X-App-Version") || "0", 10);
      const isWhitelisted = VERSION_GATE_WHITELIST.some(p => url.pathname === p || url.pathname.startsWith(p));
      if (clientVersion > 0 && clientVersion < minVersion && !isWhitelisted) {
        return withCookieUUID(ctx, corsResponse(ctx, new Response(JSON.stringify({
          error: "UPDATE_REQUIRED",
          minVersionCode: minVersion,
          forceReason: env.FORCE_REASON || "",
        }), {
          status: 426,
          headers: { "Content-Type": "application/json" },
        })));
      }
    }

    // Route: GET /config/steam — feature flags for Steam client
    if (request.method === "GET" && url.pathname === "/config/steam") {
      return handleSteamConfig(env, ctx);
    }

    // Route: POST /score — submit score (proxied + validated)
    if (request.method === "POST" && url.pathname === "/score") {
      return handleScoreSubmit(request, env, ctx);
    }

    // Route: GET /health — lightweight backend health check
    if (request.method === "GET" && url.pathname === "/health") {
      return handleHealth(env, ctx);
    }

    // Route: GET /puzzle/{n} — proxy individual puzzle
    const puzzleMatch = url.pathname.match(/^\/puzzle\/(\d+)$/);
    if (request.method === "GET" && puzzleMatch) {
      return proxyToBackend(request, env, ctx, url.pathname);
    }

    // Route: GET /levels — level counts
    if (request.method === "GET" && url.pathname === "/levels") {
      return proxyToBackend(request, env, ctx, url.pathname);
    }

    // Route: GET /level/{name}/puzzle/{slot} — level-based puzzle
    const levelMatch = url.pathname.match(/^\/level\/(easy|medium|hard|hell)\/puzzle\/(\d+)$/);
    if (request.method === "GET" && levelMatch) {
      return proxyToBackend(request, env, ctx, url.pathname);
    }

    // Route: GET /scoreboard, GET /puzzles, GET /leaderboard, GET /version — pass through to backend
    if (request.method === "GET" && (url.pathname === "/scoreboard" || url.pathname === "/puzzles" || url.pathname === "/leaderboard" || url.pathname === "/version")) {
      return proxyToBackend(request, env, ctx, url.pathname);
    }

    // Route: GET /player/{uuid}/stats, GET /player/{uuid}/elo — player stats
    const playerMatch = url.pathname.match(/^\/player\/[^/]+\/(stats|elo)$/);
    if (request.method === "GET" && playerMatch) {
      return proxyToBackend(request, env, ctx, url.pathname);
    }

    // Route: /auth/*, /sync/*, /league/* — proxy auth, sync, and league endpoints
    if (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/sync/") || url.pathname.startsWith("/league/")) {
      return proxyAuthToBackend(request, env, ctx, url.pathname);
    }

    // Route: GET /daily-challenge/* — daily challenge puzzle + scoreboard
    if (request.method === "GET" && url.pathname.startsWith("/daily-challenge/")) {
      return proxyToBackend(request, env, ctx, url.pathname);
    }

    // Route: POST /feedback — submit feedback
    if (request.method === "POST" && url.pathname === "/feedback") {
      return proxyAuthToBackend(request, env, ctx, url.pathname);
    }

    return withCookieUUID(ctx, corsResponse(ctx, new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })));
  },
};

// ---------------------------------------------------------------------------
// Steam config — KV-backed feature flags with hardcoded fallback
// ---------------------------------------------------------------------------

const STEAM_CONFIG_KV_KEY = "steam_config_v1";

const DEFAULT_STEAM_FLAGS = {
  config_version: 1,
  demo: false,
  steam: {
    phase: "phase1",
    ttl_seconds: 300,
    features: {
      energy: false,
      diamond_multiplier: false,
      daily_tasks: false,
      league: false,
      inbox: false,
      elo_profile: false,
      rating_leaderboard: false,
      gamepad: true,
    }
  }
};

async function handleSteamConfig(env, ctx) {
  let flags = null;
  if (env.STEAM_CONFIG) {
    try {
      flags = await env.STEAM_CONFIG.get(STEAM_CONFIG_KV_KEY, { type: "json" });
    } catch (_) {
      flags = null;
    }
  }
  if (!flags) flags = DEFAULT_STEAM_FLAGS;
  return withCookieUUID(ctx, corsResponse(ctx, new Response(JSON.stringify(flags), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60"
    }
  })));
}

// ---------------------------------------------------------------------------
// Health check — proxy to backend, return only { status }
// ---------------------------------------------------------------------------

async function handleHealth(env, ctx) {
  try {
    const backendURL = (env.BACKEND_ORIGIN || "https://m.taleon.work.gd") + "/xsw/api/health";
    const resp = await fetch(backendURL, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) {
      return corsResponse(ctx, new Response(JSON.stringify({ status: "error" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }));
    }
    const data = await resp.json();
    return withCookieUUID(ctx, corsResponse(ctx, new Response(JSON.stringify({ status: data.status || "error" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
  } catch {
    return corsResponse(ctx, new Response(JSON.stringify({ status: "error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    }));
  }
}

// ---------------------------------------------------------------------------
// Score submission handler
// ---------------------------------------------------------------------------

async function handleScoreSubmit(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(ctx, 400, "invalid JSON");
  }

  const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

  // --- Layer 1: Turnstile verification ---
  // Verify token when present; skip when absent (Android/iOS WebView can't load Turnstile)
  const token = body.cf_turnstile_token;
  if (token && env.CF_TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(token, env.CF_TURNSTILE_SECRET, clientIP);
    if (!ok) {
      return errorResponse(ctx, 403, "turnstile verification failed");
    }
  }

  // --- Layer 2: IP rate limiting via KV ---
  if (env.RATE_LIMIT) {
    const limited = await checkIPRateLimit(env.RATE_LIMIT, clientIP);
    if (limited) {
      return errorResponse(ctx, 429, "too many requests from this IP");
    }
  }

  // --- Layer 3: HMAC signing ---
  if (!env.WORKER_HMAC_SECRET) {
    return errorResponse(ctx, 500, "server misconfigured");
  }

  // Remove turnstile token from payload (backend doesn't need it)
  delete body.cf_turnstile_token;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = JSON.stringify(body);
  const signature = await hmacSign(payload + timestamp, env.WORKER_HMAC_SECRET);

  // Forward to backend
  const backendURL = (env.BACKEND_ORIGIN || "https://m.taleon.work.gd") + "/octile/score";
  const headers = buildForwardHeaders(request, ctx, { json: true, includeAuth: true });
  headers["X-Worker-Signature"] = signature;
  headers["X-Worker-Timestamp"] = timestamp;

  const backendResp = await fetch(backendURL, {
    method: "POST",
    headers,
    body: payload,
  });

  const respBody = await backendResp.text();
  return withCookieUUID(ctx, corsResponse(ctx, new Response(respBody, {
    status: backendResp.status,
    headers: { "Content-Type": "application/json" },
  })));
}

// ---------------------------------------------------------------------------
// Turnstile verification
// ---------------------------------------------------------------------------

async function verifyTurnstile(token, secret, clientIP) {
  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: secret,
      response: token,
      remoteip: clientIP,
    }),
  });
  const data = await resp.json();
  return data.success === true;
}

// ---------------------------------------------------------------------------
// IP rate limiting via KV
// ---------------------------------------------------------------------------

async function checkIPRateLimit(kv, ip) {
  const key = `rl:${ip}`;
  const record = await kv.get(key);

  if (record) {
    const count = parseInt(record, 10);
    if (count >= 10) {
      // Max 10 submissions per minute per IP
      return true;
    }
    await kv.put(key, (count + 1).toString(), { expirationTtl: 60 });
  } else {
    await kv.put(key, "1", { expirationTtl: 60 });
  }
  return false;
}

// ---------------------------------------------------------------------------
// HMAC signing
// ---------------------------------------------------------------------------

async function hmacSign(message, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// ---------------------------------------------------------------------------
// Proxy GET requests to backend
// ---------------------------------------------------------------------------

async function proxyToBackend(request, env, ctx, pathname) {
  const url = new URL(request.url);
  const backendURL = (env.BACKEND_ORIGIN || "https://m.taleon.work.gd") + "/octile" + pathname + url.search;
  const headers = buildForwardHeaders(request, ctx);
  const resp = await fetch(backendURL, { headers });
  const body = await resp.text();
  const ct = resp.headers.get("Content-Type") || "application/json";
  return withCookieUUID(ctx, corsResponse(ctx, new Response(body, {
    status: resp.status,
    headers: { "Content-Type": ct },
  })));
}

// ---------------------------------------------------------------------------
// Proxy auth requests to backend (POST/DELETE body + Authorization header)
// ---------------------------------------------------------------------------

async function proxyAuthToBackend(request, env, ctx, pathname) {
  const url = new URL(request.url);
  const backendURL = (env.BACKEND_ORIGIN || "https://m.taleon.work.gd") + "/octile" + pathname + url.search;
  const headers = buildForwardHeaders(request, ctx, { json: true, includeAuth: true });

  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  const resp = await fetch(backendURL, init);

  // Pass through redirects (e.g. Google OAuth)
  if (resp.status >= 300 && resp.status < 400) {
    return new Response(null, {
      status: resp.status,
      headers: { "Location": resp.headers.get("Location") || "" },
    });
  }

  const body = await resp.text();
  // Preserve Content-Type from backend (may be text/html for OAuth callback pages)
  const ct = resp.headers.get("Content-Type") || "application/json";
  return withCookieUUID(ctx, corsResponse(ctx, new Response(body, {
    status: resp.status,
    headers: { "Content-Type": ct },
  })));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildForwardHeaders(request, ctx, opts = {}) {
  const clientIP = request.headers.get("CF-Connecting-IP") || "";
  const headers = {
    "User-Agent": request.headers.get("User-Agent") || "",
    "X-Forwarded-For": clientIP,
    "X-Real-IP": clientIP,
  };
  if (opts.json) {
    headers["Content-Type"] = "application/json";
  }
  if (ctx.cookieUUID) {
    headers["X-Player-UUID"] = ctx.cookieUUID;
  }
  if (opts.includeAuth) {
    const auth = request.headers.get("Authorization");
    if (auth) headers["Authorization"] = auth;
  }
  return headers;
}

function corsResponse(ctx, response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", ctx.corsOrigin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-App-Version");
  if (ctx.isAllowedOrigin) {
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  headers.set("Access-Control-Expose-Headers", "X-Cookie-UUID");
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

// ---------------------------------------------------------------------------
// Cookie UUID helpers
// ---------------------------------------------------------------------------

function getCookieUUID(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(new RegExp("(?:^|;\\s*)" + COOKIE_NAME + "=([^;]+)"));
  return match ? match[1] : null;
}

function withCookieUUID(ctx, response) {
  if (!ctx.cookieUUID) return response;
  const headers = new Headers(response.headers);
  // Echo UUID in a readable response header (client stores for display)
  headers.set("X-Cookie-UUID", ctx.cookieUUID);
  // Only set cookie for allowlisted origins (cookie is ignored on CORS * anyway)
  // Only set when this is a new cookie (no existing octile_uid in request)
  if (ctx.isAllowedOrigin && ctx.isNewCookie) {
    const isLocalhost = ctx.corsOrigin.startsWith("http://localhost") || ctx.corsOrigin.startsWith("http://127.0.0.1");
    const cookieFlags = isLocalhost
      ? "Path=/; HttpOnly; SameSite=Lax"
      : "Path=/; HttpOnly; Secure; SameSite=None";
    headers.append("Set-Cookie",
      `${COOKIE_NAME}=${ctx.cookieUUID}; ${cookieFlags}; Max-Age=${COOKIE_MAX_AGE}`);
  }
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function errorResponse(ctx, status, detail) {
  return withCookieUUID(ctx, corsResponse(ctx, new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  })));
}
