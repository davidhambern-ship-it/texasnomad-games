import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function TargetWordDisplay({ targetWords = [], foundWords = [] }) {
  const normalizedWords = targetWords
    .map(item => (typeof item === 'string' ? item : item?.word))
    .filter(Boolean);

  const visibleWords = normalizedWords
    .filter(word => !foundWords.includes(word))
    .slice(0, 5);

  return (
    <div className="border-2 border-cyber-purple/40 rounded-xl p-4 bg-black/40 box-glow-purple">
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-lg font-heading text-outlaw-gold tracking-wider"
          style={{ textShadow: '0 0 10px #FFD700' }}
        >
          TARGET WORDS
        </h3>

        <span className="text-[10px] tracking-widest text-white/60" style={PS2}>
          {foundWords.length}/{normalizedWords.length}
        </span>
      </div>

      <div className="space-y-2">
        {visibleWords.length > 0 ? (
          visibleWords.map((word, idx) => (
            <div
              key={`${word}-${idx}`}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
            >
              <span className="font-heading text-emerald-400 tracking-widest">
                {word.toUpperCase()}
              </span>
              <span className="text-white/40">○</span>
            </div>
          ))
        ) : (
          <div className="text-white/50 font-body text-sm">
            No target words loaded.
          </div>
        )}
      </div>
    </div>
  );
}
