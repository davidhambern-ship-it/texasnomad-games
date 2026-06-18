import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Records a completed game session to the player's PlayerProfile.
 * Payload:
 *   user_id       - Auth user ID of the player
 *   game_id       - e.g. "bff", "spades", "square-biz"
 *   score         - numeric score for this session
 *   won           - boolean, did player win?
 *   play_time_minutes - how long the session lasted
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verify caller is authenticated
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { user_id, game_id, score = 0, won = false, play_time_minutes = 0 } = body;

    if (!user_id || !game_id) {
      return Response.json({ error: 'user_id and game_id required' }, { status: 400 });
    }

    // Fetch the player's profile
    const profiles = await base44.asServiceRole.entities.PlayerProfile.filter({ user_id });
    if (!profiles || profiles.length === 0) {
      return Response.json({ error: 'PlayerProfile not found' }, { status: 404 });
    }

    const profile = profiles[0];
    const gameStats = profile.game_stats || {};
    const existing = gameStats[game_id] || { high_score: 0, times_played: 0, total_points: 0, wins: 0 };

    const updatedGameStats = {
      ...gameStats,
      [game_id]: {
        high_score: Math.max(existing.high_score || 0, score),
        times_played: (existing.times_played || 0) + 1,
        total_points: (existing.total_points || 0) + score,
        wins: (existing.wins || 0) + (won ? 1 : 0),
        last_played: new Date().toISOString(),
      },
    };

    // Compute favorite_games: top 5 by times_played
    const favGames = Object.entries(updatedGameStats)
      .sort((a, b) => (b[1].times_played || 0) - (a[1].times_played || 0))
      .slice(0, 5)
      .map(([id]) => id);

    // Award badges
    const badges = [...(profile.badges || [])];
    const gs = updatedGameStats[game_id];

    // First win badge
    if (won && gs.wins === 1 && !badges.find(b => b.id === `first_win_${game_id}`)) {
      badges.push({ id: `first_win_${game_id}`, name: `First Win: ${game_id.toUpperCase()}`, game_id, type: 'win', earned_at: new Date().toISOString() });
    }
    // 10 games played badge
    if (gs.times_played === 10 && !badges.find(b => b.id === `veteran_${game_id}`)) {
      badges.push({ id: `veteran_${game_id}`, name: `Veteran: ${game_id.toUpperCase()}`, game_id, type: 'achievement', earned_at: new Date().toISOString() });
    }

    await base44.asServiceRole.entities.PlayerProfile.update(profile.id, {
      game_stats: updatedGameStats,
      total_games_played: (profile.total_games_played || 0) + 1,
      total_play_time_minutes: (profile.total_play_time_minutes || 0) + play_time_minutes,
      favorite_games: favGames,
      badges,
    });

    return Response.json({ success: true, game_stats: updatedGameStats[game_id] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});