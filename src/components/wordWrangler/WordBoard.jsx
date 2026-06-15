import React, { useState, useCallback, useRef } from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const SPECIAL_TILES = {
  'gold-bean': { icon: '🫘', bg: 'bg-gradient-to-br from-yellow-600 to-yellow-400', border: 'border-yellow-300', glow: 'shadow-[0_0_15px_rgba(255,215,0,0.6)]', bonus: 50 },
  'diamond': { icon: '💎', bg: 'bg-gradient-to-br from-blue-600 to-cyan-400', border: 'border-cyan-300', glow: 'shadow-[0_0_15px_rgba(0,255,255,0.6)]', bonus: 100 },
  'dexter': { icon: '🤠', bg: 'bg-gradient-to-br from-red-600 to-orange-500', border: 'border-orange-400', glow: 'shadow-[0_0_15px_rgba(255,100,0,0.6)]', steal: 25 },
  'frog': { icon: '🐸', bg: 'bg-gradient-to-br from-green-600 to-emerald-400', border: 'border-emerald-400', glow: 'shadow-[0_0_15px_rgba(0,255,100,0.6)]', event: true },
  'microphone': { icon: '🎤', bg: 'bg-gradient-to-br from-pink-600 to-purple-500', border: 'border-purple-400', glow: 'shadow-[0_0_15px_rgba(255,0,255,0.6)]', double: true },
  'texas-flag': { icon: '🤠', bg: 'bg-gradient-to-br from-blue-700 to-blue-500', border: 'border-blue-300', glow: 'shadow-[0_0_15px_rgba(0,100,255,0.6)]', team: true },
};

export default function WordBoard({ 
  board, 
  boardSize, 
  selectedCells, 
  onCellSelect, 
  disabled = false 
}) {
  const [isTouching, setIsTouching] = useState(false);
  const touchStartRef = useRef(null);

  const isSelected = useCallback((row, col) => {
    return selectedCells.some(c => c.row === row && c.col === col);
  }, [selectedCells]);

  const handleMouseDown = useCallback((row, col) => {
    if (disabled) return;
    onCellSelect(row, col);
  }, [disabled, onCellSelect]);

  const handleMouseEnter = useCallback((row, col) => {
    if (disabled || !isTouching) return;
    onCellSelect(row, col);
  }, [disabled, isTouching, onCellSelect]);

  const handleTouchStart = useCallback((row, col, e) => {
    if (disabled) return;
    e.preventDefault();
    setIsTouching(true);
    touchStartRef.current = { row, col };
    const selected = isSelected(row, col);
    if (!selected) {
      onCellSelect(row, col);
    }
  }, [disabled, isSelected, onCellSelect]);

  const handleTouchMove = useCallback((e) => {
    if (disabled || !isTouching) return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element) {
      const row = parseInt(element.dataset.row);
      const col = parseInt(element.dataset.col);
      if (!isNaN(row) && !isNaN(col)) {
        const selected = isSelected(row, col);
        if (!selected && touchStartRef.current) {
          const lastSelected = selectedCells[selectedCells.length - 1];
          if (!lastSelected || (lastSelected.row === row && lastSelected.col === col)) {
            return;
          }
          onCellSelect(row, col);
        }
      }
    }
  }, [disabled, isTouching, isSelected, selectedCells, onCellSelect]);

  const handleTouchEnd = useCallback(() => {
    setIsTouching(false);
    touchStartRef.current = null;
  }, []);

  return (
    <div 
      className="relative"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className="grid gap-1 md:gap-1.5 mx-auto"
        style={{ 
          gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
          maxWidth: boardSize <= 6 ? '280px' : boardSize <= 8 ? '360px' : '420px',
        }}
      >
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const selected = isSelected(rowIndex, colIndex);
            const specialTile = cell.specialType ? SPECIAL_TILES[cell.specialType] : null;
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                data-row={rowIndex}
                data-col={colIndex}
                onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                onTouchStart={(e) => handleTouchStart(rowIndex, colIndex, e)}
                className={`
                  aspect-square rounded-lg md:rounded-xl flex items-center justify-center
                  text-lg md:text-2xl font-bold cursor-pointer select-none
                  transition-all duration-150
                  ${selected 
                    ? 'bg-gradient-to-br from-outlaw-gold to-yellow-400 text-black scale-105 z-10' 
                    : specialTile 
                      ? `${specialTile.bg} ${specialTile.border} border-2 ${specialTile.glow} text-white`
                      : 'bg-gradient-to-br from-cyber-purple/80 to-cyber-purple/40 border border-cyber-purple/50 text-white hover:border-outlaw-gold/60'
                  }
                  ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:scale-105 active:scale-95'}
                `}
                style={{
                  boxShadow: selected ? '0 0 20px rgba(255, 215, 0, 0.8)' : undefined,
                  textShadow: selected ? 'none' : '0 0 5px rgba(255,255,255,0.5)',
                }}
              >
                {specialTile ? (
                  <div className="flex flex-col items-center">
                    <span className="text-sm md:text-base">{specialTile.icon}</span>
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