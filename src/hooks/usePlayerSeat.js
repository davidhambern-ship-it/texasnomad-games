import { useState, useEffect, useRef } from 'react';

/**
 * Universal Player Seat Hook
 * Assigns a persistent playerId (localStorage) and a room-specific seat number to the current player.
 * Registers the player in the game_state.players array via updateState.
 */
export function usePlayerSeat(room, roomCode, gameId, updateState) {
  const [playerId] = useState(() => {
    const key = `tn_player_id_${gameId}_${roomCode}`;
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'p_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(key, id);
    }
    return id;
  });

  const [seatNumber, setSeatNumber] = useState(null);
  const [isSeated, setIsSeated] = useState(false);
  const seatedRef = useRef(false);

  useEffect(() => {
    if (!room || !updateState || seatedRef.current) return;

    const gs = room.game_state || {};
    const players = gs.players || [];

    // Check if already seated
    const existing = players.find(p => p.playerId === playerId);
    if (existing) {
      setSeatNumber(existing.seatNumber);
      setIsSeated(true);
      seatedRef.current = true;
      return;
    }

    // Assign next available seat number
    const usedSeats = players.map(p => p.seatNumber);
    let nextSeat = 1;
    while (usedSeats.includes(nextSeat)) nextSeat++;

    const newPlayer = {
      playerId,
      seatNumber: nextSeat,
      joinedAt: Date.now(),
    };

    const updatedPlayers = [...players, newPlayer];

    updateState({ players: updatedPlayers }).then(() => {
      setSeatNumber(nextSeat);
      setIsSeated(true);
      seatedRef.current = true;
    }).catch(() => {
      // retry on next render cycle
    });
  }, [room, playerId, updateState]);

  return { playerId, seatNumber, isSeated };
}