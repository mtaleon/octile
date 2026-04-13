// D4 dihedral group: 8 symmetries (identity, 3 rotations, 4 flips)
export const TRANSFORMS = {
  IDENTITY: 0,
  ROT90: 1,
  ROT180: 2,
  ROT270: 3,
  FLIP_H: 4,
  FLIP_V: 5,
  FLIP_D1: 6,
  FLIP_D2: 7
};

/**
 * Transform a cell index (0-63) according to D4 symmetry
 * @param {number} cell - Cell index (0-63) on 8×8 board
 * @param {number} transform - Transform ID from TRANSFORMS enum
 * @returns {number} Transformed cell index
 */
export function transformCell(cell, transform) {
  // cell: 0-63 (8×8 board index)
  // Returns transformed cell index
  const r = Math.floor(cell / 8);
  const c = cell % 8;
  let nr = r, nc = c;

  switch (transform) {
    case 0: break; // identity
    case 1: nr = c; nc = 7 - r; break; // rotate 90° CW
    case 2: nr = 7 - r; nc = 7 - c; break; // rotate 180°
    case 3: nr = 7 - c; nc = r; break; // rotate 270° CW
    case 4: nc = 7 - c; break; // flip horizontal
    case 5: nr = 7 - r; break; // flip vertical
    case 6: nr = c; nc = r; break; // flip diagonal \
    case 7: nr = 7 - c; nc = 7 - r; break; // flip diagonal /
  }

  return nr * 8 + nc;
}

/**
 * Apply transform to array of cell indices
 * @param {number[]} cells - Array of cell indices [g1, g2a, g2b, g3a, g3b, g3c]
 * @param {number} transform - Transform ID from TRANSFORMS enum
 * @returns {number[]} Array of transformed cell indices
 */
export function applyCellTransform(cells, transform) {
  return cells.map(cell => transformCell(cell, transform));
}
