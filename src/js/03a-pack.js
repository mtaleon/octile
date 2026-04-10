// --- PuzzlePack system: PackReader + IDB storage + download/verify ---

// Base-92 alphabet (same as backend): printable ASCII 33-126, excluding ' (39) and \ (92)
var _PKP92 = '!"#$%&()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~';
var _PKP92_MAP = {};
for (var _pi = 0; _pi < _PKP92.length; _pi++) _PKP92_MAP[_PKP92.charCodeAt(_pi)] = _pi;

// MiniPack v0: embedded pack with 99 base puzzles (792 extended), no ordering, unsigned
var MINIPACK_DATA = 'T1BLMQAAAABjAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApIiErIiEuIiEvIiFiIiFGIiFJIiElIyEmIyFQIiF3IyF6IyEpJCEqJCFXIyFYKCFbKCE4KSE5KSE8XyE/XyFvXiFMXyFOXyFhXyFbYCFAYiEmLCF1LyFSMCFkNyEpcyFsciFHRiFXJiJjTCEzPSIjIiNUSiJhTSJZLCNEVyI4ZCJbZCJ0VyN4OSQtXyMmYyNbPyRyQiRmaSNeaiMwUyQ1IiQwKiRnKyRzSyV9eyRZeyQqVyVRfCQyJSVsWyUtXSVAJiVwJiUyKiVBKiVDbSVhLiVzdCVYKCYlSCVASiVxfi5OYi9aZS9Rby9qcy8udC9FWjBVLjAkMTBNPDAueDBXSDBmUjAxVzA9VzBRITtHJDs9RTp9Rzp2Mzt8QTs7QjsuYzpZZTohQ0UBAQEBAQEBAQEDAQEBAQIBAQEBAQEBAQEBAwMCAgIEAwQEBAICAwICAgICAgIDAgICAgMDBAMBBAMCAgIDAwIDAgMCAwQDBAEDBAQDBAQEBAQDAgQEBAEDBAMEAwQEAwMDBAQ=';

var _miniPackReader = null;
var _fullPackReader = null;
var _packReady = null; // Promise, resolves when IDB pack loaded (or immediately if none)

var PUZZLE_COUNT_BASE = 11378;

// --- PackReader class ---

function PackReader(buffer) {
  var view = new DataView(buffer);
  // Validate magic
  var magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== 'OPK1') throw new Error('Invalid pack magic: ' + magic);

  this.version = view.getUint32(4, true);
  this.puzzleCount = view.getUint32(8, true);
  this.schema = view.getUint16(12, true);
  this.hasOrdering = !!(view.getUint8(14) & 1);
  this.signature = new Uint8Array(buffer, 16, 64);

  var dataStart = 80;
  this._puzzleData = new Uint8Array(buffer, dataStart, this.puzzleCount * 3);
  this._diffLevels = new Uint8Array(buffer, dataStart + this.puzzleCount * 3, this.puzzleCount);
  this._buffer = buffer;

  // Parse ordering if present
  this._levelCounts = null;  // [easy, medium, hard, hell]
  this._levelOrdering = null; // {1: Uint16Array, 2: ..., 3: ..., 4: ...}
  if (this.hasOrdering) {
    var ordStart = dataStart + this.puzzleCount * 4; // after puzzle data + diff levels
    var ov = new DataView(buffer, ordStart);
    this._levelCounts = [
      ov.getUint16(0, true), ov.getUint16(2, true),
      ov.getUint16(4, true), ov.getUint16(6, true)
    ];
    this._levelOrdering = {};
    var offset = 8;
    for (var li = 1; li <= 4; li++) {
      var count = this._levelCounts[li - 1];
      var arr = new Uint16Array(count);
      for (var j = 0; j < count; j++) {
        arr[j] = ov.getUint16(offset, true);
        offset += 2;
      }
      this._levelOrdering[li] = arr;
    }
  }

  // Build base-index set for canDecode
  this._baseIndices = null; // lazy: only for MiniPack (when puzzleCount < PUZZLE_COUNT_BASE)
  if (this.puzzleCount < PUZZLE_COUNT_BASE) {
    // MiniPack: need a mapping from actual base indices to position in pack
    // The pack stores puzzles in order of their base indices (sorted)
    // We need to reconstruct which base indices are in the pack
    // For MiniPack, the base indices are stored in minipack-v0-mapping.json at build time
    // But at runtime we don't have that. Instead, we'll decode and match.
    // Actually, the MiniPack stores puzzles at positions 0..N-1 which correspond to
    // specific base indices. We need a reverse lookup.
    // For now, we'll build it from the embedded mapping approach:
    // The pack itself doesn't store which base indices it contains.
    // We need to store this information. Let's use the difficulty levels as a fingerprint.
    // Actually, per the plan, the MiniPack just contains base puzzles at sequential positions.
    // The position in the pack IS the lookup key. We need external mapping.
    // Let's handle this differently: store the base index mapping in the pack.
    // But the format doesn't have it. So for MiniPack, we'll build a decode-all-and-match approach.
    // OR: we just expose decodePuzzle(position) where position = index in pack.
    // The getPuzzleCells will need to try all transforms to find the right base.
    //
    // Simpler approach: build base index list from the mapping JSON embedded at build time.
    // For MiniPack, we embed the list alongside the base64 data.
    this._baseIndices = null; // will be set by _initMiniPack
  }
}

// Decode puzzle at pack-local index (0-based position in this pack's data)
PackReader.prototype.decodePuzzle = function(packIndex) {
  if (packIndex < 0 || packIndex >= this.puzzleCount) return null;
  var o = packIndex * 3;
  var d = this._puzzleData;
  var n = _PKP92_MAP[d[o]] + _PKP92_MAP[d[o + 1]] * 92 + _PKP92_MAP[d[o + 2]] * 92 * 92;

  var g3_idx = n % 96;
  var g2_idx = Math.floor(n / 96) % 112;
  var g1 = Math.floor(n / 10752);

  // Decode grey2
  var g2a, g2b;
  if (g2_idx < 56) {
    var r2 = Math.floor(g2_idx / 7), c2 = g2_idx % 7;
    g2a = r2 * 8 + c2;
    g2b = g2a + 1;
  } else {
    var i2 = g2_idx - 56;
    var r2v = Math.floor(i2 / 8), c2v = i2 % 8;
    g2a = r2v * 8 + c2v;
    g2b = g2a + 8;
  }

  // Decode grey3
  var g3a, g3b, g3c;
  if (g3_idx < 48) {
    var r3 = Math.floor(g3_idx / 6), c3 = g3_idx % 6;
    g3a = r3 * 8 + c3;
    g3b = g3a + 1;
    g3c = g3a + 2;
  } else {
    var i3 = g3_idx - 48;
    var r3v = Math.floor(i3 / 8), c3v = i3 % 8;
    g3a = r3v * 8 + c3v;
    g3b = g3a + 8;
    g3c = g3a + 16;
  }

  return [g1, g2a, g2b, g3a, g3b, g3c];
};

// D4 symmetry transform on 8x8 board cell
PackReader.prototype.transformCell = function(cell, transform) {
  var r = Math.floor(cell / 8), c = cell % 8;
  switch (transform) {
    case 1: var t = r; r = c; c = 7 - t; break;
    case 2: r = 7 - r; c = 7 - c; break;
    case 3: var t3 = r; r = 7 - c; c = t3; break;
    case 4: c = 7 - c; break;
    case 5: var t5 = r; r = 7 - c; c = 7 - t5; break;
    case 6: r = 7 - r; break;
    case 7: var t7 = r; r = c; c = t7; break;
  }
  return r * 8 + c;
};

// Decompose extended puzzle number (1-based) into [baseIndex, transform]
PackReader.prototype.decompose = function(puzzleNumber) {
  var idx = puzzleNumber - 1;
  var transform = Math.floor(idx / PUZZLE_COUNT_BASE);
  var base = idx % PUZZLE_COUNT_BASE;
  return [base, transform];
};

// Get cells for an extended puzzle number (1-based). Returns [6 cells] or null.
PackReader.prototype.getPuzzleCells = function(puzzleNumber) {
  var parts = this.decompose(puzzleNumber);
  var baseIndex = parts[0], transform = parts[1];

  // For FullPack (puzzleCount == PUZZLE_COUNT_BASE): packIndex == baseIndex
  // For MiniPack: need to look up baseIndex in _baseIndices
  var packIndex;
  if (this.puzzleCount === PUZZLE_COUNT_BASE) {
    packIndex = baseIndex;
  } else if (this._baseIndices) {
    packIndex = this._baseIndices.indexOf(baseIndex);
    if (packIndex === -1) return null;
  } else {
    return null;
  }

  var cells = this.decodePuzzle(packIndex);
  if (!cells) return null;
  if (transform === 0) return cells;
  var self = this;
  return cells.map(function(c) { return self.transformCell(c, transform); });
};

// Check if this pack can decode a given extended puzzle number
PackReader.prototype.canDecode = function(puzzleNumber) {
  var baseIndex = this.decompose(puzzleNumber)[0];
  if (this.puzzleCount === PUZZLE_COUNT_BASE) return baseIndex < this.puzzleCount;
  if (this._baseIndices) return this._baseIndices.indexOf(baseIndex) !== -1;
  return false;
};

// Level slot → puzzle number (FullPack only, interleaved ordering)
PackReader.prototype.levelSlotToPuzzle = function(level, slot) {
  if (!this.hasOrdering || !this._levelOrdering) return null;
  var levelNum = {easy: 1, medium: 2, hard: 3, hell: 4}[level];
  if (!levelNum) return null;
  var bases = this._levelOrdering[levelNum];
  if (!bases) return null;
  var numBases = bases.length;
  var total = numBases * 8;
  if (slot < 1 || slot > total) return null;
  var slot0 = slot - 1;
  var basePos = slot0 % numBases;
  var transform = Math.floor(slot0 / numBases);
  var baseIdx = bases[basePos];
  return transform * PUZZLE_COUNT_BASE + baseIdx + 1;
};

// Get total puzzles in a level (FullPack only)
PackReader.prototype.getLevelTotal = function(level) {
  if (!this.hasOrdering || !this._levelOrdering) return 0;
  var levelNum = {easy: 1, medium: 2, hard: 3, hell: 4}[level];
  if (!levelNum) return 0;
  var bases = this._levelOrdering[levelNum];
  return bases ? bases.length * 8 : 0;
};

// Get all level totals as {easy:N, medium:N, hard:N, hell:N}
PackReader.prototype.getAllLevelTotals = function() {
  var totals = {};
  var levels = ['easy', 'medium', 'hard', 'hell'];
  for (var i = 0; i < levels.length; i++) {
    totals[levels[i]] = this.getLevelTotal(levels[i]);
  }
  return totals;
};

// Get list of all base indices in this pack (for random selection in MiniPack)
PackReader.prototype.getBaseIndices = function() {
  if (this._baseIndices) return this._baseIndices;
  if (this.puzzleCount === PUZZLE_COUNT_BASE) return null; // too many to list
  return null;
};

// Get a random puzzle number from this pack
PackReader.prototype.getRandomPuzzleNumber = function() {
  if (this.puzzleCount === PUZZLE_COUNT_BASE) {
    return Math.floor(Math.random() * PUZZLE_COUNT_BASE * 8) + 1;
  }
  if (this._baseIndices) {
    var base = this._baseIndices[Math.floor(Math.random() * this._baseIndices.length)];
    var transform = Math.floor(Math.random() * 8);
    return transform * PUZZLE_COUNT_BASE + base + 1;
  }
  return 1;
};

// --- MiniPack initialization ---

// Base indices embedded from generate-minipack.py (sorted)
var MINIPACK_BASE_INDICES = [0,1,2,4,9,10,14,15,57,60,64,65,72,86,88,93,94,98,231,234,238,239,278,281,289,294,296,308,333,382,557,667,670,952,1016,1034,1539,1561,1683,1877,2068,2099,2122,2167,2231,2449,2461,2748,2873,2919,2974,3053,3103,3205,3222,3530,3970,4137,4345,4602,4751,4765,4771,4904,4960,4984,5012,5141,5171,5196,5199,5440,5462,5698,6206,6358,6412,6633,6673,6730,6837,6860,6867,7089,7224,7240,7497,7575,7899,8274,8358,8363,9230,9309,9331,9388,9860,10316,10512,10540];

function _initMiniPack() {
  try {
    var raw = atob(MINIPACK_DATA);
    var buf = new ArrayBuffer(raw.length);
    var view = new Uint8Array(buf);
    for (var i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
    _miniPackReader = new PackReader(buf);
    _miniPackReader._baseIndices = MINIPACK_BASE_INDICES;
  } catch (e) {
    console.error('[Octile] MiniPack init failed:', e);
  }
}

// Initialize MiniPack immediately
_initMiniPack();

// --- IndexedDB storage ---

var _IDB_NAME = 'octile_packs';
var _IDB_VERSION = 1;

function _openPackDB() {
  return new Promise(function(resolve, reject) {
    if (typeof indexedDB === 'undefined') { reject(new Error('no IDB')); return; }
    var req = indexedDB.open(_IDB_NAME, _IDB_VERSION);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('packs')) db.createObjectStore('packs');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
  });
}

function _idbGet(storeName, key) {
  return _openPackDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(storeName, 'readonly');
      var req = tx.objectStore(storeName).get(key);
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

function _idbPut(storeName, key, value) {
  return _openPackDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(storeName, 'readwrite');
      var req = tx.objectStore(storeName).put(value, key);
      req.onsuccess = function() { resolve(); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

// --- Pack loading from IDB ---

function _loadPackFromIDB() {
  return _idbGet('packs', 'active').then(function(record) {
    if (!record || !record.data) return false;
    try {
      var reader = new PackReader(record.data);
      // Verify signature if FullPack
      if (reader.puzzleCount === PUZZLE_COUNT_BASE) {
        if (!_verifyPackSignature(reader)) {
          console.warn('[Octile] Pack signature invalid, discarding');
          return false;
        }
      }
      _fullPackReader = reader;
      console.log('[Octile] Loaded FullPack v' + reader.version + ' from IDB (' + reader.puzzleCount + ' puzzles)');
      return true;
    } catch (e) {
      console.warn('[Octile] Failed to load pack from IDB:', e);
      return false;
    }
  }).catch(function() { return false; });
}

// --- Signature verification ---

var _PACK_PUBLIC_KEY = null; // set from config

function _setPackPublicKey(b64) {
  if (!b64) return;
  try {
    var raw = atob(b64);
    _PACK_PUBLIC_KEY = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) _PACK_PUBLIC_KEY[i] = raw.charCodeAt(i);
  } catch (e) {
    console.warn('[Octile] Invalid pack public key');
  }
}

function _verifyPackSignature(reader) {
  if (!_PACK_PUBLIC_KEY || typeof nacl === 'undefined') return true; // skip if no key or no nacl
  try {
    var dataPayload = new Uint8Array(reader._buffer, 80);
    var sig = reader.signature;
    return nacl.sign.detached.verify(dataPayload, sig, _PACK_PUBLIC_KEY);
  } catch (e) {
    console.warn('[Octile] Signature verification error:', e);
    return false;
  }
}

function _verifyReleaseSignature(currentObj, sigB64) {
  if (!_PACK_PUBLIC_KEY || typeof nacl === 'undefined') return true;
  try {
    var canonical = JSON.stringify(currentObj, Object.keys(currentObj).sort(), 0)
      .replace(/\s/g, '');
    // Use proper canonical: sorted keys, no spaces
    var keys = Object.keys(currentObj).sort();
    var obj = {};
    for (var i = 0; i < keys.length; i++) obj[keys[i]] = currentObj[keys[i]];
    canonical = JSON.stringify(obj);
    var msgBytes = new TextEncoder().encode(canonical);
    var sigRaw = atob(sigB64);
    var sigBytes = new Uint8Array(sigRaw.length);
    for (var j = 0; j < sigRaw.length; j++) sigBytes[j] = sigRaw.charCodeAt(j);
    return nacl.sign.detached.verify(msgBytes, sigBytes, _PACK_PUBLIC_KEY);
  } catch (e) {
    console.warn('[Octile] Release signature verification error:', e);
    return false;
  }
}

// --- Download & update ---

function checkPackUpdate() {
  var releaseUrl = _cfg('pack.releaseUrl', '');
  if (!releaseUrl) return Promise.resolve();

  return fetch(releaseUrl, { signal: AbortSignal.timeout(10000), cache: 'no-cache' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(release) {
      if (!release || !release.current) return;
      var current = release.current;

      // Check version
      var localVersion = _fullPackReader ? _fullPackReader.version : 0;
      if (current.version <= localVersion) return;

      // Check minimum app version
      if (current.minAppVersionCode && current.minAppVersionCode > APP_VERSION_CODE) return;

      // Verify release signature
      if (release.signature && !_verifyReleaseSignature(current, release.signature)) {
        console.warn('[Octile] Release manifest signature invalid');
        return;
      }

      // Download pack
      return _downloadPack(current);
    })
    .catch(function(e) {
      console.log('[Octile] Pack update check failed:', e.message);
    });
}

function _fetchWithMirrors(urls) {
  var i = 0;
  function tryNext() {
    if (i >= urls.length) return Promise.resolve(null);
    var url = urls[i++];
    return fetch(url, { signal: AbortSignal.timeout(30000) })
      .then(function(r) { return r.ok ? r.arrayBuffer() : null; })
      .then(function(buf) {
        if (buf) return buf;
        return tryNext();
      })
      .catch(function() { return tryNext(); });
  }
  return tryNext();
}

function _downloadPack(info) {
  var urls = [info.url];
  if (info.mirrors && info.mirrors.length) urls = urls.concat(info.mirrors);

  return _fetchWithMirrors(urls).then(function(buf) {
    if (!buf) return;

    // Verify SHA-256
    return crypto.subtle.digest('SHA-256', buf).then(function(hashBuf) {
      var hashArr = new Uint8Array(hashBuf);
      var hex = '';
      for (var i = 0; i < hashArr.length; i++) hex += ('0' + hashArr[i].toString(16)).slice(-2);

      if (hex !== info.sha256) {
        console.warn('[Octile] Pack SHA-256 mismatch');
        return;
      }

      // Parse and verify signature
      var reader;
      try { reader = new PackReader(buf); } catch (e) {
        console.warn('[Octile] Downloaded pack parse failed:', e);
        return;
      }

      if (!_verifyPackSignature(reader)) {
        console.warn('[Octile] Downloaded pack signature invalid');
        return;
      }

      // Store in IDB and activate
      _fullPackReader = reader;
      console.log('[Octile] Installed FullPack v' + reader.version + ' (' + reader.puzzleCount + ' puzzles)');

      return _idbPut('packs', 'active', {
        version: reader.version,
        data: buf,
        installedAt: Date.now()
      }).catch(function() {}); // IDB write failure is non-fatal
    });
  });
}

// Compute ordering_id: first 8 hex of SHA-256 of canonical ordering bytes
PackReader.prototype.getOrderingId = function() {
  if (this._orderingId) return Promise.resolve(this._orderingId);
  if (!this.hasOrdering) return Promise.resolve(null);
  var dataStart = 80 + this.puzzleCount * 4; // after header + puzzleData + diffLevels
  var orderingBytes = new Uint8Array(this._buffer, dataStart);
  var self = this;
  return crypto.subtle.digest('SHA-256', orderingBytes).then(function(hash) {
    var arr = new Uint8Array(hash);
    var hex = '';
    for (var i = 0; i < 4; i++) hex += ('0' + arr[i].toString(16)).slice(-2);
    self._orderingId = hex;
    return hex;
  });
};

// --- Public API ---

function hasFullPuzzleSet() {
  return !!_fullPackReader;
}

var _orderingMismatchLogged = false;

function _checkOrderingMismatch() {
  if (_orderingMismatchLogged) return;
  if (!_fullPackReader || !_fullPackReader.hasOrdering || !_serverOrderingId) return;
  _fullPackReader.getOrderingId().then(function(packId) {
    if (packId && packId !== _serverOrderingId) {
      console.warn('[Octile] Ordering mismatch: pack=' + packId + ' server=' + _serverOrderingId);
      _orderingMismatchLogged = true;
    }
  });
}

function _initPacks() {
  // Set public key from config
  _setPackPublicKey(_cfg('pack.publicKey', ''));

  // Load from IDB, then check for updates
  _packReady = _loadPackFromIDB().then(function() {
    _checkOrderingMismatch();
    // Background update check (non-blocking)
    checkPackUpdate();
  }).catch(function() {});

  return _packReady;
}
