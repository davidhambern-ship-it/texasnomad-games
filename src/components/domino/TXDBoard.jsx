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

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-1 overflow-x-auto py-3 px-6 min-h-[110px]"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#BC13FE40 transparent' }}
    >
      {board.map((d, i) => {
        const isFirst = i === 0;
        const isLast = i === board.length - 1;
        const isDouble = d.top === d.bottom;
        const glowStyle = isFirst
          ? { filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.9))' }
          : isLast
          ? { filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.9))' }
          : {};
        return (
          <div key={i} className="flex-shrink-0 flex items-center gap-0.5">
            <TXDDomino
              top={d.top}
              bottom={d.bottom}
              width={TILE_W}
              orientation={isDouble ? 'vertical' : 'horizontal'}
              style={glowStyle}
            />
          </div>
        );
      })}
    </div>
  );
}