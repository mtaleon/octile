# Deploy Instructions — v1.15.0 (from v1.8.1 or any prior version)

## Prerequisites

- SSH access to backend server
- Cloudflare Wrangler CLI (`npm install -g wrangler`)
- Android Studio (for APK build)

---

## Step 1: Backup

```bash
# On backend server
cp data/octile.db data/octile.db.bak.$(date +%Y%m%d)
```

---

## Step 2: Deploy Backend

```bash
# Pull latest code
cd /path/to/xsw
git pull origin master

# Restart the service
# (depends on your setup — systemd, docker, pm2, etc.)
sudo systemctl restart xsw
# or: docker-compose restart
# or: pm2 restart xsw
```

---

## Step 3: Run Database Migrations

The following changes are needed on `data/octile.db`:

### 3a. Allow NULL password_hash (magic link users have no password)

```bash
cp data/octile.db data/octile.db.bak

sqlite3 data/octile.db "
BEGIN;
CREATE TABLE octile_users_new AS SELECT * FROM octile_users;
DROP TABLE octile_users;
CREATE TABLE octile_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR,
  display_name VARCHAR NOT NULL,
  picture VARCHAR,
  browser_uuid VARCHAR,
  is_verified BOOLEAN DEFAULT 0,
  otp_code VARCHAR,
  otp_expires_at DATETIME,
  magic_request_id VARCHAR,
  magic_jwt VARCHAR,
  created_at DATETIME,
  last_login_at DATETIME
);
INSERT INTO octile_users SELECT * FROM octile_users_new;
DROP TABLE octile_users_new;
CREATE UNIQUE INDEX IF NOT EXISTS ix_octile_users_email ON octile_users(email);
CREATE INDEX IF NOT EXISTS ix_octile_users_browser_uuid ON octile_users(browser_uuid);
COMMIT;
PRAGMA integrity_check;
"
```

### 3b. Add new columns to octile_progress (sync themes, solved set, best times)

```bash
sqlite3 data/octile.db "
ALTER TABLE octile_progress ADD COLUMN unlocked_themes TEXT DEFAULT '[]';
ALTER TABLE octile_progress ADD COLUMN solved_set TEXT DEFAULT '[]';
ALTER TABLE octile_progress ADD COLUMN best_times TEXT DEFAULT '{}';
"
```

### 3c. Create league tables (if not exists — create_all() handles this on restart)

The 4 league tables (`league_members`, `league_teams`, `league_daily_exp`, `league_history`) are created automatically by SQLAlchemy `create_all()` on backend startup. No manual SQL needed.

### 3d. Add new indexes (if not exists)

```bash
sqlite3 data/octile.db "
CREATE INDEX IF NOT EXISTS idx_octile_userid_created ON octile_scores(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_league_member_team_exp ON league_members(team_id, today_exp);
CREATE INDEX IF NOT EXISTS idx_league_member_tier ON league_members(tier);
"
```

### 3e. Verify

```bash
sqlite3 data/octile.db "
SELECT count(*) FROM octile_users;
SELECT count(*) FROM octile_scores;
SELECT count(*) FROM octile_progress;
PRAGMA table_info(octile_users);
PRAGMA table_info(octile_progress);
PRAGMA integrity_check;
"
```

---

## Step 4: Deploy Cloudflare Worker

```bash
cd /path/to/octile/workers/octile-proxy
npx wrangler deploy
```

This deploys the updated worker with:
- `/version` route (for OTA apiVersion check + data_version)
- Force-update version gate (MIN_VERSION_CODE)
- `X-App-Version` CORS header

### Optional: Set force-update minimum version

```bash
# Only if you want to force old clients to update
wrangler secret put MIN_VERSION_CODE
# Enter: 23 (or whatever minimum versionCode)

wrangler secret put FORCE_REASON
# Enter: "Critical security update"
```

---

## Step 5: Restart Backend (again, after DB migrations)

```bash
sudo systemctl restart xsw
```

Verify it's running:

```bash
curl https://octile.owen-ouyang.workers.dev/health
# Should return: {"status":"ok"}

curl https://octile.owen-ouyang.workers.dev/version
# Should return: {"apiVersion":1,"data_version":"2026-04-02",...}
```

---

## Step 6: Build & Publish Android APK (if needed)

```bash
cd /path/to/octile/android
./gradlew assembleRelease
```

Sign and upload to Play Store. Update `version.json`:
- Set `versionCode` to match Play Store release

---

## Step 7: Verify OTA

After all deployments, existing v1.10+ apps will:
1. Fetch `version.json` → see `otaVersionCode: 23`
2. Check `/version` → `apiVersion: 1` >= `minApiVersion: 1` → OK
3. Download `bundle-v23.zip`
4. Verify SHA-256 + manifest
5. Atomic swap to ota/ dir
6. Show "Update ready" banner

---

## Rollback

### Backend

```bash
# Restore DB backup
cp data/octile.db.bak data/octile.db

# Revert code
git checkout <previous-commit>
sudo systemctl restart xsw
```

### Worker

```bash
cd workers/octile-proxy
git checkout <previous-commit> -- index.js
npx wrangler deploy
```

### OTA

Set `otaVersionCode` in `version.json` to a lower number. Existing OTA installs will be cleaned up when the bundled APK version catches up (`getWebLoadUrl()` logic).

---

## Checklist

- [ ] Backup DB
- [ ] Deploy backend code
- [ ] Run SQL migrations (3a, 3b, 3d)
- [ ] Restart backend
- [ ] Deploy worker (`wrangler deploy`)
- [ ] Verify `/health` and `/version` endpoints
- [ ] Test magic link login (new user + existing user)
- [ ] Test score submission
- [ ] Test sync push/pull
- [ ] Test OTA update on Android
- [ ] Build APK (if publishing to Play Store)
