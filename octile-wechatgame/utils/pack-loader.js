/**
 * Pack Loader - Manages WeChat subpackage loading
 * Uses wx.loadSubpackage API with progress monitoring
 */

import { PackReader } from '../core/index.js';

// Constantize pack prefix (Tightening #6)
const PACK_PREFIX = 'pack-';

// Tracks loaded subpackages
const loadedPacks = new Set();

// Tracks failed subpackages with retry count (Tightening #5)
const failedPacks = new Map(); // level -> failCount
const MAX_FAIL_RETRIES = 3;

/**
 * Load a level pack subpackage
 * @param {string} level - 'easy' | 'medium' | 'hard' | 'hell'
 * @returns {Promise<void>}
 */
export async function ensureLevelPack(level) {
  // Already loaded
  if (loadedPacks.has(level)) {
    console.log('[PackLoader] Already loaded:', level);
    return;
  }

  // Check fail limit (Tightening #5)
  const failCount = failedPacks.get(level) || 0;
  if (failCount >= MAX_FAIL_RETRIES) {
    const err = new Error(`Too many failures for: ${level} (${failCount} attempts)`);
    console.error('[PackLoader]', err.message);
    throw err;
  }

  const packName = `${PACK_PREFIX}${level}`;

  return new Promise((resolve, reject) => {
    console.log('[PackLoader] Loading subpackage:', packName);

    const loadTask = wx.loadSubpackage({
      name: packName,
      success: () => {
        loadedPacks.add(level);
        failedPacks.delete(level); // Clear fail count on success
        console.log('[PackLoader] ✅ Loaded:', packName);
        resolve();
      },
      fail: (err) => {
        const newFailCount = failCount + 1;
        failedPacks.set(level, newFailCount);
        console.error('[PackLoader] ❌ Failed:', packName, 'attempt:', newFailCount, err);
        reject(err);
      }
    });

    // Progress monitoring (if available)
    if (loadTask && loadTask.onProgressUpdate) {
      loadTask.onProgressUpdate((res) => {
        const progress = Math.floor((res.totalBytesWritten / res.totalBytesExpectedToWrite) * 100);
        console.log(`[PackLoader] ${packName} progress: ${progress}%`);
      });
    }
  });
}

/**
 * Get PackReader for a loaded level pack
 * Uses explicit switch case to avoid dynamic require() issues (Correction 2.6)
 * @param {string} level - 'easy' | 'medium' | 'hard' | 'hell'
 * @param {Object} cryptoProvider - Optional crypto provider
 * @returns {PackReader | null}
 */
export function getPackReader(level, cryptoProvider = null) {
  if (!loadedPacks.has(level)) {
    console.warn('[PackLoader] Pack not loaded yet:', level);
    return null;
  }

  try {
    const base64 = requirePackBase64(level);
    const ab = wx.base64ToArrayBuffer(base64);
    return new PackReader(ab, cryptoProvider);
  } catch (e) {
    console.error('[PackLoader] getPackReader failed:', level, e);
    return null;
  }
}

/**
 * Require pack base64 data with explicit paths (Correction 2.6)
 * Avoids dynamic require() which may fail in some bundlers
 * @param {string} level
 * @returns {string} Base64 encoded pack data
 */
function requirePackBase64(level) {
  switch (level) {
    case 'easy':
      return require('../subpackages/pack-easy/pack.js').PACK_BASE64;
    case 'medium':
      return require('../subpackages/pack-medium/pack.js').PACK_BASE64;
    case 'hard':
      return require('../subpackages/pack-hard/pack.js').PACK_BASE64;
    case 'hell':
      return require('../subpackages/pack-hell/pack.js').PACK_BASE64;
    default:
      throw new Error('Unknown level: ' + level);
  }
}

/**
 * Check if a level pack is loaded
 * @param {string} level
 * @returns {boolean}
 */
export function isPackLoaded(level) {
  return loadedPacks.has(level);
}

/**
 * Get loaded pack levels
 * @returns {Array<string>}
 */
export function getLoadedPacks() {
  return Array.from(loadedPacks);
}

/**
 * Clear fail count for a level (for manual retry)
 * @param {string} level
 */
export function clearFailCount(level) {
  failedPacks.delete(level);
  console.log('[PackLoader] Cleared fail count for:', level);
}
