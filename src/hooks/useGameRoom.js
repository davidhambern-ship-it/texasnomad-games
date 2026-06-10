import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { getDefaultGameState } from '@/lib/roomUtils';

/**
 * Shared hook for both Host Panel and Public Game Screen.
 * role = 'host' | 'viewer'
 *
 * Presence model:
 *   game_state.connectedUsers = [{ playerId, role, connectedAt, lastSeen }]
 *   game_state.players = seated gameplay users (role: 'player' | 'hostPlayer')
 *
 * Host joining NEVER modifies game_state.players — only sets host_connected.
 */
export function useGameRoom(roomCode, gameId, role = 'viewer') {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const roomRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const pollRef = useRef(null);
  const heartbeatRef = useRef(null);

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
          // Viewer: room doesn't exist yet — poll will pick it up
          setLoading(false);
          return;
        }

        // Mark connection — host only sets host_connected, never touches players or game_state
        if (role === 'host') {
          r = await base44.entities.GameRoom.update(r.id, { host_connected: true });
        }
        roomRef.current = r;
        setRoom({ ...r });

        // Fetch fresh state to be sure
        const freshRoom = await base44.entities.GameRoom.get(r.id);
        roomRef.current = freshRoom;
        setRoom({ ...freshRoom });

        // Subscribe to real-time changes
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

        // Poll every 3s as fallback — checks ALL fields including host_connected
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
              // Compare broadly — include host_connected
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
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      // Disconnect: only host_connected flag — never touch game_state or players
      if (roomRef.current && role === 'host') {
        base44.entities.GameRoom.update(roomRef.current.id, { host_connected: false }).catch(() => {});
      }
    };
  }, [roomCode, gameId, role]);

  const ensureRoom = async (gameId, roomCode) => {
    if (roomRef.current) return roomRef.current;
    // Room doesn't exist yet — create it now
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

  return { room, loading, error, updateState, sendCommand, updateRoomStatus, ensureRoom };
}