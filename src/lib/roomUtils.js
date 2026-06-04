import { base44 } from '@/api/base44Client';

const GAME_PATHS = {
  bff: '/games/bff',
  'square-biz': '/games/square-biz',
  hangman: '/games/hangman',
};

export function generateRoomCode(prefix = 'TN') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix;
  for (let i = 0; i < 3; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function getDefaultGameState(gameId) {
  switch (gameId) {
    case 'bff':
      return {
        phase: 'setup',
        family1: 'Family 1',
        family2: 'Family 2',
        score1: 0,
        score2: 0,
        active_turn: 1,
        round_bank: 0,
        current_question: '',
        answers: [],
        sound_on: true,
        dead_reveal: false,
        round: 1,
      };
    case 'square-biz':
      return {
        phase: 'playing',
        display_mode: null,
        board: Array(9).fill(''),
        current_turn: 'X',
        current_question: '',
        current_choices: null,
        correct_answer: null,
        show_question: false,
        show_choices: false,
        selected_square: null,
        trivia_idx: 0,
        popup: null,
        music_on: true,
        winner: null,
      };
    case 'hangman':
      return {
        phase: 'setup',
        secret_word: '',
        category: '',
        hint: '',
        hint_revealed: false,
        word_revealed: false,
        guessed_letters: [],
        wrong_letters: [],
        max_wrong: 6,
      };
    default:
      return {};
  }
}

/**
 * Creates a new game room and redirects the browser to the game page.
 * @param {string} gameId - 'bff' | 'square-biz' | 'hangman'
 */
export async function createRoomAndJoin(gameId) {
  const roomCode = generateRoomCode();
  await base44.entities.GameRoom.create({
    room_code: roomCode,
    game_id: gameId,
    status: 'waiting',
    host_connected: false,
    screen_connected: false,
    players_connected: 0,
    game_state: getDefaultGameState(gameId),
    last_command: null,
  });
  window.location.href = `${GAME_PATHS[gameId]}?room=${roomCode}`;
}