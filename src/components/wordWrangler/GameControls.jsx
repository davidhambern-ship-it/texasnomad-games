import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const HEADING = { fontFamily: "'Teko', sans-serif" };

export default function GameControls({ 
  currentWord, 
  selectedCells, 
  onSubmitWord, 
  onClearSelection,
  onEndTurn,
  timeRemaining,
  gamePhase,
  canSubmit 
}) {
  const urgency = timeRemaining <= 10;
  
  return (
    <div className="bg-midnight-void/80 border border-cyber-purple/40 rounded-lg p-4 box-glow-purple">
      {/* Timer */}
      <div className="mb-4 text-center">
        <div 
          className={`text-3xl md:text-4xl font-bold mb-1 ${urgency ? 'text-kinetic-orange animate-pulse' : 'text-outlaw-gold'}`}
          style={HEADING}
        >
          {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
        </div>
        <div 
          className="text-[6px] md:text-[7px] text-white/40 uppercase tracking-widest"
          style={PS2}
        >
          TIME REMAINING
        </div>
      </div>
      
      {/* Current Word */}
      {currentWord && (
        <div className="mb-4 p-3 rounded-lg bg-cyber-purple/10 border border-cyber-purple/40 text-center">
          <div 
            className="text-xl md:text-2xl font-bold text-white mb-1"
            style={HEADING}
          >
            {currentWord}
          </div>
          <div 
            className="text-[6px] md:text-[7px] text-white/40 uppercase tracking-widest"
            style={PS2}
          >
            {currentWord.length} LETTERS
          </div>
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="space-y-2">
        <button
          onClick={onSubmitWord}
          disabled={!canSubmit || gamePhase !== 'playing'}
          className="w-full py-3 rounded-lg font-heading text-sm tracking-[0.15em] uppercase transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
            border: '2px solid #FFD700',
            color: '#000',
            textShadow: 'none',
          }}
        >
          ✅ SUBMIT WORD
        </button>
        
        <button
          onClick={onClearSelection}
          disabled={selectedCells.length === 0 || gamePhase !== 'playing'}
          className="w-full py-2.5 rounded-lg font-heading text-xs tracking-[0.1em] uppercase transition-all duration-200 active:scale-95 disabled:opacity-30"
          style={{
            background: 'transparent',
            border: '1px solid #BC13FE',
            color: '#BC13FE',
          }}
        >
          🗑 CLEAR
        </button>
        
        {onEndTurn && (
          <button
            onClick={onEndTurn}
            disabled={gamePhase !== 'playing'}
            className="w-full py-2.5 rounded-lg font-heading text-xs tracking-[0.1em] uppercase transition-all duration-200 active:scale-95 disabled:opacity-30"
            style={{
              background: 'transparent',
              border: '1px solid #FF5F1F',
              color: '#FF5F1F',
            }}
          >
          ⏭ END TURN
          </button>
        )}
      </div>
      
      {/* Instructions */}
      <div className="mt-4 text-center">
        <div 
          className="text-[6px] md:text-[7px] text-white/30 uppercase tracking-widest"
          style={PS2}
        >
          SELECT 3+ ADJACENT LETTERS
        </div>
        <div 
          className="text-[6px] md:text-[7px] text-white/30 uppercase tracking-widest mt-1"
          style={PS2}
        >
          HORIZONTAL • VERTICAL • DIAGONAL
        </div>
      </div>
    </div>
  );
}