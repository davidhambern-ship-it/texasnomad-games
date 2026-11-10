import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import NeonBattleSudokuPlayer from '@/pages/NeonBattleSudokuPlayer';

// Battleship Sudoku now uses the shared TNG room creator and join flow.
// /games/sudoku?room=TNXXXX is the player cabinet; hosting starts at /room?game=sudoku.
export default function SudokuGame() {
  const [params] = useSearchParams();
  const roomCode = String(params.get('room') || '').trim().toUpperCase();
  if (/^TN[A-Z0-9]{4}$/.test(roomCode)) {
    return <NeonBattleSudokuPlayer roomCode={roomCode} />;
  }
  return <Navigate to="/room?game=sudoku" replace />;
}
