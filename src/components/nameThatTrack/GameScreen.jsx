import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Mic } from 'lucide-react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const HEADING = { fontFamily: "'Teko', sans-serif" };

import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';

export default function GameScreen({ gs, updateState, playerId }) {
  const phase = gs.phase || 'waiting';
  const currentQuestion = gs.currentQuestion;
  const question = currentQuestion?.question || currentQuestion;
  const song = currentQuestion?.song || currentQuestion;
  const players = gs.players || [];
  const vsAI = gs.vs_ai;
  const aiTeamSize = gs.ai_team_size || 4;
  const [guess, setGuess] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [aiGuesses, setAIGuesses] = useState([]);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const playerRef = useRef(null);

  useEffect(() => {
    setGuess('');
    setSubmitted(false);
    setAIGuesses([]);
    setIsPlayerTurn(true);
  }, [currentQuestion]);

  // AI guessing logic - only runs on AI's turn
  useEffect(() => {
    if (!vsAI || phase !== 'guessing' || isPlayerTurn || submitted) return;
    
    const aiDelay = 3000 + Math.random() * 4000; // AI guesses between 3-7 seconds
    const timer = setTimeout(() => {
      const aiCharacters = TEXASNOMAD_CHARACTERS.slice(0, aiTeamSize);
      const questionType = question?.questionType;
      
      const aiGuessResults = aiCharacters.map((char, idx) => {
        const accuracy = 0.3 + (char.traits.intelligence / 100) * 0.5; // 30-80% accuracy
        const isCorrect = Math.random() < accuracy;
        
        let guessText = '';
        if (isCorrect && song) {
          guessText = questionType === 'artist' ? song.artist : song.title;
        } else {
          // Wrong guess
          const wrongGuesses = questionType === 'artist' 
            ? ['The Beatles', 'Drake', 'Beyoncé', 'Taylor Swift', 'Elvis']
            : ['Song Title', 'Unknown Track', 'Mystery Hit', 'Classic Song'];
          guessText = wrongGuesses[Math.floor(Math.random() * wrongGuesses.length)];
        }
        
        return {
          characterId: char.id,
          characterName: char.name,
          guess: guessText,
          isCorrect,
          delay: idx * 800,
        };
      });
      
      setAIGuesses(aiGuessResults);
      
      // Process results after all AI guesses are shown
      setTimeout(() => {
        processRoundResults(aiGuessResults);
      }, 2000);
    }, aiDelay);
    
    return () => clearTimeout(timer);
  }, [vsAI, phase, isPlayerTurn, submitted, question, song]);

  const handleGuess = async () => {
    if (!guess.trim() || submitted) return;
    setSubmitted(true);
    
    // Check if player's guess is correct
    const questionType = question?.questionType;
    const isCorrect = song && (
      questionType === 'artist' 
        ? guess.toLowerCase().includes(song.artist.toLowerCase())
        : guess.toLowerCase().includes(song.title.toLowerCase())
    );
    
    await updateState({
      players: (players || []).map(p =>
        p.playerId === playerId ? {
          ...p,
          lastGuess: guess.trim(),
          guessSubmitted: true,
          score: isCorrect ? (p.score || 0) + (question?.points || 100) : p.score,
          correctAnswers: isCorrect ? (p.correctAnswers || 0) + 1 : p.correctAnswers,
        } : p
      ),
    });
    
    // Switch to AI's turn after player guesses
    setIsPlayerTurn(false);
  };

  async function processRoundResults(aiGuessResults) {
    // Update AI team score
    const aiCorrectCount = aiGuessResults.filter(ai => ai.isCorrect).length;
    const aiPoints = aiCorrectCount * (question?.points || 100);
    
    await updateState({
      aiTeamScore: (gs.aiTeamScore || 0) + aiPoints,
      aiCorrectAnswers: (gs.aiCorrectAnswers || 0) + aiCorrectCount,
      lastRoundResults: {
        playerCorrect: players.find(p => p.playerId === playerId)?.correctAnswers,
        aiCorrect: aiCorrectCount,
      },
    });
    
    // Move to next round or end game
    const currentRound = gs.currentRound || 1;
    if (currentRound >= (gs.totalRounds || 10)) {
      await updateState({ phase: 'game_over' });
    } else {
      await updateState({
        phase: 'round_over',
        currentRound: currentRound + 1,
      });
      // Reset turn flag for next round
      setIsPlayerTurn(true);
      // Start next round after 3 seconds
      setTimeout(startNextRound, 3000);
    }
  }

  async function startNextRound() {
    try {
      const { base44 } = await import('@/api/base44Client');
      const res = await base44.functions.invoke('nameThatTrack', {
        action: 'getRandomQuestion',
        playlistIds: gs.selectedPlaylists || [],
        categories: gs.selectedCategories || [],
      });
      
      if (res.data.question) {
        await updateState({
          phase: 'guessing',
          currentQuestion: res.data.question,
        });
        setSubmitted(false);
        setAIGuesses([]);
      }
    } catch (err) {
      console.error('Failed to load next question:', err);
    }
  }

  const videoUrl = song ? `https://www.youtube.com/embed/${song.youtubeVideoId}?start=30&mute=${muted ? 1 : 0}&controls=1` : null;

  // Game over check
  if (phase === 'game_over') {
    const playerScore = players.find(p => p.playerId === playerId)?.score || 0;
    const aiScore = gs.aiTeamScore || 0;
    const playerWon = playerScore > aiScore;
    
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-center mb-8">
          <div className="font-heading text-4xl tracking-widest uppercase mb-4" style={{ ...PS2, textShadow: playerWon ? '0 0 30px #FFD700' : '0 0 30px #BC13FE' }}>
            {playerWon ? '🏆 YOU WIN!' : '🤖 AI TEAM WINS!'}
          </div>
          <div className="text-white/60 text-lg">Final Score</div>
        </div>
        
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="p-6 rounded-2xl border-2 border-[#FFD700] bg-[#FFD700]/10 text-center">
            <div className="text-[8px] text-[#FFD700]/60 uppercase mb-2" style={PS2}>YOU</div>
            <div className="font-heading text-5xl text-[#FFD700]" style={HEADING}>{playerScore}</div>
          </div>
          <div className="p-6 rounded-2xl border-2 border-[#BC13FE] bg-[#BC13FE]/10 text-center">
            <div className="text-[8px] text-[#BC13FE]/60 uppercase mb-2" style={PS2}>AI TEAM</div>
            <div className="font-heading text-5xl text-[#BC13FE]" style={HEADING}>{aiScore}</div>
          </div>
        </div>
        
        <button
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-[#BC13FE] text-white rounded-xl font-heading text-lg tracking-widest uppercase hover:bg-[#BC13FE]/90 transition-all"
          style={{ ...PS2, boxShadow: '0 0 20px rgba(188,19,254,0.4)' }}
        >
          🔄 PLAY AGAIN
        </button>
      </div>
    );
  }

  // Round over / intro screen
  if (phase === 'round_over' || phase === 'intro') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-[#8a22ff]/40 border-t-[#8a22ff] rounded-full animate-spin mb-6" />
        <div className="font-heading text-2xl tracking-widest text-white/60 uppercase" style={PS2}>
          {phase === 'intro' ? '🎵 GET READY...' : `ROUND ${gs.currentRound || 1} STARTING...`}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
        {song && (
          <div className="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden border-2 border-[#BC13FE]/50" style={{ boxShadow: '0 0 40px rgba(188,19,254,0.3)' }}>
            <iframe ref={playerRef} src={videoUrl} title="Music preview" className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
          </div>
        )}

        {question && (
          <div className="text-center">
            <div className="font-heading text-2xl tracking-widest text-[#FFD700] uppercase mb-2" style={{ ...PS2, textShadow: '0 0 20px rgba(255,215,0,0.5)' }}>
              {question.questionType === 'title' ? '🎵 NAME THAT TRACK' :
               question.questionType === 'artist' ? '🎤 NAME THAT ARTIST' :
               '🎵 NAME THAT TRACK & ARTIST'}
            </div>
            <div className="text-white/40 text-sm">{question.points} points • {question.difficulty?.toUpperCase()}</div>
          </div>
        )}

        {phase === 'guessing' && !submitted && (
          <div className="w-full max-w-md space-y-3">
            <input
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Type your answer..."
              className="w-full px-6 py-4 bg-black/50 border-2 border-[#BC13FE]/50 rounded-xl text-white text-lg placeholder-white/30 focus:border-[#BC13FE] focus:outline-none"
              style={{ boxShadow: '0 0 20px rgba(188,19,254,0.2)' }}
            />
            <button
              onClick={handleGuess}
              disabled={!guess.trim()}
              className="w-full py-4 bg-[#BC13FE] text-white rounded-xl font-heading text-lg tracking-widest uppercase hover:bg-[#BC13FE]/90 disabled:opacity-50"
              style={{ ...PS2, boxShadow: '0 0 20px rgba(188,19,254,0.4)' }}
            >
              <Mic className="w-5 h-5 inline mr-2" /> SUBMIT GUESS
            </button>
          </div>
        )}

        {submitted && vsAI && aiGuesses.length === 0 && (
          <div className="px-6 py-4 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 text-center">
            <div className="font-heading text-lg text-[#FFD700] uppercase" style={PS2}>⏳ AI Team is thinking...</div>
          </div>
        )}

        {submitted && vsAI && aiGuesses.length > 0 && (
          <div className="w-full max-w-2xl space-y-2">
            <div className="font-heading text-sm tracking-widest text-[#BC13FE] uppercase mb-3 text-center" style={PS2}>AI Team Guesses</div>
            {aiGuesses.map((ai, idx) => (
              <div key={ai.characterId} className={`flex items-center justify-between p-3 rounded-lg border ${ai.isCorrect ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
                <div className="flex items-center gap-3">
                  <img src={TEXASNOMAD_CHARACTERS.find(c => c.id === ai.characterId)?.avatar} alt={ai.characterName} className="w-8 h-8 rounded-full border border-white/20" />
                  <span className="font-heading text-white" style={HEADING}>{ai.characterName}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white">{ai.guess}</div>
                  <div className={`text-[10px] uppercase tracking-widest ${ai.isCorrect ? 'text-green-400' : 'text-red-400'}`} style={PS2}>
                    {ai.isCorrect ? '✓ CORRECT' : '✕ WRONG'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {submitted && !vsAI && (
          <div className="px-6 py-4 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 text-center">
            <div className="font-heading text-lg text-[#FFD700] uppercase" style={PS2}>⏳ Waiting for other players...</div>
          </div>
        )}

        <div className="w-full max-w-3xl grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Player score */}
          {(players || []).map((player, idx) => (
            <div key={player.playerId} className={`p-3 rounded-xl border text-center ${player.playerId === playerId ? 'border-[#FFD700] bg-[#FFD700]/10' : 'border-white/10 bg-white/5'}`}>
              <div className="text-[7px] text-white/40 uppercase mb-1" style={PS2}>{player.playerId === playerId ? 'YOU' : `P${idx + 1}`}</div>
              <div className="font-heading text-2xl text-white" style={HEADING}>{player.score || 0}</div>
              <div className="text-[6px] text-white/30 uppercase" style={PS2}>{player.correctAnswers || 0} CORRECT</div>
            </div>
          ))}
          
          {/* AI Team score */}
          {vsAI && (
            <div className="p-3 rounded-xl border border-[#BC13FE]/50 bg-[#BC13FE]/10 text-center">
              <div className="text-[7px] text-[#BC13FE]/60 uppercase mb-1" style={PS2}>🤖 AI TEAM</div>
              <div className="font-heading text-2xl text-[#BC13FE]" style={HEADING}>{gs.aiTeamScore || 0}</div>
              <div className="text-[6px] text-[#BC13FE]/40 uppercase" style={PS2}>{gs.aiCorrectAnswers || 0} CORRECT</div>
            </div>
          )}
        </div>
      </div>

      <button onClick={() => setMuted(!muted)} className="fixed bottom-6 right-6 p-3 rounded-full bg-black/50 border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-all">
        {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>
    </div>
  );
}