/**
 * PackStore interface for large binary pack storage
 * Platform implementations: web (IndexedDB), WeChat (FileSystemManager)
 */
export class PackStore {
  /**
   * Get pack data from storage
   * @param {string} key - Pack key (e.g., 'fullpack', 'level_easy')
   * @returns {Promise<ArrayBuffer|null>} Pack data or null if not found
   */
  async getPack(key) {
    throw new Error('PackStore.getPack() not implemented');
  }

  /**
   * Store pack data
   * @param {string} key - Pack key
   * @param {ArrayBuffer} arrayBuffer - Pack data
   * @returns {Promise<void>}
   */
  async setPack(key, arrayBuffer) {
    throw new Error('PackStore.setPack() not implemented');
  }

  /**
   * Remove pack data from storage
   * @param {string} key - Pack key
   * @returns {Promise<void>}
   */
  async removePack(key) {
    throw new Error('PackStore.removePack() not implemented');
  }
}
