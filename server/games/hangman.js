export const HANGMAN_SEATS = [1, 2, 3, 4];

export function defaultHangmanState() {
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
    round_number: 1,
    word_setter_seat: 1,
    next_setter_seat: 1,
    current_turn_seat: null,
    scores: { '1': 0, '2': 0, '3': 0, '4': 0 },
    round_start_scores: { '1': 0, '2': 0, '3': 0, '4': 0 },
    last_action: null,
    round_result: null,
    winner_seat: null,
    winner_player_id: null,
  };
}

export function normalizedHangmanState(raw = {}) {
  const base = defaultHangmanState();
  return {
    ...base,
    ...raw,
    guessed_letters: Array.isArray(raw.guessed_letters) ? raw.guessed_letters : [],
    wrong_letters: Array.isArray(raw.wrong_letters) ? raw.wrong_letters : [],
    scores: {
      ...base.scores,
      ...(raw.scores && typeof raw.scores === 'object' ? raw.scores : {}),
    },
    round_start_scores: {
      ...base.round_start_scores,
      ...(raw.round_start_scores && typeof raw.round_start_scores === 'object'
        ? raw.round_start_scores
        : {}),
    },
  };
}

export function maskedHangmanWord(secretWord, guessedLetters, revealWord = false) {
  const guessed = Array.isArray(guessedLetters) ? guessedLetters : [];
  return String(secretWord || '')
    .toUpperCase()
    .split('')
    .map((character) => {
      if (character === ' ') return ' ';
      if (revealWord || guessed.includes(character)) return character;
      return '_';
    })
    .join('');
}

export function nextHangmanGuessSeat(activeSeats, setterSeat, fromSeat = setterSeat) {
  const seats = [...new Set(
    (activeSeats || [])
      .map(Number)
      .filter((seat) => HANGMAN_SEATS.includes(seat) && seat !== Number(setterSeat)),
  )].sort((a, b) => a - b);

  if (seats.length === 0) return null;

  const sortedAll = [...HANGMAN_SEATS];
  const startIndex = Math.max(0, sortedAll.indexOf(Number(fromSeat)));

  for (let offset = 1; offset <= sortedAll.length; offset += 1) {
    const candidate = sortedAll[(startIndex + offset) % sortedAll.length];
    if (seats.includes(candidate)) return candidate;
  }

  return seats[0];
}

function addScore(scores, seatNumber, points) {
  const next = { ...(scores || {}) };
  const key = String(seatNumber);
  next[key] = Number(next[key] || 0) + Number(points || 0);
  return next;
}

function letterOccurrences(secretWord, letter) {
  return String(secretWord || '')
    .toUpperCase()
    .split('')
    .filter((character) => character === letter)
    .length;
}

function unrevealedLetterPositions(secretWord, guessedLetters) {
  const guessed = Array.isArray(guessedLetters) ? guessedLetters : [];
  return String(secretWord || '')
    .toUpperCase()
    .split('')
    .filter((character) => character !== ' ' && !guessed.includes(character))
    .length;
}

function isSolved(secretWord, guessedLetters) {
  const guessed = Array.isArray(guessedLetters) ? guessedLetters : [];
  return String(secretWord || '')
    .toUpperCase()
    .split('')
    .every((character) => character === ' ' || guessed.includes(character));
}

function stumpState(state, setterSeat, scores, lastAction) {
  return {
    ...state,
    phase: 'finished',
    word_revealed: true,
    current_turn_seat: null,
    round_result: 'stumped',
    winner_seat: null,
    winner_player_id: null,
    next_setter_seat: Number(setterSeat),
    scores: addScore(scores, setterSeat, 50),
    last_action: {
      ...lastAction,
      setterPoints: 50,
      roundResult: 'stumped',
    },
  };
}

export function startHangmanBoard(rawState, {
  actorSeat,
  word,
  category = '',
  hint = '',
  activeSeats = [],
}) {
  const state = normalizedHangmanState(rawState);
  const setterSeat = Number(
    state.phase === 'finished'
      ? (state.next_setter_seat || state.word_setter_seat || 1)
      : (state.word_setter_seat || state.next_setter_seat || 1),
  );

  if (Number(actorSeat) !== setterSeat) {
    const error = new Error(`Seat ${setterSeat} controls the next board.`);
    error.statusCode = 403;
    error.code = 'HANGMAN_NOT_BOARD_SETTER';
    throw error;
  }

  const secretWord = String(word || '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (secretWord.length < 2) {
    const error = new Error('Enter a Hangman word or phrase with at least two letters.');
    error.statusCode = 400;
    error.code = 'INVALID_HANGMAN_WORD';
    throw error;
  }

  const startingTurn = nextHangmanGuessSeat(activeSeats, setterSeat, setterSeat);
  if (!startingTurn) {
    const error = new Error('At least one guesser must be connected before starting the board.');
    error.statusCode = 409;
    error.code = 'HANGMAN_GUESSER_REQUIRED';
    throw error;
  }

  const isNextRound = state.phase === 'finished';

  return {
    ...state,
    phase: 'playing',
    secret_word: secretWord,
    category: String(category || '').trim(),
    hint: String(hint || '').trim(),
    hint_revealed: false,
    word_revealed: false,
    guessed_letters: [],
    wrong_letters: [],
    max_wrong: Number(state.max_wrong || 6),
    round_number: isNextRound ? Number(state.round_number || 1) + 1 : Number(state.round_number || 1),
    word_setter_seat: setterSeat,
    next_setter_seat: null,
    current_turn_seat: startingTurn,
    round_start_scores: { ...state.scores },
    last_action: {
      type: 'board_set',
      seatNumber: setterSeat,
      timestamp: Date.now(),
    },
    round_result: null,
    winner_seat: null,
    winner_player_id: null,
  };
}

export function applyHangmanGuess(rawState, {
  actorSeat,
  actorAccountId = null,
  activeSeats = [],
  action,
  letter,
  guess,
}) {
  const state = normalizedHangmanState(rawState);
  const seatNumber = Number(actorSeat);
  const setterSeat = Number(state.word_setter_seat || 1);

  if (state.phase !== 'playing') {
    const error = new Error('Wait for the next Hangman board.');
    error.statusCode = 409;
    error.code = 'HANGMAN_NOT_PLAYING';
    throw error;
  }

  if (seatNumber === setterSeat) {
    const error = new Error('The Board Setter cannot guess their own word.');
    error.statusCode = 409;
    error.code = 'HANGMAN_SETTER_CANNOT_GUESS';
    throw error;
  }

  if (Number(state.current_turn_seat || 0) !== seatNumber) {
    const error = new Error(`It is Seat ${state.current_turn_seat}'s turn.`);
    error.statusCode = 409;
    error.code = 'HANGMAN_NOT_YOUR_TURN';
    throw error;
  }

  const secretWord = String(state.secret_word || '').toUpperCase();
  const guessed = [...state.guessed_letters];
  const wrong = [...state.wrong_letters];
  const maxWrong = Number(state.max_wrong || 6);
  let scores = { ...state.scores };

  if (action === 'guess_letter') {
    const normalizedLetter = String(letter || '').trim().toUpperCase();
    if (!/^[A-Z]$/.test(normalizedLetter)) {
      const error = new Error('Choose one letter from A to Z.');
      error.statusCode = 400;
      error.code = 'INVALID_HANGMAN_LETTER';
      throw error;
    }

    if (guessed.includes(normalizedLetter) || wrong.includes(normalizedLetter)) {
      const error = new Error('That letter has already been guessed.');
      error.statusCode = 409;
      error.code = 'HANGMAN_LETTER_USED';
      throw error;
    }

    const occurrences = letterOccurrences(secretWord, normalizedLetter);
    const correct = occurrences > 0;
    const nextGuessed = correct ? [...guessed, normalizedLetter] : guessed;
    const nextWrong = correct ? wrong : [...wrong, normalizedLetter];
    const letterPoints = correct ? occurrences * 10 : 0;
    scores = addScore(scores, seatNumber, letterPoints);

    const solved = correct && isSolved(secretWord, nextGuessed);
    const lastAction = {
      type: 'letter',
      playerId: actorAccountId,
      seatNumber,
      letter: normalizedLetter,
      result: correct ? 'correct' : 'wrong',
      points: letterPoints,
      timestamp: Date.now(),
    };

    if (solved) {
      scores = addScore(scores, seatNumber, 50);
      return {
        ...state,
        guessed_letters: nextGuessed,
        wrong_letters: nextWrong,
        phase: 'finished',
        word_revealed: true,
        current_turn_seat: null,
        round_result: 'solved',
        winner_seat: seatNumber,
        winner_player_id: actorAccountId,
        next_setter_seat: seatNumber,
        scores,
        last_action: {
          ...lastAction,
          solveBonus: 50,
          points: letterPoints + 50,
          roundResult: 'solved',
        },
      };
    }

    if (!correct && nextWrong.length >= maxWrong) {
      return stumpState(
        { ...state, guessed_letters: nextGuessed, wrong_letters: nextWrong },
        setterSeat,
        scores,
        lastAction,
      );
    }

    return {
      ...state,
      guessed_letters: nextGuessed,
      wrong_letters: nextWrong,
      scores,
      current_turn_seat: correct
        ? seatNumber
        : nextHangmanGuessSeat(activeSeats, setterSeat, seatNumber),
      last_action: lastAction,
    };
  }

  if (action === 'guess_word') {
    const normalizedGuess = String(guess || '')
      .toUpperCase()
      .replace(/[^A-Z ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalizedGuess) {
      const error = new Error('Enter a word guess.');
      error.statusCode = 400;
      error.code = 'INVALID_HANGMAN_WORD';
      throw error;
    }

    const correct = normalizedGuess === secretWord;
    const lastAction = {
      type: 'word',
      playerId: actorAccountId,
      seatNumber,
      guess: normalizedGuess,
      result: correct ? 'correct' : 'wrong',
      timestamp: Date.now(),
    };

    if (correct) {
      const revealPoints = unrevealedLetterPositions(secretWord, guessed) * 10;
      const points = revealPoints + 50;
      scores = addScore(scores, seatNumber, points);
      return {
        ...state,
        guessed_letters: [...new Set(secretWord.split('').filter((character) => character !== ' '))],
        phase: 'finished',
        word_revealed: true,
        current_turn_seat: null,
        round_result: 'solved',
        winner_seat: seatNumber,
        winner_player_id: actorAccountId,
        next_setter_seat: seatNumber,
        scores,
        last_action: {
          ...lastAction,
          revealPoints,
          solveBonus: 50,
          points,
          roundResult: 'solved',
        },
      };
    }

    const nextWrong = [...wrong, `(${normalizedGuess.slice(0, 12)})`];
    if (nextWrong.length >= maxWrong) {
      return stumpState(
        { ...state, wrong_letters: nextWrong },
        setterSeat,
        scores,
        { ...lastAction, points: 0 },
      );
    }

    return {
      ...state,
      wrong_letters: nextWrong,
      current_turn_seat: nextHangmanGuessSeat(activeSeats, setterSeat, seatNumber),
      last_action: { ...lastAction, points: 0 },
    };
  }

  const error = new Error('Unknown Hangman action.');
  error.statusCode = 400;
  error.code = 'INVALID_HANGMAN_ACTION';
  throw error;
}

export function publicHangmanState(rawState, participants = [], viewerSeat = null) {
  const state = normalizedHangmanState(rawState);
  const revealWord = state.word_revealed === true || state.phase === 'finished';
  const viewer = Number(viewerSeat || 0);
  const setterSeat = Number(state.word_setter_seat || 1);
  const nextSetterSeat = Number(state.next_setter_seat || setterSeat);

  return {
    phase: state.phase,
    category: state.category || '',
    hint: state.hint_revealed ? (state.hint || '') : '',
    hintAvailable: Boolean(state.hint),
    hintRevealed: state.hint_revealed === true,
    wordRevealed: revealWord,
    maskedWord: maskedHangmanWord(state.secret_word, state.guessed_letters, revealWord),
    guessedLetters: state.guessed_letters,
    wrongGuesses: state.wrong_letters,
    maxWrong: Number(state.max_wrong || 6),
    roundNumber: Number(state.round_number || 1),
    wordSetterSeat: setterSeat,
    nextSetterSeat,
    currentTurnSeat: Number(state.current_turn_seat || 0),
    scores: { ...state.scores },
    lastAction: state.last_action || null,
    roundResult: state.round_result || null,
    winnerSeat: state.winner_seat || null,
    players: participants,
    canSetBoard:
      (state.phase === 'setup' && viewer === setterSeat) ||
      (state.phase === 'finished' && viewer === nextSetterSeat),
    isSetter: viewer === setterSeat,
  };
}
