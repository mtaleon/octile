/**
 * Core logic imports for WeChat Mini Game
 * Re-exports from octile-core
 */

export {
  initBoard,
  canPlace,
  placePiece,
  removePiece,
  rotateShape,
  getPieceById,
  getColorForCell
} from '../../octile-core/src/puzzle/board.js';

export { PackReader } from '../../octile-core/src/puzzle/pack-reader.js';

export { Timer } from '../../octile-core/src/game/timer.js';

export {
  PIECE_DEFINITIONS,
  BOARD_SIZE
} from '../../octile-core/src/puzzle/types.js';

export {
  transformCell,
  TRANSFORMS
} from '../../octile-core/src/puzzle/transforms.js';
