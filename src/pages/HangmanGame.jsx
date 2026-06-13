import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import { usePlayerSeat } from '@/hooks/usePlayerSeat.js';
import SeatNotification from '@/components/game/SeatNotification.jsx';
import SeatBadge from '@/components/game/SeatBadge.jsx';
import SinglePlayerPanel from '@/components/game/SinglePlayerPanel.jsx';
import { base44 } from '@/api/base44Client';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// ── Word bank fallback (used if AI generation fails) ─────────────────────────
const WORD_BANK = [
  { word: 'JAVASCRIPT', category: 'Technology', hint: 'A programming language for the web' },
  { word: 'QUARTERBACK', category: 'Sports', hint: 'Football field general' },
  { word: 'SAXOPHONE', category: 'Music', hint: 'A jazzy wind instrument' },
  { word: 'HURRICANE', category: 'Weather', hint: 'A powerful tropical storm' },
  { word: 'ARCHIPELAGO', category: 'Geography', hint: 'A chain of islands' },
  { word: 'CHAMELEON', category: 'Animals', hint: 'Changes color to blend in' },
  { word: 'PALINDROME', category: 'Language', hint: 'Reads the same forwards and backwards' },
  { word: 'TELESCOPE', category: 'Science', hint: 'Used to observe distant stars' },
  { word: 'SPAGHETTI', category: 'Food', hint: 'Italian pasta with long noodles' },
  { word: 'BUTTERFLY', category: 'Animals', hint: 'Transformed from a caterpillar' },
  { word: 'MANHATTAN', category: 'Places', hint: 'Famous NYC borough' },
  { word: 'PORCUPINE', category: 'Animals', hint: 'Covered in sharp quills' },
  { word: 'ELECTRICITY', category: 'Science', hint: 'Powers your devices' },
  { word: 'WOLVERINE', category: 'Pop Culture', hint: 'Marvel mutant with claws' },
  { word: 'RENAISSANCE', category: 'History', hint: 'European cultural rebirth era' },
  { word: 'XYLOPHONE', category: 'Music', hint: 'Percussion instrument with bars' },
  { word: 'AVALANCHE', category: 'Weather', hint: 'Snow rushing down a mountain' },
  { word: 'DEMOCRACY', category: 'Politics', hint: 'Government by the people' },
  { word: 'PHOTOGRAPHY', category: 'Art', hint: 'Capturing light to make images' },
  { word: 'TRAPEZOID', category: 'Math', hint: 'A quadrilateral with one pair of parallel sides' },
];

// ── Per-character word themes for AI generation ───────────────────────────────
const CHARACTER_WORD_THEMES = {
  dexter:   'intelligent, science, technology, logic, strategy, engineering, mathematics',
  lemonade: 'bold, action, competition, speed, intensity, high-energy sports',
  carlos:   'funny, random, entertaining, pop culture, food, silly phrases',
  violet:   'positive, inspirational, mindfulness, thoughtful, uplifting',
  tank:     'tough, strength, discipline, military, endurance, power',
  berna:    'leadership, motivation, competitive, achievement, ambition',
};

// ── AI word generation via LLM ────────────────────────────────────────────────
async function generateAIWord(characterId, difficulty) {
  const theme = CHARACTER_WORD_THEMES[characterId] || 'general knowledge';
  const diffMap = {
    easy:   'a common, simple word (4-6 letters)',
    medium: 'a moderately difficult word or short phrase (6-10 letters)',
    hard:   'a long, uncommon word or tricky phrase (10+ letters)',
  };
  const diffDesc = diffMap[difficulty] || diffMap.medium;
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are generating a Hangman puzzle word for the character "${characterId}". Their personality themes are: ${theme}. Pick ${diffDesc} that fits their personality. Return ONLY valid JSON with no extra text.`,
      response_json_schema: {
        type: 'object',
        properties: {
          word: { type: 'string', description: 'The secret word or short phrase (uppercase, letters and spaces only, no punctuation)' },
          category: { type: 'string', description: 'One-word category label' },
          hint: { type: 'string', description: 'A short helpful hint (1 sentence)' },
        },
        required: ['word', 'category', 'hint'],
      },
    });
    const word = (res.word || '').toUpperCase().replace(/[^A-Z ]/g, '').trim();
    if (word.length >= 3) return { word, category: res.category || 'AI Pick', hint: res.hint || '' };
  } catch (_) {}
  // Fallback to word bank
  return WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
}

// ── CPU guess logic: pick best unguessed letter ───────────────────────────────
function cpuPickLetter(secretWord, guessedLetters, wrongLetters, difficulty) {
  const all = guessedLetters.concat(wrongLetters);
  // Frequency order (most common English letters)
  const freq = 'ETAOINSHRDLCUMWFGYPBVKJXQZ'.split('');
  // Hard chars: uncommon letters
  const available = freq.filter(l => !all.includes(l) && /[A-Z]/.test(l));
  if (available.length === 0) return null;

  // Smart: filter letters that appear in revealed pattern context
  const upper = secretWord.toUpperCase();
  const smart = available.filter(l => upper.includes(l));

  // Difficulty: harder = smarter picks
  const useSmartChance = difficulty >= 7 ? 0.9 : difficulty >= 4 ? 0.6 : 0.35;
  if (smart.length > 0 && Math.random() < useSmartChance) return smart[0];
  return available[0];
}

export default function HangmanGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  const cpuId = params.get('cpu');
  if (!roomCode) {
    window.location.href = '/';
    return null;
  }
  return <HangmanViewer roomCode={roomCode} cpuId={cpuId} />;
}

function HangmanViewer({ roomCode, cpuId }) {
  const navigate = useNavigate();
  const { room, loading, updateState, registerPlayer } = useGameRoom(roomCode, 'hangman', 'viewer');
  const gs = room?.game_state || {};
  const isSinglePlayer = !!(cpuId || gs.single_player);

  const { playerId, seatNumber, isSeated } = usePlayerSeat(room, roomCode, 'hangman', updateState);

  // Register player for auto-cleanup when seated
  useEffect(() => {
    if (isSeated && playerId) registerPlayer(playerId);
  }, [isSeated, playerId, registerPlayer]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notification, setNotification] = useState(null);
  const notifTimerRef = useRef(null);
  const containerRef = useRef(null);

  // Word setter panel state (for winner / 1P mode)
  const [setterWord, setSetterWord] = useState('');
  const [setterCategory, setSetterCategory] = useState('');
  const [setterHint, setSetterHint] = useState('');
  const [setterError, setSetterError] = useState('');

  // Voice guess state
  const [isListeningGuess, setIsListeningGuess] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const recognitionRef = useRef(null);
  const guessWordRef = useRef(null);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Watch for new last_action to display notification
  const lastActionRef = useRef(null);
  useEffect(() => {
    const action = gs.last_action;
    if (!action) return;
    if (JSON.stringify(action) === JSON.stringify(lastActionRef.current)) return;
    lastActionRef.current = action;
    setNotification({ seatNumber: action.seatNumber, letter: action.letter || action.guess, result: action.result });
    clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => setNotification(null), 2800);
  }, [gs.last_action]);

  // Initialize 1P mode game state on first load
  const initDoneRef = useRef(false);
  useEffect(() => {
    if (!isSinglePlayer || !room || initDoneRef.current) return;
    if (gs.phase) return; // already initialized
    initDoneRef.current = true;

    // Round 1: human is host (sets word), CPU guesses
    updateState({
      phase: 'setup',
      single_player: true,
      cpu_opponent_id: cpuId || null,
      word_setter_seat: seatNumber, // human hosts round 1
      round_number: 1,
      score_human: 0,
      score_cpu: 0,
      // host_is_human: true means human is setter this round
      host_is_human: true,
    });
  }, [room, isSinglePlayer]);

  // Detect new human player joining → disable 1P mode
  const prevPlayerCountRef = useRef(null);
  useEffect(() => {
    if (!room || !isSinglePlayer) return;
    const humanPlayers = (gs.players || []).filter(p => p.playerType !== 'cpu');
    const count = humanPlayers.length;
    if (prevPlayerCountRef.current === null) {
      prevPlayerCountRef.current = count;
      return;
    }
    if (count > prevPlayerCountRef.current) {
      // New human joined — turn off 1P mode
      updateState({ single_player: false, cpu_opponent_id: null, phase: null, secret_word: '', guessed_letters: [], wrong_letters: [] });
    }
    prevPlayerCountRef.current = count;
  }, [gs.players]);

  // CPU auto-sets word when it's the CPU's turn to host
  const cpuSetRef = useRef(false);
  useEffect(() => {
    if (!isSinglePlayer || !room) return;
    if (gs.phase !== 'setup' && gs.phase !== 'word_set') return;
    if (gs.secret_word) { cpuSetRef.current = false; return; }
    // CPU is host this round when host_is_human is false
    const cpuIsHost = gs.host_is_human === false;
    if (!cpuIsHost) return;
    if (cpuSetRef.current) return;
    cpuSetRef.current = true;

    const delay = setTimeout(async () => {
      const charId = cpuId || gs.cpu_opponent_id || 'dexter';
      const diff = cpuCharacter?.difficulty >= 8 ? 'hard' : cpuCharacter?.difficulty >= 5 ? 'medium' : 'easy';
      const pick = await generateAIWord(charId, diff);
      await updateState({
        secret_word: pick.word,
        category: pick.category,
        hint: pick.hint,
        hint_revealed: false,
        guessed_letters: [],
        wrong_letters: [],
        phase: 'playing',
        word_revealed: false,
        last_action: null,
        winner_seat: null,
        winner_player_id: null,
        seats_that_chose: [],
        current_go_round: 1,
        max_wrong: 6,
      });
      cpuSetRef.current = false;
    }, 1800);
    return () => clearTimeout(delay);
  }, [gs.phase, gs.host_is_human, gs.secret_word, seatNumber, isSinglePlayer]);

  // CPU auto-guesses letters when it's the guesser (host_is_human === true)
  const cpuGuessRef = useRef(false);
  useEffect(() => {
    if (!isSinglePlayer || !room) return;
    if (gs.phase !== 'playing') return;
    if (gs.host_is_human === false) return; // CPU is host, not guesser
    if (!gs.secret_word) return;
    if (gs.word_revealed || allRevealed) return;
    if (wrongCount >= maxWrong) return;
    if (cpuGuessRef.current) return;
    cpuGuessRef.current = true;

    const delay = Math.max(1200, 1000 + Math.random() * 1200);
    const timer = setTimeout(async () => {
      const diff = cpuCharacter?.difficulty || 5;
      const letter = cpuPickLetter(gs.secret_word, gs.guessed_letters || [], gs.wrong_letters || [], diff);
      if (!letter) { cpuGuessRef.current = false; return; }

      const secretWord = (gs.secret_word || '').toUpperCase();
      const isCorrect = secretWord.includes(letter);
      const newGuessed = isCorrect ? [...(gs.guessed_letters || []), letter] : (gs.guessed_letters || []);
      const newWrong = !isCorrect ? [...(gs.wrong_letters || []), letter] : (gs.wrong_letters || []);
      const newAllRevealed = secretWord.split('').every(ch => ch === ' ' || newGuessed.includes(ch));
      const newPhase = newAllRevealed ? 'finished' : (newWrong.length >= maxWrong ? 'finished' : 'playing');

      await updateState({
        guessed_letters: newGuessed,
        wrong_letters: newWrong,
        phase: newPhase,
        word_revealed: newPhase === 'finished' && !newAllRevealed,
        last_action: { letter, result: isCorrect ? 'correct' : 'wrong', type: 'cpu_guess', timestamp: Date.now() },
        // CPU wins if it guessed the word
        ...(newAllRevealed ? { winner_cpu: true } : {}),
      });
      cpuGuessRef.current = false;
    }, delay);
    return () => { clearTimeout(timer); cpuGuessRef.current = false; };
  }, [gs.phase, gs.guessed_letters, gs.wrong_letters, gs.secret_word, gs.host_is_human, isSinglePlayer]);

  const word = gs.secret_word || '';
  const guessed = gs.guessed_letters || [];
  const wrong = gs.wrong_letters || [];
  const maxWrong = gs.max_wrong || 6;
  const wrongCount = wrong.length;
  const maskedWord = word.split('').map(ch => ch === ' ' ? ' ' : (guessed.includes(ch) || gs.word_revealed ? ch : '_'));
  const allRevealed = word.length > 0 && word.split('').every(ch => ch === ' ' || guessed.includes(ch));

  // In 1P: the single player can always guess letters (no turn restrictions)
  // In multiplayer: go-round logic
  const players = gs.players || [];
  const connectedSeats = players.map(p => p.seatNumber);
  const currentGoRound = gs.current_go_round || 1;
  const seatsThatChose = gs.seats_that_chose || [];
  const totalPeople = players.length + 1;
  const isGoRoundMode = !isSinglePlayer && totalPeople >= 4;
  const alreadyChosen = seatNumber ? seatsThatChose.includes(seatNumber) : false;

  // 1P turn tracking: host_is_human===true → human is host (sets word), CPU guesses
  //                   host_is_human===false → CPU is host (sets word), human guesses
  const hostIsHuman = gs.host_is_human !== false; // default true for round 1
  const iAmSetter1P = isSinglePlayer && hostIsHuman; // human is host = human sets word
  const iAmGuesser1P = isSinglePlayer && !hostIsHuman; // CPU is host = human guesses

  // Who set the word (winner in previous round) — multiplayer only
  const wordSetter = gs.word_setter_seat || null;
  const amWordSetter = seatNumber === wordSetter;

  const canGuess =
    isSeated &&
    seatNumber !== null &&
    gs.phase === 'playing' &&
    !gs.word_revealed &&
    !allRevealed &&
    (isSinglePlayer ? iAmGuesser1P : (isGoRoundMode ? !alreadyChosen : true));

  // Show the setter panel: in 1P only when human is host; in multiplayer when amWordSetter
  const isSetter = isSinglePlayer ? (isSeated && iAmSetter1P) : amWordSetter;
  const showSetterPanel = isSetter && (gs.phase === 'setup' || gs.phase === 'word_set') && !gs.secret_word;

  const cpuCharacter = isSinglePlayer
    ? TEXASNOMAD_CHARACTERS.find(c => c.id === (cpuId || gs.cpu_opponent_id)) || null
    : null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleGuessLetter = async (letter) => {
    if (!canGuess) return;
    if (guessed.includes(letter) || wrong.includes(letter)) return;

    const secretWord = (gs.secret_word || '').toUpperCase();
    const isCorrect = secretWord.includes(letter);
    const newGuessed = isCorrect ? [...guessed, letter] : guessed;
    const newWrong = !isCorrect ? [...wrong, letter] : wrong;

    const newAllRevealed = secretWord.split('').every(ch => ch === ' ' || newGuessed.includes(ch));
    const newPhase = newAllRevealed ? 'finished' : (newWrong.length >= maxWrong ? 'finished' : 'playing');

    let nextGoRound = currentGoRound;
    let nextSeatsThatChose = seatsThatChose;
    if (isGoRoundMode) {
      const newSeatsThatChose = [...seatsThatChose, seatNumber];
      const allChosen = connectedSeats.length > 0 && connectedSeats.every(s => newSeatsThatChose.includes(s));
      nextGoRound = allChosen ? currentGoRound + 1 : currentGoRound;
      nextSeatsThatChose = allChosen ? [] : newSeatsThatChose;
    }

    const last_action = {
      playerId, seatNumber, letter,
      result: isCorrect ? 'correct' : 'wrong',
      goRound: currentGoRound,
      timestamp: Date.now(),
      type: 'letter',
    };

    const updatedPlayers = (gs.players || []).map(p =>
      p.playerId === playerId ? { ...p, lastActionAt: Date.now() } : p
    );

    await updateState({
      guessed_letters: newGuessed,
      wrong_letters: newWrong,
      phase: newPhase,
      word_revealed: newPhase === 'finished' && !newAllRevealed ? true : (newPhase === 'finished' ? true : false),
      last_action,
      current_go_round: nextGoRound,
      seats_that_chose: nextSeatsThatChose,
      players: updatedPlayers,
      // If winner via letter, record winner seat
      ...(newAllRevealed ? { winner_seat: seatNumber, winner_player_id: playerId } : {}),
    });
  };

  const handleGuessWord = async (guessText) => {
    if (!canGuess || !guessText.trim()) return;
    const guess = guessText.trim().toUpperCase();
    const secretWord = (gs.secret_word || '').toUpperCase();
    const isCorrect = guess === secretWord;

    const last_action = {
      playerId, seatNumber,
      guess: guessText,
      result: isCorrect ? 'correct' : 'wrong',
      type: 'word',
      timestamp: Date.now(),
    };

    const updatedPlayers = (gs.players || []).map(p =>
      p.playerId === playerId ? { ...p, lastActionAt: Date.now() } : p
    );

    if (isCorrect) {
      await updateState({
        guessed_letters: secretWord.split('').filter(c => c !== ' '),
        phase: 'finished',
        word_revealed: true,
        last_action,
        winner_seat: seatNumber,
        winner_player_id: playerId,
        players: updatedPlayers,
      });
    } else {
      // Wrong word guess: count as one wrong strike
      const newWrong = [...wrong, `(${guessText.slice(0, 8)})`];
      const newPhase = newWrong.length >= maxWrong ? 'finished' : 'playing';
      await updateState({
        wrong_letters: newWrong,
        phase: newPhase,
        word_revealed: newPhase === 'finished' ? true : false,
        last_action,
        players: updatedPlayers,
      });
    }
    setVoiceTranscript('');
  };

  const toggleVoiceGuess = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Voice recognition requires Chrome or Edge.');
      return;
    }
    if (isListeningGuess) {
      recognitionRef.current?.stop();
      return;
    }
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = false;
    r.onstart = () => setIsListeningGuess(true);
    r.onend = () => setIsListeningGuess(false);
    r.onerror = () => setIsListeningGuess(false);
    r.onresult = (e) => {
      const t = e.results[0][0].transcript.trim();
      setVoiceTranscript(t);
      handleGuessWord(t);
    };
    recognitionRef.current = r;
    r.start();
  };

  const handleRandomWord = () => {
    const pick = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    setSetterWord(pick.word);
    setSetterCategory(pick.category);
    setSetterHint(pick.hint);
    setSetterError('');
  };

  const handleSetWord = async () => {
    const w = setterWord.trim().toUpperCase();
    if (!w || w.length < 3) { setSetterError('Word must be at least 3 letters.'); return; }
    setSetterError('');
    await updateState({
      secret_word: w,
      category: setterCategory.trim() || null,
      hint: setterHint.trim() || null,
      hint_revealed: false,
      guessed_letters: [],
      wrong_letters: [],
      phase: 'playing',
      word_revealed: false,
      last_action: null,
      winner_seat: null,
      winner_player_id: null,
      seats_that_chose: [],
      current_go_round: 1,
      max_wrong: 6,
    });
    setSetterWord('');
    setSetterCategory('');
    setSetterHint('');
  };

  const handleNextRound = async () => {
    if (isSinglePlayer) {
      // Strict alternation: whoever was host switches to guesser
      const nextHostIsHuman = !hostIsHuman;

      // Score tracking: human wins if they guessed (guesser) and got it right
      // CPU wins if it guessed (guesser) and got it right
      let scoreHuman = gs.score_human || 0;
      let scoreCpu = gs.score_cpu || 0;
      if (hostIsHuman) {
        // CPU was guessing — did CPU win?
        if (gs.winner_cpu) scoreCpu += 1;
      } else {
        // Human was guessing — did human win?
        if (gs.winner_seat === seatNumber) scoreHuman += 1;
      }

      await updateState({
        secret_word: '',
        phase: 'setup',
        guessed_letters: [],
        wrong_letters: [],
        word_revealed: false,
        last_action: null,
        winner_seat: null,
        winner_player_id: null,
        winner_cpu: false,
        word_setter_seat: nextHostIsHuman ? seatNumber : null,
        host_is_human: nextHostIsHuman,
        seats_that_chose: [],
        current_go_round: 1,
        round_number: (gs.round_number || 1) + 1,
        score_human: scoreHuman,
        score_cpu: scoreCpu,
      });
    } else {
      await updateState({
        secret_word: '',
        phase: 'setup',
        guessed_letters: [],
        wrong_letters: [],
        word_revealed: false,
        last_action: null,
        winner_seat: null,
        winner_player_id: null,
        word_setter_seat: gs.winner_seat || null,
        seats_that_chose: [],
        current_go_round: 1,
      });
    }
  };

  // Hangman SVG parts
  const parts = [
    <circle key="head" cx="120" cy="75" r="15" stroke="#FFD700" strokeWidth="3" fill="none" />,
    <line key="body" x1="120" y1="90" x2="120" y2="140" stroke="#FFD700" strokeWidth="3" />,
    <line key="arm-l" x1="120" y1="100" x2="90" y2="125" stroke="#FFD700" strokeWidth="3" />,
    <line key="arm-r" x1="120" y1="100" x2="150" y2="125" stroke="#FFD700" strokeWidth="3" />,
    <line key="leg-l" x1="120" y1="140" x2="90" y2="175" stroke="#FFD700" strokeWidth="3" />,
    <line key="leg-r" x1="120" y1="140" x2="150" y2="175" stroke="#FFD700" strokeWidth="3" />,
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-[#070311] text-white flex flex-col">
      <SeatNotification notification={notification} />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#BC13FE]/30 bg-[#070311]/90 backdrop-blur-xl">
        <div className="px-4 h-12 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="shrink-0">
              <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TN" className="w-7 h-7 object-contain" />
            </Link>
            <span className="text-[#FFD700] uppercase text-[9px] tracking-widest hidden sm:block" style={PS2}>Hangman</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse shrink-0" />
              <span className="text-[8px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>ROOM {roomCode}</span>
            </div>
            {isSinglePlayer && (
              <span className="px-2 py-0.5 bg-[#FFD700]/10 border border-[#FFD700]/40 rounded text-[#FFD700] text-[7px] tracking-widest uppercase" style={PS2}>
                🤖 1P vs CPU
              </span>
            )}
            {!isSinglePlayer && room?.host_connected && (
              <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-[7px] tracking-widest uppercase hidden sm:inline" style={PS2}>
                🔴 HOST LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SeatBadge seatNumber={seatNumber} isSeated={isSeated} alreadyChosen={isGoRoundMode && alreadyChosen} />
            <Link to="/games" className="relative inline-flex items-center justify-center px-3 py-1.5 border border-[#FFD700]/40 rounded hover:bg-[#FFD700]/10 transition-all" style={{ zIndex: 10 }}>
              <span className="pointer-events-none text-[#FFD700]/80 text-xs font-body tracking-wide" style={{ zIndex: -1 }}>← LOBBY</span>
            </Link>
            <button
              onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }}
              className="px-2 py-1 bg-[#FF5F1F] text-white rounded hover:bg-[#FF5F1F]/80 transition-all text-[7px] tracking-widest uppercase" style={PS2}>
              {isFullscreen ? '✕' : '⛶'}
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : showSetterPanel ? (
        /* ── Word Setter Screen ─────────────────────────────────────────── */
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6 max-w-md mx-auto w-full">
          {isSinglePlayer && cpuCharacter && (
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-[#BC13FE]/30 bg-[#BC13FE]/5 w-full">
              <img src={cpuCharacter.avatar} alt={cpuCharacter.name} className="w-10 h-10 rounded-lg object-cover border border-[#BC13FE]/30" />
              <div>
                <div className="text-[7px] text-[#BC13FE]/60 uppercase tracking-widest" style={PS2}>Your opponent</div>
                <div className="font-heading text-base text-white tracking-widest uppercase">{cpuCharacter.name}</div>
              </div>
              <div className="ml-auto px-2 py-1 rounded border border-[#BC13FE]/40 text-[#BC13FE] text-[6px] uppercase tracking-widest" style={PS2}>LV {cpuCharacter.difficulty}</div>
            </div>
          )}

          <div className="w-full space-y-1">
            <h2 className="text-center font-heading text-xl tracking-widest text-[#FFD700] uppercase mb-4">
              {isSinglePlayer ? `🎛 Round ${gs.round_number || 1} — You Are Host` : amWordSetter ? `🏆 You Won! Set the Next Word` : `📝 Set the Word`}
            </h2>
            {isSinglePlayer && cpuCharacter && (
              <div className="text-center text-[8px] tracking-widest text-white/40 uppercase mb-4" style={PS2}>
                {cpuCharacter.name} will try to guess your word
              </div>
            )}

            {/* Random button */}
            <button
              onClick={handleRandomWord}
              className="w-full py-3 rounded-xl border-2 font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95 mb-4"
              style={{ borderColor: '#BC13FE60', color: '#BC13FEcc', background: '#BC13FE10' }}>
              🎲 Random Word
            </button>

            <div className="space-y-3">
              <div>
                <label className="block text-[7px] tracking-widest text-white/40 uppercase mb-1" style={PS2}>Word *</label>
                <input
                  className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#22d3ee]/30 text-white font-body text-lg focus:border-[#22d3ee] focus:outline-none uppercase tracking-widest"
                  value={setterWord}
                  onChange={e => setSetterWord(e.target.value.toUpperCase())}
                  placeholder="Enter word..."
                  maxLength={24}
                />
              </div>
              <div>
                <label className="block text-[7px] tracking-widest text-white/40 uppercase mb-1" style={PS2}>Category (optional)</label>
                <input
                  className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/20 text-white font-body text-base focus:border-[#BC13FE] focus:outline-none"
                  value={setterCategory}
                  onChange={e => setSetterCategory(e.target.value)}
                  placeholder="e.g. Animals, Sports..."
                />
              </div>
              <div>
                <label className="block text-[7px] tracking-widest text-white/40 uppercase mb-1" style={PS2}>Hint (optional)</label>
                <input
                  className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/20 text-white font-body text-base focus:border-[#BC13FE] focus:outline-none"
                  value={setterHint}
                  onChange={e => setSetterHint(e.target.value)}
                  placeholder="A short clue..."
                />
              </div>
              {setterError && (
                <div className="text-[8px] text-red-400 tracking-widest uppercase" style={PS2}>{setterError}</div>
              )}
              <button
                onClick={handleSetWord}
                disabled={!setterWord.trim()}
                className="w-full py-4 rounded-xl font-heading text-base tracking-widest uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
                style={{ background: '#22d3ee', color: '#000', boxShadow: '0 0 20px rgba(34,211,238,0.4)' }}>
                ▶ Start Round
              </button>
            </div>
          </div>
        </div>

      ) : (!gs.phase || gs.phase === 'setup' || gs.phase === 'word_set') && !gs.secret_word ? (
        /* ── Waiting screen (non-setter or waiting for host) ───────────── */
        <WaitingScreen isSeated={isSeated} seatNumber={seatNumber} players={players} isSinglePlayer={isSinglePlayer && !!gs.single_player} cpuCharacter={cpuCharacter} hostIsHuman={hostIsHuman} />

      ) : (
        /* ── Game Screen ─────────────────────────────────────────────── */
        <div className="flex-1 flex flex-col items-center p-4 gap-4 max-w-2xl mx-auto w-full">

          {/* 1P: Round info — Host / Guesser / Score */}
          {isSinglePlayer && cpuCharacter && (
            <div className="w-full grid grid-cols-3 gap-2">
              {/* Host */}
              <div className="px-3 py-2 rounded-xl border text-center"
                style={{ borderColor: '#BC13FE40', background: '#BC13FE08' }}>
                <div className="text-[6px] tracking-widest text-white/30 uppercase mb-1" style={PS2}>🎛 Host</div>
                <div className="text-[8px] tracking-widest uppercase" style={{ ...PS2, color: '#BC13FE' }}>
                  {hostIsHuman ? 'You' : cpuCharacter.name}
                </div>
              </div>
              {/* Round */}
              <div className="px-3 py-2 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 text-center">
                <div className="text-[6px] tracking-widest text-white/30 uppercase mb-1" style={PS2}>Round</div>
                <div className="text-[10px] text-[#FFD700]" style={PS2}>{gs.round_number || 1}</div>
              </div>
              {/* Guesser */}
              <div className="px-3 py-2 rounded-xl border text-center"
                style={{ borderColor: '#4ade8040', background: '#4ade8008' }}>
                <div className="text-[6px] tracking-widest text-white/30 uppercase mb-1" style={PS2}>🔤 Guessing</div>
                <div className="text-[8px] tracking-widest uppercase" style={{ ...PS2, color: '#4ade80' }}>
                  {hostIsHuman ? cpuCharacter.name : 'You'}
                </div>
              </div>
            </div>
          )}

          {/* 1P scoreboard */}
          {isSinglePlayer && cpuCharacter && (
            <div className="w-full grid grid-cols-2 gap-2">
              <div className="px-3 py-2 rounded-xl border border-[#22d3ee]/30 bg-[#22d3ee]/5 text-center">
                <div className="text-[6px] tracking-widest text-white/30 uppercase mb-1" style={PS2}>You</div>
                <div className="font-heading text-2xl text-[#22d3ee]">{gs.score_human || 0}</div>
              </div>
              <div className="px-3 py-2 rounded-xl border border-[#FF5F1F]/30 bg-[#FF5F1F]/5 text-center">
                <div className="text-[6px] tracking-widest text-white/30 uppercase mb-1" style={PS2}>{cpuCharacter.name}</div>
                <div className="font-heading text-2xl text-[#FF5F1F]">{gs.score_cpu || 0}</div>
              </div>
            </div>
          )}

          {/* Mode indicator (multiplayer only) */}
          {!isSinglePlayer && gs.phase === 'playing' && (
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <div className="px-4 py-1.5 rounded-lg border text-center"
                style={{ borderColor: isGoRoundMode ? '#FFD700' : '#4ade80', background: isGoRoundMode ? 'rgba(255,215,0,0.05)' : 'rgba(74,222,128,0.05)' }}>
                <div className="text-[7px] tracking-widest text-white/40 uppercase" style={PS2}>Mode</div>
                <div className="text-[9px] mt-0.5" style={{ ...PS2, color: isGoRoundMode ? '#FFD700' : '#4ade80' }}>
                  {isGoRoundMode ? 'Go-Round' : 'Free Play'}
                </div>
              </div>
              {isGoRoundMode && (
                <>
                  <div className="px-4 py-1.5 rounded-lg border border-[#FFD700]/30 bg-[#FFD700]/5 text-center">
                    <div className="text-[7px] tracking-widest text-white/40 uppercase" style={PS2}>Go-Round</div>
                    <div className="text-lg text-[#FFD700]" style={PS2}>{currentGoRound}</div>
                  </div>
                  <div className="flex gap-1.5">
                    {connectedSeats.map(seat => (
                      <div key={seat} className="w-7 h-7 rounded flex items-center justify-center border text-[7px]"
                        style={{
                          ...PS2,
                          borderColor: seatsThatChose.includes(seat) ? '#4ade80' : '#ffffff20',
                          color: seatsThatChose.includes(seat) ? '#4ade80' : '#ffffff30',
                          background: seatsThatChose.includes(seat) ? '#4ade8015' : 'transparent',
                        }}>
                        {seat}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Category */}
          {gs.category && (
            <div className="text-center">
              <div className="text-[8px] tracking-[0.25em] text-white/40 uppercase mb-1" style={PS2}>Category</div>
              <div className="text-base tracking-widest text-[#BC13FE] uppercase" style={PS2}>{gs.category}</div>
            </div>
          )}

          {/* Hangman figure */}
          <div className="flex items-center gap-8">
            <svg width="180" height="200" className="shrink-0">
              <line x1="20" y1="190" x2="160" y2="190" stroke="#ffffff15" strokeWidth="3" />
              <line x1="60" y1="190" x2="60" y2="10" stroke="#ffffff15" strokeWidth="3" />
              <line x1="60" y1="10" x2="120" y2="10" stroke="#ffffff15" strokeWidth="3" />
              <line x1="120" y1="10" x2="120" y2="20" stroke="#ffffff15" strokeWidth="3" />
              <line x1="120" y1="20" x2="120" y2="60" stroke="#BC13FE" strokeWidth="3" />
              {parts.slice(0, wrongCount)}
            </svg>
            <div className="text-center">
              <div className="text-4xl text-[#FF5F1F]" style={PS2}>{wrongCount}</div>
              <div className="text-[8px] tracking-widest text-white/40 uppercase mt-1" style={PS2}>Wrong</div>
              <div className="text-sm text-white/20 mt-1" style={PS2}>/ {maxWrong}</div>
            </div>
          </div>

          {/* Masked Word */}
          <div className="flex gap-2 flex-wrap justify-center">
            {maskedWord.map((ch, i) => (
              ch === ' ' ? (
                <div key={i} className="w-4" />
              ) : (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-3xl md:text-4xl font-bold text-[#FFD700] min-w-[1.5ch] text-center"
                    style={{ ...PS2, textShadow: ch !== '_' ? '0 0 15px rgba(255,215,0,0.5)' : 'none' }}>
                    {ch}
                  </span>
                  <div className="w-full h-0.5 bg-[#FFD700]/40 rounded" />
                </div>
              )
            ))}
          </div>

          {/* Hint */}
          {gs.hint_revealed && gs.hint && (
            <div className="px-6 py-3 border border-[#BC13FE]/40 rounded-xl bg-[#BC13FE]/10 text-center max-w-sm">
              <div className="text-[8px] tracking-widest text-[#BC13FE]/70 uppercase mb-1" style={PS2}>💡 Hint</div>
              <div className="text-sm text-white tracking-wide" style={PS2}>{gs.hint}</div>
            </div>
          )}

          {/* Wrong letters */}
          {wrong.length > 0 && (
            <div className="text-center">
              <div className="text-[8px] tracking-widest text-white/40 uppercase mb-2" style={PS2}>Wrong</div>
              <div className="flex gap-2 flex-wrap justify-center">
                {wrong.map((l, i) => (
                  <span key={i} className="font-mono text-lg text-red-400 line-through">{l}</span>
                ))}
              </div>
            </div>
          )}

          {/* Alphabet — ALL players can guess */}
          {gs.phase === 'playing' && !gs.word_revealed && (
            <div className="w-full max-w-lg space-y-3">
              {/* Go-round throttle message */}
              {isGoRoundMode && alreadyChosen && (
                <div className="text-center px-4 py-2 rounded-lg border border-[#FF5F1F]/30 bg-[#FF5F1F]/10">
                  <span className="text-[8px] tracking-widest text-[#FF5F1F] uppercase" style={PS2}>
                    You chose this round. Waiting for others…
                  </span>
                </div>
              )}
              {!isSeated && (
                <div className="text-center px-4 py-2 rounded-lg border border-white/10 bg-white/5">
                  <span className="text-[8px] tracking-widest text-white/30 uppercase" style={PS2}>
                    Joining game, please wait…
                  </span>
                </div>
              )}
              {isSinglePlayer && iAmSetter1P && (
                <div className="text-center px-4 py-3 rounded-lg border border-[#FFD700]/30 bg-[#FFD700]/5">
                  <span className="text-[8px] tracking-widest text-[#FFD700]/70 uppercase" style={PS2}>
                    🔒 You are Host — {cpuCharacter?.name || 'CPU'} is guessing!
                  </span>
                </div>
              )}
              {isSinglePlayer && iAmGuesser1P && (
                <div className="text-center px-4 py-3 rounded-lg border border-[#4ade80]/30 bg-[#4ade80]/5">
                  <span className="text-[8px] tracking-widest text-[#4ade80]/70 uppercase" style={PS2}>
                    🔤 {cpuCharacter?.name || 'CPU'} is Host — Guess their word!
                  </span>
                </div>
              )}

              {/* Letter grid */}
              <div className="flex flex-wrap gap-1.5 justify-center">
                {ALPHABET.map((l) => {
                  const isWrong = wrong.includes(l);
                  const isCorrect = guessed.includes(l);
                  const used = isWrong || isCorrect;
                  const active = canGuess && !used;
                  return (
                    <button key={l}
                      onClick={() => handleGuessLetter(l)}
                      disabled={!active}
                      className="w-9 h-9 rounded-lg border-2 text-sm tracking-widest transition-all active:scale-90 disabled:cursor-not-allowed"
                      style={{
                        ...PS2,
                        borderColor: isWrong ? '#ef4444' : isCorrect ? '#4ade80' : active ? '#FFD700' : '#ffffff20',
                        color: isWrong ? '#ef4444' : isCorrect ? '#4ade80' : active ? '#FFD700' : '#ffffff25',
                        background: isWrong ? '#ef444415' : isCorrect ? '#4ade8015' : 'transparent',
                        opacity: !active && !used ? 0.35 : 1,
                        textDecoration: isWrong ? 'line-through' : 'none',
                      }}>
                      {l}
                    </button>
                  );
                })}
              </div>

              {/* Guess the full word — voice or text */}
              {canGuess && (
                <GuessWordPanel
                  onGuess={handleGuessWord}
                  isListening={isListeningGuess}
                  onToggleVoice={toggleVoiceGuess}
                  transcript={voiceTranscript}
                  onTranscriptChange={setVoiceTranscript}
                  seatNumber={seatNumber}
                />
              )}
            </div>
          )}

          {/* Finished state */}
          {gs.phase === 'finished' && (
            <FinishedPanel
              gs={gs}
              isSinglePlayer={isSinglePlayer}
              seatNumber={seatNumber}
              onNextRound={handleNextRound}
              cpuCharacter={cpuCharacter}
              hostIsHuman={hostIsHuman}
            />
          )}

          {/* 1P Single Player Panel */}
          {isSinglePlayer && cpuCharacter && gs.phase === 'playing' && (
            <div className="w-full mt-2">
              <SinglePlayerPanel cpuCharacter={cpuCharacter} gameLabel="Hangman">
                <div className="text-[7px] text-white/30 uppercase tracking-widest" style={PS2}>
                  CPU is watching your guesses… Good luck!
                </div>
              </SinglePlayerPanel>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Guess Word Panel ──────────────────────────────────────────────────────────
function GuessWordPanel({ onGuess, isListening, onToggleVoice, transcript, onTranscriptChange, seatNumber }) {
  const [text, setText] = useState('');

  const submit = () => {
    const val = text.trim() || transcript.trim();
    if (val) { onGuess(val); setText(''); onTranscriptChange(''); }
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="text-[8px] tracking-widest text-white/40 uppercase text-center mb-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>
        — Guess the full word —
      </div>
      <div className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-center text-[7px] text-white/30 uppercase tracking-widest" style={{ fontFamily: "'Press Start 2P', monospace" }}>
        Seat {seatNumber || '?'} guessing
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 px-4 py-3 rounded-lg bg-black/80 border-2 border-[#22d3ee]/30 text-white font-body text-base focus:border-[#22d3ee] focus:outline-none uppercase tracking-widest"
          value={text || transcript}
          onChange={e => { setText(e.target.value.toUpperCase()); onTranscriptChange(''); }}
          placeholder="Type full word…"
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        <button
          onClick={onToggleVoice}
          className={`px-4 py-3 rounded-lg border-2 font-heading text-lg transition-all ${isListening ? 'border-red-500 text-red-400 bg-red-500/20 animate-pulse' : 'border-[#22d3ee]/40 text-[#22d3ee]/70 hover:border-[#22d3ee]'}`}>
          {isListening ? '🔴' : '🎙'}
        </button>
        <button
          onClick={submit}
          disabled={!text.trim() && !transcript.trim()}
          className="px-5 py-3 rounded-lg border-2 border-[#22d3ee] text-[#22d3ee] font-heading text-sm tracking-widest uppercase hover:bg-[#22d3ee]/20 transition-all disabled:opacity-30">
          GO
        </button>
      </div>
      {isListening && (
        <div className="text-center text-[8px] text-red-400 uppercase tracking-widest animate-pulse" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          🎙 Listening… say the word
        </div>
      )}
    </div>
  );
}

// ── Finished Panel ────────────────────────────────────────────────────────────
function FinishedPanel({ gs, isSinglePlayer, seatNumber, onNextRound, cpuCharacter, hostIsHuman }) {
  const PS2 = { fontFamily: "'Press Start 2P', monospace" };

  let resultLabel, resultColor;
  if (isSinglePlayer) {
    if (hostIsHuman) {
      // Human was host, CPU was guessing
      if (gs.winner_cpu) {
        resultLabel = `🤖 ${cpuCharacter?.name || 'CPU'} Guessed It!`;
        resultColor = '#FF5F1F';
      } else {
        resultLabel = gs.word_revealed ? `🏳 ${cpuCharacter?.name || 'CPU'} Couldn't Guess It` : '🎉 Round Over';
        resultColor = '#4ade80';
      }
    } else {
      // CPU was host, human was guessing
      if (gs.winner_seat === seatNumber) {
        resultLabel = '🏆 You Guessed It!';
        resultColor = '#4ade80';
      } else {
        resultLabel = "🏳 You Couldn't Get It";
        resultColor = '#FFD700';
      }
    }
  } else {
    const isWinner = gs.winner_seat === seatNumber;
    resultLabel = isWinner ? '🏆 You Guessed It!' : gs.winner_seat ? `🏆 Seat ${gs.winner_seat} Wins!` : gs.word_revealed ? '🏳 Revealed' : '🎉 Complete!';
    resultColor = isWinner ? '#4ade80' : '#FFD700';
  }

  const isMultiWinner = !isSinglePlayer && gs.winner_seat === seatNumber;

  return (
    <div className="text-center p-5 border-2 rounded-2xl max-w-sm w-full space-y-4"
      style={{ borderColor: `${resultColor}60`, background: `${resultColor}10` }}>
      <div className="text-xl tracking-widest uppercase" style={{ ...PS2, color: resultColor }}>
        {resultLabel}
      </div>
      <div className="text-2xl text-white mt-3 tracking-[0.3em]" style={PS2}>{gs.secret_word}</div>

      {/* Next round button */}
      {(isSinglePlayer || isMultiWinner) && (
        <button
          onClick={onNextRound}
          className="w-full py-3 rounded-xl font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95 mt-2"
          style={{ background: '#22d3ee', color: '#000', boxShadow: '0 0 20px rgba(34,211,238,0.4)' }}>
          {isSinglePlayer ? '▶ Next Round' : '🏆 You Won — Set Next Word'}
        </button>
      )}
      {!isSinglePlayer && !isMultiWinner && (
        <div className="text-[7px] text-white/30 uppercase tracking-widest" style={PS2}>
          Waiting for winner to set next word…
        </div>
      )}
    </div>
  );
}

// ── Waiting Screen ────────────────────────────────────────────────────────────
function WaitingScreen({ isSeated, seatNumber, players, isSinglePlayer, cpuCharacter, hostIsHuman }) {
  const PS2loc = { fontFamily: "'Press Start 2P', monospace" };
  const cpuIsGenerating = isSinglePlayer && !hostIsHuman;
  return (
    <div className="flex-1 flex items-center justify-center text-center px-4">
      <div className="space-y-5">
        <div className="text-6xl">{cpuIsGenerating ? '🤖' : '🔤'}</div>
        <div className="text-lg tracking-widest text-white/40 uppercase" style={PS2loc}>
          {cpuIsGenerating ? `${cpuCharacter?.name || 'CPU'} is picking a word…` : isSinglePlayer ? 'Setting up…' : 'Waiting for Host…'}
        </div>
        {cpuIsGenerating && (
          <div className="flex justify-center gap-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#FF5F1F] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        {isSeated ? (
          <div className="px-6 py-4 rounded-xl border-2 border-[#BC13FE]/50 bg-[#BC13FE]/10" style={{ boxShadow: '0 0 20px rgba(188,19,254,0.2)' }}>
            <div className="text-[8px] tracking-widest text-[#BC13FE]/70 uppercase mb-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>You are</div>
            <div className="text-3xl text-white" style={{ fontFamily: "'Press Start 2P', monospace" }}>SEAT {seatNumber}</div>
          </div>
        ) : (
          <div className="text-[8px] tracking-widest text-white/20 uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>Assigning seat…</div>
        )}
        {players.length > 0 && !isSinglePlayer && (
          <div>
            <div className="text-[8px] tracking-widest text-white/30 uppercase mb-3" style={{ fontFamily: "'Press Start 2P', monospace" }}>{players.length} player{players.length !== 1 ? 's' : ''} in lobby</div>
            <div className="flex gap-2 justify-center flex-wrap">
              {players.map(p => (
                <div key={p.playerId} className="px-3 py-1.5 rounded-lg border border-[#FFD700]/20 bg-[#FFD700]/5 text-[8px] text-[#FFD700]" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                  SEAT {p.seatNumber}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}