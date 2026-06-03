import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Shared hook for both Host Panel and Public Game Screen.
 * Finds or creates a GameRoom by roomCode+gameId, then subscribes to real-time updates.
 */
export function useGameRoom(roomCode, gameId, role = 'viewer') {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const roomRef = useRef(null);

  useEffect(() => {
    if (!roomCode || !gameId) return;

    let unsubscribe = null;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        // Find existing room or create new one
        const rooms = await base44.entities.GameRoom.filter({ room_code: roomCode.toUpperCase(), game_id: gameId });
        let r;
        if (rooms.length > 0) {
          r = rooms[0];
        } else {
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
        }

        // Mark connection
        const patch = role === 'host' ? { host_connected: true } : { screen_connected: true };
        r = await base44.entities.GameRoom.update(r.id, patch);
        roomRef.current = r;
        setRoom(r);

        // Subscribe to real-time changes
        unsubscribe = base44.entities.GameRoom.subscribe((event) => {
          const eventId = event.data?.id || event.id;
          if (eventId === r.id && event.type === 'update') {
            const updated = event.data || event;
            roomRef.current = updated;
            setRoom({ ...updated });
          }
        });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    init();

    return () => {
      if (unsubscribe) unsubscribe();
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

function getDefaultGameState(gameId) {
  switch (gameId) {
    case 'bff':
      return {
        phase: 'setup', // setup | playing | finished
        family1: 'Family 1',
        family2: 'Family 2',
        score1: 0,
        score2: 0,
        active_turn: 1, // 1 or 2
        round_bank: 0,
        current_question: '',
        answers: [],
        sound_on: true,
        dead_reveal: false,
        round: 1,
      };
    case 'square-biz':
      return {
        phase: 'playing',
        board: Array(9).fill(''), // '' | 'X' | 'O'
        current_turn: 'X',
        current_question: '',
        show_question: false,
        music_on: true,
        music_volume: 70,
        sfx_on: true,
        sfx_volume: 80,
        winner: null,
      };
    case 'hangman':
      return {
        phase: 'setup', // setup | playing | finished
        secret_word: '',
        category: '',
        hint: '',
        hint_revealed: false,
        word_revealed: false,
        guessed_letters: [],
        wrong_letters: [],
        max_wrong: 6,
      };
    default:
      return {};
  }
}