import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { getDefaultGameState } from '@/lib/roomUtils';

/**
 * Shared hook for both Host Panel and Public Game Screen.
 * Finds or creates a GameRoom by roomCode+gameId, then subscribes to real-time updates.
 */
export function useGameRoom(roomCode, gameId, role = 'viewer') {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const roomRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!roomCode || !gameId) return;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        // Find existing room
        const rooms = await base44.entities.GameRoom.filter({ room_code: roomCode.toUpperCase(), game_id: gameId });
        let r;
        if (rooms.length > 0) {
          r = rooms[0];
        } else if (role === 'host') {
          r = await base44.entities.GameRoom.create({
            room_code: roomCode.toUpperCase(),
            game_id: gameId,
            status: 'waiting',
            host_connected: false,
            screen_connected: false,
            players_connected: 0,
            game_state: getDefaultGameState(gameId),
            last_command: null,
          });
        } else {
          // Viewer: room doesn't exist yet — show waiting state, poll will pick it up
          setLoading(false);
          return;
        }

        // If host role, check if another host is already connected (but allow reconnect)
        // Removed hard block — just let host reconnect if needed

        // Mark connection
        const patch = role === 'host' ? { host_connected: true } : { screen_connected: true };
        r = await base44.entities.GameRoom.update(r.id, patch);
        roomRef.current = r;
        setRoom(r);

        // Subscribe to real-time changes
        unsubscribeRef.current = base44.entities.GameRoom.subscribe((event) => {
          if (event.type === 'update' && event.data) {
            const updated = event.data;
            const updatedId = updated.id || event.id;
            if (updatedId === roomRef.current?.id) {
              roomRef.current = updated;
              setRoom({ ...updated });
            }
          }
        });

        // Poll every 3s as a reliable fallback
        pollRef.current = setInterval(async () => {
          try {
            const fresh = await base44.entities.GameRoom.filter({ room_code: roomCode.toUpperCase(), game_id: gameId });
            if (fresh.length > 0) {
              const fr = fresh[0];
              // If viewer just found the room for the first time, connect
              if (!roomRef.current) {
                const patched = await base44.entities.GameRoom.update(fr.id, { screen_connected: true });
                roomRef.current = patched;
                setRoom({ ...patched });
                return;
              }
              if (JSON.stringify(fr.game_state) !== JSON.stringify(roomRef.current?.game_state) ||
                  fr.host_connected !== roomRef.current?.host_connected ||
                  fr.players_connected !== roomRef.current?.players_connected ||
                  fr.status !== roomRef.current?.status) {
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
      // Disconnect on unmount
      if (roomRef.current) {
        const patch = role === 'host' ? { host_connected: false } : { screen_connected: false };
        base44.entities.GameRoom.update(roomRef.current.id, patch).catch(() => {});
      }
    };
  }, [roomCode, gameId, role]);

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

  return { room, loading, error, updateState, sendCommand, updateRoomStatus };
}