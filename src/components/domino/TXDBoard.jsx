import React, { useRef, useEffect } from 'react';
import TXDDomino from './TXDDomino';

const TILE_W = 32; // narrow dimension for board tiles

export default function TXDBoard({ board = [], leftEnd, rightEnd }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      el.scrollLeft = el.scrollWidth / 2 - el.clientWidth / 2;
    }
  }, [board.length]);

  if (board.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[120px] text-white/30 font-body text-xs tracking-widest">
        — waiting for first play —
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-1 overflow-x-auto py-3 px-4 min-h-[120px]"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#BC13FE30 transparent' }}
    >
      {board.map((d, i) => {
        const isDouble = d.top === d.bottom;
        const isEnd = i === 0 || i === board.length - 1;
        return (
          <div key={i} className="flex-shrink-0 flex items-center gap-1">
            <TXDDomino
              top={d.top}
              bottom={d.bottom}
              width={TILE_W}
              orientation={isDouble ? 'vertical' : 'horizontal'}
              style={isEnd ? { filter: 'drop-shadow(0 0 6px rgba(188,19,254,0.7))' } : {}}
            />
            {i < board.length - 1 && (
              <div className="w-px h-3 bg-white/10 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}