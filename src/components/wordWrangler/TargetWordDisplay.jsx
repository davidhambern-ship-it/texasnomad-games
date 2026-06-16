import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function TargetWordDisplay({ targetWords, foundWords }) {
  const visibleWords = targetWords
  .filter(item => {
    const word = typeof item === 'string' ? item : item.word;
    return !foundWords.includes(word);
  })
  .slice(0, 5);
  const remaining = targetWords.length - foundWords.length;

  return (
    <div className="border-2 border-cyber-purple/40 rounded-xl p-4 bg-black/40 box-glow-purple">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-heading text-outlaw-gold tracking-wider" style={{ textShadow: '0 0 10px #FFD700' }}>
          TARGET WORDS
        </h3>
        <span className="text-[10px] tracking-widest text-white/60" style={PS2}>
          {foundWords.length}/{targetWords.length}
        </span>
      </div>
      
      <div className="space-y-2">
        {visibleWords.map((item, idx) => {
          const word = typeof item === 'string' ? item : item.word;
          const found = foundWords.includes(word);
          
          return (
            <div
              key={idx}
              className={`px-3 py-2 rounded border transition-all ${
                found
                  ? 'bg-emerald-600/30 border-emerald-500/60'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className={`text-sm font-mono tracking-widest ${found ? 'text-emerald-400 line-through' : 'text-white'}`}>
                {found ? '✓' : '○'} {word}
              </div>
            </div>
          );
        })}
        
        {visibleWords.length < 5 && Array(5 - visibleWords.length).fill(null).map((_, idx) => (
          <div key={`empty-${idx}`} className="px-3 py-2 rounded border border-white/5 bg-white/5">
            <div className="text-sm font-mono tracking-widest text-white/20">???</div>
          </div>
        ))}
      </div>
      
      {remaining > 5 && (
        <div className="mt-3 text-center">
          <span className="text-[9px] tracking-widest text-white/40" style={PS2}>
            +{remaining - 5} MORE HIDDEN
          </span>
        </div>
      )}
    </div>
  );
}