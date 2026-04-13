# Octile WeChat Mini Game (微信小游戏)

WeChat Mini Game UI layer for Octile puzzle game.

## Structure

```
octile-wechatgame/
├── game.js              # Main lifecycle (GameGlobal.onLaunch/onShow/onHide)
├── game.json            # Game config with subpackages
├── main.js              # Game loop entry point
├── core/                # Re-exports from octile-core
├── platform/            # Re-exports from octile-platform/wechatgame
├── scenes/              # Game scenes (Canvas rendering)
│   └── game-scene.js    # 8x8 board + piece pool
├── utils/
│   └── minipack.js      # Embedded MiniPack (1KB, 99 puzzles)
└── subpackages/         # Lazy-loaded level packs
    ├── pack-easy/
    ├── pack-medium/
    ├── pack-hard/
    └── pack-hell/
```

## Key Features

- **Canvas 2D rendering**: 8x8 board with touch input
- **Hybrid pack storage**: Embedded MiniPack (99 puzzles) + subpackages (4-8MB)
- **Lifecycle compensation**: WeChatTimeSource compensates for onHide/onShow gaps
- **No monkey-patching**: Direct calls to timeSource.handlePause/Resume
- **Small interfaces**: TimeSource, CryptoProvider, PackStore, KVStore (not god object)

## Development

1. Open in WeChat DevTools
2. Set project type to "游戏" (Game)
3. Compile Type: "小游戏" (Mini Game)
4. Run in simulator or real device

## Phase 3 Status

✅ Game lifecycle (game.js)
✅ Game config (game.json)
✅ Canvas scene (game-scene.js)
✅ Game loop (main.js)
✅ Timer display (1000ms updates)
✅ MiniPack integration

🚧 TODO:
- Complete touch drag/drop mechanics
- Implement piece rotation
- Add win screen
- Wire subpackages for level-based packs
- Test in WeChat DevTools

## Constraints

- Main package: ≤ 4MB
- Total (main + subpackages): ≤ 30MB
- wx.storage: ~10MB (use FileSystemManager for packs)

## Dependencies

- octile-core: Platform-agnostic puzzle logic
- octile-platform/wechatgame: WeChat adapters (TimeSource, CryptoProvider, etc.)
