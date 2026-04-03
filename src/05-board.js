// --- Lazy Timer ---
function ensureTimerRunning() {
  if (timerStarted || gameOver || paused) return;
  timerStarted = true;
  startTime = Date.now();
  timerInterval = setInterval(() => {
    elapsed = elapsedBeforePause + Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('timer').textContent = formatTime(elapsed);
  }, 250);
  document.getElementById('pause-btn').style.display = '';
}

function pauseGame() {
  if (!timerStarted || gameOver || paused) return;
  paused = true;
  clearInterval(timerInterval);
  timerInterval = null;
  elapsedBeforePause = elapsed;
  document.getElementById('pause-overlay').classList.add('show');
  document.getElementById('timer').style.opacity = '0.4';
}

function resumeGame() {
  if (!paused) return;
  paused = false;
  startTime = Date.now();
  timerInterval = setInterval(() => {
    elapsed = elapsedBeforePause + Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('timer').textContent = formatTime(elapsed);
  }, 250);
  document.getElementById('pause-overlay').classList.remove('show');
  document.getElementById('timer').style.opacity = '';
}

function rotateShape(shape) {
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

function initBoard() {
  board = Array.from({ length: 8 }, () => Array(8).fill(null));
}

function canPlace(shape, startR, startC, ignorePieceId) {
  const rows = shape.length, cols = shape[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!shape[r][c]) continue;
      const br = startR + r, bc = startC + c;
      if (br < 0 || br >= 8 || bc < 0 || bc >= 8) return false;
      if (board[br][bc] !== null && board[br][bc] !== ignorePieceId) return false;
    }
  }
  return true;
}

function placePiece(shape, startR, startC, pieceId) {
  const rows = shape.length, cols = shape[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!shape[r][c]) continue;
      board[startR + r][startC + c] = pieceId;
    }
  }
}

function removePiece(pieceId) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === pieceId) board[r][c] = null;
    }
  }
}

function getPieceById(id) {
  return pieces.find(p => p.id === id);
}

function getColorForCell(r, c) {
  const pid = board[r][c];
  if (!pid) return null;
  const p = getPieceById(pid);
  return p ? p.color : null;
}

// Load a puzzle by number (1-based)
async function loadPuzzle(puzzleNumber) {
  const cellIndices = await getPuzzleCells(puzzleNumber);
  // cellIndices: [g1, g2a, g2b, g3a, g3b, g3c]
  const greyCells = {
    grey1: [cellIndices[0]],
    grey2: [cellIndices[1], cellIndices[2]],
    grey3: [cellIndices[3], cellIndices[4], cellIndices[5]],
  };
  currentSolution = null; // solved lazily on hint
  initBoard();
  const greys = pieces.filter(p => p.auto);
  for (const g of greys) {
    const indices = greyCells[g.id];
    if (!indices) continue;
    const cells = indices.map(i => [Math.floor(i / 8), i % 8]);
    const minR = Math.min(...cells.map(c => c[0]));
    const minC = Math.min(...cells.map(c => c[1]));
    const maxR = Math.max(...cells.map(c => c[0]));
    const maxC = Math.max(...cells.map(c => c[1]));
    const rows = maxR - minR + 1, cols = maxC - minC + 1;
    const shape = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (const [r, c] of cells) shape[r - minR][c - minC] = 1;
    g.currentShape = shape;
    g.placed = true;
    g.boardR = minR;
    g.boardC = minC;
    placePiece(shape, minR, minC, g.id);
  }
}

function updateHintBtn() {
  const btn = document.getElementById('hint-btn');
  const left = Math.max(0, MAX_HINTS - getHintsUsedToday());
  if (left <= 0) {
    btn.textContent = t('hint') + ' (\uD83D\uDC8E' + HINT_DIAMOND_COST + ')';
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = 'pointer';
  } else {
    btn.textContent = t('hint') + ' (' + left + ')';
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = 'pointer';
  }
}

function showHint() {
  if (gameOver || hintTimeout) return;
  if (getHintsUsedToday() >= MAX_HINTS) {
    showDiamondPurchase(t('hint_buy_name'), HINT_DIAMOND_COST, () => {
      _grantBonusHint();
      _doShowHint();
    });
    return;
  }
  _doShowHint();
}

function _grantBonusHint() {
  const data = _loadHintData();
  data.used = Math.max(0, (data.used || 0) - 1);
  _saveHintData(data);
  updateHintBtn();
}

function _doShowHint() {
  if (gameOver || hintTimeout || getHintsUsedToday() >= MAX_HINTS) return;
  // Solve lazily on first hint request
  if (!currentSolution) {
    const greyBoard = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const pid = board[r][c];
        if (pid && (pid === 'grey1' || pid === 'grey2' || pid === 'grey3'))
          greyBoard[r][c] = pid;
      }
    currentSolution = solvePuzzle(greyBoard);
  }
  if (!currentSolution) return;

  // Pick one random unplaced non-grey piece
  const unplaced = pieces.filter(p => !p.auto && !p.placed);
  if (unplaced.length === 0) return;
  const hintPiece = unplaced[Math.floor(Math.random() * unplaced.length)];

  // Find that piece's cells in the solution
  const hintCells = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (currentSolution[r][c] === hintPiece.id) hintCells.push([r, c]);

  // Flash those cells on the board as ghost overlays
  const boardEl = document.getElementById('board');
  const overlays = [];
  for (const [r, c] of hintCells) {
    const cell = boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    if (!cell) continue;
    cell.classList.add('hint-flash');
    cell.dataset.hintColor = hintPiece.color;
    overlays.push(cell);
  }

  playSound('hint'); haptic(20);
  useHint();
  updateHintBtn();

  hintTimeout = setTimeout(() => {
    overlays.forEach(cell => {
      cell.classList.remove('hint-flash');
      delete cell.dataset.hintColor;
    });
    hintTimeout = null;
  }, 800);
}

async function loadRandomPuzzle() {
  if (!hasEnoughEnergy()) { showEnergyModal(true); return; }
  const num = getRandomPuzzleNumber();
  currentLevel = null;
  currentPuzzleNumber = num;
  await resetGame(num);
}

function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      const pid = board[r][c];
      if (pid) {
        const color = getColorForCell(r, c);
        cell.classList.add('occupied');
        cell.dataset.color = color;
        cell.dataset.pieceId = pid;
        // Piece outline borders: add border where neighbor is different piece or edge
        if (r === 0 || board[r-1][c] !== pid) cell.classList.add('border-top');
        if (r === 7 || board[r+1][c] !== pid) cell.classList.add('border-bottom');
        if (c === 0 || board[r][c-1] !== pid) cell.classList.add('border-left');
        if (c === 7 || board[r][c+1] !== pid) cell.classList.add('border-right');
        // Allow dragging non-grey pieces off the board
        const piece = getPieceById(pid);
        if (piece && !piece.auto) {
          cell.addEventListener('pointerdown', (e) => startDragFromBoard(e, piece));
        }
      }
      // Tap empty cell to place selected piece
      if (!pid && !gameOver) {
        cell.addEventListener('pointerup', (e) => onBoardCellTap(e, r, c));
      }
      boardEl.appendChild(cell);
    }
  }
  // Show preview for selected piece on board
  if (selectedPiece && !selectedPiece.placed) {
    updateSelectedPreview();
  }
}

function onBoardCellTap(e, row, col) {
  if (paused) return;
  if (!selectedPiece || selectedPiece.placed || dragPiece) return;
  ensureTimerRunning();
  const shape = selectedPiece.currentShape;
  const rows = shape.length, cols = shape[0].length;
  // Place piece centered on tapped cell
  const startR = Math.max(0, Math.min(row - Math.floor(rows / 2), 8 - rows));
  const startC = Math.max(0, Math.min(col - Math.floor(cols / 2), 8 - cols));
  if (canPlace(shape, startR, startC, null)) {
    placePiece(shape, startR, startC, selectedPiece.id);
    selectedPiece.placed = true;
    selectedPiece = null;
    piecesPlacedCount++;
    playSound('place'); haptic(15);
    renderBoard(); triggerSnap();
    renderPool();
    maybeShowEncourageToast();
    checkWin();
    showTutorialHint2(); maybeCompleteTutorial();
  }
}

function updateSelectedPreview() {
  // No persistent preview for tap mode - user taps to place
}

function selectPiece(piece) {
  if (selectedPiece === piece) {
    // Already selected — rotate it
    piece.currentShape = rotateShape(piece.currentShape);
    playSound('rotate'); haptic(8);
  } else {
    selectedPiece = piece;
    playSound('select'); haptic(10);
  }
  renderPool();
}

const POOL_CELL_PX = PIECE_CELL_PX; // same size as original

function renderPool() {
  const poolEl = document.getElementById('pool');
  poolEl.innerHTML = '';
  pieces.filter(p => !p.auto).forEach(p => {
    const wrapper = document.createElement('div');
    wrapper.className = 'piece-wrapper' + (p.placed ? ' placed' : '');

    const el = document.createElement('div');
    el.className = 'piece' + (selectedPiece === p ? ' selected' : '');
    el.dataset.id = p.id;
    const shape = p.currentShape;
    const rows = shape.length, cols = shape[0].length;
    el.style.gridTemplateColumns = `repeat(${cols}, ${POOL_CELL_PX}px)`;
    el.style.gridTemplateRows = `repeat(${rows}, ${POOL_CELL_PX}px)`;
    el.style.setProperty('--cols', cols);
    el.style.setProperty('--rows', rows);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'piece-cell';
        cell.style.width = POOL_CELL_PX + 'px';
        cell.style.height = POOL_CELL_PX + 'px';
        if (shape[r][c]) {
          cell.dataset.color = p.color;
        } else {
          cell.style.visibility = 'hidden';
        }
        el.appendChild(cell);
      }
    }

    // Tap to select OR drag to place
    if (!p.placed) {
      el.addEventListener('pointerdown', (e) => onPiecePointerDown(e, p));
    }

    wrapper.appendChild(el);
    poolEl.appendChild(wrapper);
  });
  updatePoolScrollHints();
  requestAnimationFrame(updatePoolScrollHints);
}

function updatePoolScrollHints() {
  const pool = document.getElementById('pool');
  const wrap = document.getElementById('pool-scroll');
  if (!pool || !wrap) return;
  const atStart = pool.scrollLeft <= 2;
  const atEnd = pool.scrollLeft + pool.clientWidth >= pool.scrollWidth - 2;
  wrap.classList.toggle('at-start', atStart);
  wrap.classList.toggle('at-end', atEnd);
  var leftBtn = document.getElementById('pool-left');
  var rightBtn = document.getElementById('pool-right');
  if (leftBtn) leftBtn.disabled = atStart;
  if (rightBtn) rightBtn.disabled = atEnd;
}

let _poolHintShown = false;
function showPoolScrollHint() {
  if (_poolHintShown) return;
  const pool = document.getElementById('pool');
  const hint = document.getElementById('pool-hint');
  if (!pool || !hint) return;
  const overflows = pool.scrollWidth > pool.clientWidth + 4;
  hint.textContent = overflows ? t('pool_scroll_hint') : t('pool_rotate_hint');
  hint.classList.remove('hidden');
  _poolHintShown = true;
  setTimeout(dismissPoolScrollHint, 8000);
}
function dismissPoolScrollHint() {
  const hint = document.getElementById('pool-hint');
  if (hint) hint.classList.add('hidden');
}

// Listen for pool scroll to update fade hints and dismiss scroll hint
document.getElementById('pool').addEventListener('scroll', () => {
  updatePoolScrollHints();
  dismissPoolScrollHint();
}, { passive: true });

// Pool arrow buttons (mobile)
function scrollPool(dir) {
  var pool = document.getElementById('pool');
  if (!pool) return;
  pool.scrollBy({ left: dir * pool.clientWidth * 0.6, behavior: 'smooth' });
}
document.getElementById('pool-left').addEventListener('click', () => scrollPool(-1));
document.getElementById('pool-right').addEventListener('click', () => scrollPool(1));

function getCellSize() {
  const boardEl = document.getElementById('board');
  const rect = boardEl.getBoundingClientRect();
  // account for padding (3px each side) and gaps (7 gaps * 2px)
  return (rect.width - 6 - 14) / 8;
}

function buildGhost(piece) {
  const shape = piece.currentShape;
  const rows = shape.length, cols = shape[0].length;
  const ghost = document.getElementById('drag-ghost');
  const cellSize = getCellSize();
  ghost.style.setProperty('--cell-size', cellSize + 'px');
  ghost.style.display = 'grid';
  ghost.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
  ghost.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
  ghost.style.gap = '2px';
  ghost.innerHTML = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'piece-cell';
      if (shape[r][c]) {
        cell.dataset.color = piece.color;
      } else {
        cell.style.visibility = 'hidden';
      }
      cell.style.width = cellSize + 'px';
      cell.style.height = cellSize + 'px';
      ghost.appendChild(cell);
    }
  }
}

function capturePointer(e) {
  dragPointerId = e.pointerId;
  // Capture on a persistent element so events survive re-renders
  const boardEl = document.getElementById('board');
  try { boardEl.setPointerCapture(e.pointerId); } catch (err) { console.warn('Pointer capture failed:', err.message); }
  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', onDragEnd);
  document.addEventListener('pointercancel', onDragCancel);
}

function releasePointer() {
  if (dragPointerId !== null) {
    const boardEl = document.getElementById('board');
    try { boardEl.releasePointerCapture(dragPointerId); } catch (err) { console.warn('Pointer release failed:', err.message); }
    dragPointerId = null;
  }
  document.removeEventListener('pointermove', onDragMove);
  document.removeEventListener('pointerup', onDragEnd);
  document.removeEventListener('pointercancel', onDragCancel);
}

function onDragCancel(e) {
  if (!dragPiece) return;
  releasePointer();
  const ghost = document.getElementById('drag-ghost');
  ghost.style.display = 'none';
  clearPreview();
  // Return piece to pool if it was dragged from board
  if (dragFromBoard) {
    dragPiece.placed = false;
  }
  renderBoard();
  renderPool();
  dragPiece = null;
  dragFromBoard = false;
}

function startDragFromBoard(e, piece) {
  if (gameOver || paused) return;
  ensureTimerRunning();
  e.preventDefault();
  selectedPiece = null;
  dragPiece = piece;
  dragFromBoard = true;

  // Figure out offset based on which cell of the piece was clicked
  const clickedR = parseInt(e.currentTarget.dataset.row);
  const clickedC = parseInt(e.currentTarget.dataset.col);
  // Find top-left of this piece on the board
  let minR = 8, minC = 8;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === piece.id) {
        if (r < minR) minR = r;
        if (c < minC) minC = c;
      }
    }
  }
  dragOffsetRow = clickedR - minR;
  dragOffsetCol = clickedC - minC;

  // Capture pointer BEFORE re-rendering destroys the target element
  capturePointer(e);

  // Remove piece from board
  removePiece(piece.id);
  playSound('remove'); haptic(10);
  renderBoard();

  buildGhost(piece);
  moveGhost(e.clientX, e.clientY);
}

function onPiecePointerDown(e, piece) {
  if (gameOver || paused) return;
  ensureTimerRunning();
  dismissPoolScrollHint();
  e.preventDefault();
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  // Store piece and offset info for potential drag
  const shape = piece.currentShape;
  const cols = shape[0].length;
  const pieceEl = e.currentTarget;
  const rect = pieceEl.getBoundingClientRect();
  const cellW = POOL_CELL_PX + 1;
  const relX = e.clientX - rect.left;
  const relY = e.clientY - rect.top;
  const offC = Math.min(Math.floor(relX / cellW), cols - 1);
  const offR = Math.min(Math.floor(relY / cellW), shape.length - 1);

  // Use a pending state: start actual drag only after movement threshold
  let started = false;
  const onMove = (me) => {
    const dx = me.clientX - dragStartX;
    const dy = me.clientY - dragStartY;
    if (!started && Math.sqrt(dx*dx + dy*dy) > TAP_THRESHOLD) {
      started = true;
      // Begin real drag
      dragPiece = piece;
      dragFromBoard = false;
      dragOffsetCol = offC;
      dragOffsetRow = offR;
      selectedPiece = null;
      buildGhost(piece);
      moveGhost(me.clientX, me.clientY);
      renderPool();
    }
    if (started) {
      me.preventDefault();
      moveGhost(me.clientX, me.clientY);
      const { row, col } = getBoardPosForGhost(me.clientX, me.clientY);
      if (row >= 0 && row < 8 && col >= 0 && col < 8) {
        showPreview(dragPiece, row, col);
      } else {
        clearPreview();
      }
    }
  };
  const onUp = (ue) => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    if (!started) {
      // It was a tap — select/deselect piece
      selectPiece(piece);
    } else {
      // End drag
      const ghost = document.getElementById('drag-ghost');
      ghost.style.display = 'none';
      clearPreview();
      if (!dragPiece) return;
      const { row, col } = getBoardPosForGhost(ue.clientX, ue.clientY);
      const sh = dragPiece.currentShape;
      const startR = row - dragOffsetRow;
      const startC = col - dragOffsetCol;
      if (canPlace(sh, startR, startC, null)) {
        placePiece(sh, startR, startC, dragPiece.id);
        dragPiece.placed = true;
        piecesPlacedCount++;
        playSound('place'); haptic(15);
        renderBoard();
        renderPool();
        maybeShowEncourageToast();
        checkWin();
        showTutorialHint2(); maybeCompleteTutorial();
      }
      dragPiece = null;
    }
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
}

function moveGhost(x, y) {
  const ghost = document.getElementById('drag-ghost');
  const cellSize = getCellSize();
  const gapSize = 2;
  const offsetX = dragOffsetCol * (cellSize + gapSize) + cellSize / 2;
  const offsetY = dragOffsetRow * (cellSize + gapSize) + cellSize / 2;
  // On touch devices, lift ghost above finger so it's visible
  const touchLift = ('ontouchstart' in window) ? 60 : 0;
  ghost.style.left = (x - offsetX) + 'px';
  ghost.style.top = (y - offsetY - touchLift) + 'px';
}

function getBoardPosForGhost(x, y) {
  // Account for touch lift when calculating board position
  const touchLift = ('ontouchstart' in window) ? 60 : 0;
  return getBoardPos(x, y - touchLift);
}

function getBoardPos(x, y) {
  const boardEl = document.getElementById('board');
  const rect = boardEl.getBoundingClientRect();
  const cellSize = getCellSize();
  const padGap = 3; // padding
  const gap = 2;
  const relX = x - rect.left - padGap;
  const relY = y - rect.top - padGap;
  const col = Math.floor(relX / (cellSize + gap));
  const row = Math.floor(relY / (cellSize + gap));
  return { row, col };
}

function clearPreview() {
  document.querySelectorAll('.cell.preview-valid, .cell.preview-invalid').forEach(c => {
    c.classList.remove('preview-valid', 'preview-invalid');
  });
}

function showPreview(piece, boardRow, boardCol) {
  clearPreview();
  const shape = piece.currentShape;
  const startR = boardRow - dragOffsetRow;
  const startC = boardCol - dragOffsetCol;
  const valid = canPlace(shape, startR, startC, null);
  const rows = shape.length, cols = shape[0].length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!shape[r][c]) continue;
      const br = startR + r, bc = startC + c;
      if (br < 0 || br >= 8 || bc < 0 || bc >= 8) continue;
      const cell = document.querySelector(`.cell[data-row="${br}"][data-col="${bc}"]`);
      if (cell) cell.classList.add(valid ? 'preview-valid' : 'preview-invalid');
    }
  }
}

function onDragMove(e) {
  if (!dragPiece) return;
  e.preventDefault();
  moveGhost(e.clientX, e.clientY);

  const { row, col } = getBoardPosForGhost(e.clientX, e.clientY);
  if (row >= 0 && row < 8 && col >= 0 && col < 8) {
    showPreview(dragPiece, row, col);
  } else {
    clearPreview();
  }
}

function onDragEnd(e) {
  if (!dragPiece) return;
  e.preventDefault();
  releasePointer();

  const ghost = document.getElementById('drag-ghost');
  ghost.style.display = 'none';
  clearPreview();

  const { row, col } = getBoardPosForGhost(e.clientX, e.clientY);
  const shape = dragPiece.currentShape;
  const startR = row - dragOffsetRow;
  const startC = col - dragOffsetCol;

  if (canPlace(shape, startR, startC, null)) {
    placePiece(shape, startR, startC, dragPiece.id);
    dragPiece.placed = true;
    piecesPlacedCount++;
    playSound('place'); haptic(15);
    renderBoard(); triggerSnap();
    renderPool();
    maybeShowEncourageToast();
    checkWin();
    showTutorialHint2(); maybeCompleteTutorial();
  } else if (dragFromBoard) {
    // Dropped outside or invalid spot — return to pool
    dragPiece.placed = false;
    renderBoard();
    renderPool();
  }

  dragPiece = null;
  dragFromBoard = false;
}

function getSolvedSet() {
  try { return new Set(JSON.parse(localStorage.getItem('octile_solved') || '[]')); }
  catch { return new Set(); }
}

function saveSolvedSet(s) {
  localStorage.setItem('octile_solved', JSON.stringify([...s]));
}

function getWinMotivation(totalUnique, isFirstClear, isNewBest, prevBest, elapsed, improvement) {
  const msgs = [];
  // First time solving this puzzle
  if (isFirstClear) {
    msgs.push(...t('motiv_first_clear'));
  }
  // New personal best (on re-solve)
  if (!isFirstClear && isNewBest) {
    const saved = improvement;
    if (saved >= 60) {
      msgs.push(...t('motiv_big_improve').map(s => s.replace('{saved}', formatTime(saved))));
    } else if (saved > 0) {
      msgs.push(...t('motiv_improve').map(s => s.replace('{saved}', saved + 's')));
    }
  }
  // Speed achievements
  if (elapsed <= 30) msgs.push(...t('motiv_speed_30'));
  else if (elapsed <= 60) msgs.push(...t('motiv_speed_60'));
  // Milestone achievements
  if (totalUnique === 1) msgs.push(...t('motiv_first').map(s => s.replace('{remain}', (getEffectivePuzzleCount() - 1).toLocaleString())));
  else if (totalUnique === 10) msgs.push(...t('motiv_10'));
  else if (totalUnique === 50) msgs.push(...t('motiv_50'));
  else if (totalUnique === 100) msgs.push(...t('motiv_100'));
  else if (totalUnique === 500) msgs.push(...t('motiv_500'));
  else if (totalUnique === 1000) msgs.push(...t('motiv_1000'));
  else if (totalUnique % 100 === 0) msgs.push(...t('motiv_hundred').map(s => s.replace('{n}', totalUnique)));
  // Progress
  const pct = (totalUnique / getEffectivePuzzleCount() * 100).toFixed(1);
  if (totalUnique > 1 && !msgs.length) {
    msgs.push(...t('motiv_progress').map(s => s.replace('{n}', totalUnique).replace('{total}', getEffectivePuzzleCount().toLocaleString()).replace('{pct}', pct)));
  }
  return msgs.length ? msgs[Math.floor(Math.random() * msgs.length)] : '';
}

