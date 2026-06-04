import { useState, useEffect, useRef } from 'react';

/**
 * Universal Player Seat Hook
 * - Persists playerId per room in localStorage
 * - Assigns and restores seat number from game_state.players
 * - Only runs for non-host viewers; pass isHost=true to skip seating
 */
export function usePlayerSeat(room, roomCode, gameId, updateState, isHost = false) {
  // Stable playerId per room — persisted in localStorage
  const [playerId] = useState(() => {
    const key = `tn_pid_${roomCode}`;
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  });

  const [seatNumber, setSeatNumber] = useState(() => {
    // Try to restore seat from localStorage immediately (avoids flash)
    const cached = localStorage.getItem(`tn_seat_${roomCode}_${playerId}`);
    return cached ? Number(cached) : null;
  });
  const [isSeated, setIsSeated] = useState(false);
  const registrationAttemptedRef = useRef(false);

  useEffect(() => {
    if (isHost || !room || !updateState) return;

    const gs = room.game_state || {};
    const players = gs.players || [];

    // Check if already registered in current room state
    const existing = players.find(p => p.playerId === playerId);
    if (existing) {
      const seat = existing.seatNumber;
      setSeatNumber(seat);
      setIsSeated(true);
      localStorage.setItem(`tn_seat_${roomCode}_${playerId}`, String(seat));
      registrationAttemptedRef.current = true;
      return;
    }

    // Don't double-register
    if (registrationAttemptedRef.current) return;
    registrationAttemptedRef.current = true;

    // Assign next available seat
    const usedSeats = new Set(players.map(p => p.seatNumber));
    let nextSeat = 1;
    while (usedSeats.has(nextSeat)) nextSeat++;

    const newPlayer = {
      playerId,
      seatNumber: nextSeat,
      role: 'player',
      connected: true,
      joinedAt: Date.now(),
      lastActionAt: null,
    };

    // Optimistically set seat locally
    setSeatNumber(nextSeat);
    setIsSeated(true);
    localStorage.setItem(`tn_seat_${roomCode}_${playerId}`, String(nextSeat));

    updateState({ players: [...players, newPlayer] }).catch(() => {
      // If it fails, reset so next room poll can retry
      registrationAttemptedRef.current = false;
    });
  }, [room, playerId, updateState, isHost, roomCode]);

  return { playerId, seatNumber, isSeated };
}