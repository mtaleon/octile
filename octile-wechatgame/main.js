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

// Load puzzle from MiniPack
const packReader = new PackReader(GameGlobal.miniPackBuffer);
const cells = packReader.getPuzzleCells(1); // Puzzle 1 (SYNC)

// Convert cells to pieces format expected by GameScene
const pieces = convertCellsToPieces(cells);
gameScene.setPieces(pieces);

// Initialize timer
const timer = new Timer(GameGlobal.timeSource);
timer.start();

console.log('[Main] Game initialized, puzzle loaded');

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

/**
 * Convert cell indices to piece format
 * cells: [g1, g2a, g2b, g3a, g3b, g3c] (6 grey cells)
 */
function convertCellsToPieces(cells) {
  // TODO: Import PIECE_DEFINITIONS from octile-core
  // For now, create simplified pieces
  return [
    { id: 'g1', color: 'grey', shape: [[1]], placed: false, boardR: null, boardC: null, auto: true },
    { id: 'g2a', color: 'grey', shape: [[1]], placed: false, boardR: null, boardC: null, auto: true },
    { id: 'g2b', color: 'grey', shape: [[1]], placed: false, boardR: null, boardC: null, auto: true },
    { id: 'g3a', color: 'grey', shape: [[1]], placed: false, boardR: null, boardC: null, auto: true },
    { id: 'g3b', color: 'grey', shape: [[1]], placed: false, boardR: null, boardC: null, auto: true },
    { id: 'g3c', color: 'grey', shape: [[1]], placed: false, boardR: null, boardC: null, auto: true },
    // Add colored pieces (red, blue, yellow, white)
    { id: 'r1', color: 'red', shape: [[1,1],[1,0]], placed: false, boardR: null, boardC: null, auto: false },
    { id: 'b1', color: 'blue', shape: [[1,1,1]], placed: false, boardR: null, boardC: null, auto: false },
    { id: 'y1', color: 'yellow', shape: [[1,1],[1,1]], placed: false, boardR: null, boardC: null, auto: false },
  ];
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
