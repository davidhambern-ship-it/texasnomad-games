import { useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook to record a game session to the player's profile.
 * Bypasses the backend function entirely — writes directly to PlayerProfile
 * using the SDK so there are no auth/invoke issues.
 */
export default function useGameStats(gameId) {
  const recordedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  const recordStat = async ({ score = 0, won = false, play_time_minutes = null } = {}) => {
    if (recordedRef.current) return;
    recordedRef.current = true;

    const elapsedMinutes = play_time_minutes ?? Math.round((Date.now() - startTimeRef.current) / 60000);

    try {
      const user = await base44.auth.me();
      if (!user) return;

      const profiles = await base44.entities.PlayerProfile.filter({ user_id: user.id });
      if (!profiles || profiles.length === 0) return;

      const profile = profiles[0];
      const gameStats = profile.game_stats || {};
      const existing = gameStats[gameId] || { high_score: 0, times_played: 0, total_points: 0, wins: 0 };

      const updatedGameStats = {
        ...gameStats,
        [gameId]: {
          high_score: Math.max(existing.high_score || 0, score),
          times_played: (existing.times_played || 0) + 1,
          total_points: (existing.total_points || 0) + score,
          wins: (existing.wins || 0) + (won ? 1 : 0),
          last_played: new Date().toISOString(),
        },
      };

      const favGames = Object.entries(updatedGameStats)
        .sort((a, b) => (b[1].times_played || 0) - (a[1].times_played || 0))
        .slice(0, 5)
        .map(([id]) => id);

      const badges = [...(profile.badges || [])];
      const gs = updatedGameStats[gameId];
      if (won && gs.wins === 1 && !badges.find(b => b.id === `first_win_${gameId}`)) {
        badges.push({ id: `first_win_${gameId}`, name: `First Win: ${gameId.toUpperCase()}`, game_id: gameId, type: 'win', earned_at: new Date().toISOString() });
      }
      if (gs.times_played === 10 && !badges.find(b => b.id === `veteran_${gameId}`)) {
        badges.push({ id: `veteran_${gameId}`, name: `Veteran: ${gameId.toUpperCase()}`, game_id: gameId, type: 'achievement', earned_at: new Date().toISOString() });
      }

      await base44.entities.PlayerProfile.update(profile.id, {
        game_stats: updatedGameStats,
        total_games_played: (profile.total_games_played || 0) + 1,
        total_play_time_minutes: (profile.total_play_time_minutes || 0) + elapsedMinutes,
        favorite_games: favGames,
        badges,
      });
    } catch (e) {
      console.error('[useGameStats] failed to record stat:', e);
    }
  };

  const resetStat = () => {
    recordedRef.current = false;
    startTimeRef.current = Date.now();
  };

  return { recordStat, resetStat };
}