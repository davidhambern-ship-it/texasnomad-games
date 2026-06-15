import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const SPECIAL_TILES = [
  { name: 'Gold Bean', icon: '🫘', bonus: '+50' },
  { name: 'Diamond', icon: '💎', bonus: '+100' },
  { name: 'Dexter', icon: '🤠', bonus: '+75' },
  { name: 'Microphone', icon: '🎤', bonus: '2x' },
  { name: 'Outlaw', icon: '💀', bonus: '+150' },
];

export default function WordList({ 
  wordsFound,
  currentScore,
  lastWordScore,
  outlawDanger
}) {
  return (
    <div className="space-y-3">
      {/* Score Display */}
      <div className="bg-midnight-void/80 border border-outlaw-gold/40 rounded-lg p-4 box-glow-gold">
        <div 
          className="text-[7px] md:text-[8px] text-white/50 uppercase tracking-widest mb-1 text-center"
          style={PS2}
        >
          CURRENT SCORE
        </div>
        <div 
          className="text-3xl md:text-4xl font-heading text-outlaw-gold text-center tracking-wider"
          style={{ textShadow: '0 0 20px #FFD700' }}
        >
          {currentScore.toLocaleString()}
        </div>
        
        {/* Last Word Score Popup */}
        {lastWordScore && (
          <div className="mt-2 text-center animate-pulse">
            <div className="text-lg font-heading text-outlaw-gold" style={{ textShadow: '0 0 15px #FFD700' }}>
              +{lastWordScore.score.toLocaleString()}
            </div>
            <div className="text-[8px] text-white/60 uppercase tracking-widest" style={PS2}>
              {lastWordScore.word.toUpperCase()}
            </div>
          </div>
        )}
      </div>

      {/* Outlaw Warning */}
      {outlawDanger && (
        <div className="bg-red-900/30 border-2 border-red-500 rounded-lg p-3 animate-pulse">
          <div className="text-center">
            <span className="text-2xl">🚨</span>
            <div 
              className="text-[7px] md:text-[8px] text-red-400 uppercase tracking-widest mt-1"
              style={PS2}
            >
              OUTLAW DANGER!
            </div>
          </div>
        </div>
      )}

      {/* Words Found List */}
      <div className="bg-midnight-void/80 border border-cyber-purple/40 rounded-lg p-3 max-h-48 overflow-y-auto">
        <h4 
          className="text-[7px] md:text-[8px] text-white/60 uppercase tracking-widest mb-2 text-center"
          style={PS2}
        >
          WORDS FOUND ({wordsFound.length})
        </h4>
        
        {wordsFound.length === 0 ? (
          <div className="text-[6px] md:text-[7px] text-white/30 text-center italic" style={PS2}>
            No words yet!
          </div>
        ) : (
          <div className="space-y-1">
            {wordsFound.slice(-10).map((word, index) => (
              <div 
                key={index}
                className="flex items-center justify-between text-[7px] md:text-[8px] text-white/60 uppercase tracking-wider p-1.5 rounded bg-white/5"
                style={PS2}
              >
                <span>{word}</span>
                <span className="text-outlaw-gold">✓</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Special Tiles Legend */}
      <div className="bg-midnight-void/80 border border-cyber-purple/40 rounded-lg p-3">
        <h4 
          className="text-[7px] md:text-[8px] text-white/60 uppercase tracking-widest mb-2 text-center"
          style={PS2}
        >
          SPECIAL TILES
        </h4>
        <div className="space-y-1.5">
          {SPECIAL_TILES.map(tile => (
            <div key={tile.name} className="flex items-center justify-between text-[6px] md:text-[7px] text-white/50" style={PS2}>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">{tile.icon}</span>
                <span>{tile.name}</span>
              </div>
              <span className="text-outlaw-gold">{tile.bonus}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}