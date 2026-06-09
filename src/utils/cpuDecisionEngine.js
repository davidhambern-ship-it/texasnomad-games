/**
 * TexasNomad CPU Decision Engine
 * Personality-based AI decision logic for all current games.
 * Each character makes decisions based on difficulty, traits, and game profile.
 *
 * Difficulty tiers:
 *   1–3: mostly random legal moves
 *   4–6: basic strategy with personality flavor
 *   7–8: strong strategy with occasional personality-based mistakes
 *   9–10: advanced strategy, memory, blocking, adaptation
 *
 * CPU characters are allowed to make mistakes.
 * CPU characters never cheat.
 * CPU characters only make legal moves.
 */

/**
 * Get normalized personality modifiers for a character (0.0–1.0 scale).
 */
export function getCpuPersonalityModifier(character) {
  return {
    risk: character.traits.riskTaking / 100,
    strategy: character.traits.intelligence / 100,
    patience: character.traits.patience / 100,
    chaos: character.traits.chaos / 100,
    difficulty: character.difficulty / 10
  };
}

/**
 * Should the CPU make a mistake right now?
 * Higher chaos + lower difficulty = more mistakes.
 */
export function shouldMakeMistake(character) {
  const mod = getCpuPersonalityModifier(character);
  // Mistake chance: high at low difficulty, amplified by chaos
  const mistakeChance = (1 - mod.difficulty) * 0.5 + mod.chaos * 0.2;
  return Math.random() < mistakeChance;
}

/**
 * Should the CPU take a risky action?
 */
export function shouldTakeRisk(character, gameContext = {}) {
  const mod = getCpuPersonalityModifier(character);
  // Risk base from trait, adjusted by whether they're losing (higher risk when behind)
  const behindBonus = gameContext.isBehind ? 0.15 : 0;
  const riskChance = mod.risk + behindBonus;
  return Math.random() < riskChance;
}

/**
 * Pick a random item from an array (for chaos/random decisions).
 */
export function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick the best item from an array using a scoring function,
 * with personality-based noise added to simulate imperfect play.
 */
export function pickWithPersonality(arr, scoreFn, character) {
  if (!arr || arr.length === 0) return null;
  const mod = getCpuPersonalityModifier(character);

  const scored = arr.map(item => ({
    item,
    score: scoreFn(item) + (Math.random() * mod.chaos * 40) - (mod.strategy * 5)
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0].item;
}

// ─────────────────────────────────────────────────────────────────────────────
// HANGMAN CPU
// ─────────────────────────────────────────────────────────────────────────────

// Letter frequency in English (most to least common)
const LETTER_FREQUENCY = ['e','t','a','o','i','n','s','h','r','d','l','c','u','m','w','f','g','y','p','b','v','k','j','x','q','z'];

/**
 * Get the CPU's next letter guess for Hangman.
 * @param {string[]} guessedLetters - Already guessed letters
 * @param {string[]} revealedPattern - e.g. ['_','a','_','_'] (null = unrevealed)
 * @param {object} character - CPU character object
 */
export function getCpuHangmanGuess(guessedLetters, revealedPattern, character) {
  const available = LETTER_FREQUENCY.filter(l => !guessedLetters.includes(l));
  if (available.length === 0) return null;

  const mod = getCpuPersonalityModifier(character);
  const profile = character.gameProfiles?.hangman;

  // Difficulty 1–3: pure random
  if (character.difficulty <= 3) return pickRandom(available);

  // Carlos / Lemonade: high chaos — sometimes picks a random letter
  if (mod.chaos > 0.7 && Math.random() < mod.chaos * 0.6) {
    return pickRandom(available);
  }

  // Letter frequency strategy (Dexter/Tank/Violet prefer this)
  if (profile?.style === 'letter_frequency' || profile?.style === 'methodical_solver' || profile?.style === 'calm_solver') {
    // Pick top frequency letter not yet guessed
    return available[0];
  }

  // Berna: pattern-aware — if vowels not yet tried, prioritize them
  if (profile?.style === 'pattern_reader') {
    const vowels = ['e','a','o','i','u'].filter(v => !guessedLetters.includes(v));
    if (vowels.length > 0 && Math.random() < 0.6) return vowels[0];
    return available[0];
  }

  // Lemonade: risky — sometimes skips to uncommon letters
  if (profile?.style === 'risky_guesser') {
    if (Math.random() < 0.4) {
      const uncommon = [...available].reverse();
      return uncommon[0];
    }
    return available[Math.floor(Math.random() * Math.min(5, available.length))];
  }

  // Default: frequency-based with slight noise
  const idx = Math.floor(Math.random() * Math.min(3 + Math.round(mod.chaos * 5), available.length));
  return available[idx];
}

// ─────────────────────────────────────────────────────────────────────────────
// SQUARE BIZ CPU
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get CPU's preferred board position for Square Biz (0–8 index on 3x3 grid).
 * @param {(string|null)[]} board - 9-cell array, null = empty, 'X'/'O' = taken
 * @param {string} cpuMark - 'X' or 'O'
 * @param {object} character - CPU character
 */
export function getCpuSquareBizMove(board, cpuMark, character) {
  const opponentMark = cpuMark === 'X' ? 'O' : 'X';
  const empty = board.map((v, i) => v === null ? i : -1).filter(i => i !== -1);
  if (empty.length === 0) return null;

  const mod = getCpuPersonalityModifier(character);
  const profile = character.gameProfiles?.squareBiz;

  // Difficulty 1–3: random
  if (character.difficulty <= 3) return pickRandom(empty);

  // Carlos: vibes-based — 50% random
  if (profile?.style === 'vibes_based' && Math.random() < 0.5) return pickRandom(empty);

  const winningMove = findWinningMove(board, cpuMark, empty);
  const blockingMove = findWinningMove(board, opponentMark, empty);

  // Lemonade: attack first, almost never blocks unless it's an immediate loss
  if (profile?.style === 'attack_first') {
    if (winningMove !== null) return winningMove;
    if (Math.random() < 0.85 && blockingMove !== null) return blockingMove; // sometimes ignores block
    return pickPreferredPosition(empty, 'attack');
  }

  // Dexter/Tank: defensive — block first, then attack
  if (profile?.style === 'defensive_controller' || profile?.style === 'defensive_master') {
    if (winningMove !== null) return winningMove;
    if (blockingMove !== null) return blockingMove;
    return pickPreferredPosition(empty, 'defense');
  }

  // Berna/Violet: balanced
  if (winningMove !== null) return winningMove;
  if (blockingMove !== null) return blockingMove;
  return pickPreferredPosition(empty, 'balanced');
}

function findWinningMove(board, mark, empty) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a, b, c] of lines) {
    const cells = [board[a], board[b], board[c]];
    const marks = cells.filter(x => x === mark).length;
    const nulls = cells.filter(x => x === null).length;
    if (marks === 2 && nulls === 1) {
      const idx = [a, b, c].find(i => board[i] === null);
      if (empty.includes(idx)) return idx;
    }
  }
  return null;
}

function pickPreferredPosition(empty, mode) {
  // Priority: center > corners > edges
  const priority = mode === 'attack' ? [4, 0, 2, 6, 8, 1, 3, 5, 7]
    : mode === 'defense' ? [4, 0, 2, 6, 8, 1, 3, 5, 7]
    : [4, 0, 2, 6, 8, 1, 3, 5, 7];
  for (const pos of priority) {
    if (empty.includes(pos)) return pos;
  }
  return empty[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// BFF CPU
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Common "safe" survey-style answers used by strategic characters.
 * These are high-frequency Family Feud-style answers.
 */
const COMMON_SURVEY_KEYWORDS = [
  'money','food','family','love','work','car','house','phone','sleep','friends',
  'school','doctor','hospital','vacation','clothes','tv','music','sports','dog','cat',
  'dinner','lunch','breakfast','party','game','stress','happy','tired','angry','sick'
];

/**
 * Simulate a CPU answer attempt for BFF.
 * Returns { shouldGuess: boolean, guess: string|null, delay: number }
 * @param {object[]} answers - Array of {text, points, revealed}
 * @param {object} character
 * @param {object} context - { roundBank, byeCount, isStealMode }
 */
export function getCpuBffDecision(answers, character, context = {}) {
  const mod = getCpuPersonalityModifier(character);
  const profile = character.gameProfiles?.bff;
  const unrevealed = answers.filter(a => !a.revealed);
  if (unrevealed.length === 0) return { shouldGuess: false, guess: null, delay: 0 };

  // Lemonade: always buzzes fast with impulsive guesses
  if (profile?.style === 'fast_buzzer') {
    const delay = 800 + Math.random() * 600;
    if (Math.random() < 0.3) {
      // Risky random guess
      const randomAnswer = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      return { shouldGuess: true, guess: randomAnswer.text, delay };
    }
    return { shouldGuess: true, guess: getBestGuess(unrevealed, mod), delay };
  }

  // Carlos: comedic — sometimes guesses a random unrevealed, sometimes the best
  if (profile?.style === 'comedy_guesser') {
    const delay = 1500 + Math.random() * 2000;
    if (Math.random() < mod.chaos * 0.7) {
      return { shouldGuess: true, guess: pickRandom(unrevealed)?.text, delay };
    }
    return { shouldGuess: true, guess: getBestGuess(unrevealed, mod), delay };
  }

  // Tank: waits longer, picks safest answer
  if (profile?.style === 'answer_eliminator') {
    const delay = 3000 + Math.random() * 2000;
    const safest = [...unrevealed].sort((a, b) => b.points - a.points)[0];
    return { shouldGuess: true, guess: safest?.text, delay };
  }

  // Dexter: surveys the best answer methodically
  if (profile?.style === 'survey_logic') {
    const delay = 2000 + Math.random() * 1500;
    return { shouldGuess: true, guess: getBestGuess(unrevealed, mod), delay };
  }

  // Default (Berna, Violet): balanced
  const delay = 1500 + Math.random() * 2000;
  return { shouldGuess: true, guess: getBestGuess(unrevealed, mod), delay };
}

function getBestGuess(unrevealed, mod) {
  // Higher strategy = picks highest point answer; higher chaos = more random
  if (Math.random() < mod.chaos * 0.4) return pickRandom(unrevealed)?.text;
  return [...unrevealed].sort((a, b) => b.points - a.points)[0]?.text;
}