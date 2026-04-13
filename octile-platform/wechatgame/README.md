# octile-platform-wechatgame

WeChat Mini Game (微信小游戏) platform adapters for Octile.

## Installation

```bash
npm install tweetnacl
```

## Usage

```javascript
import { WeChatTimeSource, WeChatKVStore, WeChatCryptoProvider, WeChatPackStore } from './platform/wechatgame/src/index.js';
import { Timer, PackReader } from 'octile-core';

// Initialize platform adapters
const timeSource = new WeChatTimeSource();
const kvStore = new WeChatKVStore();
const cryptoProvider = new WeChatCryptoProvider();
const packStore = new WeChatPackStore();

// Use with core
const timer = new Timer(timeSource);
timer.start();

// Handle WeChat lifecycle in game.js
GameGlobal.onHide = function() {
  timeSource.handlePause(); // Freeze time
};

GameGlobal.onShow = function() {
  timeSource.handleResume(); // Compensate for paused time
};
```

## Modules

### WeChatTimeSource
- Implements `TimeSource` interface
- Compensates for onHide/onShow time gaps
- `isPauseAware = true`

### WeChatCryptoProvider
- Implements `CryptoProvider` interface  
- Uses tweetnacl for Ed25519 signature verification
- Sync `verifySignature()` method

### WeChatPackStore
- Implements `PackStore` interface
- Stores large binary packs in `wx.env.USER_DATA_PATH`
- Files don't count toward 10MB storage limit

### WeChatKVStore
- Implements `KVStore` interface
- Uses `wx.setStorageSync` for small key-value data
- Auto-clears cache when storage limit exceeded

### Network Helpers
- `wxFetch(url, options)` - fetch-like wrapper for wx.request
- `wxDownloadFile(url, options)` - download large files with progress

## WeChat Constraints

- **Main package**: ≤ 4MB
- **Total (main + subpackages)**: ≤ 30MB
- **wx.storage limit**: ~10MB total
- **FileSystemManager**: No limit (use for packs)

## Critical Notes

1. **Time compensation**: Call `timeSource.handlePause/Resume()` in game.js lifecycle
2. **Binary downloads**: Use `responseType: 'arraybuffer'` in wxFetch options
3. **Storage management**: KVStore auto-clears expendable data when full
4. **No monkey-patching**: Direct lifecycle calls (no automatic hook injection)
