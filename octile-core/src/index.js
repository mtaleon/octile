// Puzzle logic
export {
  initBoard,
  canPlace,
  placePiece,
  removePiece,
  rotateShape,
  getPieceById,
  getColorForCell,
  BOARD_SIZE
} from './puzzle/board.js';

export {
  transformCell,
  applyCellTransform,
  TRANSFORMS
} from './puzzle/transforms.js';

export {
  solvePuzzle,
  solverGetRotations,
  SOLVER_SHAPES
} from './puzzle/solver.js';

export {
  PIECE_DEFINITIONS,
  SOLVER_PIECES
} from './puzzle/types.js';

export {
  PackReader,
  MINIPACK_DATA,
  MINIPACK_BASE_INDICES,
  PUZZLE_COUNT_BASE
} from './puzzle/pack-reader.js';

// Game logic
export { Timer } from './game/timer.js';

// Utils
export {
  BASE92_ALPHABET,
  decodeBase92,
  encodeBase92
} from './utils/base92.js';

// Interfaces (for platform implementers)
export { TimeSource } from './interfaces/time-source.js';
export { CryptoProvider } from './interfaces/crypto-provider.js';
export { PackStore } from './interfaces/pack-store.js';
export { KVStore } from './interfaces/kv-store.js';
