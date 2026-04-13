import { SOLVER_PIECES, BOARD_SIZE } from './types.js';

/**
 * Get all unique rotations of a piece
 * @param {Array<[number, number]>} cells - Array of [row, col] coordinates
 * @returns {Array<Array<[number, number]>>} Array of unique rotations
 */
export function solverGetRotations(cells) {
  const seen = new Set();
  const results = [];
  let cur = cells;

  for (let r = 0; r < 4; r++) {
    const minR = Math.min(...cur.map(c => c[0]));
    const minC = Math.min(...cur.map(c => c[1]));
    const norm = cur.map(c => [c[0] - minR, c[1] - minC]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const key = norm.toString();

    if (!seen.has(key)) {
      seen.add(key);
      results.push(norm);
    }

    // Rotate 90° clockwise
    cur = cur.map(c => [c[1], -c[0]]);
  }

  return results;
}

/**
 * Pre-compute all rotations for solver pieces
 */
export const SOLVER_SHAPES = SOLVER_PIECES.map(p => ({
  id: p.id,
  rotations: solverGetRotations(p.base)
}));

/**
 * Solve a puzzle using backtracking
 * @param {(string|null)[][]} greyBoard - Board with grey pieces already placed
 * @returns {(string|null)[][]} Solved board or original if no solution
 */
export function solvePuzzle(greyBoard) {
  const bd = greyBoard.map(r => [...r]);
  const placed = new Array(SOLVER_SHAPES.length).fill(false);

  function solve() {
    // Find first empty cell
    let er = -1, ec = -1;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!bd[r][c]) {
          er = r;
          ec = c;
          r = BOARD_SIZE; // Break outer loop
          break;
        }
      }
    }

    // No empty cells - solved!
    if (er === -1) return true;

    // Try each unplaced piece
    for (let pi = 0; pi < SOLVER_SHAPES.length; pi++) {
      if (placed[pi]) continue;

      const sp = SOLVER_SHAPES[pi];

      // Try each rotation
      for (const rot of sp.rotations) {
        // Try each anchor cell in rotation
        for (const [ar, ac] of rot) {
          const offR = er - ar;
          const offC = ec - ac;

          // Check if piece fits
          let fits = true;
          for (const [sr, sc] of rot) {
            const r = sr + offR;
            const c = sc + offC;
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || bd[r][c]) {
              fits = false;
              break;
            }
          }

          if (!fits) continue;

          // Place piece
          placed[pi] = true;
          for (const [sr, sc] of rot) {
            bd[sr + offR][sc + offC] = sp.id;
          }

          // Recurse
          if (solve()) return true;

          // Backtrack
          placed[pi] = false;
          for (const [sr, sc] of rot) {
            bd[sr + offR][sc + offC] = null;
          }
        }
      }
    }

    return false;
  }

  solve();
  return bd;
}
