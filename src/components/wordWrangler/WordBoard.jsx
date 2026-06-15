import React, { useState, useCallback, useRef } from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const SPECIAL_TILES = {
  'gold-bean': { icon: '🫘', bg: 'bg-gradient-to-br from-yellow-600 to-yellow-400', border: 'border-yellow-300', glow: 'shadow-[0_0_15px_rgba(255,215,0,0.6)]', bonus: 50 },
  'diamond': { icon: '💎', bg: 'bg-gradient-to-br from-blue-600 to-cyan-400', border: 'border-cyan-300', glow: 'shadow-[0_0_15px_rgba(0,255,255,0.6)]', bonus: 100 },
  'dexter': { icon: '🤠', bg: 'bg-gradient-to-br from-red-600 to-orange-500', border: 'border-orange-400', glow: 'shadow-[0_0_15px_rgba(255,100,0,0.6)]', steal: 25 },
  'frog': { icon: '🐸', bg: 'bg-gradient-to-br from-green-600 to-emerald-400', border: 'border-emerald-400', glow: 'shadow-[0_0_15px_rgba(0,255,100,0.6)]', event: true },
  'microphone': { icon: '🎤', bg: 'bg-gradient-to-br from-pink-600 to-purple-500', border: 'border-purple-400', glow: 'shadow-[0_0_15px_rgba(255,0,255,0.6)]', double: true },
  'texas-flag': { icon: '🤠', bg: 'bg-gradient-to-br from-blue-700 to-blue-500', border: 'border-blue-300', glow: 'shadow-[0_0_15px_rgba(0,100,255,0.6)]', team: true },
  'outlaw': { icon: '💀', bg: 'bg-gradient-to-br from-red-900 to-red-700', border: 'border-red-500', glow: 'shadow-[0_0_15px_rgba(255,0,0,0.8)]', danger: true },
};

export default function WordBoard({ 
  board, 
  boardSize, 
  selectedCells, 
  onCellSelect, 
  disabled = false,
  animatingCells = []
}) {
  const [isDragging, setIsDragging] = useState(false);
  const touchStartRef = useRef(null);

  const isSelected = useCallback((row, col) => {
    return selectedCells.some(c => c.row === row && c.col === col);
  }, [selectedCells]);

  const isAnimating = useCallback((row, col) => {
    return animatingCells.some(c => c.row === row && c.col === col);
  }, [animatingCells]);

  const handleMouseDown = useCallback((row, col) => {
    if (disabled) return;
    setIsDragging(true);
    onCellSelect(row, col);
  }, [disabled, onCellSelect]);

  const handleMouseEnter = useCallback((row, col) => {
    if (disabled || !isDragging) return;
    onCellSelect(row, col);
  }, [disabled, isDragging, onCellSelect]);

  const handleTouchStart = useCallback((row, col, e) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    touchStartRef.current = { row, col };
    onCellSelect(row, col);
  }, [disabled, onCellSelect]);

  const handleTouchMove = useCallback((e) => {
    if (disabled || !isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element && element.dataset.row && element.dataset.col) {
      const row = parseInt(element.dataset.row);
      const col = parseInt(element.dataset.col);
      if (!isNaN(row) && !isNaN(col)) {
        const selected = isSelected(row, col);
        if (!selected) {
          onCellSelect(row, col);
        }
      }
    }
  }, [disabled, isDragging, isSelected, onCellSelect]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    touchStartRef.current = null;
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div 
      className="relative touch-none"
      onMouseLeave={handleTouchEnd}
      onMouseUp={handleMouseUp}
      onMouseDown={(e) => e.preventDefault()}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'none' }}
    >
      <div 
        className="grid gap-1 md:gap-1.5 mx-auto touch-none"
        style={{ 
          gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
          maxWidth: boardSize <= 6 ? '280px' : boardSize <= 8 ? '360px' : '420px',
          touchAction: 'none',
        }}
      >
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const selected = isSelected(rowIndex, colIndex);
            const animating = isAnimating(rowIndex, colIndex);
            const specialTile = cell.specialType ? SPECIAL_TILES[cell.specialType] : null;
            const isOutlaw = cell.isOutlaw ? SPECIAL_TILES.outlaw : null;
            const activeSpecial = specialTile || isOutlaw;
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                data-row={rowIndex}
                data-col={colIndex}
                onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                onTouchStart={(e) => handleTouchStart(rowIndex, colIndex, e)}
                className={`
                  aspect-square rounded-lg md:rounded-xl flex items-center justify-center
                  text-lg md:text-2xl font-bold cursor-pointer select-none
                  transition-all duration-150
                  ${selected 
                    ? 'bg-gradient-to-br from-outlaw-gold to-yellow-400 text-black scale-105 z-10' 
                    : activeSpecial
                      ? `${activeSpecial.bg} ${activeSpecial.border} border-2 ${activeSpecial.glow} text-white`
                      : 'bg-gradient-to-br from-cyber-purple/80 to-cyber-purple/40 border border-cyber-purple/50 text-white hover:border-outlaw-gold/60'
                  }
                  ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:scale-105 active:scale-95'}
                  ${animating ? 'animate-pulse' : ''}
                `}
                style={{
                  boxShadow: selected ? '0 0 20px rgba(255, 215, 0, 0.8)' : (isOutlaw ? '0 0 20px rgba(255, 0, 0, 0.8)' : undefined),
                  textShadow: selected ? 'none' : '0 0 5px rgba(255,255,255,0.5)',
                }}
              >
                {activeSpecial ? (
                  <div className="flex flex-col items-center">
                    <span className="text-sm md:text-base">{activeSpecial.icon}</span>
                    <span className="text-base md:text-xl font-bold">{cell.letter}</span>
                  </div>
                ) : (
                  <span className="drop-shadow-md">{cell.letter}</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}