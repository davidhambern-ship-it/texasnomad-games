import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Header from '@/components/home/Header';
import WordBoard from '@/components/wordWrangler/WordBoard';
import PlayerPanel from '@/components/wordWrangler/PlayerPanel';
import GameControls from '@/components/wordWrangler/GameControls';
import WordList from '@/components/wordWrangler/WordList';
import GameInstructions from '@/components/game/GameInstructions';
import { generateLetterBoard, validateWord, calculateScore, getAdjacentCells, removeTilesAndCascade, checkOutlawDanger } from '@/lib/wordWranglerUtils';
import { soundManager } from '@/lib/wordWranglerSound';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const HEADING = { fontFamily: "'Teko', sans-serif" };
const BODY = { fontFamily: "'Inter', sans-serif" };

export default function WordWranglerGame() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomCode = searchParams.get('room')?.toUpperCase();
  const isCreator = searchParams.get('creator') === '1';
  const vsAI = searchParams.get('vsai') === '1';
  const cpuOpponent = searchParams.get('cpu');

  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [selectedCells, setSelectedCells] = useState([]);
  const [wordsFound, setWordsFound] = useState([]);
  const [currentScore, setCurrentScore] = useState(0);
  const [gameMode, setGameMode] = useState('single-player');
  const [difficulty, setDifficulty] = useState('reader');
  const [specialTilesEnabled, setSpecialTilesEnabled] = useState(true);
  const [timerLength, setTimerLength] = useState(60);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [gamePhase, setGamePhase] = useState('setup');
  const [showWordModal, setShowWordModal] = useState(false);
  const [lastWordScore, setLastWordScore] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [outlawDanger, setOutlawDanger] = useState(false);
  const [animatingCells, setAnimatingCells] = useState([]);

  const timerRef = useRef(null);
  const boardRef = useRef(null);
  const gameRef = useRef(null);
  const outlawTimerRef = useRef(null);

  // Keep ref in sync with latest game state
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const createNewGame = async () => {
    const boardSize = difficulty === 'simpleton' ? 6 : difficulty === 'reader' ? 8 : 10;
    const letterBoard = generateLetterBoard(boardSize, specialTilesEnabled);
    
    const gameData = {
      room_code: roomCode,
      status: 'waiting',
      host_connected: isCreator,
      screen_connected: false,
      players: [],
      gameMode: vsAI ? 'vs-ai' : 'single-player',
      difficulty,
      boardSize,
      letterBoard,
      gameState: {
        phase: 'setup',
        currentPlayerIndex: 0,
        timeRemaining: timerLength,
        roundNumber: 1,
        totalRounds: 3,
        selectedCells: [],
        currentWord: '',
        specialTilesEnabled,
        timerLength,
      },
      created_by_user_id: isCreator ? (await base44.auth.me())?.id : null,
    };

    const created = await base44.entities.WordWranglerGame.create(gameData);
    return created;
  };

  // Initialize or load game
  useEffect(() => {
    if (!roomCode) {
      setError('No room code provided');
      setLoading(false);
      return;
    }

    async function initGame() {
      try {
        // Check if room exists
        const rooms = await base44.entities.WordWranglerGame.filter({ room_code: roomCode });
        
        if (rooms.length === 0) {
          // Create new room
          const newGame = await createNewGame();
          // Auto-join for vsAI mode
          if (vsAI) {
            const user = await base44.auth.me();
            const pid = user?.id || `player_${Date.now()}`;
            const gameWithPlayer = {
              ...newGame,
              players: [{
                playerId: pid,
                seatNumber: 1,
                playerName: 'Player 1',
                score: 0,
                wordsFound: [],
                status: 'active',
                isAI: false,
              }],
              status: 'active',
              gameState: {
                ...newGame.gameState,
                phase: 'playing',
              }
            };
            await base44.entities.WordWranglerGame.update(newGame.id, gameWithPlayer);
            setGame(gameWithPlayer);
            setPlayerId(pid);
            setPlayerName('Player 1');
            setGamePhase('playing');
            setTimeRemaining(timerLength);
          } else {
            setGame(newGame);
          }
        } else {
          const existingGame = rooms[0];
          // Auto-join if vsAI and not already joined
          if (vsAI && existingGame.players?.length === 0) {
            const user = await base44.auth.me();
            const pid = user?.id || `player_${Date.now()}`;
            const updatedGame = {
              ...existingGame,
              players: [{
                playerId: pid,
                seatNumber: 1,
                playerName: 'Player 1',
                score: 0,
                wordsFound: [],
                status: 'active',
                isAI: false,
              }],
              status: 'active',
              gameState: {
                ...existingGame.gameState,
                phase: 'playing',
              }
            };
            await base44.entities.WordWranglerGame.update(existingGame.id, updatedGame);
            setGame(updatedGame);
            setPlayerId(pid);
            setPlayerName('Player 1');
            setGamePhase('playing');
            setTimeRemaining(timerLength);
          } else {
            setGame(existingGame);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize game:', err);
        console.error('Error details:', err.message, err.stack);
        setError('Failed to load game: ' + (err.message || 'Unknown error'));
        setLoading(false);
      }
    }

    initGame();

    // Poll for updates
    const interval = setInterval(async () => {
      if (roomCode && gamePhase !== 'game-over') {
        try {
          const rooms = await base44.entities.WordWranglerGame.filter({ room_code: roomCode });
          if (rooms.length > 0) {
            const freshGame = rooms[0];
            setGame(prev => {
              // Don't overwrite if we don't have prev yet
              if (!prev) return freshGame;
              // If we have a player but fresh game doesn't, keep our version
              if (prev?.players?.length > 0 && (!freshGame.players || freshGame.players.length === 0)) {
                return prev;
              }
              // Compare updated_date to see if database has newer data
              if (freshGame.updated_date && prev.updated_date) {
                const freshTime = new Date(freshGame.updated_date).getTime();
                const prevTime = new Date(prev.updated_date).getTime();
                // Only update if database is genuinely newer (by more than 500ms to avoid race conditions)
                if (freshTime > prevTime + 500) {
                  console.log('[Poll] Updating from database (newer by', freshTime - prevTime, 'ms)');
                  return freshGame;
                }
              }
              // Keep current state
              return prev;
            });
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [roomCode, vsAI, gamePhase]);

  // Timer
  useEffect(() => {
    if (gamePhase === 'playing' && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timerRef.current);
  }, [gamePhase, timeRemaining]);

  // Outlaw tile movement timer (every 10 seconds)
  useEffect(() => {
    if (gamePhase === 'playing' && game?.letterBoard) {
      outlawTimerRef.current = setInterval(() => {
        const danger = checkOutlawDanger(game.letterBoard, game.boardSize || 8);
        if (danger) {
          setOutlawDanger(true);
          soundManager.playRattlesnake();
        } else {
          setOutlawDanger(false);
        }
      }, 10000);
    }

    return () => clearInterval(outlawTimerRef.current);
  }, [gamePhase, game?.letterBoard, game?.boardSize]);

  const joinGame = async (name) => {
    try {
      const user = await base44.auth.me();
      const playerId = user?.id || `player_${Date.now()}`;
      
      const updatedGame = {
        ...game,
        players: [
          ...(game?.players || []),
          {
            playerId,
            seatNumber: (game?.players?.length || 0) + 1,
            playerName: name,
            score: 0,
            wordsFound: [],
            status: 'active',
            isAI: false,
          }
        ],
        status: 'active',
        gameState: {
          ...game?.gameState,
          phase: 'playing',
        }
      };

      console.log('Joining game, updating with player:', playerId, name);
      await base44.entities.WordWranglerGame.update(game.id, updatedGame);
      console.log('Game updated, setting local state');
      setPlayerId(playerId);
      setPlayerName(name);
      setGame(updatedGame);
      setGamePhase('playing');
      setTimeRemaining(timerLength);
      console.log('Join complete, playerId:', playerId, 'gamePhase:', gamePhase);
    } catch (err) {
      console.error('Failed to join game:', err);
      setError('Failed to join game');
    }
  };

  const handleCellSelect = useCallback((row, col) => {
    if (gamePhase !== 'playing' || !game?.letterBoard) return;

    // Play spurs sound on selection
    if (selectedCells.length < 10) soundManager.playSpurs();

    setSelectedCells(prev => {
      const cellKey = `${row}-${col}`;
      const isSelected = prev.some(c => `${c.row}-${c.col}` === cellKey);

      if (isSelected) {
        // Deselect this cell and all after it
        const index = prev.findIndex(c => `${c.row}-${c.col}` === cellKey);
        return prev.slice(0, index);
      } else {
        // Check adjacency if not first cell
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          const adjacent = getAdjacentCells(last.row, last.col, game.boardSize || 8);
          if (!adjacent.some(c => c.row === row && c.col === col)) {
            return prev;
          }
        }
        // Check if already selected
        if (prev.some(c => c.row === row && c.col === col)) {
          return prev;
        }
        return [...prev, { row, col }];
      }
    });
  }, [gamePhase, game?.boardSize, game?.letterBoard]);

  const submitWord = async () => {
    if (selectedCells.length < 3) {
      console.log('[submitWord] Not enough cells:', selectedCells.length);
      return;
    }
    
    // Use current game state directly
    if (!game || !game.letterBoard) {
      console.log('[submitWord] No game or letterBoard');
      return;
    }

    const word = selectedCells.map(c => game.letterBoard[c.row][c.col].letter).join('');
    console.log('[submitWord] Submitting word:', word, 'playerId:', playerId, 'players:', game.players?.length);
    
    // Validate word
    if (!validateWord(word)) {
      console.log('[submitWord] Invalid word:', word);
      soundManager.playWrong();
      return;
    }

    // Check if already found by this player
    const currentPlayer = game.players?.find(p => p.playerId === playerId);
    if (!currentPlayer) {
      console.error('[submitWord] Player not found:', playerId, 'players:', game.players?.map(p => p.playerId));
      return;
    }
    if (currentPlayer.wordsFound?.includes(word)) {
      console.log('[submitWord] Word already found:', word);
      return;
    }

    // Calculate score
    const score = calculateScore(word.length, selectedCells, game.letterBoard);
    console.log('[submitWord] Score:', score);
    
    // Play sounds
    soundManager.playWhiplash();
    
    // Cascade tiles
    const newBoard = removeTilesAndCascade(game.letterBoard, selectedCells, game.boardSize || 8);
    setAnimatingCells(selectedCells);
    setTimeout(() => setAnimatingCells([]), 500);
    
    // Check outlaw danger
    const danger = checkOutlawDanger(newBoard, game.boardSize || 8);
    setOutlawDanger(danger);
    if (danger) soundManager.playRattlesnake();
    
    // Update game state
    const playerIndex = game.players.findIndex(p => p.playerId === playerId);
    const updatedPlayers = [...game.players];
    updatedPlayers[playerIndex] = {
      ...updatedPlayers[playerIndex],
      score: updatedPlayers[playerIndex].score + score,
      wordsFound: [...(updatedPlayers[playerIndex].wordsFound || []), word]
    };

    const updatedGame = {
      ...game,
      players: updatedPlayers,
      letterBoard: newBoard,
    };

    try {
      console.log('[submitWord] Updating game in database...');
      await base44.entities.WordWranglerGame.update(game.id, updatedGame);
      console.log('[submitWord] Game updated successfully');
      
      // Update local game state immediately so next submission works
      setGame(updatedGame);
      setWordsFound(prev => [...prev, word]);
      setCurrentScore(prev => prev + score);
      setLastWordScore({ word, score });
      setShowWordModal(true);
      setSelectedCells([]);
      soundManager.playCupFill();

      setTimeout(() => {
        setShowWordModal(false);
        setLastWordScore(null);
      }, 2000);
      
      return true;
    } catch (err) {
      console.error('[submitWord] Failed to update game:', err);
    }
  };

  const clearSelection = () => {
    setSelectedCells([]);
  };

  const startGame = () => {
    setGamePhase('playing');
    setTimeRemaining(timerLength);
  };

  const endGame = async () => {
    setGamePhase('game-over');
    
    // Determine winner
    const sortedPlayers = [...(game?.players || [])].sort((a, b) => b.score - a.score);
    if (sortedPlayers.length > 0) {
      const updatedGame = {
        ...game,
        status: 'finished',
        players: sortedPlayers.map((p, i) => ({
          ...p,
          status: i === 0 ? 'winner' : 'active'
        })),
        gameState: {
          ...game?.gameState,
          phase: 'game-over',
        }
      };
      
      await base44.entities.WordWranglerGame.update(game.id, updatedGame);
    }
  };

  const playAgain = async () => {
    try {
      // Reset game state
      const boardSize = difficulty === 'simpleton' ? 6 : difficulty === 'reader' ? 8 : 10;
      const newLetterBoard = generateLetterBoard(boardSize, specialTilesEnabled);
      
      const updatedGame = {
        ...game,
        status: 'active',
        players: (game?.players || []).map(p => ({
          ...p,
          score: 0,
          wordsFound: [],
          status: 'active'
        })),
        letterBoard: newLetterBoard,
        gameState: {
          ...game?.gameState,
          phase: 'playing',
          timeRemaining: timerLength,
          roundNumber: (game?.gameState?.roundNumber || 1) + 1,
        }
      };
      
      await base44.entities.WordWranglerGame.update(game.id, updatedGame);
      setGame(updatedGame);
      setGamePhase('playing');
      setTimeRemaining(timerLength);
      setWordsFound([]);
      setCurrentScore(0);
      setLastWordScore(null);
      setOutlawDanger(false);
      setSelectedCells([]);
    } catch (err) {
      console.error('Failed to play again:', err);
    }
  };

  const leaveGame = () => {
    navigate('/games');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-midnight-void flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyber-purple border-t-outlaw-gold rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-outlaw-gold font-heading text-2xl tracking-widest uppercase">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-midnight-void flex items-center justify-center">
        <div className="text-center">
          <p className="text-kinetic-orange font-heading text-3xl mb-4">ERROR</p>
          <p className="text-white/60 font-body mb-6">{error}</p>
          <button onClick={leaveGame} className="px-6 py-3 border-2 border-outlaw-gold text-outlaw-gold font-heading uppercase tracking-widest hover:bg-outlaw-gold hover:text-black transition-all">
            Back to Games
          </button>
        </div>
      </div>
    );
  }



  // Show name input for new players
  if (!playerId && gamePhase === 'setup' && !vsAI) {
    return (
      <div className="min-h-screen bg-midnight-void flex items-center justify-center p-4">
        <div className="max-w-md w-full border-2 border-cyber-purple rounded-2xl p-8 box-glow-purple" style={{ background: '#08050f' }}>
          <h1 className="text-4xl font-heading text-center text-outlaw-gold mb-2" style={{ textShadow: '0 0 20px #FFD700' }}>
            WORD WRANGLER
          </h1>
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
          
          <button
            onClick={() => setShowInstructions(true)}
            className="w-full mt-3 py-2 text-sm text-white/60 font-body hover:text-white transition-all"
          >
            📖 How to Play
          </button>
        </div>
        
        {showInstructions && (
          <GameInstructions gameId="word-wrangler" onDismiss={() => setShowInstructions(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-midnight-void text-white overflow-hidden">
      <Header />
      
      {/* Top Bar */}
      <div className="border-b border-cyber-purple/30 bg-black/40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl md:text-3xl font-heading text-outlaw-gold tracking-wider" style={{ textShadow: '0 0 15px #FFD700' }}>
              WORD WRANGLER
            </h1>
            <span className="px-3 py-1 rounded bg-cyber-purple/20 border border-cyber-purple/50 text-[10px] tracking-widest uppercase" style={PS2}>
              {roomCode}
            </span>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Timer */}
            <div className="flex items-center gap-2">
              <span className="text-kinetic-orange text-2xl" style={PS2}>⏱</span>
              <span className={`text-2xl font-mono font-bold ${timeRemaining <= 10 ? 'text-kinetic-orange animate-pulse' : 'text-white'}`}>
                {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
              </span>
            </div>
            
            {/* Round */}
            <div className="text-white/60 text-sm font-body">
              Round {game?.gameState?.roundNumber || 1} of {game?.gameState?.totalRounds || 3}
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Outlaw Danger Indicator */}
              {outlawDanger && (
                <div className="px-3 py-1 rounded bg-red-600/80 border border-red-400 animate-pulse" style={PS2}>
                  <span className="text-[10px] text-white">⚠️ OUTLAW!</span>
                </div>
              )}
              
              {/* Mute Toggle */}
              <button 
                onClick={() => {
                  setIsMuted(!isMuted);
                  soundManager.setMute(!isMuted);
                }} 
                className="p-2 rounded hover:bg-white/10 transition-all" 
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
              
              <button onClick={() => setShowInstructions(true)} className="p-2 rounded hover:bg-white/10 transition-all" title="How to Play">
                📖
              </button>
              <button onClick={leaveGame} className="p-2 rounded hover:bg-white/10 transition-all" title="Leave Game">
                🚪
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel - Players */}
          <div className="lg:col-span-3">
            <PlayerPanel 
              players={game?.players || []} 
              currentPlayerId={playerId}
              gameMode={game?.gameMode}
            />
          </div>
          
          {/* Center - Game Board */}
          <div className="lg:col-span-6">
            <div className="border-2 border-cyber-purple/40 rounded-2xl p-4 box-glow-purple bg-black/40">
              <WordBoard
                board={game?.letterBoard || []}
                selectedCells={selectedCells}
                onCellSelect={handleCellSelect}
                boardSize={game?.boardSize || 8}
                disabled={gamePhase !== 'playing'}
                animatingCells={animatingCells}
              />
              
              {/* Current Word Display */}
              <div className="mt-4 text-center">
                <div className="text-3xl font-mono font-bold text-white tracking-[0.3em] min-h-[2.5rem]">
                  {selectedCells.map(c => game?.letterBoard[c.row][c.col].letter).join('')}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="mt-4 flex gap-3 justify-center">
                <button
                  onClick={clearSelection}
                  disabled={selectedCells.length === 0}
                  className="px-6 py-3 rounded-lg font-heading text-sm tracking-widest uppercase border-2 border-white/30 text-white/70 disabled:opacity-30 hover:border-white hover:text-white transition-all"
                >
                  Clear
                </button>
                <button
                  onClick={() => submitWord()}
                  disabled={selectedCells.length < 3}
                  className="px-8 py-3 rounded-lg font-heading text-sm tracking-widest uppercase bg-gradient-to-r from-outlaw-gold to-outlaw-gold/80 text-black disabled:opacity-30 hover:opacity-90 transition-all box-glow-gold"
                >
                  Submit Word
                </button>
              </div>
            </div>
          </div>
          
          {/* Right Panel - Words Found */}
          <div className="lg:col-span-3">
            <WordList 
              wordsFound={wordsFound}
              currentScore={currentScore}
              lastWordScore={lastWordScore}
              outlawDanger={outlawDanger}
            />
          </div>
        </div>
      </div>

      {/* Game Over Modal */}
      {gamePhase === 'game-over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)' }}>
          <div className="max-w-lg w-full border-2 border-outlaw-gold rounded-2xl p-8 box-glow-gold text-center" style={{ background: '#08050f' }}>
            <h2 className="text-4xl font-heading text-outlaw-gold mb-4" style={{ textShadow: '0 0 20px #FFD700' }}>
              TIME'S UP!
            </h2>
            
            <div className="mb-6">
              <p className="text-white/60 font-body mb-2">Final Standings</p>
              <div className="space-y-2">
                {[...(game?.players || [])]
                  .sort((a, b) => b.score - a.score)
                  .map((p, i) => (
                    <div key={p.playerId} className={`flex items-center justify-between p-3 rounded ${i === 0 ? 'bg-outlaw-gold/20 border border-outlaw-gold' : 'bg-white/5'}`}>
                      <span className="font-body text-lg">{i === 0 ? '👑' : `#${i + 1}`} {p.playerName}</span>
                      <span className="font-mono text-xl text-outlaw-gold">{p.score} pts</span>
                    </div>
                  ))}
              </div>
            </div>
            
            <p className="text-white/80 font-body mb-6">Want to wrangle more words?</p>
            
            <div className="space-y-3">
              <button
                onClick={playAgain}
                className="w-full py-3 rounded-lg font-heading text-lg tracking-widest uppercase bg-gradient-to-r from-outlaw-gold to-outlaw-gold/80 text-black hover:opacity-90 transition-all box-glow-gold"
              >
                🤠 PLAY AGAIN
              </button>
              <button
                onClick={leaveGame}
                className="w-full py-3 rounded-lg font-heading text-lg tracking-widest uppercase border-2 border-white/30 text-white/70 hover:border-white hover:text-white transition-all"
              >
                Back to Games
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions Modal */}
      {showInstructions && (
        <GameInstructions gameId="word-wrangler" onDismiss={() => setShowInstructions(false)} />
      )}

      {/* Word Score Popup */}
      {showWordModal && lastWordScore && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="animate-bounce">
            <div className="text-4xl font-heading text-outlaw-gold" style={{ textShadow: '0 0 20px #FFD700, 0 0 40px #FFD700' }}>
              +{lastWordScore.score}
            </div>
            <div className="text-center text-white font-mono tracking-widest">
              {lastWordScore.word.toUpperCase()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}