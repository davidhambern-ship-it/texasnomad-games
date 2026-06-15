import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const HEADING = { fontFamily: "'Teko', sans-serif" };

export default function WordList({ wordsFound, lastWordScore, specialEvents }) {
  return (
    <div className="bg-midnight-void/80 border border-cyber-purple/40 rounded-lg p-4 box-glow-purple">
      <h3 
        className="text-base md:text-lg tracking-[0.1em] text-outlaw-gold uppercase mb-3 text-center"
        style={PS2}
      >
        WORDS FOUND
      </h3>
      
      {/* Last Word Score Popup */}
      {lastWordScore && (
        <div className="mb-3 p-3 rounded-lg bg-outlaw-gold/10 border border-outlaw-gold/40 text-center box-glow-gold">
          <div 
            className="text-xs md:text-sm text-outlaw-gold uppercase mb-1"
            style={PS2}
          >
            LAST WORD
          </div>
          <div className="flex items-center justify-center gap-2">
            <span 
              className="text-lg md:text-xl font-bold text-white"
              style={HEADING}
            >
              {lastWordScore.word}
            </span>
            <span 
              className="text-lg md:text-xl font-bold text-outlaw-gold"
              style={HEADING}
            >
              +{lastWordScore.points}
            </span>
          </div>
          {lastWordScore.bonus > 0 && (
            <div className="text-[6px] md:text-[7px] text-kinetic-orange uppercase mt-1" style={PS2}>
              🎉 BONUS: +{lastWordScore.bonus}
            </div>
          )}
        </div>
      )}
      
      {/* Special Events */}
      {specialEvents && specialEvents.length > 0 && (
        <div className="mb-3 space-y-1">
          {specialEvents.slice(-3).map((event, i) => (
            <div 
              key={i}
              className="text-[6px] md:text-[7px] text-white/60 uppercase tracking-wider p-1 rounded bg-white/5"
              style={PS2}
            >
              {event.icon} {event.message}
            </div>
          ))}
        </div>
      )}
      
      {/* Word List */}
      <div className="max-h-48 overflow-y-auto space-y-1">
        {wordsFound.length === 0 ? (
          <div 
            className="text-[6px] md:text-[7px] text-white/20 uppercase tracking-widest text-center py-4"
            style={PS2}
          >
            NO WORDS YET
          </div>
        ) : (
          wordsFound.map((word, index) => (
            <div 
              key={index}
              className="flex items-center justify-between text-[7px] md:text-[8px] text-white/60 uppercase tracking-wider p-1.5 rounded bg-white/5"
              style={PS2}
            >
              <span>{word}</span>
              <span className="text-outlaw-gold">✓</span>
            </div>
          ))
        )}
      </div>
      
      <div className="mt-3 pt-3 border-t border-cyber-purple/30 text-center">
        <div 
          className="text-[6px] md:text-[7px] text-white/40 uppercase tracking-widest"
          style={PS2}
        >
          TOTAL: {wordsFound.length} WORDS
        </div>
      </div>
    </div>
  );
}