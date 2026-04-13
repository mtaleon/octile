/**
 * KVStore interface for small key-value storage (progress, settings)
 * Platform implementations: web (localStorage), WeChat (wx.storage)
 */
export class KVStore {
  /**
   * Get value from storage
   * @param {string} key - Storage key
   * @returns {Promise<any>} Parsed value or null if not found
   */
  async get(key) {
    throw new Error('KVStore.get() not implemented');
  }

  /**
   * Set value in storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store (will be JSON.stringify'd)
   * @returns {Promise<void>}
   */
  async set(key, value) {
    throw new Error('KVStore.set() not implemented');
  }

  /**
   * Remove value from storage
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async remove(key) {
    throw new Error('KVStore.remove() not implemented');
  }
}
