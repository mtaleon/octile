# ITP Migration Checklist

Migration from `mtaleon.github.io/octile` + `octile.owen-ouyang.workers.dev`
to `app.octile.eu.cc` + `api.octile.eu.cc` (same-site, Safari ITP safe).

## DNS & Hosting

- [ ] `app.octile.eu.cc` CNAME → GitLab Pages
- [ ] `api.octile.eu.cc` → Cloudflare Worker custom domain
- [ ] HTTPS working on `https://app.octile.eu.cc`
- [ ] HTTPS working on `https://api.octile.eu.cc`
- [ ] GitLab Pages domain verified (TXT record)

## Worker (api.octile.eu.cc)

- [ ] Worker deployed to Cloudflare with `api.octile.eu.cc` custom domain
- [ ] `BACKEND_ORIGIN` env var set correctly (→ `https://m.taleon.work.gd`)
- [ ] Health check works: `curl https://api.octile.eu.cc/health`
- [ ] Score API works: `curl https://api.octile.eu.cc/scoreboard`
- [ ] CORS headers present (`Access-Control-Allow-Origin: *`)
- [ ] Puzzle fetch works: `curl https://api.octile.eu.cc/puzzle/1`

## Backend (m.taleon.work.gd)

- [ ] `OCTILE_WORKER_URL` env var updated to `https://api.octile.eu.cc`
- [ ] `OCTILE_SITE_URL` env var updated to `https://app.octile.eu.cc/`
- [ ] `OCTILE_GOOGLE_REDIRECT_URI` updated to `https://api.octile.eu.cc/auth/google/callback`
- [ ] Backend redeployed with new env vars

## Google OAuth (Cloud Console)

- [ ] Authorized JavaScript origins: add `https://app.octile.eu.cc`
- [ ] Authorized redirect URIs: add `https://api.octile.eu.cc/auth/google/callback`
- [ ] Keep old URIs during transition (remove later)
- [ ] Test: Google sign-in on `app.octile.eu.cc` completes without error

## Cloudflare Turnstile (if used)

- [ ] Add `app.octile.eu.cc` to allowed domains in Turnstile widget settings

## Client Code (this repo)

- [x] `src/02-config.js`: `WORKER_URL` → `https://api.octile.eu.cc`
- [x] `src/02-config.js`: `SITE_URL` → `https://app.octile.eu.cc/`
- [x] `config.json`: `workerUrl` + `siteUrl` updated
- [x] `feedback.html`: `API_BASE` updated
- [x] `version.json`: `bundleUrl` updated
- [x] `scripts/make-ota-bundle.sh`: bundle URL updated
- [x] `android/assets/config.json`: `workerUrl` + `siteUrl` updated
- [x] `android/assets/feedback.html`: `API_BASE` updated
- [x] `ios/Web/config.json`: `workerUrl` updated
- [x] `ios/Web/feedback.html`: `API_BASE` updated

## GitHub Actions

- [ ] `GITLAB_DEPLOY_TOKEN` secret set in GitHub repo settings
- [ ] `GITLAB_REPO_URL` secret set (e.g. `gitlab.com/octileapp/octileapp.gitlab.io.git`)
- [ ] Test: push to main → GitLab Pages updated

## Smoke Test on app.octile.eu.cc

- [ ] Page loads, splash screen shows
- [ ] Puzzle loads (API fetch works)
- [ ] Score submits after solving
- [ ] Leaderboard loads
- [ ] Google sign-in works (redirect + callback)
- [ ] Magic link login works (email sends, link opens correctly)
- [ ] Sync push/pull works after login
- [ ] Daily check-in toast appears
- [ ] Feedback form submits
- [ ] OTA update check works (version.json fetch)

## Safari-Specific Tests

- [ ] Safari macOS: all above smoke tests pass
- [ ] Safari iOS: all above smoke tests pass
- [ ] No "Status: --" errors in Safari DevTools Network tab
- [ ] Cookies/auth tokens persist across page reloads in Safari

## Cleanup (after migration confirmed stable)

- [ ] Remove old Google OAuth URIs for `mtaleon.github.io`
- [ ] Remove old Turnstile domain entries
- [ ] Optionally redirect `mtaleon.github.io/octile` → `app.octile.eu.cc`
- [ ] Update README / docs with new URLs
- [ ] Update Play Store listing URL if needed
