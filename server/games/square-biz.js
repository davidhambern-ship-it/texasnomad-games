import { eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { roomParticipants } from '../db/schema.js';
import {
  checkSquareBizAnswer,
  drawSquareBizQuestion,
  publicSquareBizQuestion,
} from './square-biz-trivia.js';

export const SQUARE_BIZ_MARKS = {
  X: { seatNumber: 2, color: '#ff0097', label: 'PLAYER X' },
  O: { seatNumber: 3, color: '#26b8ff', label: 'PLAYER O' },
};

const WIN_LINES = [
  [0,1,2], [3,4,5], [6,7,8],
  [0,3,6], [1,4,7], [2,5,8],
  [0,4,8], [2,4,6],
];

const INTRO_DURATION_MS = 15_000;
const QUESTION_READ_MS = 5_000;
const ANSWER_WINDOW_MS = 12_000;
const RESULT_HOLD_MS = 2_000;

export function defaultSquareBizState() {
  return {
    phase: 'lobby',
    board: Array(9).fill(null),
    current_mark: 'X',
    x_account_id: null,
    o_account_id: null,
    queue_account_ids: [],
    selected_square: null,
    current_question_id: null,
    current_question: null,
    current_choices: null,
    selected_answer: null,
    answer_result: null,
    correct_answer: null,
    correct_answer_text: null,
    used_question_ids: [],
    intro_started_at: null,
    intro_ends_at: null,
    choices_reveal_at: null,
    answer_deadline_at: null,
    result_ends_at: null,
    question_replay_nonce: 0,
    winner: null,
    winning_line: null,
    round_number: 0,
    last_action: null,
  };
}

export function normalizeSquareBizState(raw = {}) {
  const base = defaultSquareBizState();
  return {
    ...base,
    ...raw,
    board: Array.isArray(raw.board) && raw.board.length === 9
      ? raw.board.map((value) => value === 'X' || value === 'O' ? value : null)
      : [...base.board],
    queue_account_ids: Array.isArray(raw.queue_account_ids) ? raw.queue_account_ids : [],
    used_question_ids: Array.isArray(raw.used_question_ids) ? raw.used_question_ids : [],
  };
}

export function checkSquareBizWinner(board = []) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return { winner: null, line: null };
}

export function otherMark(mark) {
  return mark === 'X' ? 'O' : 'X';
}

export async function assignSquareBizPlayers(roomId, participants, executor = db) {
  const active = participants
    .filter((player) => !player.leftAt)
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

  if (!active.length) return [];

  // Clear all seats first so role rotation can never collide with the room/seat unique index.
  await executor
    .update(roomParticipants)
    .set({
      seatNumber: null,
      role: 'player',
      lastHeartbeatAt: new Date(),
    })
    .where(eq(roomParticipants.roomId, roomId));

  const assigned = [];

  for (let index = 0; index < active.length; index += 1) {
    const participant = active[index];
    const seatNumber = index === 0 ? 2 : index === 1 ? 3 : null;

    const [updated] = await executor
      .update(roomParticipants)
      .set({
        seatNumber,
        role: 'player',
        leftAt: null,
        lastHeartbeatAt: new Date(),
      })
      .where(eq(roomParticipants.id, participant.id))
      .returning();

    assigned.push(updated);
  }

  return assigned;
}

export function syncSquareBizRoster(rawState, participants = []) {
  const state = normalizeSquareBizState(rawState);
  if (!['lobby', 'finished'].includes(state.phase)) return state;

  const active = [...participants]
    .filter((player) => !player.leftAt)
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

  const xAccountId = active[0]?.accountId || null;
  const oAccountId = active[1]?.accountId || null;
  const queueIds = active.slice(2).map((player) => player.accountId);

  return {
    ...state,
    x_account_id: xAccountId,
    o_account_id: oAccountId,
    queue_account_ids: queueIds,
  };
}

function playerForMark(state, mark) {
  return mark === 'X' ? state.x_account_id : state.o_account_id;
}

function clearQuestion(state) {
  return {
    ...state,
    selected_square: null,
    current_question_id: null,
    current_question: null,
    current_choices: null,
    selected_answer: null,
    answer_result: null,
    correct_answer: null,
    correct_answer_text: null,
    choices_reveal_at: null,
    answer_deadline_at: null,
    result_ends_at: null,
  };
}

export function startSquareBizRound(rawState, participants, {
  introDurationMs = INTRO_DURATION_MS,
} = {}) {
  const state = normalizeSquareBizState(rawState);
  const players = [...participants]
    .filter((player) => !player.leftAt)
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

  if (players.length < 2) {
    const error = new Error('Square Biz needs two active players before the round can start.');
    error.statusCode = 409;
    error.code = 'SQUARE_BIZ_TWO_PLAYERS_REQUIRED';
    throw error;
  }

  const now = Date.now();
  return {
    ...defaultSquareBizState(),
    phase: 'intro',
    x_account_id: players[0].accountId,
    o_account_id: players[1].accountId,
    queue_account_ids: players.slice(2).map((player) => player.accountId),
    intro_started_at: now,
    intro_ends_at: now + Math.max(1_000, Number(introDurationMs || INTRO_DURATION_MS)),
    round_number: Number(state.round_number || 0) + 1,
    last_action: {
      type: 'round_started',
      timestamp: now,
    },
  };
}

export function skipSquareBizIntro(rawState) {
  const state = normalizeSquareBizState(rawState);
  if (state.phase !== 'intro') return state;

  return {
    ...state,
    phase: 'board',
    intro_ends_at: Date.now(),
    last_action: {
      type: 'intro_skipped',
      timestamp: Date.now(),
    },
  };
}

export async function selectSquareBizSquare(rawState, {
  actorAccountId,
  squareIndex,
  executor = db,
}) {
  let state = normalizeSquareBizState(rawState);
  state = advanceSquareBizClock(state);

  if (state.phase !== 'board') {
    const error = new Error('Wait until the Square Biz board is ready.');
    error.statusCode = 409;
    error.code = 'SQUARE_BIZ_BOARD_NOT_READY';
    throw error;
  }

  const mark = state.current_mark;
  const expectedAccountId = playerForMark(state, mark);
  if (String(actorAccountId) !== String(expectedAccountId)) {
    const error = new Error(`It is Player ${mark}'s turn.`);
    error.statusCode = 409;
    error.code = 'SQUARE_BIZ_NOT_YOUR_TURN';
    throw error;
  }

  const index = Number(squareIndex);
  if (!Number.isInteger(index) || index < 0 || index > 8) {
    const error = new Error('Choose a valid Square Biz square.');
    error.statusCode = 400;
    error.code = 'INVALID_SQUARE_BIZ_SQUARE';
    throw error;
  }

  if (state.board[index]) {
    const error = new Error('That square is already claimed.');
    error.statusCode = 409;
    error.code = 'SQUARE_BIZ_SQUARE_TAKEN';
    throw error;
  }

  const question = await drawSquareBizQuestion({
    excludeIds: state.used_question_ids,
    executor,
  });

  const now = Date.now();
  return {
    ...state,
    phase: 'question_read',
    selected_square: index,
    current_question_id: question.id,
    current_question: question.question,
    current_choices: question.choices,
    selected_answer: null,
    answer_result: null,
    correct_answer: null,
    correct_answer_text: null,
    used_question_ids: [...state.used_question_ids, question.id],
    choices_reveal_at: now + QUESTION_READ_MS,
    answer_deadline_at: now + QUESTION_READ_MS + ANSWER_WINDOW_MS,
    result_ends_at: null,
    last_action: {
      type: 'square_selected',
      mark,
      squareIndex: index,
      questionId: question.id,
      timestamp: now,
    },
  };
}

export async function answerSquareBizQuestion(rawState, {
  actorAccountId,
  answer,
  executor = db,
}) {
  let state = normalizeSquareBizState(rawState);
  state = advanceSquareBizClock(state);

  if (!['question_read', 'answering'].includes(state.phase)) {
    const error = new Error('There is no active Square Biz question to answer.');
    error.statusCode = 409;
    error.code = 'SQUARE_BIZ_NO_ACTIVE_QUESTION';
    throw error;
  }

  const now = Date.now();
  if (state.choices_reveal_at && now < Number(state.choices_reveal_at)) {
    const error = new Error('The answer choices are not visible yet.');
    error.statusCode = 409;
    error.code = 'SQUARE_BIZ_CHOICES_NOT_READY';
    throw error;
  }

  const mark = state.current_mark;
  const expectedAccountId = playerForMark(state, mark);
  if (String(actorAccountId) !== String(expectedAccountId)) {
    const error = new Error(`Only Player ${mark} can answer this question.`);
    error.statusCode = 409;
    error.code = 'SQUARE_BIZ_NOT_YOUR_TURN';
    throw error;
  }

  const result = await checkSquareBizAnswer(
    state.current_question_id,
    answer,
    executor,
  );

  let board = [...state.board];
  let winner = null;
  let winningLine = null;

  if (result.correct) {
    board[state.selected_square] = mark;
    const outcome = checkSquareBizWinner(board);
    winner = outcome.winner;
    winningLine = outcome.line;
  }

  return {
    ...state,
    phase: 'result',
    board,
    selected_answer: String(answer || '').trim().toUpperCase(),
    answer_result: result.correct,
    correct_answer: result.correctAnswer,
    correct_answer_text: result.correctAnswerText,
    result_ends_at: now + RESULT_HOLD_MS,
    winner,
    winning_line: winningLine,
    last_action: {
      type: 'answer',
      mark,
      squareIndex: state.selected_square,
      result: result.correct ? 'correct' : 'wrong',
      answer: String(answer || '').trim().toUpperCase(),
      correctAnswer: result.correctAnswer,
      timestamp: now,
    },
  };
}

export function replaySquareBizQuestion(rawState) {
  const state = normalizeSquareBizState(rawState);
  if (!state.current_question_id) return state;

  const now = Date.now();
  return {
    ...state,
    phase: 'question_read',
    selected_answer: null,
    answer_result: null,
    correct_answer: null,
    correct_answer_text: null,
    choices_reveal_at: now + QUESTION_READ_MS,
    answer_deadline_at: now + QUESTION_READ_MS + ANSWER_WINDOW_MS,
    result_ends_at: null,
    question_replay_nonce: Number(state.question_replay_nonce || 0) + 1,
    last_action: {
      type: 'question_replayed',
      mark: state.current_mark,
      questionId: state.current_question_id,
      timestamp: now,
    },
  };
}

export function resetSquareBizBoard(rawState) {
  const state = normalizeSquareBizState(rawState);
  return {
    ...clearQuestion(state),
    phase: 'board',
    board: Array(9).fill(null),
    current_mark: 'X',
    used_question_ids: [],
    winner: null,
    winning_line: null,
    last_action: {
      type: 'board_reset',
      timestamp: Date.now(),
    },
  };
}

export function forceNextSquareBizTurn(rawState) {
  const state = normalizeSquareBizState(rawState);
  return {
    ...clearQuestion(state),
    phase: 'board',
    current_mark: otherMark(state.current_mark),
    last_action: {
      type: 'turn_forced',
      mark: otherMark(state.current_mark),
      timestamp: Date.now(),
    },
  };
}

export function advanceSquareBizClock(rawState) {
  let state = normalizeSquareBizState(rawState);
  const now = Date.now();

  if (state.phase === 'intro' && state.intro_ends_at && now >= Number(state.intro_ends_at)) {
    state = {
      ...state,
      phase: 'board',
      last_action: {
        type: 'intro_complete',
        timestamp: now,
      },
    };
  }

  if (state.phase === 'question_read' && state.choices_reveal_at && now >= Number(state.choices_reveal_at)) {
    state = {
      ...state,
      phase: 'answering',
      last_action: {
        ...(state.last_action || {}),
        choicesVisibleAt: now,
      },
    };
  }

  if (
    ['question_read', 'answering'].includes(state.phase) &&
    state.answer_deadline_at &&
    now >= Number(state.answer_deadline_at)
  ) {
    state = {
      ...state,
      phase: 'result',
      selected_answer: null,
      answer_result: false,
      correct_answer: null,
      correct_answer_text: null,
      result_ends_at: now + RESULT_HOLD_MS,
      last_action: {
        type: 'answer_timeout',
        mark: state.current_mark,
        squareIndex: state.selected_square,
        result: 'timeout',
        timestamp: now,
      },
    };
  }

  if (state.phase === 'result' && state.result_ends_at && now >= Number(state.result_ends_at)) {
    if (state.winner) {
      state = {
        ...state,
        phase: 'finished',
        result_ends_at: null,
        last_action: {
          ...(state.last_action || {}),
          gameResult: 'win',
          winner: state.winner,
        },
      };
    } else {
      const nextMark = otherMark(state.current_mark);
      state = {
        ...clearQuestion(state),
        phase: 'board',
        current_mark: nextMark,
        last_action: {
          type: 'turn_changed',
          mark: nextMark,
          timestamp: now,
        },
      };
    }
  }

  return state;
}

export function publicSquareBizState(rawState, participants = [], viewerAccountId = null, {
  host = false,
} = {}) {
  const state = advanceSquareBizClock(rawState);
  const currentAccountId = playerForMark(state, state.current_mark);
  const choicesVisible = ['answering', 'result', 'finished'].includes(state.phase);
  const revealAnswer = ['result', 'finished'].includes(state.phase);

  const players = participants.map((participant) => {
    const mark = participant.accountId === state.x_account_id
      ? 'X'
      : participant.accountId === state.o_account_id
        ? 'O'
        : null;

    const queueIndex = state.queue_account_ids.indexOf(participant.accountId);

    return {
      accountId: participant.accountId,
      name: participant.name,
      handle: participant.handle,
      seatNumber: participant.seatNumber,
      mark,
      color: mark ? SQUARE_BIZ_MARKS[mark].color : '#FFD700',
      role: mark ? 'player' : 'viewer',
      queuePosition: queueIndex >= 0 ? queueIndex + 1 : null,
      isCurrent: Boolean(mark && mark === state.current_mark),
    };
  });

  const currentQuestion = state.current_question_id
    ? {
        id: state.current_question_id,
        question: state.current_question,
        choices: choicesVisible ? state.current_choices : null,
      }
    : null;

  return {
    phase: state.phase,
    board: state.board,
    currentMark: state.current_mark,
    selectedSquare: state.selected_square,
    currentQuestion,
    choicesRevealAt: state.choices_reveal_at,
    answerDeadlineAt: state.answer_deadline_at,
    resultEndsAt: state.result_ends_at,
    selectedAnswer: state.selected_answer,
    answerResult: state.answer_result,
    correctAnswer: revealAnswer || host ? state.correct_answer : null,
    correctAnswerText: revealAnswer || host ? state.correct_answer_text : null,
    introStartedAt: state.intro_started_at,
    introEndsAt: state.intro_ends_at,
    questionReplayNonce: state.question_replay_nonce,
    winner: state.winner,
    winningLine: state.winning_line,
    roundNumber: state.round_number,
    players,
    currentPlayerAccountId: currentAccountId,
    myMark: participants.find((participant) => participant.accountId === viewerAccountId)?.accountId === state.x_account_id
      ? 'X'
      : participants.find((participant) => participant.accountId === viewerAccountId)?.accountId === state.o_account_id
        ? 'O'
        : null,
    canSelectSquare:
      state.phase === 'board' &&
      String(viewerAccountId || '') === String(currentAccountId || ''),
    canAnswer:
      ['question_read', 'answering'].includes(state.phase) &&
      String(viewerAccountId || '') === String(currentAccountId || ''),
    lastAction: state.last_action,
  };
}
