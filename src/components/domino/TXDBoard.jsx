import React, { useRef, useEffect } from 'react';
import TXDDomino from './TXDDomino';

const TILE_W = 36;

export default function TXDBoard({ board = [], leftEnd, rightEnd }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    }
  }, [board.length]);

  if (board.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[110px] text-white/20 font-body text-xs tracking-widest italic">
        — no tiles played yet —
      </div>
    );
  }

  // Find spinner (first domino, always index 0 which is the 6-6)
  const spinnerIndex = board.findIndex(d => d.isSpinner);
  const hasSpinner = spinnerIndex >= 0;

  // Split board into: left chain (before spinner, reversed), spinner, right chain (after spinner)
  let leftChain = [];
  let spinner = null;
  let rightChain = [];

  if (hasSpinner) {
    spinner = board[spinnerIndex];
    leftChain = board.slice(0, spinnerIndex).reverse(); // tiles played to left
    rightChain = board.slice(spinnerIndex + 1);          // tiles played to right
  } else {
    // No spinner yet — render as flat chain
    rightChain = board;
  }

  return (
    <div
      ref={scrollRef}
      className="flex items-center justify-center gap-0.5 overflow-x-auto py-3 px-4 min-h-[110px] w-full"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#BC13FE40 transparent' }}
    >
      {/* Left chain (played toward left end) */}
      {leftChain.map((d, i) => {
        const isDouble = d.top === d.bottom;
        return (
          <div key={`left-${i}`} className="flex-shrink-0">
            <TXDDomino
              top={d.top}
              bottom={d.bottom}
              width={TILE_W}
              orientation={isDouble ? 'vertical' : 'horizontal'}
            />
          </div>
        );
      })}

      {/* Spinner — centered, glowing */}
      {spinner && (
        <div
          className="flex-shrink-0 mx-1"
          style={{
            filter: 'drop-shadow(0 0 12px rgba(0,255,120,0.95)) drop-shadow(0 0 18px rgba(255,95,31,0.75))',
          }}
        >
          <TXDDomino
            top={spinner.top}
            bottom={spinner.bottom}
            width={TILE_W + 6}
            orientation="vertical"
          />
        </div>
      )}

      {/* Right chain (played toward right end) */}
      {rightChain.map((d, i) => {
        const isDouble = d.top === d.bottom;
        const isFirst = !hasSpinner && i === 0;
        return (
          <div key={`right-${i}`} className="flex-shrink-0">
            <TXDDomino
              top={d.top}
              bottom={d.bottom}
              width={TILE_W}
              orientation={isDouble ? 'vertical' : 'horizontal'}
              style={isFirst ? { filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.9))' } : {}}
            />
          </div>
        );
      })}

      {/* End indicators */}
      {board.length > 0 && leftEnd !== null && rightEnd !== null && (
        <div className="flex-shrink-0 ml-2 flex flex-col gap-0.5 items-center">
          <span className="text-emerald-400/70 text-[8px] font-mono font-bold">{rightEnd}</span>
        </div>
      )}
    </div>
  );
}