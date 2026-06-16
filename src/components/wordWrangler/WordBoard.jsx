import React, { useState, useCallback, useRef, useEffect } from 'react';

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
  onSelectionComplete,
  disabled = false,
  animatingCells = []
}) {
  const [isDragging, setIsDragging] = useState(false);
  const boardRef = useRef(null);

  const isSelected = useCallback((row, col) => {
    return selectedCells.some(c => c.row === row && c.col === col);
  }, [selectedCells]);

  const isAnimating = useCallback((row, col) => {
    return animatingCells.some(c => c.row === row && c.col === col);
  }, [animatingCells]);

  const handleMouseDown = useCallback((row, col, e) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    onCellSelect(row, col);
  }, [disabled, onCellSelect]);

  const handleMouseEnter = useCallback((row, col) => {
    if (disabled || !isDragging) return;
    onCellSelect(row, col);
  }, [disabled, isDragging, onCellSelect]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onSelectionComplete?.();
    }
  }, [isDragging, onSelectionComplete]);

  const handleTouchStart = useCallback((row, col, e) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
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
        const alreadySelected = selectedCells.some(c => c.row === row && c.col === col);
        if (!alreadySelected) {
          onCellSelect(row, col);
        }
      }
    }
  }, [disabled, isDragging, selectedCells, onCellSelect]);

  const handleTouchEnd = useCallback((e) => {
    if (isDragging) {
      setIsDragging(false);
      onSelectionComplete?.();
    }
  }, [isDragging, onSelectionComplete]);

  // Global mouse up handler
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        onSelectionComplete?.();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, onSelectionComplete]);

  return (
    <div 
      ref={boardRef}
      className="relative touch-none select-none"
      onMouseLeave={() => {
        if (isDragging) {
          setIsDragging(false);
          onSelectionComplete?.();
        }
      }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'none' }}
    >
      <div 
        className="grid gap-1.5 mx-auto"
        style={{ 
          gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
          maxWidth: boardSize <= 6 ? '280px' : boardSize <= 8 ? '360px' : '420px',
        }}
      >
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const selected = isSelected(rowIndex, colIndex);
            const animating = isAnimating(rowIndex, colIndex);
            const specialTile = cell.specialType ? SPECIAL_TILES[cell.specialType] : null;
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                data-row={rowIndex}
                data-col={colIndex}
                onMouseDown={(e) => handleMouseDown(rowIndex, colIndex, e)}
                onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                onTouchStart={(e) => handleTouchStart(rowIndex, colIndex, e)}
                className={`
                  aspect-square rounded-lg md:rounded-xl flex items-center justify-center
                  text-xl md:text-2xl font-bold cursor-pointer
                  transition-all duration-100
                  relative overflow-hidden
                  ${selected 
                    ? 'bg-gradient-to-br from-cyber-purple to-purple-700 border-2 border-purple-400 scale-105 z-10' 
                    : specialTile
                      ? `${specialTile.bg} ${specialTile.border} border-2 ${specialTile.glow}`
                      : 'bg-gradient-to-br from-orange-500 to-orange-600 border-2 border-orange-400/50'
                  }
                  ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:scale-105 active:scale-95'}
                  ${animating ? 'animate-pulse' : ''}
                `}
                style={{
                  boxShadow: selected 
                    ? '0 0 20px rgba(188, 19, 254, 0.8), inset 0 0 10px rgba(188, 19, 254, 0.3)' 
                    : '0 4px 6px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)',
                }}
              >
                {/* Shine effect */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div 
                    className={`absolute w-full h-full opacity-30 ${
                      selected ? 'bg-gradient-to-br from-purple-300/40 to-transparent' : 'bg-gradient-to-br from-white/30 to-transparent'
                    }`}
                    style={{
                      transform: 'translateX(-100%)',
                      animation: selected ? 'none' : 'shine 3s ease-in-out infinite',
                    }}
                  />
                </div>
                
                {/* Letter */}
                <span 
                  className={`drop-shadow-md relative z-10 ${
                    selected ? 'text-outlaw-gold' : 'text-emerald-300'
                  }`}
                  style={{
                    textShadow: selected 
                      ? '0 0 10px #FFD700, 0 0 20px #FFD700' 
                      : '0 0 5px rgba(16, 185, 129, 0.5)',
                    fontFamily: "'Teko', sans-serif",
                    fontWeight: '700',
                  }}
                >
                  {cell.letter}
                </span>
                
                {/* Special tile icon */}
                {specialTile && (
                  <span className="absolute top-0.5 right-0.5 text-[8px] z-20">
                    {specialTile.icon}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* CSS for shine animation */}
      <style>{`
        @keyframes shine {
          0% { transform: translateX(-100%) skewX(-15deg); }
          50%, 100% { transform: translateX(100%) skewX(-15deg); }
        }
      `}</style>
    </div>
  );
}