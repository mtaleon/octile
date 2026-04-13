import { transformCell, TRANSFORMS } from '../src/puzzle/transforms.js';

describe('D4 Transforms', () => {
  test('ROT180 transforms corner to opposite corner', () => {
    // Top-left (0,0) = cell 0 → bottom-right (7,7) = cell 63
    expect(transformCell(0, TRANSFORMS.ROT180)).toBe(63);
    expect(transformCell(63, TRANSFORMS.ROT180)).toBe(0);
  });

  test('ROT90 transforms top-left to top-right', () => {
    // (0,0) → (0,7) = cell 7
    expect(transformCell(0, TRANSFORMS.ROT90)).toBe(7);
  });

  test('IDENTITY preserves cell', () => {
    expect(transformCell(0, TRANSFORMS.IDENTITY)).toBe(0);
    expect(transformCell(31, TRANSFORMS.IDENTITY)).toBe(31);
  });

  test('FLIP_H flips horizontally', () => {
    // (0,0) → (0,7) = cell 7
    expect(transformCell(0, TRANSFORMS.FLIP_H)).toBe(7);
    // (0,7) → (0,0) = cell 0
    expect(transformCell(7, TRANSFORMS.FLIP_H)).toBe(0);
  });

  test('FLIP_V flips vertically', () => {
    // (0,0) → (7,0) = cell 56
    expect(transformCell(0, TRANSFORMS.FLIP_V)).toBe(56);
    // (7,0) → (0,0) = cell 0
    expect(transformCell(56, TRANSFORMS.FLIP_V)).toBe(0);
  });

  test('ROT270 transforms correctly', () => {
    // (0,0) → (7,0) cell 56 (270° = -90°)
    expect(transformCell(0, TRANSFORMS.ROT270)).toBe(56);
  });

  test('FLIP_D1 flips along main diagonal', () => {
    // (0,1) → (1,0) cell 8
    expect(transformCell(1, TRANSFORMS.FLIP_D1)).toBe(8);
  });

  test('FLIP_D2 flips along anti-diagonal', () => {
    // (0,0) → (7,7) cell 63
    expect(transformCell(0, TRANSFORMS.FLIP_D2)).toBe(63);
  });
});
