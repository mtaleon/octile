/**
 * Board constants
 */
export const BOARD_SIZE = 8;

/**
 * Rotate a piece shape 90° clockwise
 * @param {number[][]} shape - 2D array representing piece shape
 * @returns {number[][]} Rotated shape
 */
export function rotateShape(shape) {
  const rows = shape.length, cols = shape[0].length;
  const rotated = [];
  for (let c = 0; c < cols; c++) {
    rotated[c] = [];
    for (let r = rows - 1; r >= 0; r--) {
      rotated[c].push(shape[r][c]);
    }
  }
  return rotated;
}

/**
 * Initialize an empty 8×8 board
 * @returns {(string|null)[][]} 8×8 board filled with null
 */
export function initBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

/**
 * Check if a piece can be placed at given position
 * @param {(string|null)[][]} board - Current board state
 * @param {number[][]} shape - Piece shape
 * @param {number} startR - Starting row
 * @param {number} startC - Starting column
 * @param {string|null} ignorePieceId - Piece ID to ignore (for drag/drop)
 * @returns {boolean} True if placement is valid
 */
export function canPlace(board, shape, startR, startC, ignorePieceId) {
  const rows = shape.length, cols = shape[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!shape[r][c]) continue;
      const br = startR + r, bc = startC + c;
      if (br < 0 || br >= BOARD_SIZE || bc < 0 || bc >= BOARD_SIZE) return false;
      if (board[br][bc] !== null && board[br][bc] !== ignorePieceId) return false;
    }
  }
  return true;
}

/**
 * Place a piece on the board (mutates board)
 * @param {(string|null)[][]} board - Current board state
 * @param {number[][]} shape - Piece shape
 * @param {number} startR - Starting row
 * @param {number} startC - Starting column
 * @param {string} pieceId - Piece identifier
 */
export function placePiece(board, shape, startR, startC, pieceId) {
  const rows = shape.length, cols = shape[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!shape[r][c]) continue;
      board[startR + r][startC + c] = pieceId;
    }
  }
}

/**
 * Remove a piece from the board (mutates board)
 * @param {(string|null)[][]} board - Current board state
 * @param {string} pieceId - Piece identifier to remove
 */
export function removePiece(board, pieceId) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === pieceId) board[r][c] = null;
    }
  }
}

/**
 * Get piece object by ID
 * @param {Array} pieces - Array of piece objects
 * @param {string} id - Piece ID
 * @returns {Object|undefined} Piece object or undefined
 */
export function getPieceById(pieces, id) {
  return pieces.find(p => p.id === id);
}

/**
 * Get color for a cell on the board
 * @param {(string|null)[][]} board - Current board state
 * @param {Array} pieces - Array of piece objects
 * @param {number} r - Row index
 * @param {number} c - Column index
 * @returns {string|null} Color string or null
 */
export function getColorForCell(board, pieces, r, c) {
  const pid = board[r][c];
  if (!pid) return null;
  const p = getPieceById(pieces, pid);
  return p ? p.color : null;
}
