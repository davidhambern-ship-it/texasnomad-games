/**
 * TexasNomad Dialogue & Interaction Rules
 * Triggered at key moments during gameplay.
 * Rules: short, non-blocking, personality-consistent, game-show friendly.
 */

export const RELATIONSHIP_DIALOGUE = [
  {
    trigger: "lemonade_risky_move",
    speakers: ["tank", "lemonade"],
    lines: [
      { characterId: "tank", text: "That was reckless." },
      { characterId: "lemonade", text: "That was legendary." }
    ]
  },
  {
    trigger: "carlos_bad_move",
    speakers: ["dexter", "carlos"],
    lines: [
      { characterId: "dexter", text: "That statistically made no sense." },
      { characterId: "carlos", text: "Yeah, but it felt right." }
    ]
  },
  {
    trigger: "tank_close_win",
    speakers: ["lemonade", "tank"],
    lines: [
      { characterId: "lemonade", text: "I almost had you." },
      { characterId: "tank", text: "Almost doesn't count." }
    ]
  },
  {
    trigger: "dexter_blocks_player",
    speakers: ["dexter"],
    lines: [
      { characterId: "dexter", text: "You left that open." }
    ]
  },
  {
    trigger: "berna_comeback",
    speakers: ["berna"],
    lines: [
      { characterId: "berna", text: "Momentum just changed." }
    ]
  },
  {
    trigger: "violet_calms_team",
    speakers: ["violet"],
    lines: [
      { characterId: "violet", text: "Stay focused. There's still another move." }
    ]
  },
  {
    trigger: "carlos_random_win",
    speakers: ["carlos", "dexter"],
    lines: [
      { characterId: "carlos", text: "See! I had a strategy!" },
      { characterId: "dexter", text: "That was not a strategy." }
    ]
  }
];

/**
 * Dialogue display rules:
 * - Dialogue should be short.
 * - Do not interrupt gameplay too often.
 * - Show dialogue in a small speech bubble or side panel.
 * - Trigger at key moments only (win, loss, mistake, comeback, steal, etc.).
 * - Never block core gameplay controls.
 * - Characters should stay in personality.
 * - Tone: funny, competitive, game-show friendly.
 */

export const DIALOGUE_COOLDOWN_MS = 8000; // min 8s between dialogue lines

/**
 * Get a random dialogue line for a character at a given moment.
 * moment: 'gameStart' | 'winning' | 'losing' | 'mistake' | 'comeback' | 'win' | 'loss'
 */
export function getDialogueLine(character, moment) {
  const lines = character?.dialogue?.[moment];
  if (!lines || lines.length === 0) return null;
  return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * Get a random catchphrase for a character.
 */
export function getCatchphrase(character) {
  const phrases = character?.catchphrases;
  if (!phrases || phrases.length === 0) return null;
  return phrases[Math.floor(Math.random() * phrases.length)];
}

/**
 * Map game state to a dialogue moment key.
 */
export function getMomentFromState({ playerScore, cpuScore, roundsLeft, justMadeMistake, justMadeComeback }) {
  if (justMadeMistake) return 'mistake';
  if (justMadeComeback) return 'comeback';
  if (playerScore > cpuScore && roundsLeft <= 2) return 'losing';
  if (cpuScore > playerScore && roundsLeft <= 2) return 'winning';
  return null;
}