import React from 'react';
import { Pencil, Eraser } from 'lucide-react';

export default function SudokuNumpad({ onNumber, onErase, notesMode, onToggleNotes, puzzle, userGrid }) {
  // Count how many of each number are placed (givens + user entries)
  const counts = Array(10).fill(0);
  if (puzzle && userGrid) {
    for (let i = 0; i < 81; i++) {
      const v = puzzle[i] || userGrid[i];
      if (v > 0) counts[v]++;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Notes toggle */}
      <button
        onClick={onToggleNotes}
        className="flex items-center justify-center gap-2 py-2 rounded-xl border-2 transition-all"
        style={{
          borderColor: notesMode ? '#BC13FE' : 'rgba(188,19,254,0.3)',
          background: notesMode ? 'rgba(188,19,254,0.2)' : 'transparent',
          color: notesMode ? '#BC13FE' : 'rgba(255,255,255,0.5)',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 9,
        }}
      >
        <Pencil className="w-3 h-3" />
        NOTES {notesMode ? 'ON' : 'OFF'}
      </button>

      {/* Number grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => {
          const complete = counts[n] >= 9;
          return (
            <button
              key={n}
              onClick={() => !complete && onNumber(n)}
              disabled={complete}
              className="flex flex-col items-center justify-center rounded-xl border-2 transition-all hover:scale-105 active:scale-95"
              style={{
                aspectRatio: '1',
                background: complete ? 'rgba(255,255,255,0.03)' : 'rgba(188,19,254,0.08)',
                borderColor: complete ? 'rgba(255,255,255,0.1)' : 'rgba(188,19,254,0.4)',
                color: complete ? 'rgba(255,255,255,0.2)' : 'white',
                cursor: complete ? 'not-allowed' : 'pointer',
              }}
            >
              <span style={{ fontFamily: "'Teko', sans-serif", fontSize: 'clamp(18px, 3vw, 28px)', lineHeight: 1 }}>{n}</span>
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: complete ? 'rgba(255,255,255,0.15)' : 'rgba(188,19,254,0.7)' }}>
                {9 - counts[n]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Erase */}
      <button
        onClick={onErase}
        className="flex items-center justify-center gap-2 py-2 rounded-xl border-2 transition-all hover:scale-105 active:scale-95"
        style={{
          borderColor: 'rgba(255,95,31,0.4)',
          background: 'rgba(255,95,31,0.08)',
          color: 'rgba(255,95,31,0.8)',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 9,
        }}
      >
        <Eraser className="w-3 h-3" />
        ERASE
      </button>
    </div>
  );
}