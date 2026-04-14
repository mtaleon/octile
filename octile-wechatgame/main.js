/**
 * Octile WeChat Mini Game (小游戏)
 * Main game loop entry point
 */

import { PackReader, Timer } from './core/index.js';
import { GameScene } from './scenes/game-scene.js';

// Create main canvas
const canvas = wx.createCanvas();
canvas.width = 360;
canvas.height = 640;

// Initialize game scene
const gameScene = new GameScene(canvas);

// Load MiniPack
const packReader = new PackReader(GameGlobal.miniPackBuffer);

// Initialize timer
const timer = new Timer(GameGlobal.timeSource);

// Current puzzle index
let currentPuzzleIndex = 1;

// Timer display update (every 1000ms)
setInterval(() => {
  const elapsed = timer.getElapsedSeconds();
  updateTimerDisplay(elapsed);
}, 1000);

// Game loop
function render() {
  gameScene.render();
  requestAnimationFrame(render);
}
render();

// Load first puzzle
loadPuzzle(currentPuzzleIndex);

// Wire up next puzzle callback
gameScene.onNextPuzzle = () => {
  currentPuzzleIndex++;
  if (currentPuzzleIndex > packReader.puzzleCount) {
    currentPuzzleIndex = 1; // Loop back to start
  }
  loadPuzzle(currentPuzzleIndex);
};

/**
 * Load puzzle by index
 */
function loadPuzzle(index) {
  console.log('[Main] Loading puzzle:', index);

  // Get puzzle cells from pack
  const cells = packReader.getPuzzleCells(index);

  // Convert to piece format
  const pieces = convertCellsToPieces(cells);

  // Reset scene
  gameScene.resetPuzzle(pieces);

  // Reset and start timer
  timer.reset();
  timer.start();

  console.log('[Main] Puzzle loaded:', pieces.length, 'pieces');
}

/**
 * Convert cell indices to piece format
 * cells: [g1, g2a, g2b, ...] (grey cell linear indices)
 * @returns {Array} Pieces with grey + playable pieces
 */
function convertCellsToPieces(cells) {
  const greyPieces = cellsToGreyPieces(cells);
  const playablePieces = makePlayablePieces();

  return [...greyPieces, ...playablePieces];
}

/**
 * Convert grey cell indices to grey piece objects with board positions
 * @param {Array} cells - Linear indices [g1, g2a, g2b, ...]
 * @returns {Array} Grey pieces with {id, color, shape, auto, placed, boardR, boardC}
 */
function cellsToGreyPieces(cells) {
  return cells.map((linearIdx, i) => {
    const r = Math.floor(linearIdx / 8);
    const c = linearIdx % 8;

    return {
      id: `grey${i}`,
      color: 'grey',
      shape: [[1]], // 1x1 grey cell
      auto: true,
      placed: true,
      boardR: r,
      boardC: c
    };
  });
}

/**
 * Create playable (colored) pieces
 * Day 1 version: Hardcoded 3 pieces for testing
 * @returns {Array} Playable pieces
 */
function makePlayablePieces() {
  // Day 1: Hardcoded 3 colored pieces
  return [
    {
      id: 'red1',
      color: 'red',
      shape: [[1, 1], [1, 0]], // L-shape
      auto: false,
      placed: false,
      boardR: null,
      boardC: null
    },
    {
      id: 'blue1',
      color: 'blue',
      shape: [[1, 1, 1]], // I-shape (3 wide)
      auto: false,
      placed: false,
      boardR: null,
      boardC: null
    },
    {
      id: 'yellow1',
      color: 'yellow',
      shape: [[1, 1], [1, 1]], // O-shape (2x2)
      auto: false,
      placed: false,
      boardR: null,
      boardC: null
    }
  ];

  // Day 2: Will use PIECE_DEFINITIONS from octile-core
  // import { PIECE_DEFINITIONS } from './core/index.js';
  // return PIECE_DEFINITIONS.map((def, i) => ({
  //   id: `piece${i}`,
  //   color: def.color,
  //   shape: def.shape,
  //   auto: false,
  //   placed: false,
  //   boardR: null,
  //   boardC: null
  // }));
}

/**
 * Update timer display on canvas
 */
function updateTimerDisplay(seconds) {
  const ctx = canvas.getContext('2d');

  // Clear timer area
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, 360, 80);

  // Draw timer text
  ctx.fillStyle = '#ecf0f1';
  ctx.font = '24px Arial';
  ctx.textAlign = 'center';

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${minutes}:${secs.toString().padStart(2, '0')}`;

  ctx.fillText(timeStr, 180, 40);
  ctx.font = '14px Arial';
  ctx.fillText('TIME', 180, 60);
}

console.log('[Main] Game initialized');
