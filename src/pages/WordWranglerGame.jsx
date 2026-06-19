import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import useGameStats from '@/hooks/useGameStats';
import Header from '@/components/home/Header';
import WordBoard from '@/components/wordWrangler/WordBoard';
import PlayerPanel from '@/components/wordWrangler/PlayerPanel';
import TargetWordDisplay from '@/components/wordWrangler/TargetWordDisplay';
import GameInstructions from '@/components/game/GameInstructions';
import { generateBoardWithWords, isTargetWord, injectWordIntoBoard, pickTargetWords, ensureActiveWordsOnBoard } from '@/lib/wordWranglerWordGenerator';
import { getAdjacentCells, calculateScore, removeTilesAndCascade } from '@/lib/wordWranglerUtils';
import { soundManager } from '@/lib/wordWranglerSound';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function WordWranglerGame() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomCode = searchParams.get('room')?.toUpperCase();
  const isCreator = searchParams.get('creator') === '1';
  const vsAI = searchParams.get('vsai') === '1';

  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [selectedCells, setSelectedCells] = useState([]);
  const [wordsFound, setWordsFound] = useState([]);
  const [currentScore, setCurrentScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(180);
  const [gamePhase, setGamePhase] = useState('setup');
  const [lastWordScore, setLastWordScore] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [animatingCells, setAnimatingCells] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef(null);

  const targetWords = React.useMemo(() => {
    if (!game?.gameState?.activeWords) return [];
    const activeWords = Array.isArray(game.gameState.activeWords) 
      ? game.gameState.activeWords.map(w => typeof w === 'string' ? w : w?.word).filter(Boolean)
      : [];
    return activeWords;
  }, [game?.gameState?.activeWords]);

  useEffect(() => {
    if (!roomCode) { setError('No room code provided'); setLoading(false); return; }
    async function initGame() {
      try {
        const rooms = await base44.entities.WordWranglerGame.filter({ room_code: roomCode });
        if (rooms.length === 0) {
          const boardSize = 8;
          const { board, placedWords } = generateBoardWithWords(boardSize, 5);
          const activeWords = placedWords.map(p => p.word);
          let letterBoard = board.map((row) => row.map((letter) => ({ letter, specialType: Math.random() < 0.12 ? ['gold-bean','diamond','dexter','frog','microphone','texas-flag'][Math.floor(Math.random() * 6)] : null })));
          letterBoard = ensureActiveWordsOnBoard(letterBoard, activeWords);
          let creatorId = null;
          if (isCreator) { try { const u = await base44.auth.me(); creatorId = u?.id || null; } catch (_) {} }
          const gameData = { room_code: roomCode, status: 'active', host_connected: isCreator, screen_connected: false, players: [], gameMode: vsAI ? 'vs-ai' : 'single-player', difficulty: 'reader', boardSize, letterBoard, gameState: { phase: 'setup', activeWords, totalWordsFound: 0, timeRemaining: 180 }, created_by_user_id: creatorId };
          const created = await base44.entities.WordWranglerGame.create(gameData);
          if (vsAI) {
            let user = null; try { user = await base44.auth.me(); } catch (_) {}
            const pid = user?.id || `player_${Date.now()}`;
            const gameWithPlayer = { ...created, players: [{ playerId: pid, seatNumber: 1, playerName: 'Player 1', score: 0, wordsFound: [], status: 'active', isAI: false }], gameState: { ...created.gameState, phase: 'playing' } };
            await base44.entities.WordWranglerGame.update(created.id, gameWithPlayer);
            setGame(gameWithPlayer);
            setPlayerId(pid);
            setPlayerName('Player 1');
            setGamePhase('playing');
          } else {
            setGame(created);
          }
        } else {
          const existingGame = rooms[0];
          let gameToUpdate = existingGame;
          if (vsAI && existingGame.players?.length === 0) {
            let user = null; try { user = await base44.auth.me(); } catch (_) {}
            const pid = user?.id || `player_${Date.now()}`;
            gameToUpdate = { ...existingGame, players: [{ playerId: pid, seatNumber: 1, playerName: 'Player 1', score: 0, wordsFound: [], status: 'active', isAI: false }], gameState: { ...existingGame.gameState, phase: 'playing' } };
            await base44.entities.WordWranglerGame.update(existingGame.id, gameToUpdate);
            setGame(gameToUpdate);
            setPlayerId(pid);
            setPlayerName('Player 1');
            setGamePhase('playing');
          } else {
            if (!existingGame.gameState?.activeWords?.length) {
              const boardSize = existingGame.boardSize || 8;
              const { board, placedWords } = generateBoardWithWords(boardSize, 5);
              const activeWords = placedWords.map(p => p.word);

              let letterBoard = board.map((row) => row.map((letter) => ({ letter, specialType: Math.random() < 0.12 ? ['gold-bean','diamond','dexter','frog','microphone','texas-flag'][Math.floor(Math.random() * 6)] : null })));
              letterBoard = ensureActiveWordsOnBoard(letterBoard, activeWords);

              gameToUpdate = {
                ...existingGame,
                letterBoard,
                gameState: {
                  ...existingGame.gameState,
                  activeWords,
                  totalWordsFound: existingGame.gameState?.totalWordsFound || 0,
                  timeRemaining: existingGame.gameState?.timeRemaining || 180
                }
              };

              await base44.entities.WordWranglerGame.update(existingGame.id, gameToUpdate);
            }
            setGame(gameToUpdate);
            if (existingGame.players?.length > 0) {
              const player = existingGame.players.find(p => !p.isAI);
              if (player) {
                setPlayerId(player.playerId);
                setPlayerName(player.playerName);
                setWordsFound(player.wordsFound || []);
                setCurrentScore(player.score || 0);
              }
            }
            if (existingGame.gameState?.phase === 'playing') {
              setGamePhase('playing');
              setTimeRemaining(existingGame.gameState.timeRemaining || 180);
            }
          }
        }
        setLoading(false);
      } catch (err) { console.error('Failed to initialize game:', err); setError('Failed to load game: ' + err.message); setLoading(false); }
    }
    initGame();
    const interval = setInterval(async () => {
      if (roomCode && gamePhase !== 'game-over') {
        try {
          const rooms = await base44.entities.WordWranglerGame.filter({ room_code: roomCode });
          if (rooms.length > 0) {
            const freshGame = rooms[0];
            setGame(prev => {
              if (!prev) return freshGame;
              if (freshGame.updated_date && prev.updated_date) {
                const freshTime = new Date(freshGame.updated_date).getTime();
                const prevTime = new Date(prev.updated_date).getTime();
                if (freshTime > prevTime + 500) {
                  const player = freshGame.players?.find(p => p.playerId === playerId);
                  if (player) { setWordsFound(player.wordsFound || []); setCurrentScore(player.score || 0); }
                  return { ...prev, players: freshGame.players, letterBoard: freshGame.letterBoard };
                }
              }
              return prev;
            });
          }
        } catch (err) { console.error('Poll error:', err); }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [roomCode, vsAI, playerId]);

  useEffect(() => {
    if (gamePhase === 'playing' && timeRemaining > 0 && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => { if (prev <= 1) { endGame(); return 0; } return prev - 1; });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gamePhase, timeRemaining, isPaused]);

  const handleCellSelect = useCallback((row, col) => {
    if (gamePhase !== 'playing' || !game?.letterBoard || isPaused) return;
    setSelectedCells(prev => {
      const cellKey = `${row}-${col}`;
      const isSelected = prev.some(c => `${c.row}-${c.col}` === cellKey);
      if (isSelected) { const index = prev.findIndex(c => `${c.row}-${c.col}` === cellKey); return prev.slice(0, index); }
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const adjacent = getAdjacentCells(last.row, last.col, game.boardSize || 8);
        if (!adjacent.some(c => c.row === row && c.col === col)) return prev;
      }
      if (prev.some(c => c.row === row && c.col === col)) return prev;
      return [...prev, { row, col }];
    });
  }, [gamePhase, game?.boardSize, game?.letterBoard]);

  const handleSelectionComplete = useCallback(async () => {
    if (selectedCells.length < 3 || gamePhase !== 'playing' || !game?.letterBoard || isPaused) return;
    const word = selectedCells.map(c => game.letterBoard[c.row][c.col].letter).join('');
    const activeWords = game?.gameState?.activeWords || [];
    if (!isTargetWord(word, activeWords)) {
      setFeedback({ type: 'penalty', message: 'NOT A TARGET!', value: -3 });
      soundManager.playWrong();
      setTimeRemaining(prev => Math.max(0, prev - 3));
      setSelectedCells([]);
      setTimeout(() => setFeedback(null), 1000);
      return;
    }
    if (wordsFound.includes(word)) {
      setFeedback({ type: 'invalid', message: 'ALREADY FOUND!', value: 0 });
      soundManager.playWrong();
      setSelectedCells([]);
      setTimeout(() => setFeedback(null), 1000);
      return;
    }
    const score = calculateScore(word.length, selectedCells, game.letterBoard);
    const timeBonus = word.length === 3 ? 5 : word.length === 4 ? 7 : word.length === 5 ? 10 : 15;
    setTimeRemaining(prev => prev + timeBonus);
    setFeedback({ type: 'bonus', message: 'TIME BONUS!', value: timeBonus });
    soundManager.playWhiplash();
    const newBoard = removeTilesAndCascade(game.letterBoard, selectedCells, game.boardSize || 8);
    setAnimatingCells(selectedCells);
    setTimeout(() => setAnimatingCells([]), 500);
    
    const totalWordsFound = (game.gameState?.totalWordsFound || 0) + 1;
    const newTotalWordsFound = totalWordsFound;
    
    let finalBoard = newBoard;
    let newActiveWords = [...activeWords.filter(w => w !== word)];
    
    if (newTotalWordsFound < 20) {
      const wordsToPick = pickTargetWords(3, 3, 8);
      for (const candidate of wordsToPick) {
        if (newActiveWords.includes(candidate) || wordsFound.includes(candidate) || candidate === word) continue;
        const boardCopy = finalBoard.map(row => row.map(cell => ({ ...cell })));
        const result = injectWordIntoBoard(boardCopy, candidate, game.boardSize || 8);
        if (result?.placed) {
          result.placed.forEach(p => {
            boardCopy[p.row][p.col] = { ...boardCopy[p.row][p.col], letter: p.letter };
          });
          finalBoard = boardCopy;
          newActiveWords = [...newActiveWords, candidate];
          break;
        }
      }
    }
    
    // Ensure all active words are physically on the board
    finalBoard = ensureActiveWordsOnBoard(finalBoard, newActiveWords, game.boardSize || 8);
    
    const playerIndex = game.players.findIndex(p => p.playerId === playerId);
    if (playerIndex >= 0) {
      const updatedPlayers = [...game.players];
      updatedPlayers[playerIndex] = { ...updatedPlayers[playerIndex], score: updatedPlayers[playerIndex].score + score, wordsFound: [...(updatedPlayers[playerIndex].wordsFound || []), word] };
      const updatedGame = { 
        ...game, 
        players: updatedPlayers, 
        letterBoard: finalBoard,
        gameState: {
          ...game.gameState,
          activeWords: newActiveWords,
          totalWordsFound: newTotalWordsFound
        }
      };
      await base44.entities.WordWranglerGame.update(game.id, updatedGame);
      setGame(updatedGame);
      setWordsFound(prev => [...prev, word]);
      setCurrentScore(prev => prev + score);
      setLastWordScore({ word, score });
      setSelectedCells([]);
      soundManager.playCupFill();
      setTimeout(() => { setFeedback(null); setLastWordScore(null); }, 2000);
      if (newTotalWordsFound >= 20) endGame();
    }
  }, [selectedCells, gamePhase, game, wordsFound, playerId]);

  const joinGame = async (name) => {
    try {
      let user = null; try { user = await base44.auth.me(); } catch (_) {}
      const playerId = user?.id || `player_${Date.now()}`;
      const updatedGame = { ...game, players: [...(game?.players || []), { playerId, seatNumber: (game?.players?.length || 0) + 1, playerName: name, score: 0, wordsFound: [], status: 'active', isAI: false }], gameState: { ...game?.gameState, phase: 'playing' } };
      await base44.entities.WordWranglerGame.update(game.id, updatedGame);
      setPlayerId(playerId); setPlayerName(name); setGame(updatedGame); setGamePhase('playing'); setTimeRemaining(180);
    } catch (err) { console.error('Failed to join game:', err); setError('Failed to join game'); }
  };

  const { recordStat, resetStat } = useGameStats('word-wrangler');

  const endGame = async () => {
    setGamePhase('game-over');
    const sortedPlayers = [...(game?.players || [])].sort((a, b) => b.score - a.score);
    if (sortedPlayers.length > 0) {
      const updatedGame = { ...game, status: 'finished', players: sortedPlayers.map((p, i) => ({ ...p, status: i === 0 ? 'winner' : 'active' })), gameState: { ...game?.gameState, phase: 'game-over' } };
      await base44.entities.WordWranglerGame.update(game.id, updatedGame);
      // Record stats: find this player's score
      const myPlayer = sortedPlayers.find(p => p.playerId === playerId);
      if (myPlayer) {
        const won = sortedPlayers[0].playerId === playerId;
        recordStat({ score: myPlayer.score, won });
      }
    }
  };

  const playAgain = async () => {
    try {
      const boardSize = 8;
      const { board, placedWords } = generateBoardWithWords(boardSize, 5);
      const activeWords = placedWords.map(p => p.word);
      let letterBoard = board.map((row) => row.map((letter) => ({ letter, specialType: Math.random() < 0.12 ? ['gold-bean','diamond','dexter','frog','microphone','texas-flag'][Math.floor(Math.random() * 6)] : null })));
      letterBoard = ensureActiveWordsOnBoard(letterBoard, activeWords);
      const updatedGame = { ...game, status: 'active', players: (game?.players || []).map(p => ({ ...p, score: 0, wordsFound: [], status: 'active' })), letterBoard, gameState: { ...game?.gameState, phase: 'playing', activeWords, totalWordsFound: 0, timeRemaining: 180 } };
      await base44.entities.WordWranglerGame.update(game.id, updatedGame);
      setGame(updatedGame);
      setGamePhase('playing');
      setTimeRemaining(180);
      setWordsFound([]);
      setCurrentScore(0);
      setLastWordScore(null);
      setSelectedCells([]);
    } catch (err) { console.error('Failed to play again:', err); }
  };

  const leaveGame = () => navigate('/games');

  if (loading) {
    return (
      <div className="min-h-screen bg-midnight-void flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyber-purple border-t-outlaw-gold rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-outlaw-gold font-heading text-2xl tracking-widest uppercase">Loading...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-midnight-void flex items-center justify-center">
        <div className="text-center">
          <p className="text-kinetic-orange font-heading text-3xl mb-4">ERROR</p>
          <p className="text-white/60 font-body mb-6">{error}</p>
          <button onClick={leaveGame} className="px-6 py-3 border-2 border-outlaw-gold text-outlaw-gold font-heading uppercase tracking-widest hover:bg-outlaw-gold hover:text-black transition-all">Back to Games</button>
        </div>
      </div>
    );
  }

  if (!playerId && gamePhase === 'setup' && !vsAI) {
    return (
      <div className="min-h-screen bg-midnight-void flex items-center justify-center p-4">
        <div className="max-w-md w-full border-2 border-cyber-purple rounded-2xl p-8 box-glow-purple" style={{ background: '#08050f' }}>
          <h1 className="text-4xl font-heading text-center text-outlaw-gold mb-2" style={{ textShadow: '0 0 20px #FFD700' }}>WORD WRANGLER</h1>
          <p className="text-white/60 text-center mb-6 font-body">Enter your name to join</p>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="YOUR NAME"
            className="w-full px-4 py-3 rounded-lg bg-black/60 border-2 border-cyber-purple/50 text-white font-body text-lg mb-4 focus:outline-none focus:border-outlaw-gold"
            maxLength={20}
            onKeyPress={(e) => e.key === 'Enter' && playerName.trim() && joinGame(playerName.trim())}
          />
          <button
            onClick={() => playerName.trim() && joinGame(playerName.trim())}
            disabled={!playerName.trim()}
            className="w-full py-3 rounded-lg font-heading text-lg tracking-widest uppercase bg-gradient-to-r from-cyber-purple to-cyber-purple/80 text-white disabled:opacity-50 hover:opacity-90 transition-all"
          >
            JOIN GAME
          </button>
          <button onClick={() => setShowInstructions(true)} className="w-full mt-3 py-2 text-sm text-white/60 font-body hover:text-white transition-all">
            📖 How to Play
          </button>
        </div>
        {showInstructions && <GameInstructions gameId="word-wrangler" onDismiss={() => setShowInstructions(false)} />}
      </div>
    );
  }
  const timePercent = Math.max(0, (timeRemaining / 180) * 100);
  const isLowTime = timeRemaining <= 30;
  return (
    <div className="min-h-screen bg-midnight-void text-white overflow-hidden">
      <Header />
      <div className="border-b border-cyber-purple/30 bg-black/40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl md:text-3xl font-heading text-outlaw-gold tracking-wider" style={{ textShadow: '0 0 15px #FFD700' }}>WORD WRANGLER</h1>
            <span className="px-3 py-1 rounded bg-cyber-purple/20 border border-cyber-purple/50 text-[10px] tracking-widest uppercase" style={PS2}>{roomCode}</span>
          </div>
          <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className={`text-2xl ${isLowTime ? 'text-kinetic-orange animate-pulse' : 'text-kinetic-orange'}`} style={PS2}>⏱</span>
            <span className={`text-2xl font-mono font-bold ${isLowTime ? 'text-kinetic-orange animate-pulse' : 'text-white'}`}>{Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}</span>
          </div>
          <div className="text-white/60 text-sm font-body">Words: {(game?.gameState?.totalWordsFound || 0)}/20</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsPaused(!isPaused)} className={`p-2 rounded hover:bg-white/10 transition-all ${isPaused ? 'text-kinetic-orange' : 'text-white'}`}>{isPaused ? '▶' : '⏸'}</button>
            <button onClick={() => setIsMuted(!isMuted)} className="p-2 rounded hover:bg-white/10 transition-all">{isMuted ? '🔇' : '🔊'}</button>
            <button onClick={() => setShowInstructions(true)} className="p-2 rounded hover:bg-white/10 transition-all">📖</button>
            <button onClick={leaveGame} className="p-2 rounded hover:bg-white/10 transition-all">🚪</button>
          </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3"><PlayerPanel players={game?.players || []} currentPlayerId={playerId} gameMode={game?.gameMode} /></div>
          <div className="lg:col-span-6">
            <div className="relative p-1 rounded-2xl box-glow-purple bg-black/40">
              <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden" style={{ padding: '4px', background: `conic-gradient(from 270deg, #FF5F1F ${timePercent}%, #BC13FE ${timePercent}% 60%, #FFD700 60% 100%)`, filter: isLowTime ? 'drop-shadow(0 0 15px #FF5F1F)' : 'drop-shadow(0 0 8px #BC13FE)' }}><div className="w-full h-full rounded-2xl bg-black" /></div>
              <div className="relative z-10 border-2 border-cyber-purple/40 rounded-2xl p-4">
                <WordBoard board={game?.letterBoard || []} selectedCells={selectedCells} onCellSelect={handleCellSelect} onSelectionComplete={handleSelectionComplete} boardSize={game?.boardSize || 8} disabled={gamePhase !== 'playing'} animatingCells={animatingCells} />
                <div className="mt-4 text-center">
                  <div className="text-3xl font-mono font-bold text-white tracking-[0.3em] min-h-[2.5rem]">{selectedCells.map(c => game?.letterBoard[c.row][c.col].letter).join('')}</div>
                </div>
                {feedback && (
                  <div className={`mt-2 text-center text-lg font-heading tracking-widest animate-bounce ${feedback.type === 'bonus' ? 'text-emerald-400' : feedback.type === 'penalty' ? 'text-kinetic-orange' : 'text-white/60'}`}>
                    {feedback.message} {feedback.value > 0 ? `+${feedback.value}s` : feedback.value < 0 ? `${feedback.value}s` : ''}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">{!isPaused && <TargetWordDisplay targetWords={targetWords} foundWords={wordsFound} />}</div>
        </div>
      </div>

      {gamePhase === 'game-over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)' }}>
          <div className="max-w-lg w-full border-2 border-outlaw-gold rounded-2xl p-8 box-glow-gold text-center" style={{ background: '#08050f' }}>
            <h2 className="text-4xl font-heading text-outlaw-gold mb-4" style={{ textShadow: '0 0 20px #FFD700' }}>TIME'S UP!</h2>
            <div className="mb-6">
              <p className="text-white/60 font-body mb-2">Final Standings</p>
              <div className="space-y-2">
                {[...(game?.players || [])].sort((a, b) => b.score - a.score).map((p, i) => (
                  <div key={p.playerId} className={`flex items-center justify-between p-3 rounded ${i === 0 ? 'bg-outlaw-gold/20 border border-outlaw-gold' : 'bg-white/5'}`}>
                    <span className="font-body text-lg">{i === 0 ? '👑' : `#${i + 1}`} {p.playerName}</span>
                    <span className="font-mono text-xl text-outlaw-gold">{p.score} pts</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-white/80 font-body mb-6">Want to wrangle more words?</p>
            <div className="space-y-3">
              <button onClick={playAgain} className="w-full py-3 rounded-lg font-heading text-lg tracking-widest uppercase bg-gradient-to-r from-outlaw-gold to-outlaw-gold/80 text-black hover:opacity-90 transition-all box-glow-gold">🤠 PLAY AGAIN</button>
              <button onClick={leaveGame} className="w-full py-3 rounded-lg font-heading text-lg tracking-widest uppercase border-2 border-white/30 text-white/70 hover:border-white hover:text-white transition-all">Back to Games</button>
            </div>
          </div>
        </div>
      )}

      {showInstructions && <GameInstructions gameId="word-wrangler" onDismiss={() => setShowInstructions(false)} />}
      {lastWordScore && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="animate-bounce">
            <div className="text-4xl font-heading text-outlaw-gold" style={{ textShadow: '0 0 20px #FFD700, 0 0 40px #FFD700' }}>+{lastWordScore.score}</div>
            <div className="text-center text-white font-mono tracking-widest">{lastWordScore.word.toUpperCase()}</div>
          </div>
        </div>
      )}
    </div>
  );
}