import { initBoard, canPlace, placePiece, removePiece, rotateShape, getPieceById, getColorForCell } from '../src/puzzle/board.js';

describe('Board operations', () => {
  test('initBoard creates 8x8 board', () => {
    const board = initBoard();
    expect(board).toHaveLength(8);
    expect(board[0]).toHaveLength(8);
    expect(board[0][0]).toBeNull();
  });

  test('canPlace detects valid placement', () => {
    const board = initBoard();
    const shape = [[1, 1], [1, 0]]; // L-shape
    expect(canPlace(board, shape, 0, 0, null)).toBe(true);
    expect(canPlace(board, shape, 7, 7, null)).toBe(false); // Out of bounds
  });

  test('placePiece places piece on board', () => {
    const board = initBoard();
    const shape = [[1]];
    placePiece(board, shape, 3, 3, 'piece1');
    expect(board[3][3]).toBe('piece1');
  });

  test('removePiece clears piece from board', () => {
    const board = initBoard();
    placePiece(board, [[1]], 3, 3, 'piece1');
    removePiece(board, 'piece1');
    expect(board[3][3]).toBeNull();
  });

  test('rotateShape rotates 90° clockwise', () => {
    const shape = [[1, 0], [1, 1]];
    const rotated = rotateShape(shape);
    // Original:  1 0    Rotated:  1 1
    //            1 1              1 0
    expect(rotated).toEqual([[1, 1], [1, 0]]);
  });

  test('getPieceById finds piece', () => {
    const pieces = [
      { id: 'grey1', color: '#888' },
      { id: 'blue', color: '#00f' }
    ];
    expect(getPieceById(pieces, 'blue')).toEqual({ id: 'blue', color: '#00f' });
    expect(getPieceById(pieces, 'notfound')).toBeUndefined();
  });

  test('getColorForCell returns color for placed piece', () => {
    const board = initBoard();
    const pieces = [{ id: 'piece1', color: '#f00' }];
    placePiece(board, [[1]], 3, 3, 'piece1');
    expect(getColorForCell(board, pieces, 3, 3)).toBe('#f00');
    expect(getColorForCell(board, pieces, 0, 0)).toBeNull();
  });
});
