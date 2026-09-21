import { WORD_POOL, CATEGORY_MAP } from '../../src/data/wordSearchPool.js';

export const WORD_SEARCH_SEAT_COLORS = {
  1: '#BC13FE',
  2: '#FF5F1F',
  3: '#FFD700',
  4: '#22D3EE',
};

export const WORD_SEARCH_DIFFICULTIES = {
  simpleton: { label: 'Simpleton', words: 10, size: 12, difficultyBonus: 0 },
  reader: { label: 'Reader', words: 15, size: 16, difficultyBonus: 50 },
  scholar: { label: 'Scholar', words: 25, size: 22, difficultyBonus: 100 },
};

export const WORD_SEARCH_DIRECTIONS = [
  { key: 'E', dx: 1, dy: 0, label: 'Horizontal', directionBonus: 100 },
  { key: 'W', dx: -1, dy: 0, label: 'Horizontal Backward', directionBonus: 150 },
  { key: 'S', dx: 0, dy: 1, label: 'Vertical', directionBonus: 100 },
  { key: 'N', dx: 0, dy: -1, label: 'Vertical Backward', directionBonus: 150 },
  { key: 'SE', dx: 1, dy: 1, label: 'Diagonal', directionBonus: 200 },
  { key: 'SW', dx: -1, dy: 1, label: 'Diagonal', directionBonus: 200 },
  { key: 'NE', dx: 1, dy: -1, label: 'Diagonal Backward', directionBonus: 250 },
  { key: 'NW', dx: -1, dy: -1, label: 'Diagonal Backward', directionBonus: 250 },
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const VALID_MODES = new Set(['race', 'turn']);
const VALID_CATEGORIES = new Set([
  'random',
  'popculture',
  'online',
  'food',
  'spiritual',
  'gaming',
  'music',
  'travel',
  'general',
]);

function rand(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function clean(word) {
  return String(word || '').replace(/[^A-Z]/gi, '').toUpperCase();
}

function shuffle(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function wordList(category, difficulty, count) {
  const poolKey = category === 'random' ? null : CATEGORY_MAP[category];
  const source = poolKey
    ? (WORD_POOL[poolKey]?.[difficulty] || WORD_POOL.general[difficulty] || [])
    : Object.values(WORD_POOL).flatMap((group) => group[difficulty] || []);

  return shuffle([...new Set(source.map(clean).filter(Boolean))]).slice(0, count);
}

function canPlace(grid, word, x, y, direction) {
  for (let i = 0; i < word.length; i += 1) {
    const nx = x + direction.dx * i;
    const ny = y + direction.dy * i;
    if (nx < 0 || ny < 0 || ny >= grid.length || nx >= grid.length) return false;
    if (grid[ny][nx] && grid[ny][nx] !== word[i]) return false;
  }
  return true;
}

function placeWord(grid, word, difficultyBonus) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const direction = rand(WORD_SEARCH_DIRECTIONS);
    const x = Math.floor(Math.random() * grid.length);
    const y = Math.floor(Math.random() * grid.length);
    if (!canPlace(grid, word, x, y, direction)) continue;

    const cells = [];
    for (let i = 0; i < word.length; i += 1) {
      const nx = x + direction.dx * i;
      const ny = y + direction.dy * i;
      grid[ny][nx] = word[i];
      cells.push(`${ny}-${nx}`);
    }

    const lengthPoints = word.length * 10;
    const points = lengthPoints + direction.directionBonus + difficultyBonus;

    return {
      word,
      found: false,
      foundBy: null,
      foundAt: null,
      cells,
      direction: direction.key,
      directionLabel: direction.label,
      lengthPoints,
      directionBonus: direction.directionBonus,
      difficultyBonus,
      points,
    };
  }

  return null;
}

export function buildWordSearchPuzzle(difficulty = 'simpleton', category = 'random') {
  const cfg = WORD_SEARCH_DIFFICULTIES[difficulty] || WORD_SEARCH_DIFFICULTIES.simpleton;
  const safeCategory = VALID_CATEGORIES.has(category) ? category : 'random';
  const grid = Array.from(
    { length: cfg.size },
    () => Array.from({ length: cfg.size }, () => ''),
  );

  const placed = [];
  const candidates = wordList(safeCategory, difficulty, cfg.words)
    .sort((a, b) => b.length - a.length);

  for (const word of candidates) {
    const result = placeWord(grid, word, cfg.difficultyBonus);
    if (result) placed.push(result);
  }

  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid.length; x += 1) {
      if (!grid[y][x]) grid[y][x] = rand(ALPHABET);
    }
  }

  return { grid, words: placed };
}

export function defaultWordSearchState() {
  return {
    phase: 'setup',
    mode: 'race',
    difficulty: 'simpleton',
    category: 'random',
    grid: [],
    words: [],
    scores: { '1': 0, '2': 0, '3': 0, '4': 0 },
    active_seat: null,
    time_end: null,
    paused: false,
    message: null,
    winner_seat: null,
    last_action: null,
    round_number: 1,
  };
}

export function normalizeWordSearchState(raw = {}) {
  const base = defaultWordSearchState();
  return {
    ...base,
    ...raw,
    grid: Array.isArray(raw.grid) ? raw.grid : [],
    words: Array.isArray(raw.words) ? raw.words : [],
    scores: {
      ...base.scores,
      ...(raw.scores && typeof raw.scores === 'object' ? raw.scores : {}),
    },
  };
}

function activeGuessSeats(activeSeats = []) {
  return [...new Set(
    activeSeats
      .map(Number)
      .filter((seat) => [1, 2, 3, 4].includes(seat)),
  )].sort((a, b) => a - b);
}

export function nextWordSearchSeat(activeSeats, fromSeat = null) {
  const seats = activeGuessSeats(activeSeats);
  if (!seats.length) return null;
  if (!fromSeat || !seats.includes(Number(fromSeat))) return seats[0];

  const index = seats.indexOf(Number(fromSeat));
  return seats[(index + 1) % seats.length];
}

export function startWordSearchGame(rawState, {
  mode = 'race',
  difficulty = 'simpleton',
  category = 'random',
  activeSeats = [],
}) {
  const state = normalizeWordSearchState(rawState);
  const safeMode = VALID_MODES.has(mode) ? mode : 'race';
  const safeDifficulty = WORD_SEARCH_DIFFICULTIES[difficulty] ? difficulty : 'simpleton';
  const safeCategory = VALID_CATEGORIES.has(category) ? category : 'random';
  const seats = activeGuessSeats(activeSeats);

  if (!seats.length) {
    const error = new Error('At least one player must be connected before starting Word Search.');
    error.statusCode = 409;
    error.code = 'WORD_SEARCH_PLAYER_REQUIRED';
    throw error;
  }

  const { grid, words } = buildWordSearchPuzzle(safeDifficulty, safeCategory);
  if (!words.length) {
    const error = new Error('TNG could not build a Word Search board.');
    error.statusCode = 500;
    error.code = 'WORD_SEARCH_BUILD_FAILED';
    throw error;
  }

  const now = Date.now();

  return {
    ...state,
    phase: 'playing',
    mode: safeMode,
    difficulty: safeDifficulty,
    category: safeCategory,
    grid,
    words,
    scores: { '1': 0, '2': 0, '3': 0, '4': 0 },
    active_seat: safeMode === 'turn' ? seats[0] : null,
    time_end: now + (safeMode === 'turn' ? 60_000 : 300_000),
    paused: false,
    message: null,
    winner_seat: null,
    last_action: {
      type: 'game_started',
      timestamp: now,
    },
    round_number: Number(state.round_number || 0) + 1,
  };
}

function normalizeCells(cells = []) {
  return cells
    .map((cell) => String(cell || '').trim())
    .filter((cell) => /^\d+-\d+$/.test(cell));
}

function sameCells(left = [], right = []) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function cellsText(grid, cells) {
  return cells.map((id) => {
    const [y, x] = id.split('-').map(Number);
    return grid[y]?.[x] || '';
  }).join('');
}

function addScore(scores, seatNumber, delta) {
  const next = { ...(scores || {}) };
  const key = String(seatNumber);
  next[key] = Number(next[key] || 0) + Number(delta || 0);
  return next;
}

function winnerSeat(scores, activeSeats) {
  const seats = activeGuessSeats(activeSeats);
  return [...seats].sort((a, b) => {
    const diff = Number(scores[String(b)] || 0) - Number(scores[String(a)] || 0);
    return diff || a - b;
  })[0] || null;
}

export function finishWordSearchGame(rawState, activeSeats, reason = 'complete') {
  const state = normalizeWordSearchState(rawState);
  const winner = winnerSeat(state.scores, activeSeats);
  return {
    ...state,
    phase: 'finished',
    active_seat: null,
    time_end: null,
    winner_seat: winner,
    message: reason === 'time'
      ? 'Time is up!'
      : 'All words found!',
    last_action: {
      ...(state.last_action || {}),
      gameResult: reason,
      winnerSeat: winner,
      timestamp: Date.now(),
    },
  };
}

export function applyWordSearchTimeout(rawState, activeSeats = []) {
  const state = normalizeWordSearchState(rawState);
  if (state.phase !== 'playing' || state.paused || !state.time_end || Date.now() < Number(state.time_end)) {
    return state;
  }

  if (state.mode === 'race') {
    return finishWordSearchGame(state, activeSeats, 'time');
  }

  const activeSeat = Number(state.active_seat || 0);
  const nextScores = activeSeat
    ? addScore(state.scores, activeSeat, -10)
    : state.scores;
  const nextSeat = nextWordSearchSeat(activeSeats, activeSeat);

  return {
    ...state,
    scores: nextScores,
    active_seat: nextSeat,
    time_end: Date.now() + 60_000,
    last_action: {
      type: 'timeout',
      seatNumber: activeSeat,
      result: 'timeout',
      points: -10,
      timestamp: Date.now(),
    },
  };
}

export function submitWordSearchSelection(rawState, {
  actorSeat,
  cells,
  activeSeats = [],
}) {
  const state = applyWordSearchTimeout(rawState, activeSeats);
  const seat = Number(actorSeat);

  if (state.phase !== 'playing') {
    const error = new Error('This Word Search game is not active.');
    error.statusCode = 409;
    error.code = 'WORD_SEARCH_NOT_PLAYING';
    throw error;
  }

  if (state.paused) {
    const error = new Error('Word Search is paused.');
    error.statusCode = 409;
    error.code = 'WORD_SEARCH_PAUSED';
    throw error;
  }

  if (state.mode === 'turn' && Number(state.active_seat) !== seat) {
    const error = new Error(`It is Seat ${state.active_seat}'s turn.`);
    error.statusCode = 409;
    error.code = 'WORD_SEARCH_NOT_YOUR_TURN';
    throw error;
  }

  const submittedCells = normalizeCells(cells);
  if (submittedCells.length < 2) {
    const error = new Error('Drag across at least two letters.');
    error.statusCode = 400;
    error.code = 'INVALID_WORD_SEARCH_SELECTION';
    throw error;
  }

  const text = cellsText(state.grid, submittedCells);
  const reversed = text.split('').reverse().join('');
  const matched = state.words.find((word) => (
    !word.found &&
    (word.word === text || word.word === reversed) &&
    sameCells(word.cells, submittedCells)
  ));

  if (!matched) {
    const nextScores = addScore(state.scores, seat, -20);
    return {
      state: {
        ...state,
        scores: nextScores,
        active_seat: state.mode === 'turn'
          ? nextWordSearchSeat(activeSeats, seat)
          : state.active_seat,
        time_end: state.mode === 'turn'
          ? Date.now() + 60_000
          : state.time_end,
        last_action: {
          type: 'selection',
          seatNumber: seat,
          word: text,
          result: 'wrong',
          points: -20,
          timestamp: Date.now(),
        },
      },
      matched: null,
    };
  }

  const updatedWords = state.words.map((word) => (
    word.word === matched.word
      ? {
          ...word,
          found: true,
          foundBy: seat,
          foundAt: Date.now(),
        }
      : word
  ));
  const nextScores = addScore(state.scores, seat, matched.points);
  const allFound = updatedWords.every((word) => word.found);

  let nextState = {
    ...state,
    words: updatedWords,
    scores: nextScores,
    active_seat: state.mode === 'turn'
      ? nextWordSearchSeat(activeSeats, seat)
      : state.active_seat,
    time_end: state.mode === 'turn'
      ? Date.now() + 60_000
      : state.time_end,
    last_action: {
      type: 'selection',
      seatNumber: seat,
      word: matched.word,
      result: 'correct',
      points: matched.points,
      lengthPoints: matched.lengthPoints,
      directionBonus: matched.directionBonus,
      difficultyBonus: matched.difficultyBonus,
      timestamp: Date.now(),
    },
  };

  if (allFound) {
    nextState = finishWordSearchGame(nextState, activeSeats, 'complete');
  }

  return {
    state: nextState,
    matched,
  };
}

export function revealWordSearchWord(rawState, activeSeats = []) {
  const state = normalizeWordSearchState(rawState);
  const target = state.words.find((word) => !word.found);
  if (!target) return state;

  const words = state.words.map((word) => (
    word.word === target.word
      ? {
          ...word,
          found: true,
          foundBy: 'reveal',
          foundAt: Date.now(),
          revealed: true,
        }
      : word
  ));

  let nextState = {
    ...state,
    words,
    last_action: {
      type: 'reveal',
      word: target.word,
      result: 'revealed',
      points: 0,
      timestamp: Date.now(),
    },
  };

  if (words.every((word) => word.found)) {
    nextState = finishWordSearchGame(nextState, activeSeats, 'complete');
  }

  return nextState;
}

export function publicWordSearchState(rawState, participants = [], viewerSeat = null) {
  const state = normalizeWordSearchState(rawState);
  const seat = Number(viewerSeat || 0);

  return {
    phase: state.phase,
    mode: state.mode,
    difficulty: state.difficulty,
    category: state.category,
    grid: state.grid,
    words: state.words.map((word) => ({
      word: word.word,
      found: word.found === true,
      foundBy: word.foundBy,
      foundAt: word.foundAt,
      cells: word.found ? word.cells : [],
      points: word.found ? word.points : null,
      directionLabel: word.found ? word.directionLabel : null,
      revealed: word.revealed === true,
    })),
    scores: { ...state.scores },
    activeSeat: Number(state.active_seat || 0),
    timeEnd: state.time_end,
    paused: state.paused === true,
    message: state.message,
    winnerSeat: state.winner_seat,
    lastAction: state.last_action,
    roundNumber: state.round_number,
    players: participants.map((player) => ({
      ...player,
      color: WORD_SEARCH_SEAT_COLORS[Number(player.seatNumber)] || '#FFFFFF',
      score: Number(state.scores[String(player.seatNumber)] || 0),
    })),
    mySeat: seat,
    myColor: WORD_SEARCH_SEAT_COLORS[seat] || '#FFFFFF',
  };
}
