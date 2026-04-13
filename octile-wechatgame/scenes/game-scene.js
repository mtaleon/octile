/**
 * GameScene - Main game board scene
 * Renders 8x8 board and piece pool using Canvas 2D
 * Handles touch input for piece placement
 */

import { initBoard, canPlace, placePiece, removePiece, getColorForCell } from '../core/index.js';

export class GameScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Game state
    this.board = initBoard();
    this.pieces = [];
    this.cellSize = 40;
    this.boardOffsetX = 20;
    this.boardOffsetY = 100;

    // Touch state
    this.draggedPiece = null;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // Bind touch handlers
    canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
    canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
    canvas.addEventListener('touchend', this.onTouchEnd.bind(this));

    console.log('[GameScene] Initialized');
  }

  /**
   * Set puzzle pieces for current puzzle
   * @param {Array} pieces - Array of piece objects with {id, color, shape, placed, boardR, boardC}
   */
  setPieces(pieces) {
    this.pieces = pieces;
  }

  /**
   * Render the entire scene
   */
  render() {
    const { ctx, canvas } = this;

    // Clear canvas
    ctx.fillStyle = '#16213e'; // Dark background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render board
    this.renderBoard();

    // Render piece pool
    this.renderPiecePool();

    // Render dragged piece (if any)
    if (this.draggedPiece) {
      this.renderDraggedPiece();
    }
  }

  /**
   * Render the 8x8 game board
   */
  renderBoard() {
    const { ctx, board, pieces, cellSize, boardOffsetX, boardOffsetY } = this;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const x = boardOffsetX + c * cellSize;
        const y = boardOffsetY + r * cellSize;
        const pieceId = board[r][c];

        if (pieceId) {
          // Draw filled cell
          const color = getColorForCell(board, pieces, r, c);
          ctx.fillStyle = this.getColorHex(color) || '#666';
          ctx.fillRect(x, y, cellSize, cellSize);
        } else {
          // Draw empty cell
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(x, y, cellSize, cellSize);
        }

        // Draw grid border
        ctx.strokeStyle = '#0f3460';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellSize, cellSize);
      }
    }
  }

  /**
   * Render piece pool at bottom of screen
   */
  renderPiecePool() {
    const { ctx, pieces } = this;
    const poolY = 450; // Below board
    let poolX = 20;

    for (const piece of pieces) {
      if (piece.placed || piece.auto) continue; // Skip placed and auto (grey) pieces

      this.renderPieceInPool(piece, poolX, poolY);
      poolX += 80; // Spacing between pieces
    }
  }

  /**
   * Render a single piece in the pool
   */
  renderPieceInPool(piece, x, y) {
    const { ctx } = this;
    const shape = piece.currentShape || piece.shape;
    const cellSize = 20; // Smaller for pool

    const color = this.getColorHex(piece.color);

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;

        ctx.fillStyle = color;
        ctx.fillRect(x + c * cellSize, y + r * cellSize, cellSize, cellSize);

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + c * cellSize, y + r * cellSize, cellSize, cellSize);
      }
    }
  }

  /**
   * Render piece being dragged
   */
  renderDraggedPiece() {
    // TODO: Implement ghost preview
  }

  /**
   * Handle touch start
   */
  onTouchStart(e) {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    console.log('[GameScene] Touch start:', x, y);

    // Check if touching the board
    const boardX = x - this.boardOffsetX;
    const boardY = y - this.boardOffsetY;

    if (boardX >= 0 && boardX < 8 * this.cellSize &&
        boardY >= 0 && boardY < 8 * this.cellSize) {
      const col = Math.floor(boardX / this.cellSize);
      const row = Math.floor(boardY / this.cellSize);

      const pieceId = this.board[row][col];
      if (pieceId) {
        // Start dragging a placed piece (for removal/repositioning)
        console.log('[GameScene] Start drag from board:', pieceId, row, col);
        this.draggedPiece = { id: pieceId, fromBoard: true };
        removePiece(this.board, pieceId);
        this.render();
      }
    }

    // TODO: Check if touching piece pool
  }

  /**
   * Handle touch move
   */
  onTouchMove(e) {
    if (!this.draggedPiece) return;

    const touch = e.touches[0];
    // TODO: Update ghost preview position
  }

  /**
   * Handle touch end
   */
  onTouchEnd(e) {
    if (!this.draggedPiece) return;

    const touch = e.changedTouches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    console.log('[GameScene] Touch end:', x, y);

    // Check if dropped on board
    const boardX = x - this.boardOffsetX;
    const boardY = y - this.boardOffsetY;

    if (boardX >= 0 && boardX < 8 * this.cellSize &&
        boardY >= 0 && boardY < 8 * this.cellSize) {
      const col = Math.floor(boardX / this.cellSize);
      const row = Math.floor(boardY / this.cellSize);

      console.log('[GameScene] Try place at:', row, col);

      // TODO: Try to place piece at this position
      // For now, just clear drag state
    }

    this.draggedPiece = null;
    this.render();
  }

  /**
   * Convert color name to hex
   */
  getColorHex(colorName) {
    const colors = {
      'grey': '#888888',
      'red': '#e74c3c',
      'white': '#ecf0f1',
      'blue': '#3498db',
      'yellow': '#f1c40f'
    };
    return colors[colorName] || colorName;
  }

  /**
   * Check if puzzle is solved
   */
  checkWin() {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] === null) return false;
      }
    }
    return true;
  }
}
