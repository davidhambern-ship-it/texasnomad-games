import React, { useState, useCallback, useRef, useEffect } from 'react';

const SPECIAL_TILES = {
  'gold-bean': { icon: '🫘', bonus: 50 },
  diamond: { icon: '💎', bonus: 100 },
  dexter: { icon: '🤠', steal: 25 },
  frog: { icon: '🐸', event: true },
  microphone: { icon: '🎤', double: true },
  'texas-flag': { icon: '🏴', team: true },
};

export default function WordBoard({
  board,
  boardSize,
  selectedCells,
  onCellSelect,
  onSelectionComplete,
  disabled = false,
  animatingCells = [],
}) {
  const [isDragging, setIsDragging] = useState(false);
  const boardRef = useRef(null);

  const isSelected = useCallback(
    (row, col) => selectedCells.some(c => c.row === row && c.col === col),
    [selectedCells]
  );

  const isAnimating = useCallback(
    (row, col) => animatingCells.some(c => c.row === row && c.col === col),
    [animatingCells]
  );

  const startDrag = useCallback((row, col, e) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    onCellSelect(row, col);
  }, [disabled, onCellSelect]);

  const enterCell = useCallback((row, col) => {
    if (disabled || !isDragging) return;
    onCellSelect(row, col);
  }, [disabled, isDragging, onCellSelect]);

  const endDrag = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    onSelectionComplete?.();
  }, [isDragging, onSelectionComplete]);

  const handleTouchMove = useCallback((e) => {
    if (disabled || !isDragging) return;
    e.preventDefault();

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const tile = element?.closest?.('[data-row][data-col]');

    if (!tile) return;

    const row = Number(tile.dataset.row);
    const col = Number(tile.dataset.col);

    if (!Number.isNaN(row) && !Number.isNaN(col)) {
      onCellSelect(row, col);
    }
  }, [disabled, isDragging, onCellSelect]);

  useEffect(() => {
    document.addEventListener('mouseup', endDrag);
    return () => document.removeEventListener('mouseup', endDrag);
  }, [endDrag]);

  return (
    <div className="ww-rope-frame">
      <div
        ref={boardRef}
        className="ww-board-grid"
        onMouseLeave={endDrag}
        onTouchMove={handleTouchMove}
        onTouchEnd={endDrag}
        style={{
          gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
          touchAction: 'none',
        }}
      >
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const selected = isSelected(rowIndex, colIndex);
            const animating = isAnimating(rowIndex, colIndex);
            const specialTile = cell.specialType ? SPECIAL_TILES[cell.specialType] : null;

            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                data-row={rowIndex}
                data-col={colIndex}
                type="button"
                disabled={disabled}
                onMouseDown={(e) => startDrag(rowIndex, colIndex, e)}
                onMouseEnter={() => enterCell(rowIndex, colIndex)}
                onTouchStart={(e) => startDrag(rowIndex, colIndex, e)}
                className={[
                  'ww-letter-tile',
                  selected ? 'ww-selected' : '',
                  animating ? 'ww-animating' : '',
                  specialTile ? 'ww-special' : '',
                ].join(' ')}
              >
                <span className="ww-letter">{cell.letter}</span>
                {specialTile && <span className="ww-special-icon">{specialTile.icon}</span>}
              </button>
            );
          })
        )}
      </div>

      <style>{`
        .ww-rope-frame {
          position: relative;
          padding: clamp(18px, 3vw, 32px);
          border-radius: 34px;
          background:
            radial-gradient(circle at 50% 50%, rgba(255,122,0,.18), transparent 68%),
            linear-gradient(135deg, rgba(20, 8, 35, .95), rgba(5, 2, 15, .98));
          box-shadow:
            0 0 30px rgba(255, 122, 0, .35),
            0 0 60px rgba(188, 19, 254, .28);
          isolation: isolate;
        }

        .ww-rope-frame::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 34px;
          padding: 14px;
          background:
            repeating-linear-gradient(
              45deg,
              #5a3518 0px,
              #c58a3a 8px,
              #f4cf7a 14px,
              #8a541f 22px,
              #3b220f 30px
            );
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          box-shadow:
            inset 0 0 14px rgba(0,0,0,.75),
            0 0 20px rgba(255, 190, 72, .55);
          z-index: -1;
        }

        .ww-rope-frame::after {
          content: "";
          position: absolute;
          inset: -8px;
          border-radius: 42px;
          pointer-events: none;
          background:
            radial-gradient(circle at 15% 0%, rgba(255, 210, 40, .9), transparent 10%),
            radial-gradient(circle at 45% 100%, rgba(255, 80, 0, .8), transparent 12%),
            radial-gradient(circle at 88% 12%, rgba(255, 170, 0, .85), transparent 10%),
            radial-gradient(circle at 10% 78%, rgba(255, 40, 0, .75), transparent 11%),
            radial-gradient(circle at 72% 92%, rgba(188, 19, 254, .45), transparent 12%);
          filter: blur(8px);
          opacity: .9;
          animation: wwFireFlicker .8s infinite alternate;
          z-index: -2;
        }

        .ww-board-grid {
          display: grid;
          gap: clamp(5px, 1vw, 9px);
          position: relative;
          z-index: 1;
        }

        .ww-letter-tile {
          aspect-ratio: 1 / 1;
          border-radius: 14px;
          border: 2px solid rgba(255, 170, 60, .8);
          background:
            linear-gradient(135deg, #ff9f1c, #ff6b00 50%, #b54800);
          color: #00ff99;
          font-weight: 900;
          font-size: clamp(1rem, 3vw, 1.65rem);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          cursor: pointer;
          box-shadow:
            inset 0 2px 4px rgba(255,255,255,.35),
            inset 0 -5px 10px rgba(0,0,0,.35),
            0 6px 10px rgba(0,0,0,.4);
          transition: transform .1s ease, box-shadow .1s ease, background .1s ease;
        }

        .ww-letter-tile::before {
          content: "";
          position: absolute;
          inset: -40%;
          background: linear-gradient(120deg, transparent 35%, rgba(255,255,255,.55), transparent 65%);
          transform: translateX(-70%) rotate(20deg);
          animation: wwGemShine 2.8s infinite;
        }

        .ww-letter-tile:hover {
          transform: scale(1.05);
        }

        .ww-selected {
          background: linear-gradient(135deg, #bc13fe, #6d1bb3);
          border-color: #ffd700;
          color: #ffd700;
          transform: scale(1.07);
          box-shadow:
            0 0 22px rgba(188, 19, 254, .95),
            0 0 16px rgba(255, 215, 0, .7),
            inset 0 0 14px rgba(255,255,255,.25);
          z-index: 3;
        }

        .ww-animating {
          animation: wwTilePop .45s ease forwards;
        }

        .ww-special-icon {
          position: absolute;
          right: 3px;
          bottom: 1px;
          font-size: .65em;
          filter: drop-shadow(0 0 4px rgba(255,255,255,.7));
        }

        @keyframes wwGemShine {
          0%, 45% { transform: translateX(-80%) rotate(20deg); }
          65%, 100% { transform: translateX(90%) rotate(20deg); }
        }

        @keyframes wwTilePop {
          0% { transform: scale(1); opacity: 1; }
          60% { transform: scale(1.22); opacity: .9; }
          100% { transform: scale(.15); opacity: 0; }
        }

        @keyframes wwFireFlicker {
          from { opacity: .55; transform: scale(.995); }
          to { opacity: 1; transform: scale(1.015); }
        }
      `}</style>
    </div>
  );
}