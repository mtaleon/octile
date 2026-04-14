/**
 * GameScene - Main game board scene
 * Renders 8x8 board and piece pool using Canvas 2D
 * Handles touch input with tap/drag separation
 */

import { initBoard, canPlace, placePiece, removePiece, getColorForCell, rotateShape } from '../core/index.js';

// Tap detection constants (Tightening A)
const TAP_TIME_MS = 300;   // Max time for tap (vs drag)
const TAP_DISTANCE_PX = 10; // Max movement for tap (vs drag)

// Helper: Find piece by ID
function getPieceById(pieces, id) {
  return pieces.find(p => p.id === id);
}

export class GameScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Layout constants
    this.cellSize = 40;
    this.boardOffsetX = 20;
    this.boardOffsetY = 80;
    this.poolCellSize = 20;
    this.poolOffsetY = 450;
    this.poolStartX = 20;
    this.poolSpacingX = 80;

    // Game state
    this.board = initBoard();
    this.pieces = [];
    this.targetFillCount = 64; // Updated in resetPuzzle
    this.onNextPuzzle = null; // Callback for next puzzle

    // Tap state (separate from drag to prevent conflicts)
    this.tap = {
      candidatePieceId: null,
      startTime: 0,
      startPos: null
    };

    // Input state machine
    this.inputState = {
      mode: 'idle', // 'idle' | 'dragging'
      activePieceId: null,
      hoverCell: null, // {r, c} | null
      dragStartPos: { x: 0, y: 0 }
    };

    // Win overlay state
    this.showingWinOverlay = false;
    this.nextButtonBounds = null; // {x, y, w, h}

    // Sanity check canvas size (Critical Risk 2.3)
    console.log('[GameScene] Canvas size:', canvas.width, 'x', canvas.height);
    console.log('[GameScene] Board bounds:',
      this.boardOffsetX,
      this.boardOffsetY,
      this.boardOffsetX + 8 * this.cellSize,
      this.boardOffsetY + 8 * this.cellSize);
    console.log('[GameScene] Pool bounds:', this.poolStartX, this.poolOffsetY);

    const requiredHeight = this.poolOffsetY + 100;
    if (requiredHeight > canvas.height) {
      console.warn('[GameScene] Layout might overflow canvas height!',
        'required:', requiredHeight, 'available:', canvas.height);
    }

    // Bind touch handlers
    canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
    canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
    canvas.addEventListener('touchend', this.onTouchEnd.bind(this));

    console.log('[GameScene] Initialized');
  }

  /**
   * Reset puzzle with new pieces (Critical Risk 2.2)
   * @param {Array} pieces - Piece objects with {id, color, shape, auto, placed, boardR, boardC}
   */
  resetPuzzle(pieces) {
    this.board = initBoard();
    this.pieces = pieces.map(p => ({
      ...p,
      rotation: 0,
      currentShape: p.shape,
      placed: !!p.placed,
      boardR: p.boardR ?? null,
      boardC: p.boardC ?? null,
    }));

    // CRITICAL: Place grey pieces on board (Critical Risk 2.2)
    for (const p of this.pieces) {
      if (p.auto && p.placed && p.boardR !== null && p.boardC !== null) {
        this.board[p.boardR][p.boardC] = p.id;
      }
    }

    // Grey/blocked cells count
    const greyCount = this.pieces.filter(p => p.auto).length;
    this.targetFillCount = 64 - greyCount;

    this.showingWinOverlay = false;
    this.nextButtonBounds = null;
    this.resetInputState();

    console.log('[GameScene] Puzzle reset, grey=', greyCount, 'target=', this.targetFillCount);
    this.render();
  }

  /**
   * Get normalized touch coordinates with sanity check
   */
  getTouchXY(touch) {
    const x = touch.x ?? touch.clientX ?? touch.pageX ?? 0;
    const y = touch.y ?? touch.clientY ?? touch.pageY ?? 0;

    // Sanity check: coords should be within canvas bounds
    if (x < 0 || x > this.canvas.width || y < 0 || y > this.canvas.height) {
      console.warn('[Touch] Coords outside canvas:', x, y,
        'canvas:', this.canvas.width, 'x', this.canvas.height);
    }

    return { x, y };
  }

  /**
   * Convert screen coords to board cell
   * @returns {{r: number, c: number} | null}
   */
  screenToBoardCell(x, y) {
    const boardX = x - this.boardOffsetX;
    const boardY = y - this.boardOffsetY;

    if (boardX >= 0 && boardX < 8 * this.cellSize &&
        boardY >= 0 && boardY < 8 * this.cellSize) {
      const c = Math.floor(boardX / this.cellSize);
      const r = Math.floor(boardY / this.cellSize);
      return { r, c };
    }
    return null;
  }

  /**
   * Get piece ID at board cell
   * @returns {string | null}
   */
  screenToBoardPieceId(x, y) {
    const cell = this.screenToBoardCell(x, y);
    if (!cell) return null;
    return this.board[cell.r][cell.c];
  }

  /**
   * Get piece ID in pool at screen coords (Day 1 simple version)
   * @returns {string | null}
   */
  screenToPoolPiece(x, y) {
    const poolY = this.poolOffsetY;
    let poolX = this.poolStartX;

    for (const piece of this.pieces) {
      if (piece.placed || piece.auto) continue;

      const shape = piece.currentShape || piece.shape;
      // Day 1 simple: use shape dimensions
      const w = shape[0].length * this.poolCellSize;
      const h = shape.length * this.poolCellSize;

      if (x >= poolX && x < poolX + w &&
          y >= poolY && y < poolY + h) {
        return piece.id;
      }

      poolX += this.poolSpacingX;
    }
    return null;
  }

  /**
   * Reset input state (Tightening #2, B)
   */
  resetInputState() {
    this.inputState.mode = 'idle';
    this.inputState.activePieceId = null;
    this.inputState.hoverCell = null;
    this.inputState.dragStartPos = { x: 0, y: 0 };

    // Clear tap state to prevent stale data
    this.tap.candidatePieceId = null;
    this.tap.startTime = 0;
    this.tap.startPos = null;
  }

  /**
   * Handle touch start
   */
  onTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = this.getTouchXY(touch);

    // If win overlay showing, check Next button
    if (this.showingWinOverlay && this.nextButtonBounds) {
      const btn = this.nextButtonBounds;
      if (x >= btn.x && x < btn.x + btn.w && y >= btn.y && y < btn.y + btn.h) {
        this.loadNextPuzzle();
        return;
      }
    }

    // Check board for piece pick-up
    const boardPieceId = this.screenToBoardPieceId(x, y);
    if (boardPieceId) {
      const piece = getPieceById(this.pieces, boardPieceId);
      if (piece && piece.placed) {
        // Guard: Grey/blocked cells cannot be picked up (Compatibility Risk 2.3)
        if (piece.auto) {
          console.log('[PickUp] Blocked: grey cell cannot be moved');
          return;
        }

        // Pick up placed piece
        removePiece(this.board, piece.id);
        piece.placed = false;
        piece.boardR = null;
        piece.boardC = null;

        // Enter drag mode (Tightening #3: init hoverCell)
        this.inputState.mode = 'dragging';
        this.inputState.activePieceId = piece.id;
        this.inputState.dragStartPos = { x, y };
        this.inputState.hoverCell = this.screenToBoardCell(x, y);

        console.log('[PickUp] From board:', piece.id);
        this.render();
        return;
      }
    }

    // Check pool for piece tap/drag
    const poolPieceId = this.screenToPoolPiece(x, y);
    if (poolPieceId) {
      // Start tap candidate
      this.tap.candidatePieceId = poolPieceId;
      this.tap.startTime = Date.now();
      this.tap.startPos = { x, y };

      console.log('[Touch] Pool piece candidate:', poolPieceId);
      return;
    }
  }

  /**
   * Handle touch move
   */
  onTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = this.getTouchXY(touch);

    // If tap candidate exists, check if moved too far (convert to drag)
    if (this.tap.candidatePieceId && this.tap.startPos) {
      const dx = x - this.tap.startPos.x;
      const dy = y - this.tap.startPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > TAP_DISTANCE_PX) {
        // Convert tap to drag
        console.log('[Touch] Convert tap to drag:', this.tap.candidatePieceId);

        this.inputState.mode = 'dragging';
        this.inputState.activePieceId = this.tap.candidatePieceId;
        this.inputState.dragStartPos = { ...this.tap.startPos };
        this.inputState.hoverCell = this.screenToBoardCell(x, y);

        // Clear tap state
        this.tap.candidatePieceId = null;
        this.tap.startTime = 0;
        this.tap.startPos = null;
      }
    }

    // Update hover cell during drag
    if (this.inputState.mode === 'dragging') {
      this.inputState.hoverCell = this.screenToBoardCell(x, y);
      this.render();
    }
  }

  /**
   * Handle touch end
   */
  onTouchEnd(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const { x, y } = this.getTouchXY(touch);

    // Check if this is a tap (Tightening #1: using constants)
    const isTap =
      this.tap.candidatePieceId &&
      Date.now() - this.tap.startTime < TAP_TIME_MS &&
      this.tap.startPos &&
      Math.abs(x - this.tap.startPos.x) < TAP_DISTANCE_PX &&
      Math.abs(y - this.tap.startPos.y) < TAP_DISTANCE_PX;

    if (isTap) {
      // Handle rotation tap
      const piece = getPieceById(this.pieces, this.tap.candidatePieceId);
      if (piece && !piece.placed && !piece.auto) {
        piece.rotation = (piece.rotation + 1) % 4;
        piece.currentShape = rotateShape(piece.shape, piece.rotation);
        console.log('[Rotate]', piece.id, 'rot=', piece.rotation);
        this.render();
      }

      this.resetInputState();
      return;
    }

    // Handle drag drop
    if (this.inputState.mode === 'dragging' && this.inputState.activePieceId) {
      const piece = getPieceById(this.pieces, this.inputState.activePieceId);
      const cell = this.screenToBoardCell(x, y);

      if (piece && cell) {
        const shape = piece.currentShape || piece.shape;

        if (canPlace(this.board, shape, cell.r, cell.c)) {
          // Successful placement
          placePiece(this.board, shape, cell.r, cell.c, piece.id);
          piece.placed = true;
          piece.boardR = cell.r;
          piece.boardC = cell.c;

          console.log('[Place]', piece.id, 'at', cell.r, cell.c);

          // Check win condition
          if (this.checkWin()) {
            console.log('[Win] Solved!');
            this.showWinOverlay();
          }
        } else {
          console.log('[Place] Invalid placement, piece returned to pool');
        }
      }

      this.resetInputState();
      this.render();
    } else {
      // No drag, just clear state
      this.resetInputState();
    }
  }

  /**
   * Check win condition (Day 1 version - Critical Risk 2.1)
   * Win = all non-auto (playable) pieces are placed
   */
  checkWin() {
    return this.pieces
      .filter(p => !p.auto)
      .every(p => p.placed);
  }

  /**
   * Show win overlay
   */
  showWinOverlay() {
    this.showingWinOverlay = true;

    // Define Next button bounds for hit-test
    const btnW = 120;
    const btnH = 50;
    this.nextButtonBounds = {
      x: (this.canvas.width - btnW) / 2,
      y: 250,
      w: btnW,
      h: btnH
    };

    this.render();
  }

  /**
   * Load next puzzle
   */
  loadNextPuzzle() {
    console.log('[GameScene] Next puzzle requested');
    this.showingWinOverlay = false;
    this.nextButtonBounds = null;

    if (this.onNextPuzzle) {
      this.onNextPuzzle();
    }
  }

  /**
   * Render the entire scene
   */
  render() {
    const { ctx, canvas } = this;

    // Clear canvas
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render board
    this.renderBoard();

    // Render hover highlight
    if (this.inputState.hoverCell && this.inputState.mode === 'dragging') {
      this.renderHover();
    }

    // Render piece pool
    this.renderPool();

    // Render win overlay (if showing)
    if (this.showingWinOverlay) {
      this.renderWinOverlay();
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
          const color = getColorForCell(board, pieces, r, c);
          ctx.fillStyle = this.getColorHex(color) || '#666';
          ctx.fillRect(x, y, cellSize, cellSize);
        } else {
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(x, y, cellSize, cellSize);
        }

        ctx.strokeStyle = '#0f3460';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellSize, cellSize);
      }
    }
  }

  /**
   * Render hover highlight
   */
  renderHover() {
    if (!this.inputState.hoverCell || !this.inputState.activePieceId) return;

    const { ctx, cellSize, boardOffsetX, boardOffsetY } = this;
    const { r, c } = this.inputState.hoverCell;
    const piece = getPieceById(this.pieces, this.inputState.activePieceId);

    if (!piece) return;

    const shape = piece.currentShape || piece.shape;
    const canPlaceHere = canPlace(this.board, shape, r, c);

    // Draw preview of piece placement
    ctx.globalAlpha = 0.5;
    for (let dr = 0; dr < shape.length; dr++) {
      for (let dc = 0; dc < shape[dr].length; dc++) {
        if (!shape[dr][dc]) continue;

        const x = boardOffsetX + (c + dc) * cellSize;
        const y = boardOffsetY + (r + dr) * cellSize;

        ctx.fillStyle = canPlaceHere ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
    ctx.globalAlpha = 1.0;
  }

  /**
   * Render piece pool
   */
  renderPool() {
    const { ctx, pieces, poolCellSize, poolOffsetY, poolStartX, poolSpacingX } = this;
    let poolX = poolStartX;

    for (const piece of pieces) {
      if (piece.placed || piece.auto) continue;

      // Skip if currently dragging this piece
      if (this.inputState.mode === 'dragging' && piece.id === this.inputState.activePieceId) {
        poolX += poolSpacingX;
        continue;
      }

      const shape = piece.currentShape || piece.shape;
      const color = this.getColorHex(piece.color);

      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;

          ctx.fillStyle = color;
          ctx.fillRect(poolX + c * poolCellSize, poolOffsetY + r * poolCellSize,
                       poolCellSize, poolCellSize);

          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.strokeRect(poolX + c * poolCellSize, poolOffsetY + r * poolCellSize,
                         poolCellSize, poolCellSize);
        }
      }

      poolX += poolSpacingX;
    }
  }

  /**
   * Render win overlay
   */
  renderWinOverlay() {
    const { ctx, canvas, nextButtonBounds } = this;

    // Semi-transparent backdrop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // "You Win!" text
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('You Win!', canvas.width / 2, 200);

    // Next button
    if (nextButtonBounds) {
      ctx.fillStyle = '#3498db';
      ctx.fillRect(nextButtonBounds.x, nextButtonBounds.y,
                   nextButtonBounds.w, nextButtonBounds.h);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Next',
        nextButtonBounds.x + nextButtonBounds.w / 2,
        nextButtonBounds.y + nextButtonBounds.h / 2 + 7);
    }

    ctx.textAlign = 'left';
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
}
