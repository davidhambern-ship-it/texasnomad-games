import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Tracks host sessions on the PlayerProfile.
 * Call startHostSession when host enters the panel, endHostSession when they leave.
 * Also updates PlayerPresence with context="host".
 */
export default function useHostSession() {
  const profileIdRef = useRef(null);
  const sessionStartRef = useRef(null);

  const startHostSession = async (gameId = null) => {
    sessionStartRef.current = Date.now();
    try {
      const isAuthed = await base44.auth.isAuthenticated();
      if (!isAuthed) return;
      const user = await base44.auth.me();
      if (!user) return;

      // Upsert presence with host context
      const presenceList = await base44.entities.PlayerPresence.filter({ user_id: user.id });
      const presenceData = {
        user_id: user.id,
        is_online: true,
        last_seen: new Date().toISOString(),
        current_game_id: gameId,
        current_context: 'host',
      };
      if (presenceList.length > 0) {
        await base44.entities.PlayerPresence.update(presenceList[0].id, presenceData);
      } else {
        await base44.entities.PlayerPresence.create({ ...presenceData, username: user.full_name || 'Host' });
      }

      // Update profile to record hosting
      const profiles = await base44.entities.PlayerProfile.filter({ user_id: user.id });
      if (profiles.length > 0) {
        profileIdRef.current = profiles[0].id;
        const existing = profiles[0];
        const hostStats = existing.host_stats || { total_sessions: 0, total_host_time_minutes: 0, last_hosted: null };
        await base44.entities.PlayerProfile.update(profiles[0].id, {
          host_stats: {
            ...hostStats,
            total_sessions: (hostStats.total_sessions || 0) + 1,
            last_hosted: new Date().toISOString(),
          },
        });
      }
    } catch (e) {
      console.error('[useHostSession] startHostSession error:', e);
    }
  };

  const endHostSession = async () => {
    const elapsed = sessionStartRef.current ? Math.round((Date.now() - sessionStartRef.current) / 60000) : 0;
    sessionStartRef.current = null;
    try {
      const isAuthed = await base44.auth.isAuthenticated();
      if (!isAuthed) return;
      const user = await base44.auth.me();
      if (!user) return;

      // Clear host context from presence
      const presenceList = await base44.entities.PlayerPresence.filter({ user_id: user.id });
      if (presenceList.length > 0) {
        await base44.entities.PlayerPresence.update(presenceList[0].id, {
          current_context: 'player',
          current_game_id: null,
        });
      }

      // Update total host time
      if (profileIdRef.current && elapsed > 0) {
        const profiles = await base44.entities.PlayerProfile.filter({ user_id: user.id });
        if (profiles.length > 0) {
          const hostStats = profiles[0].host_stats || {};
          await base44.entities.PlayerProfile.update(profiles[0].id, {
            host_stats: {
              ...hostStats,
              total_host_time_minutes: (hostStats.total_host_time_minutes || 0) + elapsed,
            },
          });
        }
      }
    } catch (e) {
      console.error('[useHostSession] endHostSession error:', e);
    }
  };

  return { startHostSession, endHostSession };
}