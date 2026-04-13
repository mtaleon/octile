/**
 * WeChat Mini Game network helper
 * Wraps wx.request to provide fetch-like interface
 *
 * CRITICAL: Must set responseType: 'arraybuffer' for binary data
 */

/**
 * Fetch-like wrapper for wx.request
 * @param {string} url - Request URL
 * @param {Object} options - Request options
 * @param {string} options.method - HTTP method (default: 'GET')
 * @param {any} options.body - Request body
 * @param {Object} options.headers - Request headers
 * @param {number} options.timeout - Timeout in milliseconds (default: 30000)
 * @param {string} options.responseType - Response type ('text', 'arraybuffer') (default: 'text')
 * @returns {Promise<Object>} Response object with ok, status, data, json(), arrayBuffer()
 */
export function wxFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: options.method || 'GET',
      data: options.body,
      header: options.headers || {},
      timeout: options.timeout || 30000,
      responseType: options.responseType || 'text', // CRITICAL: 'arraybuffer' for binary

      success: (res) => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          headers: res.header,
          data: res.data, // Direct access (type depends on responseType)

          // Convenience methods (fetch-like API)
          json: async () => {
            if (typeof res.data === 'object') return res.data;
            return JSON.parse(res.data);
          },

          arrayBuffer: async () => {
            // Only valid if responseType='arraybuffer'
            if (options.responseType !== 'arraybuffer') {
              throw new Error('arrayBuffer() requires responseType: "arraybuffer"');
            }
            return res.data;
          },

          text: async () => {
            if (typeof res.data === 'string') return res.data;
            return JSON.stringify(res.data);
          }
        });
      },

      fail: (err) => {
        console.error('[wxFetch] Request failed:', url, err);
        reject(new Error(err.errMsg || 'Request failed'));
      }
    });
  });
}

/**
 * Download file using wx.downloadFile (for large packs)
 * @param {string} url - Download URL
 * @param {Object} options - Download options
 * @param {number} options.timeout - Timeout in milliseconds (default: 60000)
 * @param {Function} options.onProgress - Progress callback (progressEvent) => void
 * @returns {Promise<string>} Local file path
 */
export function wxDownloadFile(url, options = {}) {
  return new Promise((resolve, reject) => {
    const downloadTask = wx.downloadFile({
      url,
      timeout: options.timeout || 60000,

      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.tempFilePath);
        } else {
          reject(new Error(`Download failed with status ${res.statusCode}`));
        }
      },

      fail: (err) => {
        console.error('[wxDownloadFile] Download failed:', url, err);
        reject(new Error(err.errMsg || 'Download failed'));
      }
    });

    // Attach progress listener if provided
    if (options.onProgress) {
      downloadTask.onProgressUpdate((res) => {
        options.onProgress({
          progress: res.progress,
          totalBytesWritten: res.totalBytesWritten,
          totalBytesExpectedToWrite: res.totalBytesExpectedToWrite
        });
      });
    }
  });
}
