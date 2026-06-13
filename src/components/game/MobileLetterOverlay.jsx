import React, { useState } from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function MobileLetterOverlay({
  canGuess, guessed, wrong, onGuessLetter, onGuessWord,
  isListening, onToggleVoice, transcript, onTranscriptChange,
  seatNumber, isSinglePlayer, iAmSetter1P, iAmGuesser1P, cpuCharacter,
  isGoRoundMode, alreadyChosen, isSeated,
  hint, hintRevealed, hintUsed, onUseHint,
}) {
  const [wordText, setWordText] = useState('');
  const [showWordInput, setShowWordInput] = useState(false);

  const submitWord = () => {
    const val = wordText.trim() || transcript?.trim();
    if (val) { onGuessWord(val); setWordText(''); onTranscriptChange(''); setShowWordInput(false); }
  };

  return (
    // sm:hidden — only shows on mobile
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(7,3,17,0.93)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(188,19,254,0.3)',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.6)',
      }}>

      {/* Status strip */}
      <div className="px-3 pt-2 pb-1">
        {!isSeated && (
          <div className="text-center text-[7px] text-white/30 uppercase tracking-widest" style={PS2}>Joining game…</div>
        )}
        {isSinglePlayer && iAmSetter1P && (
          <div className="text-center text-[7px] text-[#FFD700]/70 uppercase tracking-widest" style={PS2}>🔒 You are Host — {cpuCharacter?.name || 'CPU'} is guessing!</div>
        )}
        {isSinglePlayer && iAmGuesser1P && (
          <div className="text-center text-[7px] text-[#4ade80]/70 uppercase tracking-widest" style={PS2}>🔤 Guess {cpuCharacter?.name || 'CPU'}'s word!</div>
        )}
        {isGoRoundMode && alreadyChosen && (
          <div className="text-center text-[7px] text-[#FF5F1F] uppercase tracking-widest" style={PS2}>You chose this round. Waiting…</div>
        )}
      </div>

      {/* Letter grid */}
      <div className="px-2 pb-1">
        <div className="flex flex-wrap gap-1 justify-center">
          {ALPHABET.map((l) => {
            const isWrong = wrong.includes(l);
            const isCorrect = guessed.includes(l);
            const used = isWrong || isCorrect;
            const active = canGuess && !used;
            return (
              <button
                key={l}
                onClick={() => active && onGuessLetter(l)}
                disabled={!active}
                className="w-10 h-10 rounded-lg border-2 text-sm font-bold transition-all active:scale-90"
                style={{
                  ...PS2,
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  borderColor: isWrong ? '#ef444460' : isCorrect ? '#4ade8060' : active ? '#FFD700' : '#ffffff15',
                  color: isWrong ? '#ef444450' : isCorrect ? '#4ade8050' : active ? '#FFD700' : '#ffffff20',
                  background: isWrong ? '#ef444410' : isCorrect ? '#4ade8010' : active ? 'rgba(255,215,0,0.05)' : 'transparent',
                  textDecoration: isWrong ? 'line-through' : 'none',
                  cursor: active ? 'pointer' : 'default',
                }}>
                {l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom row: Hint + Word Guess */}
      <div className="flex items-center gap-2 px-3 pb-3 pt-1">
        {/* Hint button */}
        {hint && !hintRevealed && canGuess && (
          <button
            onClick={onUseHint}
            disabled={hintUsed}
            className="px-3 py-2 rounded-lg border font-heading text-xs tracking-widest uppercase transition-all active:scale-95 disabled:opacity-40 shrink-0"
            style={{
              touchAction: 'manipulation',
              borderColor: '#BC13FE80',
              color: '#BC13FE',
              background: '#BC13FE10',
            }}>
            {hintUsed ? '💡 Used' : '💡 HINT'}
          </button>
        )}
        {hintRevealed && hint && (
          <div className="px-2 py-1 rounded-lg border border-[#BC13FE]/30 bg-[#BC13FE]/10 text-[7px] text-[#BC13FE] tracking-wide truncate flex-1" style={PS2}>
            💡 {hint}
          </div>
        )}

        {/* Word guess toggle */}
        {canGuess && !showWordInput && (
          <button
            onClick={() => setShowWordInput(true)}
            className="ml-auto px-3 py-2 rounded-lg border border-[#22d3ee]/40 text-[#22d3ee] font-heading text-xs tracking-widest uppercase transition-all active:scale-95 shrink-0"
            style={{ touchAction: 'manipulation' }}>
            GUESS WORD
          </button>
        )}
      </div>

      {/* Word guess input (expanded) */}
      {showWordInput && canGuess && (
        <div className="px-3 pb-3 flex gap-2 items-center">
          <input
            autoFocus
            className="flex-1 px-3 py-2 rounded-lg bg-black/80 border-2 border-[#22d3ee]/40 text-white font-body text-base focus:border-[#22d3ee] focus:outline-none uppercase tracking-widest"
            value={wordText || transcript}
            onChange={e => { setWordText(e.target.value.toUpperCase()); onTranscriptChange(''); }}
            placeholder="Full word…"
            onKeyDown={e => e.key === 'Enter' && submitWord()}
          />
          <button onClick={onToggleVoice}
            className={`px-3 py-2 rounded-lg border-2 text-lg transition-all ${isListening ? 'border-red-500 text-red-400 animate-pulse' : 'border-[#22d3ee]/40 text-[#22d3ee]/70'}`}
            style={{ touchAction: 'manipulation' }}>
            {isListening ? '🔴' : '🎙'}
          </button>
          <button onClick={submitWord} disabled={!wordText.trim() && !transcript?.trim()}
            className="px-4 py-2 rounded-lg border-2 border-[#22d3ee] text-[#22d3ee] font-heading text-sm tracking-widest uppercase hover:bg-[#22d3ee]/20 transition-all disabled:opacity-30"
            style={{ touchAction: 'manipulation' }}>
            GO
          </button>
          <button onClick={() => setShowWordInput(false)}
            className="px-2 py-2 rounded-lg border border-white/20 text-white/40 font-body text-sm"
            style={{ touchAction: 'manipulation' }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}