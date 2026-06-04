import { useState, useEffect, useRef } from 'react';

/**
 * Universal Player Seat Hook
 * - Persists a unique playerId per room in localStorage
 * - Assigns seat from game_state.players on first visit, restores on refresh
 * - Works across ALL games (bff, hangman, square-biz, etc.)
 * - Pass isHost=true to skip seating (host is never assigned a seat)
 */
export function usePlayerSeat(room, roomCode, gameId, updateState, isHost = false, chosenRole = null) {
  // One stable playerId per room, persisted in localStorage
  const [playerId] = useState(() => {
    const key = `tn_pid_${roomCode}`;
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'p_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  });

  // Restore seat number instantly from localStorage to avoid flash
  const [seatNumber, setSeatNumber] = useState(() => {
    const cached = localStorage.getItem(`tn_seat_${roomCode}_${playerId}`);
    return cached ? Number(cached) : null;
  });
  const [isSeated, setIsSeated] = useState(() => {
    return !!localStorage.getItem(`tn_seat_${roomCode}_${playerId}`);
  });

  const registeredRef = useRef(false);

  useEffect(() => {
    if (isHost || !room || !updateState) return;

    const gs = room.game_state || {};
    const players = gs.players || [];

    // Already registered in server state — sync locally and stop
    const existing = players.find(p => p.playerId === playerId);
    if (existing) {
      setSeatNumber(existing.seatNumber);
      setIsSeated(true);
      localStorage.setItem(`tn_seat_${roomCode}_${playerId}`, String(existing.seatNumber));
      registeredRef.current = true;
      return;
    }

    // Already registered locally, waiting for server echo (optimistic)
    if (registeredRef.current) return;
    registeredRef.current = true;

    // Assign next available seat number
    const usedSeats = new Set(players.map(p => p.seatNumber));
    let nextSeat = 1;
    while (usedSeats.has(nextSeat)) nextSeat++;

    // Optimistically update local state immediately
    setSeatNumber(nextSeat);
    setIsSeated(true);
    localStorage.setItem(`tn_seat_${roomCode}_${playerId}`, String(nextSeat));

    const newPlayer = {
      playerId,
      seatNumber: nextSeat,
      role: chosenRole || 'pending',
      connected: true,
      joinedAt: Date.now(),
      lastActionAt: null,
    };

    updateState({ players: [...players, newPlayer] }).catch(() => {
      // Allow retry on next room update
      registeredRef.current = false;
    });
  }, [room, playerId, updateState, isHost, roomCode, chosenRole]);

  return { playerId, seatNumber, isSeated };
}