import { useState, useEffect, useRef } from 'react';

/**
 * Universal Player Seat Hook
 *
 * Rules:
 *  - Seat 1 is ALWAYS and EXCLUSIVELY reserved for the Host Panel or AI characters.
 *    Human players can NEVER occupy seat 1 under any circumstances — they start at seat 2+.
 *  - Each human gets a stable uid per-room stored in localStorage.
 *  - On first visit: registers via registerUser (from useGameRoom) to get a seat.
 *  - On refresh/reconnect: reads uid from localStorage, re-registers (server marks reconnected).
 *  - isHost=true → skip seating entirely (host panel users never take a player seat).
 *  - type='spectator' → registers as spectator with no seat, can queue to play.
 *
 * Returns: { playerId, seatNumber, isSeated, userType }
 */
export function usePlayerSeat(room, roomCode, gameId, updateState, isHost = false, chosenRole = null, registerUser = null) {
  // Stable uid per room from localStorage
  const [playerId] = useState(() => {
    if (!roomCode) return null;
    const key = `tn_pid_${roomCode}`;
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'p_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  });

  const [seatNumber, setSeatNumber] = useState(() => {
    if (isHost || !roomCode || !playerId) return null;
    const cached = localStorage.getItem(`tn_seat_${roomCode}_${playerId}`);
    return cached ? Number(cached) : null;
  });

  const [isSeated, setIsSeated] = useState(() => {
    if (isHost || !roomCode || !playerId) return false;
    return !!localStorage.getItem(`tn_seat_${roomCode}_${playerId}`);
  });

  const [userType, setUserType] = useState(chosenRole === 'spectator' ? 'spectator' : 'player');
  const registeredRef = useRef(false);

  // If this is a host view, clear any stale cached seat for this room
  useEffect(() => {
    if (isHost && roomCode && playerId) {
      localStorage.removeItem(`tn_seat_${roomCode}_${playerId}`);
    }
  }, [isHost, roomCode, playerId]);

  useEffect(() => {
    if (isHost || !room || !playerId) return;

    const gs = room.game_state || {};

    // --- New system: connectedUsers array ---
    if (registerUser && !registeredRef.current) {
      registeredRef.current = true;

      const users = gs.connectedUsers || [];
      const existingUser = users.find(u => u.uid === playerId);

      if (existingUser) {
        // Reconnect — restore local state from server
        if (existingUser.type === 'player' && existingUser.seatNumber) {
          setSeatNumber(existingUser.seatNumber);
          setIsSeated(true);
          localStorage.setItem(`tn_seat_${roomCode}_${playerId}`, String(existingUser.seatNumber));
        }
        setUserType(existingUser.type);
        // Still call registerUser to mark status=connected
        registerUser(playerId, existingUser.type, existingUser.seatNumber);
        return;
      }

      // New user — determine type
      const type = chosenRole === 'spectator' ? 'spectator' : 'player';
      setUserType(type);

      registerUser(playerId, type).then((assignedSeat) => {
        if (type === 'player' && assignedSeat) {
          setSeatNumber(assignedSeat);
          setIsSeated(true);
          localStorage.setItem(`tn_seat_${roomCode}_${playerId}`, String(assignedSeat));
        }
      }).catch(() => {
        registeredRef.current = false; // allow retry
      });
      return;
    }

    // --- Legacy fallback: game_state.players array (for games not yet using connectedUsers) ---
    if (!registerUser) {
      const players = gs.players || [];
      const existing = players.find(p => p.playerId === playerId);
      if (existing) {
        setSeatNumber(existing.seatNumber);
        setIsSeated(true);
        localStorage.setItem(`tn_seat_${roomCode}_${playerId}`, String(existing.seatNumber));
        registeredRef.current = true;
        return;
      }

      if (registeredRef.current) return;
      registeredRef.current = true;

      // CRITICAL: Seat 1 is ALWAYS reserved for Host/AI — human players start at seat 2
      const usedSeats = new Set(players.map(p => p.seatNumber));
      usedSeats.add(1); // hard-block seat 1
      let nextSeat = 2; // humans always start at 2, never 1
      while (usedSeats.has(nextSeat)) nextSeat++;

      setSeatNumber(nextSeat);
      setIsSeated(true);
      localStorage.setItem(`tn_seat_${roomCode}_${playerId}`, String(nextSeat));

      const newPlayer = {
        playerId,
        seatNumber: nextSeat,
        role: chosenRole || 'pending',
        connected: true,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      };

      updateState({ players: [...players, newPlayer] }).catch(() => {
        registeredRef.current = false;
      });
    }
  }, [room, playerId, registerUser, isHost, roomCode, chosenRole, updateState]);

  return { playerId, seatNumber, isSeated, userType };
}