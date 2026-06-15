import React, { useState } from 'react';
import { getPeers, hasConflict } from '@/lib/sudokuEngine';

const DIFF_COLORS = {
  easy: '#4ade80',
  medium: '#FFD700',
  hard: '#FF5F1F',
  expert: '#BC13FE',
};

export default function SudokuBoard({
  puzzle,
  solution,
  userGrid,
  notes,
  selectedCell,
  onSelectCell,
  notesMode,
  eliminated,
  completed,
}) {
  if (!puzzle || !userGrid) return null;

  const peers = selectedCell !== null ? getPeers(selectedCell) : new Set();
  const selectedNum = selectedCell !== null ? (userGrid[selectedCell] || puzzle[selectedCell]) : null;
  const selectedRow = selectedCell !== null ? Math.floor(selectedCell / 9) : -1;
  const selectedCol = selectedCell !== null ? selectedCell % 9 : -1;
  const selectedBox = selectedCell !== null
    ? Math.floor(selectedRow / 3) * 3 + Math.floor(selectedCol / 3)
    : -1;

  const getCellBox = (idx) => {
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    return Math.floor(r / 3) * 3 + Math.floor(c / 3);
  };

  return (
    <div
      className="select-none relative"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(9, 1fr)',
        border: '3px solid rgba(188,19,254,0.8)',
        borderRadius: 8,
        boxShadow: '0 0 30px rgba(188,19,254,0.3)',
        opacity: eliminated ? 0.5 : 1,
      }}
    >
      {userGrid.map((val, idx) => {
        const isGiven = puzzle[idx] !== 0;
        const displayVal = isGiven ? puzzle[idx] : val;
        const isSelected = selectedCell === idx;
        const isPeer = peers.has(idx);
        const cellRow = Math.floor(idx / 9);
        const cellCol = idx % 9;
        const cellBox = getCellBox(idx);
        const isSameNum = selectedNum && displayVal === selectedNum && displayVal !== 0;
        const isSameRowCol = cellRow === selectedRow || cellCol === selectedCol || cellBox === selectedBox;

        // Conflict detection
        const isConflict = !isGiven && val !== 0 && solution && val !== solution[idx];
        const cellNotes = notes?.[idx] || [];

        // Border styling for 3x3 boxes
        const borderRight = (cellCol + 1) % 3 === 0 && cellCol !== 8
          ? '2px solid rgba(188,19,254,0.7)'
          : '1px solid rgba(188,19,254,0.2)';
        const borderBottom = (cellRow + 1) % 3 === 0 && cellRow !== 8
          ? '2px solid rgba(188,19,254,0.7)'
          : '1px solid rgba(188,19,254,0.2)';

        let bg = 'rgba(5,3,11,0.8)';
        if (isSelected) bg = 'rgba(188,19,254,0.35)';
        else if (isSameNum) bg = 'rgba(188,19,254,0.2)';
        else if (isSameRowCol) bg = 'rgba(188,19,254,0.08)';
        else if (isPeer) bg = 'rgba(188,19,254,0.05)';

        return (
          <div
            key={idx}
            onClick={() => !eliminated && !completed && onSelectCell(idx)}
            style={{
              width: '100%',
              aspectRatio: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: bg,
              borderRight,
              borderBottom,
              cursor: eliminated || completed ? 'default' : 'pointer',
              position: 'relative',
              transition: 'background 0.1s',
            }}
          >
            {displayVal !== 0 ? (
              <span
                style={{
                  fontSize: 'clamp(12px, 2.5vw, 22px)',
                  fontWeight: isGiven ? 700 : 500,
                  fontFamily: "'Teko', sans-serif",
                  color: isConflict
                    ? '#ef4444'
                    : isGiven
                    ? 'rgba(255,255,255,0.95)'
                    : '#FFD700',
                  textShadow: isGiven
                    ? 'none'
                    : isConflict
                    ? '0 0 8px #ef4444'
                    : '0 0 8px rgba(255,215,0,0.6)',
                  lineHeight: 1,
                }}
              >
                {displayVal}
              </span>
            ) : cellNotes.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  width: '90%',
                  height: '90%',
                  gap: 0,
                }}
              >
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <span
                    key={n}
                    style={{
                      fontSize: 'clamp(5px, 0.9vw, 8px)',
                      color: cellNotes.includes(n) ? 'rgba(188,19,254,0.9)' : 'transparent',
                      textAlign: 'center',
                      lineHeight: 1.2,
                      fontFamily: "'Press Start 2P', monospace",
                    }}
                  >
                    {n}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Conflict flash */}
            {isConflict && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(239,68,68,0.15)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}