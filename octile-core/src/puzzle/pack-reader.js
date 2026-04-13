import { transformCell } from './transforms.js';

/**
 * Number of base puzzles in the full catalog
 */
export const PUZZLE_COUNT_BASE = 11378;

/**
 * MiniPack embedded data (base64)
 * Contains 99 base puzzles (792 extended with transforms)
 */
export const MINIPACK_DATA = 'T1BLMQAAAABjAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApIiErIiEuIiEvIiFiIiFGIiFJIiElIyEmIyFQIiF3IyF6IyEpJCEqJCFXIyFYKCFbKCE4KSE5KSE8XyE/XyFvXiFMXyFOXyFhXyFbYCFAYiEmLCF1LyFSMCFkNyEpcyFsciFHRiFXJiJjTCEzPSIjIiNUSiJhTSJZLCNEVyI4ZCJbZCJ0VyN4OSQtXyMmYyNbPyRyQiRmaSNeaiMwUyQ1IiQwKiRnKyRzSyV9eyRZeyQqVyVRfCQyJSVsWyUtXSVAJiVwJiUyKiVBKiVDbSVhLiVzdCVYKCYlSCVASiVxfi5OYi9aZS9Rby9qcy8udC9FWjBVLjAkMTBNPDAueDBXSDBmUjAxVzA9VzBRITtHJDs9RTp9Rzp2Mzt8QTs7QjsuYzpZZTohQ0UBAQEBAQEBAQEDAQEBAQIBAQEBAQEBAQEBAwMCAgIEAwQEBAICAwICAgICAgIDAgICAgMDBAMBBAMCAgIDAwIDAgMCAwQDBAEDBAQDBAQEBAQDAgQEBAEDBAMEAwQEAwMDBAQ=';

/**
 * MiniPack base indices (sorted list of which base puzzles are included)
 */
export const MINIPACK_BASE_INDICES = [0,1,2,4,9,10,14,15,57,60,64,65,72,86,88,93,94,98,231,234,238,239,278,281,289,294,296,308,333,382,557,667,670,952,1016,1034,1539,1561,1683,1877,2068,2099,2122,2167,2231,2449,2461,2748,2873,2919,2974,3053,3103,3205,3222,3530,3970,4137,4345,4602,4751,4765,4771,4904,4960,4984,5012,5141,5171,5196,5199,5440,5462,5698,6206,6358,6412,6633,6673,6730,6837,6860,6867,7089,7224,7240,7497,7575,7899,8274,8358,8363,9230,9309,9331,9388,9860,10316,10512,10540];

/**
 * Base-92 character code map for decoding
 */
const BASE92_ALPHABET = '!"#$%&()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~';
const BASE92_MAP = {};
for (let i = 0; i < BASE92_ALPHABET.length; i++) {
  BASE92_MAP[BASE92_ALPHABET.charCodeAt(i)] = i;
}

/**
 * PackReader class for reading puzzle pack files
 * Supports both FullPack (11,378 base puzzles) and MiniPack (99 base puzzles)
 */
export class PackReader {
  /**
   * Create a PackReader from binary pack data
   * @param {ArrayBuffer} buffer - Binary pack data (OPK1 format)
   * @param {Object} cryptoProvider - Optional crypto provider for signature verification
   */
  constructor(buffer, cryptoProvider = null) {
    const view = new DataView(buffer);

    // Validate magic number
    const magic = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    if (magic !== 'OPK1') {
      throw new Error('Invalid pack magic: ' + magic);
    }

    this.version = view.getUint32(4, true);
    this.puzzleCount = view.getUint32(8, true);
    this.schema = view.getUint16(12, true);
    this.hasOrdering = !!(view.getUint8(14) & 1);
    this.signature = new Uint8Array(buffer, 16, 64);
    this.cryptoProvider = cryptoProvider;

    const dataStart = 80;
    this._puzzleData = new Uint8Array(buffer, dataStart, this.puzzleCount * 3);
    this._diffLevels = new Uint8Array(buffer, dataStart + this.puzzleCount * 3, this.puzzleCount);
    this._buffer = buffer;

    // Parse ordering if present (FullPack only)
    this._levelCounts = null;  // [easy, medium, hard, hell]
    this._levelOrdering = null; // {1: Uint16Array, 2: ..., 3: ..., 4: ...}
    if (this.hasOrdering) {
      const ordStart = dataStart + this.puzzleCount * 4;
      const ov = new DataView(buffer, ordStart);
      this._levelCounts = [
        ov.getUint16(0, true), ov.getUint16(2, true),
        ov.getUint16(4, true), ov.getUint16(6, true)
      ];
      this._levelOrdering = {};
      let offset = 8;
      for (let li = 1; li <= 4; li++) {
        const count = this._levelCounts[li - 1];
        const arr = new Uint16Array(count);
        for (let j = 0; j < count; j++) {
          arr[j] = ov.getUint16(offset, true);
          offset += 2;
        }
        this._levelOrdering[li] = arr;
      }
    }

    // For MiniPack: set base indices
    this._baseIndices = null;
    if (this.puzzleCount < PUZZLE_COUNT_BASE) {
      this._baseIndices = MINIPACK_BASE_INDICES;
    }
  }

  /**
   * Decode puzzle at pack-local index
   * @param {number} packIndex - Index in pack (0-based)
   * @returns {number[]|null} Array of 6 cell indices [g1, g2a, g2b, g3a, g3b, g3c] or null
   */
  decodePuzzle(packIndex) {
    if (packIndex < 0 || packIndex >= this.puzzleCount) return null;

    const o = packIndex * 3;
    const d = this._puzzleData;
    const n = BASE92_MAP[d[o]] + BASE92_MAP[d[o + 1]] * 92 + BASE92_MAP[d[o + 2]] * 92 * 92;

    const g3_idx = n % 96;
    const g2_idx = Math.floor(n / 96) % 112;
    const g1 = Math.floor(n / 10752);

    // Decode grey2 (2 cells)
    let g2a, g2b;
    if (g2_idx < 56) {
      const r2 = Math.floor(g2_idx / 7);
      const c2 = g2_idx % 7;
      g2a = r2 * 8 + c2;
      g2b = g2a + 1;
    } else {
      const i2 = g2_idx - 56;
      const r2v = Math.floor(i2 / 8);
      const c2v = i2 % 8;
      g2a = r2v * 8 + c2v;
      g2b = g2a + 8;
    }

    // Decode grey3 (3 cells)
    let g3a, g3b, g3c;
    if (g3_idx < 48) {
      const r3 = Math.floor(g3_idx / 6);
      const c3 = g3_idx % 6;
      g3a = r3 * 8 + c3;
      g3b = g3a + 1;
      g3c = g3a + 2;
    } else {
      const i3 = g3_idx - 48;
      const r3v = Math.floor(i3 / 8);
      const c3v = i3 % 8;
      g3a = r3v * 8 + c3v;
      g3b = g3a + 8;
      g3c = g3a + 16;
    }

    return [g1, g2a, g2b, g3a, g3b, g3c];
  }

  /**
   * Decompose extended puzzle number into [baseIndex, transform]
   * @param {number} puzzleNumber - Extended puzzle number (1-based)
   * @returns {[number, number]} [baseIndex, transform] where transform is 0-7
   */
  decompose(puzzleNumber) {
    const idx = puzzleNumber - 1;
    const transform = Math.floor(idx / PUZZLE_COUNT_BASE);
    const base = idx % PUZZLE_COUNT_BASE;
    return [base, transform];
  }

  /**
   * Get puzzle cells for an extended puzzle number (SYNC)
   * @param {number} puzzleNumber - Extended puzzle number (1-based, 1 to 91,024)
   * @returns {number[]|null} Array of 6 cell indices or null if not in pack
   */
  getPuzzleCells(puzzleNumber) {
    const [baseIndex, transform] = this.decompose(puzzleNumber);

    // For FullPack: packIndex == baseIndex
    // For MiniPack: look up baseIndex in _baseIndices
    let packIndex;
    if (this.puzzleCount === PUZZLE_COUNT_BASE) {
      packIndex = baseIndex;
    } else if (this._baseIndices) {
      packIndex = this._baseIndices.indexOf(baseIndex);
      if (packIndex === -1) return null;
    } else {
      return null;
    }

    const cells = this.decodePuzzle(packIndex);
    if (!cells) return null;
    if (transform === 0) return cells;

    // Apply D4 transform using transforms.js
    return cells.map(c => transformCell(c, transform));
  }

  /**
   * Check if this pack can decode a given extended puzzle number
   * @param {number} puzzleNumber - Extended puzzle number (1-based)
   * @returns {boolean} True if pack contains this puzzle
   */
  canDecode(puzzleNumber) {
    const [baseIndex] = this.decompose(puzzleNumber);
    if (this.puzzleCount === PUZZLE_COUNT_BASE) {
      return baseIndex < this.puzzleCount;
    }
    if (this._baseIndices) {
      return this._baseIndices.indexOf(baseIndex) !== -1;
    }
    return false;
  }

  /**
   * Convert level slot to puzzle number (FullPack only)
   * @param {string} level - Level name ('easy', 'medium', 'hard', 'hell')
   * @param {number} slot - Slot number (1-based)
   * @returns {number|null} Extended puzzle number or null
   */
  levelSlotToPuzzle(level, slot) {
    if (!this.hasOrdering || !this._levelOrdering) return null;

    const levelNum = { easy: 1, medium: 2, hard: 3, hell: 4 }[level];
    if (!levelNum) return null;

    const bases = this._levelOrdering[levelNum];
    if (!bases) return null;

    const numBases = bases.length;
    const total = numBases * 8;
    if (slot < 1 || slot > total) return null;

    const slot0 = slot - 1;
    const basePos = slot0 % numBases;
    const transform = Math.floor(slot0 / numBases);
    const baseIdx = bases[basePos];

    return transform * PUZZLE_COUNT_BASE + baseIdx + 1;
  }

  /**
   * Get total puzzles in a level (FullPack only)
   * @param {string} level - Level name ('easy', 'medium', 'hard', 'hell')
   * @returns {number} Total puzzles in level (0 if not available)
   */
  getLevelTotal(level) {
    if (!this.hasOrdering || !this._levelOrdering) return 0;

    const levelNum = { easy: 1, medium: 2, hard: 3, hell: 4 }[level];
    if (!levelNum) return 0;

    const bases = this._levelOrdering[levelNum];
    if (!bases) return 0;

    // Always return with 8 transforms (full extended set)
    return bases.length * 8;
  }

  /**
   * Get all level totals
   * @returns {Object} {easy: N, medium: N, hard: N, hell: N}
   */
  getAllLevelTotals() {
    const totals = {};
    const levels = ['easy', 'medium', 'hard', 'hell'];
    for (const level of levels) {
      totals[level] = this.getLevelTotal(level);
    }
    return totals;
  }

  /**
   * Get list of base indices in this pack (MiniPack only)
   * @returns {number[]|null} Array of base indices or null
   */
  getBaseIndices() {
    if (this._baseIndices) return this._baseIndices;
    if (this.puzzleCount === PUZZLE_COUNT_BASE) return null; // Too many to list
    return null;
  }

  /**
   * Get a random puzzle number from this pack
   * @returns {number} Random extended puzzle number (1-based)
   */
  getRandomPuzzleNumber() {
    if (this.puzzleCount === PUZZLE_COUNT_BASE) {
      return Math.floor(Math.random() * PUZZLE_COUNT_BASE * 8) + 1;
    }
    if (this._baseIndices) {
      const base = this._baseIndices[Math.floor(Math.random() * this._baseIndices.length)];
      const transform = Math.floor(Math.random() * 8);
      return transform * PUZZLE_COUNT_BASE + base + 1;
    }
    return 1;
  }

  /**
   * Verify pack signature (SYNC function)
   * @param {Uint8Array} publicKey - Ed25519 public key (32 bytes)
   * @returns {Object} {verified: boolean, reason: string|null}
   */
  verifySignature(publicKey) {
    if (!this.cryptoProvider) {
      return { verified: false, reason: 'NO_CRYPTO' };
    }

    const data = new Uint8Array(this._buffer, 80); // Data after header
    const result = this.cryptoProvider.verifySignature(data, this.signature, publicKey);
    return { verified: result, reason: result ? null : 'INVALID_SIGNATURE' };
  }
}

/**
 * Signature verification result reasons (enum-like):
 * - null: Signature valid
 * - 'NO_CRYPTO': No crypto provider injected
 * - 'INVALID_SIGNATURE': Signature verification failed
 */
