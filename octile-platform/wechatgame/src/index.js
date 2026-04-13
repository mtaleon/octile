/**
 * WeChat Mini Game Platform Adapters for Octile
 *
 * Usage:
 * import { WeChatTimeSource, WeChatKVStore, WeChatCryptoProvider } from 'octile-platform-wechatgame';
 * import { Timer } from 'octile-core';
 *
 * const timeSource = new WeChatTimeSource();
 * const timer = new Timer(timeSource);
 */

// Export all WeChat implementations of core interfaces
export { WeChatTimeSource } from './time-source.js';
export { WeChatCryptoProvider } from './crypto-provider.js';
export { WeChatPackStore } from './pack-store.js';
export { WeChatKVStore } from './kv-store.js';

// Export network helpers (not core interfaces, but useful utilities)
export { wxFetch, wxDownloadFile } from './network-helper.js';
