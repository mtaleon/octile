/**
 * WeChat Mini Game KVStore implementation
 * Uses wx.setStorageSync/getStorageSync for small key-value storage
 * Note: WeChat storage has ~10MB total limit
 */
export class WeChatKVStore {
  /**
   * Get value from storage
   * @param {string} key - Storage key
   * @returns {Promise<any>} Parsed value or null
   */
  async get(key) {
    try {
      return wx.getStorageSync(key);
    } catch (e) {
      console.warn('[WeChatKVStore] get failed:', key, e);
      return null;
    }
  }

  /**
   * Set value in storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store (will be JSON.stringify'd internally by WeChat)
   * @returns {Promise<void>}
   */
  async set(key, value) {
    try {
      const size = JSON.stringify(value).length;
      if (size > 1024 * 1024) {
        console.warn('[WeChatKVStore] Large value:', key, (size / 1024).toFixed(1) + 'KB');
      }
      wx.setStorageSync(key, value);
    } catch (e) {
      if (e.errMsg && e.errMsg.includes('exceed')) {
        // Storage full - clear expendable data
        console.warn('[WeChatKVStore] Storage limit exceeded, clearing cache');
        this._clearExpendableData();
        wx.setStorageSync(key, value); // Retry
      } else {
        throw e;
      }
    }
  }

  /**
   * Remove value from storage
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async remove(key) {
    try {
      wx.removeStorageSync(key);
    } catch (e) {
      console.warn('[WeChatKVStore] remove failed:', key, e);
    }
  }

  /**
   * Clear expendable data to free up storage
   * Keeps: progress, auth, settings
   * Clears: messages, temp data, puzzle cache
   * @private
   */
  _clearExpendableData() {
    try {
      const info = wx.getStorageInfoSync();
      const expendablePrefixes = ['octile_messages', 'temp_', 'puzzle_cache_'];

      info.keys.forEach(key => {
        for (const prefix of expendablePrefixes) {
          if (key.startsWith(prefix)) {
            try {
              wx.removeStorageSync(key);
              console.log('[WeChatKVStore] Cleared:', key);
            } catch (e) {
              // Ignore errors during cleanup
            }
            break;
          }
        }
      });
    } catch (e) {
      console.error('[WeChatKVStore] _clearExpendableData error:', e);
    }
  }
}
