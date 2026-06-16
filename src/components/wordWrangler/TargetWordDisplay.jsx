import React from 'react';

export default function TargetWordDisplay({ targetWords = [], foundWords = [] }) {
  const visibleWords = targetWords;
  const totalTargetWords = targetWords.length + foundWords.length;

  return (
    <div className="border-2 border-cyber-purple/40 rounded-xl p-4 bg-black/40 box-glow-purple">
      <h3 className="text-lg font-heading text-outlaw-gold tracking-wider mb-3">
        TARGET WORDS
      </h3>

      <div className="text-white/60 text-xs mb-3">
        {foundWords.length}/{totalTargetWords}
      </div>

      <div className="space-y-2">
        {visibleWords.length > 0 ? (
          visibleWords.map((word, idx) => (
            <div key={`${word}-${idx}`} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              <span className="text-emerald-400 font-heading tracking-widest">
                ○ {word.toUpperCase()}
              </span>
            </div>
          ))
        ) : (
          <div className="text-white/50 text-sm">
            No target words loaded.
          </div>
        )}
      </div>
    </div>
  );
}