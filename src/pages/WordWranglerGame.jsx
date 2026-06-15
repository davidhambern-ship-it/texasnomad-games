import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Header from '@/components/home/Header';
import WordBoard from '@/components/wordWrangler/WordBoard';
import PlayerPanel from '@/components/wordWrangler/PlayerPanel';
import GameControls from '@/components/wordWrangler/GameControls';
import WordList from '@/components/wordWrangler/WordList';
import GameInstructions from '@/components/game/GameInstructions';
import { generateLetterBoard, validateWord, calculateScore, getAdjacentCells } from '@/lib/wordWranglerUtils';

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

  const timerRef = useRef(null);
  const boardRef = useRef(null);

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
          setGame(newGame);
        } else {
          setGame(rooms[0]);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize game:', err);
        setError('Failed to load game');
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
            setGame(rooms[0]);
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [roomCode]);

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

      await base44.entities.WordWranglerGame.update(game.id, updatedGame);
      setPlayerId(playerId);
      setPlayerName(name);
      setGame(updatedGame);
      setGamePhase('playing');
      setTimeRemaining(timerLength);
    } catch (err) {
      console.error('Failed to join game:', err);
      setError('Failed to join game');
    }
  };

  const handleCellSelect = useCallback((row, col) => {
    if (gamePhase !== 'playing' || !game?.letterBoard) return;

    setSelectedCells(prev => {
      const cellKey = `${row}-${col}`;
      const isSelected = prev.some(c => `${c.row}-${c.col}` === cellKey);

      if (isSelected) {
        // Deselect from this cell onwards
        const index = prev.findIndex(c => `${c.row}-${c.col}` === cellKey);
        return prev.slice(0, index);
      } else {
        // Check if adjacent to last selected
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          const adjacent = getAdjacentCells(last.row, last.col, game.boardSize || 8);
          if (!adjacent.some(c => c.row === row && c.col === col)) {
            return prev; // Not adjacent, return unchanged
          }
        }
        return [...prev, { row, col }];
      }
    });
  }, [gamePhase, game?.boardSize, game?.letterBoard]);

  const submitWord = async () => {
    if (selectedCells.length < 3) return;

    const word = selectedCells.map(c => game.letterBoard[c.row][c.col].letter).join('');
    
    // Validate word
    if (!validateWord(word)) {
      // Show invalid word feedback
      return;
    }

    // Check if already found
    if (wordsFound.includes(word)) {
      return;
    }

    // Calculate score
    const score = calculateScore(word.length, selectedCells, game.letterBoard);
    
    // Update game state
    const updatedGame = {
      ...game,
      players: game.players.map(p => 
        p.playerId === playerId 
          ? { ...p, score: p.score + score, wordsFound: [...p.wordsFound, word] }
          : p
      ),
    };

    await base44.entities.WordWranglerGame.update(game.id, updatedGame);
    
    setWordsFound([...wordsFound, word]);
    setCurrentScore(prev => prev + score);
    setLastWordScore({ word, score });
    setShowWordModal(true);
    setSelectedCells([]);

    setTimeout(() => {
      setShowWordModal(false);
      setLastWordScore(null);
    }, 2000);
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
      const winner = sortedPlayers[0];
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
            <div className="flex gap-2">
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
                  onClick={submitWord}
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
            />
          </div>
        </div>
      </div>

      {/* Game Over Modal */}
      {gamePhase === 'game-over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)' }}>
          <div className="max-w-lg w-full border-2 border-outlaw-gold rounded-2xl p-8 box-glow-gold text-center" style={{ background: '#08050f' }}>
            <h2 className="text-4xl font-heading text-outlaw-gold mb-4" style={{ textShadow: '0 0 20px #FFD700' }}>
              GAME OVER
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
            
            <button
              onClick={leaveGame}
              className="w-full py-3 rounded-lg font-heading text-lg tracking-widest uppercase bg-gradient-to-r from-outlaw-gold to-outlaw-gold/80 text-black hover:opacity-90 transition-all"
            >
              Back to Games
            </button>
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