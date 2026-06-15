import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const HEADING = { fontFamily: "'Teko', sans-serif" };

export default function PlayerPanel({ players, currentPlayerId, gameMode }) {
  return (
    <div className="bg-midnight-void/80 border border-cyber-purple/40 rounded-lg p-4 box-glow-purple">
      <h3 
        className="text-base md:text-lg tracking-[0.1em] text-outlaw-gold uppercase mb-3 text-center"
        style={PS2}
      >
        {gameMode === 'team-battle' ? 'TEAMS' : 'PLAYERS'}
      </h3>
      
      <div className="space-y-2">
        {players.map((player, index) => {
          const isCurrentPlayer = player.playerId === currentPlayerId;
          const isAI = player.isAI;
          
          return (
            <div
              key={player.playerId}
              className={`
                p-3 rounded-lg border-2 transition-all
                ${isCurrentPlayer 
                  ? 'border-outlaw-gold bg-outlaw-gold/10 box-glow-gold' 
                  : 'border-cyber-purple/30 bg-cyber-purple/5'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span 
                    className="text-xs md:text-sm font-bold text-white"
                    style={PS2}
                  >
                    {isAI ? '🤖' : '👤'} {player.playerName}
                  </span>
                  {isCurrentPlayer && (
                    <span className="text-[8px] text-outlaw-gold px-2 py-0.5 rounded bg-outlaw-gold/20 border border-outlaw-gold/40" style={PS2}>
                      YOUR TURN
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div 
                    className="text-lg md:text-xl font-bold text-outlaw-gold"
                    style={HEADING}
                  >
                    {player.score}
                  </div>
                  <div 
                    className="text-[6px] md:text-[7px] text-white/40 uppercase tracking-widest"
                    style={PS2}
                  >
                    PTS
                  </div>
                </div>
              </div>
              
              {player.wordsFound && player.wordsFound.length > 0 && (
                <div className="mt-2 text-[6px] md:text-[7px] text-white/30 uppercase tracking-wider" style={PS2}>
                  {player.wordsFound.length} words found
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}