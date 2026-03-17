#!/usr/bin/env python3
"""
Exhaustive verification that exactly 11,378 unique solvable Octile puzzles exist.

Board: 8x8 (64 cells)
Grey pieces (auto-placed, define the puzzle): 1x1(1), 1x2(2), 1x3(3) = 6 cells
Player pieces: 3x4(12), 2x5(10), 3x3(9), 2x4(8), 2x3(6), 1x5(5), 1x4(4), 2x2(4) = 58 cells
Total: 64 cells

Two puzzles are equivalent under D4 symmetry (8 transformations: 4 rotations + 4 reflections).

Steps:
  1. Enumerate all non-overlapping placements of the 3 grey pieces on 8x8
  2. Canonicalize under D4, skip duplicates
  3. For each canonical placement, backtracking-solve with the 8 player pieces
  4. Count solvable puzzles — must equal 11,378
"""

import time
import sys
from multiprocessing import Pool, cpu_count

N = 8
FULL = (1 << 64) - 1

# ── D4 symmetry on 8x8 board ───────────────────────────────────────────────

def d4_cell(cell, t):
    """Apply D4 transform t (0-7) to a cell index 0-63."""
    r, c = divmod(cell, N)
    if t == 0: nr, nc = r, c                # identity
    elif t == 1: nr, nc = c, 7 - r          # rot90
    elif t == 2: nr, nc = 7 - r, 7 - c      # rot180
    elif t == 3: nr, nc = 7 - c, r          # rot270
    elif t == 4: nr, nc = r, 7 - c          # flip H
    elif t == 5: nr, nc = 7 - r, c          # flip V
    elif t == 6: nr, nc = c, r              # flip diag
    elif t == 7: nr, nc = 7 - c, 7 - r      # flip anti-diag
    return nr * N + nc

# Pre-compute D4 lookup: d4_table[t][cell] = transformed cell
D4_TABLE = [[d4_cell(cell, t) for cell in range(64)] for t in range(8)]

def canonicalize_cells(cells):
    """
    Canonical form of a set of grey cells under D4.
    Since all grey cells look identical in the game, the puzzle is defined
    by the SET of 6 grey cells, not by how they're partitioned into pieces.
    Returns the lexicographic minimum tuple over all 8 D4 transforms.
    """
    best = None
    for t in range(8):
        tbl = D4_TABLE[t]
        k = tuple(sorted(tbl[c] for c in cells))
        if best is None or k < best:
            best = k
    return best


# ── Grey piece placement enumeration ────────────────────────────────────────

def grey_placements():
    """Yield (mask, g1_cells, g2_cells, g3_cells) for all non-overlapping grey combos."""
    # grey1: 1x1 → 64 positions
    g1_list = []
    for cell in range(64):
        g1_list.append(((cell,), 1 << cell))

    # grey2: 1x2 horizontal or vertical → 112 positions
    g2_list = []
    for r in range(N):
        for c in range(N - 1):
            a, b = r * N + c, r * N + c + 1
            g2_list.append(((a, b), (1 << a) | (1 << b)))
    for r in range(N - 1):
        for c in range(N):
            a, b = r * N + c, (r + 1) * N + c
            g2_list.append(((a, b), (1 << a) | (1 << b)))

    # grey3: 1x3 horizontal or vertical → 96 positions
    g3_list = []
    for r in range(N):
        for c in range(N - 2):
            a, b, d = r * N + c, r * N + c + 1, r * N + c + 2
            g3_list.append(((a, b, d), (1 << a) | (1 << b) | (1 << d)))
    for r in range(N - 2):
        for c in range(N):
            a, b, d = r * N + c, (r + 1) * N + c, (r + 2) * N + c
            g3_list.append(((a, b, d), (1 << a) | (1 << b) | (1 << d)))

    return g1_list, g2_list, g3_list


def enumerate_canonical():
    """Return list of grey_mask values for all canonical (D4-unique) non-overlapping grey placements."""
    g1_list, g2_list, g3_list = grey_placements()
    seen = set()
    results = []

    for g1_cells, g1_mask in g1_list:
        for g2_cells, g2_mask in g2_list:
            if g1_mask & g2_mask:
                continue
            combined_12 = g1_mask | g2_mask
            for g3_cells, g3_mask in g3_list:
                if combined_12 & g3_mask:
                    continue
                all_cells = [g1_cells[0], g2_cells[0], g2_cells[1],
                             g3_cells[0], g3_cells[1], g3_cells[2]]
                canon = canonicalize_cells(all_cells)
                if canon not in seen:
                    seen.add(canon)
                    results.append(combined_12 | g3_mask)
    return results


# ── Player piece solver ─────────────────────────────────────────────────────

# Pieces sorted largest first for better pruning
PLAYER_PIECES = [
    (3, 4),  # blue2:  12 cells
    (2, 5),  # blue1:  10 cells
    (3, 3),  # yel1:   9 cells
    (2, 4),  # yel2:   8 cells
    (2, 3),  # red1:   6 cells
    (1, 5),  # white1: 5 cells
    (1, 4),  # red2:   4 cells
    (2, 2),  # white2: 4 cells
]

def precompute_placements():
    """
    For each piece and each cell, list of bitmasks for placements covering that cell.
    Returns: list (per piece) of list (per cell) of masks.
    """
    result = []
    for rows, cols in PLAYER_PIECES:
        orientations = {(rows, cols)}
        if rows != cols:
            orientations.add((cols, rows))

        by_cell = [[] for _ in range(64)]
        for rr, cc in orientations:
            for sr in range(N - rr + 1):
                for sc in range(N - cc + 1):
                    mask = 0
                    cells = []
                    for dr in range(rr):
                        for dc in range(cc):
                            bit = (sr + dr) * N + (sc + dc)
                            mask |= 1 << bit
                            cells.append(bit)
                    for bit in cells:
                        by_cell[bit].append(mask)
        result.append(by_cell)
    return result

PIECE_BY_CELL = precompute_placements()


def solve(grey_mask):
    """Return True if the 8 player pieces can tile the 58 empty cells."""
    # Use nonlocal for speed (avoid frame allocation overhead)
    board = [grey_mask]
    pieces_used = [0]

    def backtrack(depth):
        if depth == 8:
            return board[0] == FULL

        # Find lowest empty cell — it MUST be covered by some piece
        remaining = FULL & ~board[0]
        if not remaining:
            return False
        cell = (remaining & -remaining).bit_length() - 1

        brd = board[0]
        pu = pieces_used[0]

        for pi in range(8):
            if pu & (1 << pi):
                continue
            for mask in PIECE_BY_CELL[pi][cell]:
                if mask & brd == 0:
                    board[0] = brd | mask
                    pieces_used[0] = pu | (1 << pi)
                    if backtrack(depth + 1):
                        return True
            # Optimization: if no placement of piece pi covers this cell without
            # overlap, we still try other pieces (the cell might be covered by
            # a different piece). So continue to next pi.

        board[0] = brd
        pieces_used[0] = pu
        return False

    return backtrack(0)


# ── Batch worker for multiprocessing ────────────────────────────────────────

def check_batch(masks):
    """Check solvability for a batch. Returns count of solvable puzzles."""
    return sum(1 for m in masks if solve(m))


# ── Cross-check with embedded PUZZLE_DATA ───────────────────────────────────

def load_puzzle_data(html_path='index.html'):
    """Extract and decode PUZZLE_DATA from index.html."""
    import re
    with open(html_path) as f:
        text = f.read()

    m = re.search(r"const PUZZLE_DATA\s*=\s*'([^']+)'", text)
    if not m:
        return None
    data = m.group(1)

    B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    b64map = {c: i for i, c in enumerate(B64)}

    puzzles = []
    for i in range(0, len(data), 6):
        chunk = data[i:i+6]
        cells = [b64map[ch] for ch in chunk]
        # cells = [g1, g2a, g2b, g3a, g3b, g3c]
        puzzles.append(cells)
    return puzzles


def verify_puzzle_data():
    """Verify the embedded PUZZLE_DATA is internally consistent."""
    puzzles = load_puzzle_data()
    if puzzles is None:
        print("  Could not load PUZZLE_DATA from index.html")
        return False

    print(f"  Loaded {len(puzzles)} puzzles from PUZZLE_DATA")
    errors = 0

    # Check count
    if len(puzzles) != 11378:
        print(f"  ERROR: expected 11378 puzzles, got {len(puzzles)}")
        errors += 1

    # Check each puzzle: cells valid, grey pieces form valid shapes, no overlaps
    canonical_set = set()
    for idx, cells in enumerate(puzzles):
        g1 = (cells[0],)
        g2 = (cells[1], cells[2])
        g3 = (cells[3], cells[4], cells[5])

        # All cells in range
        for c in cells:
            if c < 0 or c >= 64:
                print(f"  ERROR puzzle {idx}: cell {c} out of range")
                errors += 1

        # No duplicate cells
        if len(set(cells)) != 6:
            print(f"  ERROR puzzle {idx}: duplicate cells {cells}")
            errors += 1
            continue

        # grey2 adjacency check (horizontal or vertical neighbors)
        r1, c1 = divmod(g2[0], N)
        r2, c2 = divmod(g2[1], N)
        if not ((r1 == r2 and abs(c1 - c2) == 1) or (c1 == c2 and abs(r1 - r2) == 1)):
            print(f"  ERROR puzzle {idx}: grey2 cells {g2} not adjacent")
            errors += 1

        # grey3 collinearity check (3 in a row/column)
        coords3 = [divmod(c, N) for c in g3]
        coords3.sort()
        rs = [r for r, c in coords3]
        cs = [c for r, c in coords3]
        if not ((rs[0] == rs[1] == rs[2] and cs[1] - cs[0] == 1 and cs[2] - cs[1] == 1) or
                (cs[0] == cs[1] == cs[2] and rs[1] - rs[0] == 1 and rs[2] - rs[1] == 1)):
            print(f"  ERROR puzzle {idx}: grey3 cells {g3} not collinear")
            errors += 1

        # D4 canonical uniqueness (by cell set, not piece assignment)
        canon = canonicalize_cells(cells)
        if canon in canonical_set:
            print(f"  ERROR puzzle {idx}: duplicate under D4 symmetry")
            errors += 1
        canonical_set.add(canon)

    if errors == 0:
        print("  All puzzles valid: correct cell ranges, shapes, and D4-unique")

    # Verify each puzzle is solvable
    print("  Checking solvability of all 11,378 embedded puzzles...")
    unsolvable = []
    for idx, cells in enumerate(puzzles):
        mask = 0
        for c in cells:
            mask |= 1 << c
        if not solve(mask):
            unsolvable.append(idx)
        if (idx + 1) % 2000 == 0:
            print(f"    checked {idx + 1}/{len(puzzles)}...")

    if unsolvable:
        print(f"  ERROR: {len(unsolvable)} puzzles are unsolvable: {unsolvable[:10]}...")
        errors += 1
    else:
        print("  All 11,378 embedded puzzles are solvable")

    return errors == 0


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    t0 = time.time()

    # Phase 1: Verify embedded data
    print("=" * 60)
    print("Phase 1: Verify embedded PUZZLE_DATA")
    print("=" * 60)
    data_ok = verify_puzzle_data()

    # Phase 2: Exhaustive enumeration
    print()
    print("=" * 60)
    print("Phase 2: Exhaustive enumeration (proves completeness)")
    print("=" * 60)

    print("Enumerating canonical grey placements (D4-unique, non-overlapping)...")
    t1 = time.time()
    placements = enumerate_canonical()
    t2 = time.time()
    print(f"  Found {len(placements):,} canonical placements in {t2 - t1:.1f}s")

    print(f"Checking solvability using {cpu_count()} CPU cores...")
    batch_size = max(1, len(placements) // (cpu_count() * 8))
    batches = [placements[i:i + batch_size] for i in range(0, len(placements), batch_size)]

    total_solvable = 0
    done_batches = 0
    t3 = time.time()

    with Pool(cpu_count()) as pool:
        for count in pool.imap_unordered(check_batch, batches):
            total_solvable += count
            done_batches += 1
            pct = done_batches / len(batches) * 100
            elapsed = time.time() - t3
            if done_batches % max(1, len(batches) // 20) == 0 or done_batches == len(batches):
                print(f"  {pct:5.1f}% | {total_solvable:,} solvable so far | {elapsed:.0f}s elapsed")

    t4 = time.time()
    print()
    print("=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"  Canonical grey placements checked:  {len(placements):,}")
    print(f"  Solvable puzzles found:             {total_solvable:,}")
    print(f"  Expected:                           11,378")
    print(f"  Total time:                         {t4 - t0:.1f}s")
    print()

    if total_solvable == 11378 and data_ok:
        print("  VERIFIED: exactly 11,378 unique solvable puzzles exist.")
        print("  The embedded PUZZLE_DATA is complete and correct.")
    elif total_solvable == 11378:
        print("  VERIFIED count: 11,378 puzzles exist.")
        print("  WARNING: embedded data has issues (see above).")
    else:
        print(f"  MISMATCH: expected 11,378 but found {total_solvable:,}")
        sys.exit(1)


if __name__ == '__main__':
    main()
