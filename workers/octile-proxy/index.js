/**
 * Octile Score Proxy — Cloudflare Worker
 *
 * Sits between the client and backend to provide:
 *   1. Turnstile verification (proves real browser, not curl/bot)
 *   2. IP-based rate limiting via KV (fast, no DB query)
 *   3. HMAC request signing (backend trusts only Worker-signed requests)
 *
 * Environment variables (set via wrangler secret put):
 *   CF_TURNSTILE_SECRET  — Turnstile secret key
 *   WORKER_HMAC_SECRET   — shared secret for HMAC signing
 *   BACKEND_ORIGIN       — backend URL (e.g. https://m.taleon.work.gd)
 *
 * KV namespace binding:
 *   RATE_LIMIT — for IP-based rate limiting
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse(new Response(null, { status: 204 }));
    }

    // Route: POST /score — submit score (proxied + validated)
    if (request.method === "POST" && url.pathname === "/score") {
      return handleScoreSubmit(request, env);
    }

    // Route: GET /health — lightweight backend health check
    if (request.method === "GET" && url.pathname === "/health") {
      return handleHealth(env);
    }

    // Route: GET /puzzle/{n} — proxy individual puzzle
    const puzzleMatch = url.pathname.match(/^\/puzzle\/(\d+)$/);
    if (request.method === "GET" && puzzleMatch) {
      return proxyToBackend(request, env, url.pathname);
    }

    // Route: GET /levels — level counts
    if (request.method === "GET" && url.pathname === "/levels") {
      return proxyToBackend(request, env, url.pathname);
    }

    // Route: GET /level/{name}/puzzle/{slot} — level-based puzzle
    const levelMatch = url.pathname.match(/^\/level\/(easy|medium|hard|hell)\/puzzle\/(\d+)$/);
    if (request.method === "GET" && levelMatch) {
      return proxyToBackend(request, env, url.pathname);
    }

    // Route: GET /scoreboard, GET /puzzles, GET /leaderboard — pass through to backend
    if (request.method === "GET" && (url.pathname === "/scoreboard" || url.pathname === "/puzzles" || url.pathname === "/leaderboard")) {
      return proxyToBackend(request, env, url.pathname);
    }

    // Route: /auth/* — proxy auth endpoints (POST and GET)
    if (url.pathname.startsWith("/auth/")) {
      return proxyAuthToBackend(request, env, url.pathname);
    }

    return corsResponse(new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    }));
  },
};

// ---------------------------------------------------------------------------
// Health check — proxy to backend, return only { status }
// ---------------------------------------------------------------------------

async function handleHealth(env) {
  try {
    const backendURL = (env.BACKEND_ORIGIN || "https://m.taleon.work.gd") + "/xsw/api/health";
    const resp = await fetch(backendURL, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) {
      return corsResponse(new Response(JSON.stringify({ status: "error" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }));
    }
    const data = await resp.json();
    return corsResponse(new Response(JSON.stringify({ status: data.status || "error" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  } catch {
    return corsResponse(new Response(JSON.stringify({ status: "error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    }));
  }
}

// ---------------------------------------------------------------------------
// Score submission handler
// ---------------------------------------------------------------------------

async function handleScoreSubmit(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid JSON");
  }

  const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

  // --- Layer 1: Turnstile verification ---
  // Verify token when present; skip when absent (Android/iOS WebView can't load Turnstile)
  const token = body.cf_turnstile_token;
  if (token && env.CF_TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(token, env.CF_TURNSTILE_SECRET, clientIP);
    if (!ok) {
      return errorResponse(403, "turnstile verification failed");
    }
  }

  // --- Layer 2: IP rate limiting via KV ---
  if (env.RATE_LIMIT) {
    const limited = await checkIPRateLimit(env.RATE_LIMIT, clientIP);
    if (limited) {
      return errorResponse(429, "too many requests from this IP");
    }
  }

  // --- Layer 3: HMAC signing ---
  // Remove turnstile token from payload (backend doesn't need it)
  delete body.cf_turnstile_token;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = JSON.stringify(body);
  const signature = await hmacSign(payload + timestamp, env.WORKER_HMAC_SECRET || "");

  // Forward to backend
  const backendURL = (env.BACKEND_ORIGIN || "https://m.taleon.work.gd") + "/octile/score";
  const backendResp = await fetch(backendURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Worker-Signature": signature,
      "X-Worker-Timestamp": timestamp,
      "X-Forwarded-For": clientIP,
      "X-Real-IP": clientIP,
    },
    body: payload,
  });

  const respBody = await backendResp.text();
  return corsResponse(new Response(respBody, {
    status: backendResp.status,
    headers: { "Content-Type": "application/json" },
  }));
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

async function proxyToBackend(request, env, pathname) {
  const url = new URL(request.url);
  const backendURL = (env.BACKEND_ORIGIN || "https://m.taleon.work.gd") + "/octile" + pathname + url.search;
  const resp = await fetch(backendURL);
  const body = await resp.text();
  return corsResponse(new Response(body, {
    status: resp.status,
    headers: { "Content-Type": "application/json" },
  }));
}

// ---------------------------------------------------------------------------
// Proxy auth requests to backend (POST body + Authorization header)
// ---------------------------------------------------------------------------

async function proxyAuthToBackend(request, env, pathname) {
  const backendURL = (env.BACKEND_ORIGIN || "https://m.taleon.work.gd") + "/octile" + pathname;
  const headers = { "Content-Type": "application/json" };

  // Forward Authorization header if present
  const auth = request.headers.get("Authorization");
  if (auth) headers["Authorization"] = auth;

  const init = { method: request.method, headers };
  if (request.method === "POST") {
    init.body = await request.text();
  }

  const resp = await fetch(backendURL, init);
  const body = await resp.text();
  return corsResponse(new Response(body, {
    status: resp.status,
    headers: { "Content-Type": "application/json" },
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function corsResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function errorResponse(status, detail) {
  return corsResponse(new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}
