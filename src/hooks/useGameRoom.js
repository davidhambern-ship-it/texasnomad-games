import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { getDefaultGameState } from '@/lib/roomUtils';

/**
 * Shared hook for both Host Panel and Public Game Screen.
 * role = 'host' | 'viewer'
 *
 * Presence model (all stored in game_state):
 *   connectedUsers = [{ uid, type: 'host'|'player'|'spectator', seatNumber, status, joinedAt, lastSeen }]
 *
 * Rules:
 *   - Host is ALWAYS seat 1. This is a CRITICAL platform rule — never override it.
 *   - Human players can NEVER be in seat 1. They always start at seat 2 or higher.
 *   - Seat 1 is exclusively for the Host Panel or AI-controlled characters.
 *   - Spectators have seatNumber = null, but are tracked with a uid.
 *   - On disconnect/tab-close: user is marked status='disconnected', not deleted.
 *   - On reconnect: existing uid is matched and status restored to 'connected'.
 *   - players_connected on the room record reflects all currently connected humans.
 */
export function useGameRoom(roomCode, gameId, role = 'viewer') {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const roomRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const pollRef = useRef(null);
  const uidRef = useRef(null); // this user's uid for cleanup
  const cleanupRef = useRef(null);

  useEffect(() => {
    if (!roomCode || !gameId) return;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const rooms = await base44.entities.GameRoom.filter({ room_code: roomCode.toUpperCase(), game_id: gameId });
        let r;
        if (rooms.length > 0) {
          r = rooms[0];
        } else if (role === 'host') {
          const user = await base44.auth.me();
          r = await base44.entities.GameRoom.create({
            room_code: roomCode.toUpperCase(),
            game_id: gameId,
            status: 'waiting',
            host_connected: false,
            screen_connected: false,
            players_connected: 0,
            created_from_host_panel: true,
            created_by_user_id: user?.id || null,
            game_state: getDefaultGameState(gameId),
            last_command: null,
          });
        } else {
          setLoading(false);
          return;
        }

        if (role === 'host') {
          // Register host as seat 1 and evict any human player who somehow took seat 1
          const gs = r.game_state || {};
          const connectedUsers = (gs.connectedUsers || []).map(u =>
            // If a human player is in seat 1, bump them to seat 2+
            (u.type === 'player' && u.seatNumber === 1)
              ? { ...u, seatNumber: 2 + Math.floor(Math.random() * 90) } // will be corrected on reconnect
              : u
          );
          r = await base44.entities.GameRoom.update(r.id, {
            host_connected: true,
            game_state: {
              ...gs,
              connectedUsers,
              host_seat: 1, // explicit marker that host = seat 1
            },
          });
        }
        roomRef.current = r;
        setRoom({ ...r });

        const freshRoom = await base44.entities.GameRoom.get(r.id);
        roomRef.current = freshRoom;
        setRoom({ ...freshRoom });

        unsubscribeRef.current = base44.entities.GameRoom.subscribe((event) => {
          if ((event.type === 'update' || event.type === 'create') && event.data) {
            const updated = event.data;
            const updatedId = updated.id || event.id;
            if (updatedId === roomRef.current?.id) {
              roomRef.current = updated;
              setRoom({ ...updated });
            }
          }
        });

        pollRef.current = setInterval(async () => {
          try {
            const fresh = await base44.entities.GameRoom.filter({ room_code: roomCode.toUpperCase(), game_id: gameId });
            if (fresh.length > 0) {
              const fr = fresh[0];
              if (!roomRef.current) {
                roomRef.current = fr;
                setRoom({ ...fr });
                return;
              }
              const changed =
                JSON.stringify(fr.game_state) !== JSON.stringify(roomRef.current?.game_state) ||
                fr.host_connected !== roomRef.current?.host_connected ||
                fr.players_connected !== roomRef.current?.players_connected ||
                fr.status !== roomRef.current?.status;
              if (changed) {
                roomRef.current = fr;
                setRoom({ ...fr });
              }
            }
          } catch (_) {}
        }, 3000);

      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    init();

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
      if (pollRef.current) clearInterval(pollRef.current);
      if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
      if (roomRef.current && role === 'host') {
        base44.entities.GameRoom.update(roomRef.current.id, { host_connected: false }).catch(() => {});
      }
      if (roomRef.current && uidRef.current) {
        markUserDisconnected(roomRef.current, uidRef.current);
      }
    };
  }, [roomCode, gameId, role]);

  // Mark a user as disconnected (keep record, just update status + lastSeen)
  function markUserDisconnected(currentRoom, uid) {
    const gs = currentRoom.game_state || {};
    const users = gs.connectedUsers || [];
    const idx = users.findIndex(u => u.uid === uid);
    if (idx === -1) return;
    const updated = users.map(u =>
      u.uid === uid ? { ...u, status: 'disconnected', lastSeen: Date.now() } : u
    );
    const connected = updated.filter(u => u.status === 'connected').length;
    base44.entities.GameRoom.update(currentRoom.id, {
      game_state: { ...gs, connectedUsers: updated },
      players_connected: connected,
    }).catch(() => {});
  }

  /**
   * Register a user (player or spectator) into the room's connectedUsers.
   * Called by useRoomPresence after determining uid + type.
   * Returns the final seatNumber assigned (or null for spectators).
   */
  const registerUser = useCallback(async (uid, type, preferredSeat = null) => {
    if (!uid || !roomRef.current) return null;
    uidRef.current = uid;

    const currentRoom = roomRef.current;
    const gs = currentRoom.game_state || {};
    const users = gs.connectedUsers || [];

    // Check if this uid already exists (reconnect)
    const existing = users.find(u => u.uid === uid);
    if (existing) {
      const updated = users.map(u =>
        u.uid === uid ? { ...u, status: 'connected', lastSeen: Date.now() } : u
      );
      const connected = updated.filter(u => u.status === 'connected').length;
      const r = await base44.entities.GameRoom.update(currentRoom.id, {
        game_state: { ...gs, connectedUsers: updated },
        players_connected: connected,
      });
      roomRef.current = r;
      setRoom({ ...r });
      return existing.seatNumber;
    }

    // New user — assign seat if player
    // CRITICAL RULE: Seat 1 is ALWAYS and EXCLUSIVELY reserved for the Host/Host Panel or AI.
    // Human players can NEVER occupy seat 1 under any circumstances.
    let seatNumber = null;
    if (type === 'player') {
      const usedSeats = new Set(
        users.filter(u => u.type === 'player' && u.status !== 'disconnected').map(u => u.seatNumber)
      );
      usedSeats.add(1); // hard-block seat 1 — host/AI only
      // Also block seat 1 if a preferred seat of 1 is requested — redirect to seat 2+
      const safePreferred = preferredSeat && preferredSeat !== 1 ? preferredSeat : null;
      if (safePreferred && !usedSeats.has(safePreferred)) {
        seatNumber = safePreferred;
      } else {
        seatNumber = 2; // humans always start at 2
        while (usedSeats.has(seatNumber)) seatNumber++;
      }
    }

    const newUser = {
      uid,
      type, // 'player' | 'spectator'
      seatNumber,
      status: 'connected',
      queuedToPlay: type === 'spectator' ? false : null,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    };

    const updatedUsers = [...users, newUser];
    const connected = updatedUsers.filter(u => u.status === 'connected').length;

    const r = await base44.entities.GameRoom.update(currentRoom.id, {
      game_state: { ...gs, connectedUsers: updatedUsers },
      players_connected: connected,
    });
    roomRef.current = r;
    setRoom({ ...r });

    // Register lifecycle cleanup
    const handleUnload = () => {
      if (roomRef.current && uidRef.current) markUserDisconnected(roomRef.current, uidRef.current);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && roomRef.current && uidRef.current)
        markUserDisconnected(roomRef.current, uidRef.current);
    };
    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', handleVisibility);
    cleanupRef.current = () => {
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
    };

    return seatNumber;
  }, []);

  /**
   * Update a spectator's queue status (wants to play vs stay watching).
   */
  const setSpectatorQueue = useCallback(async (uid, queuedToPlay) => {
    if (!roomRef.current) return;
    const gs = roomRef.current.game_state || {};
    const users = (gs.connectedUsers || []).map(u =>
      u.uid === uid ? { ...u, queuedToPlay, lastSeen: Date.now() } : u
    );
    const r = await base44.entities.GameRoom.update(roomRef.current.id, {
      game_state: { ...gs, connectedUsers: users },
    });
    roomRef.current = r;
    setRoom({ ...r });
  }, []);

  // Legacy: kept for backward compat — components that still call registerPlayer(pid)
  const registerPlayer = useCallback((pid) => {
    registerUser(pid, 'player');
  }, [registerUser]);

  const updateState = async (newState) => {
    if (!roomRef.current) return;
    const updated = await base44.entities.GameRoom.update(roomRef.current.id, {
      game_state: { ...roomRef.current.game_state, ...newState },
    });
    roomRef.current = updated;
    setRoom({ ...updated });
  };

  const sendCommand = async (command) => {
    if (!roomRef.current) return;
    const updated = await base44.entities.GameRoom.update(roomRef.current.id, {
      last_command: { ...command, timestamp: Date.now() },
    });
    roomRef.current = updated;
    setRoom({ ...updated });
  };

  const updateRoomStatus = async (patch) => {
    if (!roomRef.current) return;
    const updated = await base44.entities.GameRoom.update(roomRef.current.id, patch);
    roomRef.current = updated;
    setRoom({ ...updated });
  };

  const ensureRoom = async (gameId, roomCode) => {
    if (roomRef.current) return roomRef.current;
    const r = await base44.entities.GameRoom.create({
      room_code: roomCode.toUpperCase(),
      game_id: gameId,
      status: 'active',
      host_connected: false,
      screen_connected: false,
      players_connected: 1,
      created_from_host_panel: false,
      game_state: {},
      last_command: null,
    });
    roomRef.current = r;
    setRoom({ ...r });
    return r;
  };

  return { room, loading, error, updateState, sendCommand, updateRoomStatus, ensureRoom, registerPlayer, registerUser, setSpectatorQueue };
}