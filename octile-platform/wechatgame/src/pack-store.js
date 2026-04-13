/**
 * WeChat Mini Game PackStore implementation
 * Uses wx.getFileSystemManager() to store large binary pack files
 * Files stored in wx.env.USER_DATA_PATH don't count toward 10MB storage limit
 */
export class WeChatPackStore {
  constructor() {
    this.fs = wx.getFileSystemManager();
    this.userDataPath = wx.env.USER_DATA_PATH;
  }

  /**
   * Get pack data from filesystem
   * @param {string} key - Pack key (e.g., 'fullpack', 'level_easy')
   * @returns {Promise<ArrayBuffer|null>} Pack data or null if not found
   */
  async getPack(key) {
    const packPath = `${this.userDataPath}/${key}.opk`;
    try {
      const data = this.fs.readFileSync(packPath);
      console.log('[WeChatPackStore] Loaded pack:', key, data.byteLength, 'bytes');
      return data; // Returns ArrayBuffer
    } catch (e) {
      if (e.errMsg && e.errMsg.includes('no such file')) {
        console.log('[WeChatPackStore] Pack not found:', key);
        return null; // Not downloaded yet
      }
      console.error('[WeChatPackStore] Read error:', key, e);
      throw e;
    }
  }

  /**
   * Store pack data to filesystem
   * @param {string} key - Pack key
   * @param {ArrayBuffer} arrayBuffer - Pack data
   * @returns {Promise<void>}
   */
  async setPack(key, arrayBuffer) {
    const packPath = `${this.userDataPath}/${key}.opk`;
    try {
      this.fs.writeFileSync(packPath, arrayBuffer, 'binary');

      // Store metadata in wx.storage (small)
      const view = new DataView(arrayBuffer);
      const version = view.getUint32(4, true);
      wx.setStorageSync(`pack_meta_${key}`, {
        version,
        installedAt: Date.now(),
        size: arrayBuffer.byteLength
      });

      console.log('[WeChatPackStore] Saved pack:', key, 'v' + version, arrayBuffer.byteLength, 'bytes');
    } catch (e) {
      console.error('[WeChatPackStore] Write failed:', key, e);
      throw e;
    }
  }

  /**
   * Remove pack data from filesystem
   * @param {string} key - Pack key
   * @returns {Promise<void>}
   */
  async removePack(key) {
    const packPath = `${this.userDataPath}/${key}.opk`;
    try {
      this.fs.unlinkSync(packPath);
      wx.removeStorageSync(`pack_meta_${key}`);
      console.log('[WeChatPackStore] Removed pack:', key);
    } catch (e) {
      if (!e.errMsg || !e.errMsg.includes('no such file')) {
        console.error('[WeChatPackStore] Remove error:', key, e);
      }
      // Ignore file not found errors
    }
  }

  /**
   * Get pack metadata (small, stored in wx.storage)
   * @param {string} key - Pack key
   * @returns {Object|null} Pack metadata or null
   */
  getPackMeta(key) {
    try {
      return wx.getStorageSync(`pack_meta_${key}`);
    } catch (e) {
      return null;
    }
  }
}
