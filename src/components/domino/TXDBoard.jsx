import React, { useRef, useEffect } from 'react';
import TXDDomino from './TXDDomino';

const TILE_W = 36;

/**
 * TXDBoard renders the domino chain.
 *
 * Each board entry has:
 *   top, bottom   — already oriented by playDomino() so the matching pip faces inward
 *   side          — 'first' | 'left' | 'right'
 *   isSpinner     — true for the opening double
 *
 * Orientation rules (locked to branch direction, never to player seat):
 *   - Doubles (top === bottom) → vertical
 *   - Horizontal chain tiles   → horizontal; top = left pip, bottom = right pip
 *   - Left-branch tiles        → horizontal; rendered in reverse visual order (chain extends left)
 *   - Right-branch tiles       → horizontal; normal order
 *
 * The orientedTop/orientedBottom from the engine already place the connecting pip
 * touching the open end, so we just pass them straight through.
 */
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

  const spinnerIndex = board.findIndex(d => d.isSpinner);
  const hasSpinner = spinnerIndex >= 0;

  // Split into left chain (before spinner, played leftward), spinner, right chain (after spinner)
  let leftChain = [];
  let spinner = null;
  let rightChain = [];

  if (hasSpinner) {
    spinner = board[spinnerIndex];
    // Left chain: tiles played to the left — most-recently-played is closest to spinner
    leftChain = board.slice(0, spinnerIndex).reverse();
    rightChain = board.slice(spinnerIndex + 1);
  } else {
    rightChain = board;
  }

  const renderTile = (d, key, extraStyle = {}) => {
    const isDouble = d.top === d.bottom;
    // Doubles always vertical; non-doubles always horizontal (chain direction)
    const orientation = isDouble ? 'vertical' : 'horizontal';
    return (
      <div key={key} className="flex-shrink-0" style={extraStyle}>
        <TXDDomino
          top={d.top}
          bottom={d.bottom}
          width={TILE_W}
          orientation={orientation}
        />
      </div>
    );
  };

  return (
    <div
      ref={scrollRef}
      className="flex items-center justify-center gap-0.5 overflow-x-auto py-3 px-4 min-h-[110px] w-full"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#BC13FE40 transparent' }}
    >
      {/* Left chain — tiles grow leftward from spinner */}
      {leftChain.map((d, i) => renderTile(d, `left-${i}`))}

      {/* Spinner — always vertical, glowing */}
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

      {/* Right chain — tiles grow rightward */}
      {rightChain.map((d, i) => {
        const isFirst = !hasSpinner && i === 0;
        return renderTile(d, `right-${i}`, isFirst ? { filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.9))' } : {});
      })}

      {/* Open ends indicator */}
      {board.length > 0 && leftEnd !== null && rightEnd !== null && (
        <div className="flex-shrink-0 ml-2 flex flex-col gap-0.5 items-center">
          <span className="text-emerald-400/70 text-[8px] font-mono font-bold">{rightEnd}</span>
        </div>
      )}
    </div>
  );
}