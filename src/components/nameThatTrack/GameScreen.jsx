import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Mic } from 'lucide-react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const HEADING = { fontFamily: "'Teko', sans-serif" };

export default function GameScreen({ gs, updateState, playerId }) {
  const phase = gs.phase || 'waiting';
  const currentQuestion = gs.currentQuestion;
  const song = currentQuestion?.song;
  const players = gs.players || [];
  const [guess, setGuess] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [muted, setMuted] = useState(false);
  const playerRef = useRef(null);

  useEffect(() => {
    setGuess('');
    setSubmitted(false);
  }, [currentQuestion]);

  const handleGuess = async () => {
    if (!guess.trim() || submitted) return;
    setSubmitted(true);
    await updateState({
      players: (players || []).map(p =>
        p.playerId === playerId ? { ...p, lastGuess: guess.trim(), guessSubmitted: true } : p
      ),
    });
  };

  const videoUrl = song ? `https://www.youtube.com/embed/${song.youtubeVideoId}?autoplay=1&start=30&end=45&mute=${muted ? 1 : 0}` : null;

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
        {song && (
          <div className="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden border-2 border-[#BC13FE]/50" style={{ boxShadow: '0 0 40px rgba(188,19,254,0.3)' }}>
            <iframe ref={playerRef} src={videoUrl} title="Music preview" className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
          </div>
        )}

        {currentQuestion && (
          <div className="text-center">
            <div className="font-heading text-2xl tracking-widest text-[#FFD700] uppercase mb-2" style={{ ...PS2, textShadow: '0 0 20px rgba(255,215,0,0.5)' }}>
              {currentQuestion.question.questionType === 'title' ? '🎵 NAME THAT TRACK' :
               currentQuestion.question.questionType === 'artist' ? '🎤 NAME THAT ARTIST' :
               '🎵 NAME THAT TRACK & ARTIST'}
            </div>
            <div className="text-white/40 text-sm">{currentQuestion.question.points} points • {currentQuestion.question.difficulty.toUpperCase()}</div>
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

        {submitted && (
          <div className="px-6 py-4 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 text-center">
            <div className="font-heading text-lg text-[#FFD700] uppercase" style={PS2}>⏳ Waiting for other players...</div>
          </div>
        )}

        <div className="w-full max-w-2xl grid grid-cols-2 md:grid-cols-4 gap-3">
          {(players || []).map((player, idx) => (
            <div key={player.playerId} className={`p-3 rounded-xl border text-center ${player.playerId === playerId ? 'border-[#FFD700] bg-[#FFD700]/10' : 'border-white/10 bg-white/5'}`}>
              <div className="text-[7px] text-white/40 uppercase mb-1" style={PS2}>{player.playerId === playerId ? 'YOU' : `P${idx + 1}`}</div>
              <div className="font-heading text-2xl text-white" style={HEADING}>{player.score || 0}</div>
              <div className="text-[6px] text-white/30 uppercase" style={PS2}>{player.correctAnswers || 0} CORRECT</div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => setMuted(!muted)} className="fixed bottom-6 right-6 p-3 rounded-full bg-black/50 border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-all">
        {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>
    </div>
  );
}