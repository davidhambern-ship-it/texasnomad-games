/**
 * TexasNomad Word Search AI — Fair Play Engine
 *
 * The AI does NOT access the answer list.
 * It simulates real board searching by walking connected letter paths,
 * building candidate words, and submitting them to the normal validator.
 *
 * Character personality and difficulty control:
 *  - How long the AI takes to "think"
 *  - Maximum path/word length it attempts
 *  - How likely it is to time out or submit a bad guess
 */

// ── Character AI Profiles ─────────────────────────────────────────────────────
export const WORD_SEARCH_AI_PROFILES = {
  berna: {
    name: 'Berna',
    difficulty: 7,
    minDelay: 8000,   maxDelay: 20000,
    minLen: 4,        maxLen: 8,
    mistakeRate: 0.18,
    timeoutChance: 0.08,
    riskLevel: 0.65,        // prefers medium-length words, adapts
    shortWordBias: 0.3,     // low = prefers longer paths
    pathAttempts: 60,
  },
  dexter: {
    name: 'Dexter',
    difficulty: 8,
    minDelay: 7000,   maxDelay: 18000,
    minLen: 5,        maxLen: 9,
    mistakeRate: 0.12,
    timeoutChance: 0.06,
    riskLevel: 0.40,
    shortWordBias: 0.15,
    pathAttempts: 80,
  },
  lemonade: {
    name: 'Lemonade',
    difficulty: 7,
    minDelay: 3000,   maxDelay: 12000,
    minLen: 3,        maxLen: 10,
    mistakeRate: 0.30,
    timeoutChance: 0.10,
    riskLevel: 0.90,         // goes for long/risky paths
    shortWordBias: 0.10,
    pathAttempts: 45,
  },
  carlos: {
    name: 'Carlos',
    difficulty: 5,
    minDelay: 5000,   maxDelay: 22000,
    minLen: 3,        maxLen: 6,
    mistakeRate: 0.40,
    timeoutChance: 0.18,
    riskLevel: 0.55,
    shortWordBias: 0.55,     // often grabs short words
    pathAttempts: 30,
  },
  violet: {
    name: 'Violet',
    difficulty: 6,
    minDelay: 8000,   maxDelay: 20000,
    minLen: 4,        maxLen: 7,
    mistakeRate: 0.20,
    timeoutChance: 0.10,
    riskLevel: 0.30,
    shortWordBias: 0.45,
    pathAttempts: 50,
  },
  tank: {
    name: 'Tank',
    difficulty: 7,
    minDelay: 12000,  maxDelay: 28000,
    minLen: 4,        maxLen: 7,
    mistakeRate: 0.15,
    timeoutChance: 0.14,
    riskLevel: 0.25,
    shortWordBias: 0.50,
    pathAttempts: 55,
  },
};

const DIRS = [
  { dx:  1, dy:  0 }, { dx: -1, dy:  0 },
  { dx:  0, dy:  1 }, { dx:  0, dy: -1 },
  { dx:  1, dy:  1 }, { dx: -1, dy:  1 },
  { dx:  1, dy: -1 }, { dx: -1, dy: -1 },
];

// ── Board Path Walker (no answer-list access) ─────────────────────────────────
/**
 * Walks the grid from a random start cell in a straight direction,
 * building a letter string of `length` characters.
 * Returns the string and cell IDs, or null if out-of-bounds.
 */
function walkPath(grid, startY, startX, dir, length) {
  const size = grid.length;
  const cells = [];
  let word = '';
  for (let i = 0; i < length; i++) {
    const ny = startY + dir.dy * i;
    const nx = startX + dir.dx * i;
    if (ny < 0 || nx < 0 || ny >= size || nx >= size) return null;
    word += grid[ny][nx];
    cells.push(`${ny}-${nx}`);
  }
  return { word, cells };
}

/**
 * AI board search: generate candidate words by randomly walking the grid.
 * Does NOT check against the word list. Returns an array of {word, cells}.
 */
function generateCandidates(grid, profile, count = 12) {
  const size = grid.length;
  const candidates = [];
  const attempts = profile.pathAttempts * 2;

  for (let i = 0; i < attempts && candidates.length < count; i++) {
    // Pick a random length based on profile preferences
    const useShort = Math.random() < profile.shortWordBias;
    const minL = useShort ? 3 : profile.minLen;
    const maxL = useShort ? Math.min(5, profile.maxLen) : profile.maxLen;
    const length = minL + Math.floor(Math.random() * (maxL - minL + 1));

    const y = Math.floor(Math.random() * size);
    const x = Math.floor(Math.random() * size);
    const dir = DIRS[Math.floor(Math.random() * DIRS.length)];

    const result = walkPath(grid, y, x, dir, length);
    if (result) candidates.push(result);
  }

  return candidates;
}

/**
 * Pick the best candidate from the list based on character personality.
 * "Best" is defined by personality, NOT by checking the answer key.
 */
function pickCandidate(candidates, profile) {
  if (!candidates.length) return null;

  // Lemonade & Berna: bias toward longer words (higher potential points)
  if (profile.riskLevel > 0.7) {
    const sorted = [...candidates].sort((a, b) => b.word.length - a.word.length);
    // Pick from top 3 longest
    return sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
  }

  // Dexter: slight preference for medium-long words
  if (profile.riskLevel < 0.45) {
    const filtered = candidates.filter(c => c.word.length >= profile.minLen);
    if (filtered.length) return filtered[Math.floor(Math.random() * filtered.length)];
  }

  // Everyone else: random pick
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Main AI turn function.
 *
 * Returns a Promise that resolves to:
 *   { type: 'timeout' }            — AI ran out of time
 *   { type: 'submit', word, cells } — AI submits a word path
 *
 * The caller must validate the word against the game's word list.
 * This function never accesses the word list itself.
 */
export function runAITurn(grid, characterId) {
  const profile = WORD_SEARCH_AI_PROFILES[characterId] || WORD_SEARCH_AI_PROFILES.carlos;

  return new Promise((resolve) => {
    // Decide whether to time out this turn
    if (Math.random() < profile.timeoutChance) {
      const timeoutDelay = profile.maxDelay * 0.85 + Math.random() * profile.maxDelay * 0.15;
      setTimeout(() => resolve({ type: 'timeout' }), timeoutDelay);
      return;
    }

    // Compute a thinking delay within the profile range
    const delay = profile.minDelay + Math.random() * (profile.maxDelay - profile.minDelay);

    setTimeout(() => {
      // Generate board-derived candidates (no answer list access)
      const candidates = generateCandidates(grid, profile);
      const picked = pickCandidate(candidates, profile);

      if (!picked) {
        resolve({ type: 'timeout' });
        return;
      }

      resolve({ type: 'submit', word: picked.word, cells: picked.cells });
    }, delay);
  });
}

/**
 * Validate a submitted word+cells against the game's word list.
 * This is the ONLY place the answer list is accessed — same as for humans.
 *
 * Returns the matched word object if found and not yet found, else null.
 */
export function validateAISubmission(word, cells, gameWords) {
  // Check exact match
  const match = gameWords.find(w => !w.found && w.word === word);
  if (match) {
    // Verify cells match (same set)
    const matchCells = [...match.cells].sort().join('|');
    const submittedCells = [...cells].sort().join('|');
    if (matchCells === submittedCells) return match;
  }
  // Also check reverse (word walked backwards)
  const reversed = word.split('').reverse().join('');
  const matchRev = gameWords.find(w => !w.found && w.word === reversed);
  if (matchRev) {
    const matchCells = [...matchRev.cells].sort().join('|');
    const submittedCells = [...cells].sort().join('|');
    if (matchCells === submittedCells) return matchRev;
  }
  return null;
}