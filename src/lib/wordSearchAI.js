/**
 * TexasNomad Word Search AI Engine
 *
 * The AI knows the word list (just like a human can see it) and searches
 * the board for those specific words. Character personality controls:
 *  - How long it takes to "find" a word (thinking delay)
 *  - How often it skips its turn (timeout/miss chance)
 *  - Word length preferences (some characters prefer easy short words)
 */

// ── Character AI Profiles ─────────────────────────────────────────────────────
export const WORD_SEARCH_AI_PROFILES = {
  berna: {
    name: 'Berna',
    minDelay: 6000,  maxDelay: 14000,
    missChance: 0.12,
    prefersLong: true,
  },
  dexter: {
    name: 'Dexter',
    minDelay: 4000,  maxDelay: 10000,
    missChance: 0.06,
    prefersLong: true,
  },
  lemonade: {
    name: 'Lemonade',
    minDelay: 2000,  maxDelay: 8000,
    missChance: 0.15,
    prefersLong: false,
  },
  carlos: {
    name: 'Carlos',
    minDelay: 5000,  maxDelay: 18000,
    missChance: 0.25,
    prefersLong: false,
  },
  violet: {
    name: 'Violet',
    minDelay: 7000,  maxDelay: 16000,
    missChance: 0.18,
    prefersLong: false,
  },
  tank: {
    name: 'Tank',
    minDelay: 10000, maxDelay: 22000,
    missChance: 0.20,
    prefersLong: true,
  },
};

/**
 * Main AI turn function.
 *
 * Receives the grid AND the word list (the AI can see what words to find,
 * just like a human player).
 *
 * Returns a Promise resolving to:
 *   { type: 'timeout' }              — AI missed this turn
 *   { type: 'submit', word, cells }  — AI found and submits a word
 */
export function runAITurn(grid, characterId, gameWords) {
  const profile = WORD_SEARCH_AI_PROFILES[characterId] || WORD_SEARCH_AI_PROFILES.carlos;
  const delay = profile.minDelay + Math.random() * (profile.maxDelay - profile.minDelay);

  return new Promise((resolve) => {
    setTimeout(() => {
      // Occasional miss — AI zones out
      if (Math.random() < profile.missChance) {
        resolve({ type: 'timeout' });
        return;
      }

      // Find all unfound words and locate them on the board
      const unfound = (gameWords || []).filter(w => !w.found);
      if (!unfound.length) {
        resolve({ type: 'timeout' });
        return;
      }

      // Sort by length preference
      const sorted = [...unfound].sort((a, b) =>
        profile.prefersLong ? b.word.length - a.word.length : a.word.length - b.word.length
      );

      // Pick from the top few candidates with some randomness
      const poolSize = Math.min(3, sorted.length);
      const picked = sorted[Math.floor(Math.random() * poolSize)];

      resolve({ type: 'submit', word: picked.word, cells: picked.cells });
    }, delay);
  });
}

/**
 * Validate a submitted word+cells against the game's word list.
 * Returns the matched word object if valid and not yet found, else null.
 */
export function validateAISubmission(word, cells, gameWords) {
  const match = gameWords.find(w => !w.found && w.word === word);
  if (!match) return null;
  const matchCells = [...match.cells].sort().join('|');
  const submittedCells = [...cells].sort().join('|');
  return matchCells === submittedCells ? match : null;
}