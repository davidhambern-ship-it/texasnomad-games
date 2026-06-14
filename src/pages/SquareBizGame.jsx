import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import { usePlayerSeat } from '@/hooks/usePlayerSeat';
import SeatBadge from '@/components/game/SeatBadge.jsx';
import RoleSelector from '@/components/game/RoleSelector.jsx';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

function checkWinner(b) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,c,d] of lines) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}

/** CPU answer logic based on difficulty */
function cpuShouldAnswerCorrectly(difficulty) {
  const accuracy = Math.min(0.95, 0.35 + (difficulty / 10) * 0.6);
  return Math.random() < accuracy;
}

/** Pick a smart board position (CPU as O) */
function cpuPickSquare(board, cpuMark, humanMark) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const empty = board.map((v,i) => v === '' ? i : null).filter(i => i !== null);

  // Win if possible
  for (const line of lines) {
    const vals = line.map(i => board[i]);
    if (vals.filter(v => v === cpuMark).length === 2 && vals.includes('')) {
      return line[vals.indexOf('')];
    }
  }
  // Block human
  for (const line of lines) {
    const vals = line.map(i => board[i]);
    if (vals.filter(v => v === humanMark).length === 2 && vals.includes('')) {
      return line[vals.indexOf('')];
    }
  }
  // Center
  if (board[4] === '') return 4;
  // Random
  return empty[Math.floor(Math.random() * empty.length)];
}

export default function SquareBizGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  const cpuId = params.get('cpu');
  if (!roomCode) { window.location.href = '/'; return null; }
  return <SquareBizViewer roomCode={roomCode} cpuId={cpuId} />;
}

function SquareBizViewer({ roomCode, cpuId }) {
  const { room, loading, updateState, registerPlayer } = useGameRoom(roomCode, 'square-biz', 'viewer');
  const gs = room?.game_state || {};
  const isSinglePlayer = !!(cpuId || gs.single_player);
  const cpuCharacter = isSinglePlayer
    ? TEXASNOMAD_CHARACTERS.find(c => c.id === (cpuId || gs.cpu_opponent_id)) || TEXASNOMAD_CHARACTERS[0]
    : null;

  const [chosenRole, setChosenRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const { playerId, seatNumber, isSeated } = usePlayerSeat(room, roomCode, 'square-biz', updateState, false, chosenRole);

  // Register player for auto-cleanup when seated
  useEffect(() => {
    if (isSeated && playerId) registerPlayer(playerId);
  }, [isSeated, playerId, registerPlayer]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const spInitRef = useRef(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // 1P: auto-init on room load
  useEffect(() => {
    if (!isSinglePlayer || !room || spInitRef.current) return;
    if (gs.display_mode) { if (!chosenRole) setChosenRole('participant'); return; }
    spInitRef.current = true;
    setChosenRole('participant');
    updateState({
      display_mode: 'board',
      single_player: true,
      cpu_opponent_id: cpuId || null,
      board: Array(9).fill(''),
      current_turn: 'X',
      board_locked: true,
      winner: null,
      phase: '1p_waiting', // waiting for human to select a square
    });
  }, [room, isSinglePlayer]);

  // Also auto-set chosenRole for 1P on reload
  useEffect(() => {
    if (isSinglePlayer && gs.display_mode && !chosenRole) setChosenRole('participant');
  }, [isSinglePlayer, gs.display_mode]);

  const handleChooseRole = async (role) => {
    setRoleLoading(true);
    setChosenRole(role);
    setTimeout(() => setRoleLoading(false), 1000);
  };

  const displayMode = gs.display_mode;

  return (
    <div ref={containerRef} className="min-h-screen bg-[#05030b] text-white flex flex-col relative">
      {/* Role Selection Modal — multiplayer only */}
      {!isSinglePlayer && !chosenRole && isSeated && displayMode === 'board' && !loading && (
        <RoleSelector seatNumber={seatNumber} isSeated={isSeated} onChooseRole={handleChooseRole} loading={roleLoading} />
      )}

      <header className="sticky top-0 z-40 border-b border-[#8a22ff]/30 bg-[#05030b]/90 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TN" className="w-7 h-7 object-contain" />
            </Link>
            <span className="text-[#FF5F1F] uppercase text-[10px] tracking-widest" style={PS2}>Square Biz!</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse" />
              <span className="text-[9px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>ROOM {roomCode}</span>
            </div>
            {isSinglePlayer && (
              <span className="px-2 py-0.5 bg-[#FFD700]/10 border border-[#FFD700]/40 rounded text-[#FFD700] text-[7px] tracking-widest uppercase" style={PS2}>
                🤖 1P vs {cpuCharacter?.name || 'CPU'}
              </span>
            )}
            {!isSinglePlayer && room?.host_connected && (
              <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-[8px] tracking-widest uppercase" style={PS2}>
                🔴 HOST LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SeatBadge seatNumber={seatNumber} isSeated={isSeated} />
            <Link to="/games" className="px-3 py-1 border border-[#FFD700]/40 text-[#FFD700]/80 rounded hover:bg-[#FFD700]/10 transition-all text-[8px] tracking-widest uppercase" style={PS2}>← LOBBY</Link>
            <button
              onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }}
              className="px-3 py-1 bg-[#FF5F1F] text-white rounded hover:bg-[#FF5F1F]/80 transition-all text-[8px] tracking-widest uppercase" style={PS2}>
              {isFullscreen ? '✕ EXIT' : '⛶ FULL'}
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#8a22ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isSinglePlayer ? (
        <SinglePlayerBoard gs={gs} updateState={updateState} playerId={playerId} seatNumber={seatNumber} cpuCharacter={cpuCharacter} roomCode={roomCode} />
      ) : !displayMode ? (
        <WaitingForHost />
      ) : displayMode === 'panel' ? (
        <PanelModeBoard gs={gs} />
      ) : (
        <BoardModeBoard gs={gs} updateState={updateState} playerId={playerId} seatNumber={seatNumber} isSeated={isSeated} chosenRole={chosenRole} isSinglePlayer={false} cpuCharacter={null} />
      )}
    </div>
  );
}

/* ── 1P SINGLE PLAYER BOARD ── */
function SinglePlayerBoard({ gs, updateState, playerId, seatNumber, cpuCharacter, roomCode }) {
  const board = gs.board || Array(9).fill('');
  const currentTurn = gs.current_turn || 'X';
  const phase = gs.phase || '1p_waiting';
  const winner = gs.winner || null;
  const popup = gs.popup;
  const sty = PS2;

  const [triviaQuestion, setTriviaQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerResult, setAnswerResult] = useState(null); // true | false | null
  const [cpuThinking, setCpuThinking] = useState(false);
  const [cpuDialogue, setCpuDialogue] = useState('');
  const [gameMessage, setGameMessage] = useState('');
  const [usedQuestionIds, setUsedQuestionIds] = useState([]);
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const cpuTurnProcessedRef = useRef(false);

  const isHumanTurn = currentTurn === 'X'; // human is always X
  const isCPUTurn = currentTurn === 'O';

  // Show CPU dialogue
  const showCPULine = (type) => {
    const lines = cpuCharacter?.dialogue?.[type] || [];
    if (lines.length) setCpuDialogue(lines[Math.floor(Math.random() * lines.length)]);
    setTimeout(() => setCpuDialogue(''), 3000);
  };

  // Load a random trivia question from OpenTDB
  const loadQuestion = async () => {
    const res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;
    const item = data.results[0];

    // Decode HTML entities
    const decode = (str) => {
      const txt = document.createElement('textarea');
      txt.innerHTML = str;
      return txt.value;
    };

    const question = decode(item.question);
    const correct = decode(item.correct_answer);
    const incorrects = item.incorrect_answers.map(decode);

    // Shuffle answers into A/B/C/D slots
    const allAnswers = [correct, ...incorrects].sort(() => Math.random() - 0.5);
    const letters = ['A', 'B', 'C', 'D'];
    const correctLetter = letters[allAnswers.indexOf(correct)];

    return {
      id: Math.random().toString(36),
      question,
      answer_a: allAnswers[0],
      answer_b: allAnswers[1],
      answer_c: allAnswers[2],
      answer_d: allAnswers[3],
      correct_answer: correctLetter,
      category: decode(item.category),
    };
  };

  // Human selects a square → load question for human to answer
  const handleHumanSquareClick = async (idx) => {
    if (board[idx] || winner || !isHumanTurn || phase !== '1p_waiting') return;
    setSelectedAnswer(null);
    setAnswerResult(null);
    const q = await loadQuestion();
    if (!q) {
      // No questions — just place marker
      placeMarker(idx, 'X');
      return;
    }
    setTriviaQuestion({ ...q, targetIdx: idx });
    await updateState({ phase: '1p_human_answering', selected_square: idx });
  };

  // Human answers the question
  const handleHumanAnswer = async (letter) => {
    if (selectedAnswer || !triviaQuestion) return;
    setSelectedAnswer(letter);
    const correct = letter === triviaQuestion.correct_answer;
    setAnswerResult(correct);

    if (correct) {
      setGameMessage('✅ Correct! Place your marker.');
      await new Promise(r => setTimeout(r, 1200));
      await placeMarker(triviaQuestion.targetIdx, 'X');
    } else {
      setGameMessage('❌ Wrong! CPU gets a free move.');
      showCPULine('winning');
      await new Promise(r => setTimeout(r, 1400));
      setTriviaQuestion(null);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setGameMessage('');
      await updateState({ phase: '1p_cpu_choosing', selected_square: null });
    }
  };

  // Place a marker on the board
  const placeMarker = async (idx, mark) => {
    const newBoard = [...board];
    newBoard[idx] = mark;
    const w = checkWinner(newBoard);
    const nextTurn = mark === 'X' ? 'O' : 'X';
    const isDraw = !w && newBoard.every(c => c !== '');
    const newScores = w ? { ...scores, [w]: (scores[w] || 0) + 1 } : scores;
    if (w) setScores(newScores);
    setTriviaQuestion(null);
    setSelectedAnswer(null);
    setAnswerResult(null);
    setGameMessage('');
    // Reset CPU turn flag when human places marker
    if (mark === 'X') cpuTurnProcessedRef.current = false;
    await updateState({
      board: newBoard,
      current_turn: w || isDraw ? currentTurn : nextTurn,
      winner: w || (isDraw ? 'draw' : null),
      phase: w || isDraw ? '1p_game_over' : (nextTurn === 'O' ? '1p_cpu_choosing' : '1p_waiting'),
      selected_square: null,
      score_x: newScores.X,
      score_o: newScores.O,
    });
    if (w) showCPULine(w === 'X' ? 'losing' : 'winning');
  };

  // CPU turn: pick square → load question → auto-answer → maybe place
  useEffect(() => {
    if (phase !== '1p_cpu_choosing' || winner) return;
    if (cpuTurnProcessedRef.current) return;
    cpuTurnProcessedRef.current = true;
    
    setCpuThinking(true);
    showCPULine('gameStart');
    const timer = setTimeout(async () => {
      const idx = cpuPickSquare(board, 'O', 'X');
      if (idx == null || winner) { setCpuThinking(false); cpuTurnProcessedRef.current = false; return; }
      await updateState({ selected_square: idx, phase: '1p_cpu_answering' });
      // Load question for CPU
      const q = await loadQuestion();
      if (winner) return;
      const difficulty = cpuCharacter?.difficulty || 5;
      const correct = q ? cpuShouldAnswerCorrectly(difficulty) : true;
      await new Promise(r => setTimeout(r, 1200));
      if (winner) return;
      setCpuThinking(false);
      if (correct) {
        showCPULine('winning');
        setGameMessage(`${cpuCharacter?.name || 'CPU'} answered correctly!`);
        await new Promise(r => setTimeout(r, 1000));
        await placeMarker(idx, 'O');
      } else {
        showCPULine('mistake');
        setGameMessage(`${cpuCharacter?.name || 'CPU'} got it wrong! Your turn.`);
        await new Promise(r => setTimeout(r, 1200));
        setGameMessage('');
        await updateState({ phase: '1p_waiting', selected_square: null });
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [phase, board, cpuCharacter]);

  // New game
  const handleNewGame = async () => {
    setTriviaQuestion(null);
    setSelectedAnswer(null);
    setAnswerResult(null);
    setGameMessage('');
    setCpuDialogue('');
    cpuTurnProcessedRef.current = false;
    await updateState({
      board: Array(9).fill(''),
      current_turn: 'X',
      winner: null,
      phase: '1p_waiting',
      selected_square: null,
      score_x: gs.score_x || 0,
      score_o: gs.score_o || 0,
    });
  };

  const scoreX = gs.score_x || 0;
  const scoreO = gs.score_o || 0;

  const cellStyle = (v, idx) => {
    const isSelected = gs.selected_square === idx;
    if (v === 'X') return { char: 'X', color: '#BC13FE', border: '#BC13FE', bg: '#BC13FE20', glow: '0 0 20px rgba(188,19,254,0.8)' };
    if (v === 'O') return { char: 'O', color: '#FF5F1F', border: '#FF5F1F', bg: '#FF5F1F20', glow: '0 0 20px rgba(255,95,31,0.8)' };
    if (isSelected) return { char: '', color: '#FFD700', border: '#FFD700', bg: '#FFD70015', glow: '0 0 24px rgba(255,215,0,0.6)' };
    const canClick = isHumanTurn && phase === '1p_waiting' && !winner;
    return { char: '', color: '#ffffff30', border: canClick ? '#BC13FE60' : '#ffffff15', bg: '#0a0a0a', glow: canClick ? '0 0 12px rgba(188,19,254,0.3)' : 'none' };
  };

  const canClickBoard = isHumanTurn && phase === '1p_waiting' && !winner;

  return (
    <div className="flex-1 flex flex-col lg:flex-row items-stretch p-4 gap-4 max-w-5xl mx-auto w-full">

      {/* LEFT: Human control panel */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* You (X) label */}
        <div className="px-4 py-3 rounded-xl border-2 border-[#BC13FE]/50 bg-[#BC13FE]/10 text-center">
          <div className="text-[8px] tracking-widest text-[#BC13FE]/60 uppercase mb-1" style={sty}>You — Player X</div>
          <div className="text-[8px] tracking-widest text-white/40 uppercase" style={sty}>
            {isHumanTurn && phase === '1p_waiting' && !winner ? '▶ Pick a square!' :
             phase === '1p_human_answering' ? '📋 Answer the question' :
             isHumanTurn ? '⏳ Your turn' : '⌛ CPU is thinking…'}
          </div>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-2">
          <div className="px-3 py-2 rounded-lg border border-[#BC13FE]/40 bg-[#BC13FE]/5 text-center">
            <div className="text-[7px] text-[#BC13FE]/50 uppercase" style={sty}>You (X)</div>
            <div className="font-heading text-2xl text-[#BC13FE]">{scoreX}</div>
          </div>
          <div className="px-3 py-2 rounded-lg border border-[#FF5F1F]/40 bg-[#FF5F1F]/5 text-center">
            <div className="text-[7px] text-[#FF5F1F]/50 uppercase" style={sty}>{cpuCharacter?.name || 'CPU'} (O)</div>
            <div className="font-heading text-2xl text-[#FF5F1F]">{scoreO}</div>
          </div>
        </div>

        {/* Game message */}
        {gameMessage && (
          <div className="px-4 py-3 rounded-xl border border-[#FFD700]/40 bg-[#FFD700]/5 text-center">
            <div className="text-[9px] tracking-widest text-[#FFD700] uppercase" style={sty}>{gameMessage}</div>
          </div>
        )}

        {/* Trivia question for human */}
        {phase === '1p_human_answering' && triviaQuestion && (
          <div className="flex flex-col gap-3">
            <div className="px-5 py-4 rounded-xl border-2 border-[#FFD700]/40 bg-[#FFD700]/5">
              <div className="text-[8px] text-[#FFD700]/60 uppercase tracking-widest mb-2" style={sty}>📋 Answer to claim square {(triviaQuestion.targetIdx ?? 0) + 1}</div>
              <div className="font-heading text-lg text-white leading-snug">{triviaQuestion.question}</div>
              {triviaQuestion.category && (
                <div className="text-[7px] text-white/30 uppercase mt-1 tracking-widest" style={sty}>{triviaQuestion.category}</div>
              )}
            </div>
            {['A','B','C','D'].map(letter => {
              const text = triviaQuestion[`answer_${letter.toLowerCase()}`];
              if (!text) return null;
              const isSelected = selectedAnswer === letter;
              const isCorrect = letter === triviaQuestion.correct_answer;
              let cls = 'border-[#8a22ff]/40 bg-[#8a22ff]/5 text-white/80 hover:border-[#8a22ff] hover:bg-[#8a22ff]/15';
              if (isSelected && answerResult === true) cls = 'border-[#4ade80] bg-[#4ade80]/15 text-[#4ade80]';
              if (isSelected && answerResult === false) cls = 'border-[#ef4444] bg-[#ef4444]/10 text-[#ef4444]';
              if (selectedAnswer && !isSelected) cls = 'border-white/10 bg-transparent text-white/20 cursor-default';
              return (
                <button key={letter}
                  onClick={() => !selectedAnswer && handleHumanAnswer(letter)}
                  disabled={!!selectedAnswer}
                  className={`w-full px-4 py-3 rounded-xl border-2 font-heading text-base tracking-wide text-left transition-all active:scale-95 ${cls}`}>
                  <span className="text-[#8a22ff] mr-2">{letter}.</span>{text}
                </button>
              );
            })}
          </div>
        )}

        {/* Instructions when waiting */}
        {phase === '1p_waiting' && !winner && (
          <div className="px-4 py-4 rounded-xl border border-white/10 bg-white/5 text-center">
            <div className="text-[8px] tracking-widest text-white/30 uppercase" style={sty}>
              Tap any empty square to claim it.<br />You must answer trivia correctly to place your marker.
            </div>
          </div>
        )}

        {/* CPU thinking */}
        {(phase === '1p_cpu_choosing' || phase === '1p_cpu_answering') && !winner && (
          <div className="px-4 py-4 rounded-xl border border-[#FF5F1F]/30 bg-[#FF5F1F]/5 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 border-2 border-[#FF5F1F] border-t-transparent rounded-full animate-spin" />
              <div className="text-[8px] text-[#FF5F1F]/70 uppercase tracking-widest" style={sty}>
                {cpuCharacter?.name || 'CPU'} is {phase === '1p_cpu_answering' ? 'answering…' : 'thinking…'}
              </div>
            </div>
          </div>
        )}

        {/* Game over */}
        {winner && (
          <div className="px-5 py-5 rounded-xl border-2 text-center space-y-3"
            style={{
              borderColor: winner === 'X' ? '#BC13FE' : winner === 'O' ? '#FF5F1F' : '#FFD700',
              background: winner === 'X' ? '#BC13FE15' : winner === 'O' ? '#FF5F1F15' : '#FFD70015',
              boxShadow: `0 0 30px ${winner === 'X' ? 'rgba(188,19,254,0.3)' : winner === 'O' ? 'rgba(255,95,31,0.3)' : 'rgba(255,215,0,0.2)'}`,
            }}>
            <div className="font-heading text-xl tracking-widest uppercase"
              style={{ color: winner === 'X' ? '#BC13FE' : winner === 'O' ? '#FF5F1F' : '#FFD700' }}>
              {winner === 'draw' ? "🤝 It's a Draw!" : winner === 'X' ? '🏆 You Win!' : `🤖 ${cpuCharacter?.name || 'CPU'} Wins!`}
            </div>
            <button onClick={handleNewGame}
              className="px-6 py-3 rounded-xl border-2 border-[#FFD700] text-[#FFD700] font-heading text-sm tracking-widest uppercase hover:bg-[#FFD700]/20 transition-all active:scale-95"
              style={{ boxShadow: '0 0 15px rgba(255,215,0,0.3)', ...sty }}>
              ▶ Play Again
            </button>
          </div>
        )}
      </div>

      {/* CENTER: Board + turn indicator */}
      <div className="flex flex-col items-center justify-center gap-4 shrink-0">
        {/* Turn indicator */}
        <div className="px-5 py-2 rounded-xl border-2 text-center min-w-[200px]"
          style={{
            borderColor: currentTurn === 'X' ? '#BC13FE' : '#FF5F1F',
            background: currentTurn === 'X' ? '#BC13FE10' : '#FF5F1F10',
            boxShadow: `0 0 18px ${currentTurn === 'X' ? 'rgba(188,19,254,0.3)' : 'rgba(255,95,31,0.3)'}`,
          }}>
          <div className="text-[7px] tracking-[0.3em] text-white/30 uppercase mb-1" style={sty}>Turn</div>
          <div className="font-heading text-2xl tracking-widest" style={{ color: currentTurn === 'X' ? '#BC13FE' : '#FF5F1F' }}>
            {currentTurn === 'X' ? 'YOU (X)' : `${cpuCharacter?.name?.toUpperCase() || 'CPU'} (O)`}
          </div>
        </div>

        {/* Board */}
        <div className="relative" style={{ width: 'clamp(240px,32vw,360px)' }}>
          <div className="grid grid-cols-3 gap-3">
            {board.map((cell, idx) => {
              const { char, color, border, bg, glow } = cellStyle(cell, idx);
              const clickable = canClickBoard && !cell;
              return (
                <div key={idx}
                  onClick={() => clickable && handleHumanSquareClick(idx)}
                  className={`aspect-square flex items-center justify-center rounded-xl border-4 font-heading transition-all select-none
                    ${clickable ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'}`}
                  style={{ fontSize: 'clamp(1.8rem,5vw,4rem)', borderColor: border, color, background: bg, boxShadow: glow, fontWeight: cell ? 'bold' : 'normal' }}>
                  {char}
                </div>
              );
            })}
          </div>
          {/* Green glow when it's human's turn to pick */}
          {canClickBoard && (
            <div className="absolute inset-0 rounded-xl pointer-events-none"
              style={{ boxShadow: '0 0 0 3px #4ade80, 0 0 20px rgba(74,222,128,0.25)' }} />
          )}
        </div>

        {/* Status */}
        <div className="text-[8px] tracking-widest uppercase text-center" style={{ color: canClickBoard ? '#4ade80' : '#ffffff30', ...sty }}>
          {winner ? (winner === 'draw' ? 'GAME OVER' : `${winner} WINS!`) :
           canClickBoard ? '🟢 Pick a square' :
           phase === '1p_human_answering' ? '📋 Answer the question' :
           '⏳ CPU turn'}
        </div>
      </div>

      {/* RIGHT: CPU panel */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {cpuCharacter && (
          <div className="px-4 py-4 rounded-xl border-2 border-[#FF5F1F]/40 bg-[#FF5F1F]/5">
            <div className="flex items-center gap-3 mb-3">
              <img src={cpuCharacter.avatar} alt={cpuCharacter.name}
                className="w-12 h-12 rounded-xl border-2 border-[#FF5F1F]/50 object-cover" />
              <div>
                <div className="font-heading text-base tracking-widest text-[#FF5F1F] uppercase">{cpuCharacter.name}</div>
                <div className="text-[7px] text-white/30 uppercase tracking-widest" style={sty}>{cpuCharacter.role}</div>
              </div>
              <div className="ml-auto px-2 py-1 rounded border border-[#BC13FE]/40 text-[#BC13FE] text-[7px] uppercase tracking-widest" style={sty}>
                LV {cpuCharacter.difficulty}
              </div>
            </div>

            {/* CPU dialogue bubble */}
            {cpuDialogue ? (
              <div className="px-3 py-2 rounded-lg border border-[#FF5F1F]/30 bg-black/50 text-[9px] text-[#FF5F1F] italic tracking-wide" style={sty}>
                "{cpuDialogue}"
              </div>
            ) : (
              <div className="px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-[8px] text-white/20 tracking-wide text-center" style={sty}>
                {cpuCharacter.gameProfiles?.squareBiz?.description || 'Playing smart…'}
              </div>
            )}
          </div>
        )}

        {/* CPU thinking dots */}
        {(phase === '1p_cpu_choosing' || phase === '1p_cpu_answering') && (
          <div className="flex justify-center gap-2 py-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#FF5F1F] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}

        {/* How to play */}
        {phase === '1p_waiting' && !winner && (
          <div className="px-4 py-4 rounded-xl border border-white/10 bg-white/5 space-y-2">
            <div className="text-[8px] tracking-widest text-white/40 uppercase mb-2" style={sty}>How to Play</div>
            {[
              'You are X — pick any square',
              'Answer trivia to claim it',
              'CPU answers for O automatically',
              'Get 3 in a row to win!',
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[#BC13FE] text-[8px]" style={sty}>{i+1}.</span>
                <span className="text-[8px] text-white/40 tracking-wide" style={sty}>{tip}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WaitingForHost() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center p-8">
      <div className="w-16 h-16 border-4 border-[#8a22ff]/40 border-t-[#8a22ff] rounded-full animate-spin" />
      <div className="font-heading text-2xl tracking-widest text-white/40 uppercase">Waiting for Host…</div>
    </div>
  );
}

/* ── PANEL MODE ── */
function PanelModeBoard({ gs }) {
  const board = gs.board || Array(9).fill('');
  const popup = gs.popup;

  const cellDisplay = (v, idx) => {
    const isSelected = gs.selected_square === idx;
    if (v === 'X') return { char: 'X', color: '#BC13FE', border: '#BC13FE', glow: '0 0 20px rgba(188,19,254,0.8), inset 0 0 15px rgba(188,19,254,0.2)' };
    if (v === 'O') return { char: 'O', color: '#FF5F1F', border: '#FF5F1F', glow: '0 0 20px rgba(255,95,31,0.8), inset 0 0 15px rgba(255,95,31,0.2)' };
    if (isSelected) return { char: '', color: '#FFD700', border: '#FFD700', glow: '0 0 24px rgba(255,215,0,0.6)' };
    return { char: '', color: '#ffffff80', border: '#FF5F1F', glow: '0 0 15px rgba(188,19,254,0.5), inset 0 0 10px rgba(255,95,31,0.15)' };
  };

  return (
    <div className="flex-1 flex items-stretch p-4 gap-4 relative">
      {popup && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="font-heading text-8xl md:text-9xl tracking-widest uppercase animate-pulse"
            style={{ color: popup === 'correct' ? '#4ade80' : '#ef4444', textShadow: `0 0 40px ${popup === 'correct' ? '#4ade80' : '#ef4444'}` }}>
            {popup === 'correct' ? 'CORRECT!' : 'WRONG!'}
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">
        {gs.show_choices && gs.current_choices ? (
          <>
            <div className="font-heading text-xs tracking-[0.25em] text-[#8a22ff]/70 uppercase mb-1">Choices</div>
            {['A','B','C','D'].map((letter) => {
              const text = gs.current_choices?.[letter];
              if (!text) return null;
              return (
                <div key={letter} className="px-5 py-4 rounded-xl border-2 font-heading text-lg tracking-wide"
                  style={{ borderColor: '#8a22ff40', background: '#8a22ff10', color: '#ffffffcc' }}>
                  <span className="text-[#8a22ff] mr-3">{letter}.</span>{text}
                </div>
              );
            })}
          </>
        ) : <div className="text-center font-heading text-xs tracking-widest text-white/20 uppercase">Choices will appear here</div>}
      </div>
      <div className="flex flex-col items-center justify-center gap-4 shrink-0">
        <div className="text-center">
          <div className="font-heading text-xs tracking-[0.25em] text-white/40 uppercase mb-1">Turn</div>
          <div className="font-heading text-4xl font-bold"
            style={{ color: gs.current_turn === 'X' ? '#BC13FE' : '#FF5F1F', textShadow: `0 0 24px ${gs.current_turn === 'X' ? '#BC13FE' : '#FF5F1F'}` }}>
            {gs.current_turn || 'X'}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3" style={{ width: 'clamp(240px, 30vw, 400px)' }}>
          {board.map((cell, idx) => {
            const { char, color, border, glow } = cellDisplay(cell, idx);
            return (
              <div key={idx} className="aspect-square flex items-center justify-center rounded-xl border-4 font-heading transition-all"
                style={{ fontSize: 'clamp(2rem, 5vw, 5rem)', borderColor: border || '#FF5F1F', color, background: cell ? `${color}20` : '#0a0a0a', boxShadow: glow, fontWeight: cell ? 'bold' : 'normal' }}>
                {char}
              </div>
            );
          })}
        </div>
        {gs.winner && (
          <div className="font-heading text-3xl tracking-widest uppercase"
            style={{ color: gs.winner === 'X' ? '#BC13FE' : '#FF5F1F', textShadow: `0 0 30px ${gs.winner === 'X' ? '#BC13FE' : '#FF5F1F'}` }}>
            🏆 {gs.winner} WINS!
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">
        {gs.show_question && gs.current_question ? (
          <>
            <div className="font-heading text-xs tracking-[0.25em] text-[#FFD700]/70 uppercase mb-1">Question</div>
            <div className="px-5 py-5 rounded-xl border-2 border-[#FFD700]/30 bg-[#FFD700]/5 font-heading text-xl tracking-wide text-white leading-snug"
              style={{ boxShadow: '0 0 20px rgba(255,215,0,0.08)' }}>
              {gs.current_question}
            </div>
          </>
        ) : <div className="text-center font-heading text-xs tracking-widest text-white/20 uppercase">Question will appear here</div>}
      </div>
    </div>
  );
}

/* ── BOARD MODE (multiplayer) ── */
function BoardModeBoard({ gs, updateState, playerId, seatNumber, isSeated, chosenRole }) {
  const board = gs.board || Array(9).fill('');
  const currentTurn = gs.current_turn || 'X';
  const boardLocked = gs.board_locked !== false;
  const popup = gs.popup;
  const sty = PS2;

  const sbPlayers = gs.sb_players || [];
  const sbQueue = gs.sb_queue || [];
  const myRecord = sbPlayers.find(p => p.playerId === playerId);
  const myRole = myRecord?.role || null;
  const myQueueRecord = sbQueue.find(p => p.playerId === playerId);
  const myQueuePos = myQueueRecord?.queuePosition || null;
  const [roleChoice, setRoleChoice] = useState(null);
  const xPlayer = sbPlayers.find(p => p.role === 'X');
  const oPlayer = sbPlayers.find(p => p.role === 'O');

  useEffect(() => {
    if (!isSeated || !playerId || myRole) return;
    if (gs.display_mode !== 'board') return;
    if (chosenRole !== 'participant') return;
    const xTaken = !!xPlayer;
    const oTaken = !!oPlayer;
    if (!xTaken) {
      updateState({ sb_players: [...sbPlayers, { playerId, seatNumber, role: 'X', joinedAt: Date.now(), lastActionAt: Date.now() }] });
    } else if (!oTaken) {
      updateState({ sb_players: [...sbPlayers, { playerId, seatNumber, role: 'O', joinedAt: Date.now(), lastActionAt: Date.now() }] });
    }
  }, [isSeated, playerId, gs.display_mode, sbPlayers, chosenRole, xPlayer, oPlayer]);

  const handleJoinQueue = async () => {
    const nextPos = sbQueue.length + 1;
    await updateState({ sb_queue: [...sbQueue, { playerId, seatNumber, joinedQueueAt: Date.now(), queuePosition: nextPos }], sb_players: [...sbPlayers, { playerId, seatNumber, role: 'queued', joinedAt: Date.now(), lastActionAt: Date.now() }] });
    setRoleChoice('queue');
  };

  const handleWatchOnly = async () => {
    await updateState({ sb_players: [...sbPlayers, { playerId, seatNumber, role: 'viewer', joinedAt: Date.now(), lastActionAt: Date.now() }] });
    setRoleChoice('viewer');
  };

  const handleCellClick = async (idx) => {
    if (boardLocked || board[idx] || gs.winner) return;
    if (myRole !== currentTurn) return;
    const newBoard = [...board];
    newBoard[idx] = currentTurn;
    const winner = checkWinner(newBoard);
    const nextTurn = currentTurn === 'X' ? 'O' : 'X';
    const updatedPlayers = sbPlayers.map(p => p.playerId === playerId ? { ...p, lastActionAt: Date.now() } : p);
    await updateState({ board: newBoard, current_turn: winner ? currentTurn : nextTurn, winner: winner || null, board_locked: true, show_question: false, show_choices: false, answer_result: null, selected_answer: null, current_question: null, current_choices: null, correct_answer: null, current_category: null, last_action_seat: seatNumber, last_action_player_id: playerId, sb_players: updatedPlayers });
  };

  const handleAnswerSelect = async (letter) => {
    if (myRole !== currentTurn) return;
    if (gs.selected_answer) return;
    const isCorrect = letter === gs.correct_answer;
    await updateState({ selected_answer: letter, answer_result: isCorrect });
    if (isCorrect) {
      await updateState({ popup: 'correct' });
      setTimeout(() => updateState({ popup: null, board_locked: false }), 2000);
    } else {
      const nextTurn = currentTurn === 'X' ? 'O' : 'X';
      await updateState({ popup: 'wrong', current_turn: nextTurn, board_locked: true });
      setTimeout(() => updateState({ popup: null }), 2000);
    }
  };

  const canRevealQuestion = myRole === 'O' && currentTurn === 'O' && boardLocked && !gs.show_question && !gs.winner && !popup;
  const isMyTurn = myRole === currentTurn;
  const canControl = myRole === 'X' || myRole === 'O';
  const xTaken = !!xPlayer;
  const oTaken = !!oPlayer;
  const showPrompt = isSeated && !myRole && !myQueueRecord && xTaken && oTaken && roleChoice === null;
  const roleColor = myRole === 'X' ? '#BC13FE' : myRole === 'O' ? '#FF5F1F' : myRole === 'queued' ? '#FFD700' : '#ffffff40';
  const roleLabel = myRole === 'X' ? 'Player X — Host' : myRole === 'O' ? 'Player O — Contestant' : myRole === 'queued' ? `Queue — Position ${myQueuePos}` : myRole === 'viewer' ? 'Viewer' : null;

  const cellDisplay = (v) => {
    if (v === 'X') return { char: 'X', color: '#BC13FE', border: '#BC13FE', glow: '0 0 20px rgba(188,19,254,0.8), inset 0 0 15px rgba(188,19,254,0.2)' };
    if (v === 'O') return { char: 'O', color: '#FF5F1F', border: '#FF5F1F', glow: '0 0 20px rgba(255,95,31,0.8), inset 0 0 15px rgba(255,95,31,0.2)' };
    const active = !boardLocked && isMyTurn && canControl && !gs.winner;
    return { char: '', color: '#ffffff80', border: '#FF5F1F', glow: active ? '0 0 25px rgba(188,19,254,0.9), inset 0 0 20px rgba(255,95,31,0.3)' : '0 0 15px rgba(188,19,254,0.5), inset 0 0 10px rgba(255,95,31,0.15)' };
  };

  return (
    <div className="flex-1 flex items-stretch p-4 gap-4 relative">
      {popup && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="font-heading text-8xl md:text-9xl tracking-widest uppercase animate-pulse"
            style={{ color: popup === 'correct' ? '#4ade80' : '#ef4444', textShadow: `0 0 40px ${popup === 'correct' ? '#4ade80' : '#ef4444'}` }}>
            {popup === 'correct' ? 'CORRECT!' : 'WRONG!'}
          </div>
        </div>
      )}
      {showPrompt && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="max-w-sm w-full mx-4 p-8 rounded-2xl border-2 border-[#FFD700]/40 bg-black text-center space-y-5" style={{ boxShadow: '0 0 40px rgba(255,215,0,0.15)' }}>
            <div className="font-heading text-lg tracking-widest text-white uppercase">Game In Progress</div>
            <p className="font-body text-white/60 text-sm">Both players are active. Join the queue to play next?</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleJoinQueue} className="py-4 rounded-xl border-2 font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95" style={{ borderColor: '#FFD700', color: '#FFD700', background: '#FFD70010' }}>Join Queue</button>
              <button onClick={handleWatchOnly} className="py-4 rounded-xl border-2 font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95" style={{ borderColor: '#ffffff20', color: '#ffffff50', background: 'transparent' }}>Watch Only</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">
        {roleLabel && (
          <div className="px-4 py-3 rounded-xl border-2 text-center" style={{ borderColor: `${roleColor}50`, background: `${roleColor}10` }}>
            <div className="font-heading text-sm tracking-widest uppercase" style={{ color: roleColor, ...sty, fontSize: '9px' }}>{roleLabel}</div>
            {canControl && <div className="text-[7px] tracking-widest text-white/30 uppercase mt-1" style={sty}>{isMyTurn ? '▶ Your turn' : 'Waiting…'}</div>}
          </div>
        )}
        {myRole === 'viewer' && !myQueueRecord && (
          <button onClick={handleJoinQueue} className="px-4 py-3 rounded-xl border-2 font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95" style={{ borderColor: '#FFD70060', color: '#FFD700', background: '#FFD70008' }}>Join Queue</button>
        )}
        {gs.show_question && gs.current_question && (
          <>
            <div className="font-heading text-xs tracking-[0.25em] text-[#FFD700]/70 uppercase">Question</div>
            <div className="px-5 py-5 rounded-xl border-2 border-[#FFD700]/30 bg-[#FFD700]/5 font-heading text-xl tracking-wide text-white leading-snug" style={{ boxShadow: '0 0 20px rgba(255,215,0,0.08)' }}>
              {gs.current_question}
            </div>
            {!gs.show_choices && !popup && currentTurn === 'O' && myRole === 'O' && (
              <button onClick={() => updateState({ show_choices: true })} className="mt-1 px-6 py-3 rounded-xl border-2 border-[#FF5F1F] text-[#FF5F1F] font-heading text-sm tracking-widest uppercase hover:bg-[#FF5F1F]/20 transition-all active:scale-95" style={{ boxShadow: '0 0 15px rgba(255,95,31,0.3)' }}>Show Choices</button>
            )}
          </>
        )}
        {gs.show_choices && gs.current_choices && (
          <>
            <div className="font-heading text-xs tracking-[0.25em] text-[#8a22ff]/70 uppercase mt-2">Choices</div>
            {['A','B','C','D'].map((letter) => {
              const text = gs.current_choices[letter];
              if (!text) return null;
              const isSelected = gs.selected_answer === letter;
              const canClick = isMyTurn && canControl && !gs.selected_answer;
              const hostJudged = gs.answer_result === true || gs.answer_result === false;
              let style = 'border-[#8a22ff40] bg-[#8a22ff10] text-[#ffffffcc] opacity-50';
              if (canClick) style = 'border-[#8a22ff40] bg-[#8a22ff10] text-[#ffffffcc] hover:scale-[1.02] hover:border-[#8a22ff]';
              if (isSelected && !hostJudged) style = 'border-[#FFD700]/60 bg-[#FFD700]/10 text-[#FFD700]';
              if (hostJudged && isSelected && gs.answer_result) style = 'border-[#4ade80] bg-[#4ade80]/20 text-[#4ade80]';
              if (hostJudged && isSelected && !gs.answer_result) style = 'border-[#ef4444] bg-[#ef4444]/10 text-[#ef4444]';
              return (
                <button key={letter} onClick={() => canClick && handleAnswerSelect(letter)} disabled={!canClick || !!gs.selected_answer} className={`w-full px-5 py-4 rounded-xl border-2 font-heading text-lg tracking-wide text-left transition-all active:scale-95 disabled:cursor-default ${style}`} style={{ boxShadow: canClick ? '0 0 15px rgba(138,34,255,0.3)' : 'none' }}>
                  <span className="mr-2" style={{ color: '#8a22ff' }}>{letter}.</span>{text}
                </button>
              );
            })}
          </>
        )}
        {canControl && !isMyTurn && !gs.winner && !gs.show_question && (
          <div className="px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-center">
            <div className="text-[8px] tracking-widest text-white/30 uppercase" style={sty}>It is not your turn</div>
          </div>
        )}
      </div>
      <div className="flex flex-col items-center justify-center gap-4 shrink-0">
        <div className="px-6 py-3 rounded-xl border-2 text-center min-w-[220px]" style={{ borderColor: currentTurn === 'X' ? '#BC13FE' : '#FF5F1F', background: currentTurn === 'X' ? 'rgba(188,19,254,0.1)' : 'rgba(255,95,31,0.1)', boxShadow: `0 0 20px ${currentTurn === 'X' ? 'rgba(188,19,254,0.4)' : 'rgba(255,95,31,0.4)'}` }}>
          <div className="text-[8px] tracking-[0.3em] text-white/40 uppercase mb-1" style={sty}>Current Turn</div>
          <div className="font-heading text-3xl font-bold tracking-widest" style={{ color: currentTurn === 'X' ? '#BC13FE' : '#FF5F1F', textShadow: `0 0 20px ${currentTurn === 'X' ? '#BC13FE' : '#FF5F1F'}` }}>{currentTurn === 'X' ? 'PLAYER X' : 'PLAYER O'}</div>
          <div className="text-[7px] tracking-widest text-white/30 uppercase mt-1" style={sty}>{currentTurn === 'X' ? 'HOST' : 'CONTESTANT'}</div>
        </div>
        <div className="flex gap-3">
          {[{ role: 'X', color: '#BC13FE', player: xPlayer, label: 'HOST' }, { role: 'O', color: '#FF5F1F', player: oPlayer, label: 'CONTESTANT' }].map(({ role, color, player, label }) => (
            <div key={role} className="px-3 py-2 rounded-lg border text-center min-w-[90px]" style={{ borderColor: currentTurn === role ? color : `${color}30`, background: currentTurn === role ? `${color}15` : 'transparent' }}>
              <div className="font-heading text-xl" style={{ color, textShadow: currentTurn === role ? `0 0 12px ${color}` : 'none' }}>{role}</div>
              <div className="text-[6px] text-white/30 uppercase mt-0.5" style={sty}>{label}</div>
              <div className="text-[6px] text-white/40 uppercase" style={sty}>{player ? `Seat ${player.seatNumber}` : 'Open'}</div>
            </div>
          ))}
        </div>
        <div className="relative" style={{ width: 'clamp(240px, 30vw, 400px)' }}>
          <div onClick={() => canRevealQuestion && updateState({ show_question: true })} className={`grid grid-cols-3 gap-3 ${canRevealQuestion ? 'cursor-pointer' : ''}`}>
            {board.map((cell, idx) => {
              const { char, color, border, glow } = cellDisplay(cell);
              const canClick = !boardLocked && !cell && !gs.winner && isMyTurn && canControl;
              return (
                <div key={idx} onClick={(e) => { e.stopPropagation(); if (canClick) handleCellClick(idx); }} className={`aspect-square flex items-center justify-center rounded-xl border-4 font-heading transition-all ${canClick ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`} style={{ fontSize: 'clamp(2rem, 5vw, 5rem)', borderColor: border, color, background: cell ? `${color}20` : '#0a0a0a', boxShadow: glow, fontWeight: cell ? 'bold' : 'normal' }}>
                  {char}
                </div>
              );
            })}
          </div>
          {!boardLocked && !gs.winner && isMyTurn && canControl && (
            <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ boxShadow: '0 0 0 3px #4ade80, 0 0 20px rgba(74,222,128,0.3)' }} />
          )}
          {canRevealQuestion && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl pointer-events-none">
              <div className="font-heading text-lg tracking-widest text-[#FF5F1F] uppercase animate-pulse" style={{ textShadow: '0 0 20px rgba(255,95,31,0.8)' }}>TAP TO REVEAL</div>
            </div>
          )}
        </div>
        {gs.winner && (
          <div className="font-heading text-3xl tracking-widest uppercase" style={{ color: gs.winner === 'X' ? '#BC13FE' : '#FF5F1F', textShadow: `0 0 30px ${gs.winner === 'X' ? '#BC13FE' : '#FF5F1F'}` }}>🏆 {gs.winner} WINS!</div>
        )}
        <div className="text-center">
          <div className="text-[9px] tracking-widest uppercase font-heading" style={{ color: boardLocked ? '#ffffff30' : '#4ade80', fontFamily: "'Press Start 2P', monospace" }}>
            {boardLocked ? '🔒 BOARD LOCKED' : '🟢 PLACE MARKER'}
          </div>
        </div>
        {sbQueue.length > 0 && <div className="text-[7px] text-white/30 uppercase tracking-widest text-center" style={sty}>{sbQueue.length} in queue</div>}
      </div>
      <div className="flex-1" />
    </div>
  );
}