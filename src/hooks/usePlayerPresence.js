import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Call in any game component to broadcast that the player is in a specific room.
 * Pass gameId and roomCode when entering, call with null/null to clear on exit.
 */
export default function usePlayerPresence(gameId, roomCode, currentPlayers, maxPlayers) {
  useEffect(() => {
    let cancelled = false;

    async function updatePresence() {
      try {
        const u = await base44.auth.me();
        const existing = await base44.entities.PlayerPresence.filter({ user_id: u.id });
        const data = {
          is_online: true,
          last_seen: new Date().toISOString(),
          current_game_id: gameId || null,
          current_room_code: roomCode || null,
          current_players: currentPlayers || null,
          max_players: maxPlayers || null,
        };
        if (existing.length > 0) {
          await base44.entities.PlayerPresence.update(existing[0].id, data);
        } else {
          const profile = await base44.entities.PlayerProfile.filter({ user_id: u.id });
          await base44.entities.PlayerPresence.create({
            user_id: u.id,
            username: profile[0]?.username || u.full_name || 'Player',
            ...data,
          });
        }
      } catch (_) {}
    }

    if (!cancelled) updatePresence();

    return () => {
      cancelled = true;
      // Clear game presence on unmount
      async function clearPresence() {
        try {
          const u = await base44.auth.me();
          const existing = await base44.entities.PlayerPresence.filter({ user_id: u.id });
          if (existing.length > 0) {
            await base44.entities.PlayerPresence.update(existing[0].id, {
              current_game_id: null,
              current_room_code: null,
              current_players: null,
              max_players: null,
            });
          }
        } catch (_) {}
      }
      clearPresence();
    };
  }, [gameId, roomCode, currentPlayers, maxPlayers]);
}