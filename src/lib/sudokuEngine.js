/**
 * Sudoku Engine — puzzle generation, validation, solving
 */

// Generate a solved Sudoku grid using backtracking
export function generateSolvedGrid() {
  const grid = Array(81).fill(0);
  solve(grid);
  return grid;
}

function isValid(grid, pos, num) {
  const row = Math.floor(pos / 9);
  const col = pos % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  for (let i = 0; i < 9; i++) {
    if (grid[row * 9 + i] === num) return false;
    if (grid[i * 9 + col] === num) return false;
    if (grid[(boxRow + Math.floor(i / 3)) * 9 + boxCol + (i % 3)] === num) return false;
  }
  return true;
}

function solve(grid) {
  const empty = grid.indexOf(0);
  if (empty === -1) return true;

  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const num of nums) {
    if (isValid(grid, empty, num)) {
      grid[empty] = num;
      if (solve(grid)) return true;
      grid[empty] = 0;
    }
  }
  return false;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Remove cells from solved grid to create a puzzle
// Returns { puzzle, solution }
export function generatePuzzle(difficulty = 'medium') {
  const cluesMap = {
    easy: 36,
    medium: 30,
    hard: 25,
    expert: 22,
  };
  const clues = cluesMap[difficulty] || 30;
  const solution = generateSolvedGrid();
  const puzzle = [...solution];

  const positions = shuffle([...Array(81).keys()]);
  let removed = 0;
  const toRemove = 81 - clues;

  for (const pos of positions) {
    if (removed >= toRemove) break;
    const backup = puzzle[pos];
    puzzle[pos] = 0;

    // Quick uniqueness check (just count solutions, abort at 2)
    const copy = [...puzzle];
    if (countSolutions(copy, 0) === 1) {
      removed++;
    } else {
      puzzle[pos] = backup;
    }
  }

  return { puzzle, solution };
}

function countSolutions(grid, count) {
  if (count > 1) return count;
  const empty = grid.indexOf(0);
  if (empty === -1) return count + 1;

  for (let num = 1; num <= 9; num++) {
    if (isValid(grid, empty, num)) {
      grid[empty] = num;
      count = countSolutions(grid, count);
      grid[empty] = 0;
      if (count > 1) return count;
    }
  }
  return count;
}

// Validate current user grid against solution
export function checkCell(userGrid, solution, index) {
  if (userGrid[index] === 0) return 'empty';
  if (userGrid[index] === solution[index]) return 'correct';
  return 'wrong';
}

// Check if puzzle is fully and correctly solved
export function isPuzzleComplete(userGrid, solution, puzzle) {
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] !== 0) continue; // skip givens
    if (userGrid[i] !== solution[i]) return false;
  }
  return true;
}

// Get all peers (same row, col, box) of a cell
export function getPeers(index) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  const peers = new Set();

  for (let i = 0; i < 9; i++) {
    peers.add(row * 9 + i);
    peers.add(i * 9 + col);
    peers.add((boxRow + Math.floor(i / 3)) * 9 + boxCol + (i % 3));
  }
  peers.delete(index);
  return peers;
}

// Check if placing num at index would conflict
export function hasConflict(grid, index, num) {
  const peers = getPeers(index);
  for (const p of peers) {
    if (grid[p] === num) return true;
  }
  return false;
}