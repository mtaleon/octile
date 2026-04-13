import { PackReader, MINIPACK_DATA, MINIPACK_BASE_INDICES } from '../src/puzzle/pack-reader.js';
import { MockCryptoProvider } from './mocks/mock-crypto-provider.js';

function createMiniPackReader() {
  // Node.js doesn't have atob - use Buffer
  const buf = Buffer.from(MINIPACK_DATA, 'base64');
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new PackReader(arrayBuffer);
}

describe('PackReader', () => {
  test('parses MiniPack header', () => {
    const reader = createMiniPackReader();
    expect(reader.puzzleCount).toBe(99);
    expect(reader.version).toBeGreaterThanOrEqual(0); // Version can be 0
    expect(reader.hasOrdering).toBe(false); // MiniPack has no ordering
  });

  test('decodePuzzle returns 6 cell indices', () => {
    const reader = createMiniPackReader();
    const cells = reader.decodePuzzle(0); // First puzzle in pack

    expect(cells).toHaveLength(6);
    cells.forEach(cell => {
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(64);
    });
  });

  test('getPuzzleCells is sync and returns 6 cell indices', () => {
    const reader = createMiniPackReader();
    // Get first base puzzle (base index 0) with no transform
    const firstBaseIndex = MINIPACK_BASE_INDICES[0];
    const puzzleNumber = firstBaseIndex + 1; // 1-based

    const cells = reader.getPuzzleCells(puzzleNumber);

    expect(cells).toHaveLength(6);
    cells.forEach(cell => {
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(64);
    });
  });

  test('getPuzzleCells with transform applies D4 symmetry', () => {
    const reader = createMiniPackReader();
    const firstBaseIndex = MINIPACK_BASE_INDICES[0];

    // Get base puzzle (transform 0)
    const basePuzzle = firstBaseIndex + 1;
    const baseCells = reader.getPuzzleCells(basePuzzle);

    // Get same puzzle with ROT180 transform (transform 2)
    const transform2Puzzle = 2 * 11378 + firstBaseIndex + 1;
    const transformedCells = reader.getPuzzleCells(transform2Puzzle);

    expect(baseCells).not.toEqual(transformedCells);
    expect(transformedCells).toHaveLength(6);
  });

  test('canDecode returns true for puzzles in pack', () => {
    const reader = createMiniPackReader();
    const firstBaseIndex = MINIPACK_BASE_INDICES[0];
    const puzzleNumber = firstBaseIndex + 1;

    expect(reader.canDecode(puzzleNumber)).toBe(true);
  });

  test('canDecode returns false for puzzles not in pack', () => {
    const reader = createMiniPackReader();
    // Pick a base index not in MINIPACK_BASE_INDICES
    const missingBaseIndex = 3; // Not in the first few indices
    if (MINIPACK_BASE_INDICES.indexOf(missingBaseIndex) === -1) {
      const puzzleNumber = missingBaseIndex + 1;
      expect(reader.canDecode(puzzleNumber)).toBe(false);
    }
  });

  test('decompose splits puzzle number into base and transform', () => {
    const reader = createMiniPackReader();

    // Puzzle 1 = base 0, transform 0
    expect(reader.decompose(1)).toEqual([0, 0]);

    // Puzzle 11379 = base 0, transform 1
    expect(reader.decompose(11379)).toEqual([0, 1]);

    // Puzzle 22757 = base 0, transform 2
    expect(reader.decompose(22757)).toEqual([0, 2]);
  });

  test('getRandomPuzzleNumber returns valid puzzle', () => {
    const reader = createMiniPackReader();
    const randomPuzzle = reader.getRandomPuzzleNumber();

    expect(randomPuzzle).toBeGreaterThanOrEqual(1);
    expect(reader.canDecode(randomPuzzle)).toBe(true);
  });

  test('verifySignature returns result object', () => {
    const reader = createMiniPackReader();
    const publicKey = new Uint8Array(32); // Mock public key

    const result = reader.verifySignature(publicKey);
    expect(result).toHaveProperty('verified');
    expect(result).toHaveProperty('reason');
  });

  test('verifySignature fails when no crypto provider', () => {
    const reader = createMiniPackReader(); // No crypto
    const publicKey = new Uint8Array(32);

    const result = reader.verifySignature(publicKey);
    expect(result.verified).toBe(false);
    expect(result.reason).toBe('NO_CRYPTO');
  });

  test('verifySignature fails with invalid signature', () => {
    const buf = Buffer.from(MINIPACK_DATA, 'base64');
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const crypto = new MockCryptoProvider(false); // Returns false
    const reader = new PackReader(arrayBuffer, crypto);
    const publicKey = new Uint8Array(32);

    const result = reader.verifySignature(publicKey);
    expect(result.verified).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  test('verifySignature succeeds with valid signature', () => {
    const buf = Buffer.from(MINIPACK_DATA, 'base64');
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const crypto = new MockCryptoProvider(true); // Returns true
    const reader = new PackReader(arrayBuffer, crypto);
    const publicKey = new Uint8Array(32);

    const result = reader.verifySignature(publicKey);
    expect(result.verified).toBe(true);
    expect(result.reason).toBeNull();
  });

  test('getBaseIndices returns array for MiniPack', () => {
    const reader = createMiniPackReader();
    const indices = reader.getBaseIndices();

    expect(indices).toEqual(MINIPACK_BASE_INDICES);
    expect(indices.length).toBeGreaterThan(0); // MiniPack has base indices
  });
});
