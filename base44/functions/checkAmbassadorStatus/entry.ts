import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Checks a player's profile against ambassador requirements and promotes if eligible.
// Called from the lobby check on the frontend via base44.functions.invoke.

const TOTAL_GAMES = ['bff', 'square-biz', 'hangman', 'spades', 'word-search', 'sudoku', 'viral', 'see-that', 'txd', 'name-that-track', 'word-wrangler'];
const MASTER_MIN_BADGES = 2;
const SPECIALIST_MIN_BADGES = 3;
const SPECIALIST_MIN_PLAYTIME = 300; // 5 hours in minutes
const SPECIALIST_SKIP_THRESHOLD = 5;  // less than 5 mins means "didn't like it"

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.entities.PlayerProfile.filter({ user_id: user.id });
    if (!profiles || profiles.length === 0) {
      return Response.json({ eligible: false, reason: 'No profile found' });
    }

    const profile = profiles[0];

    // Already an ambassador
    if (profile.ambassador_status === 'ambassador') {
      return Response.json({ eligible: false, already_ambassador: true });
    }

    // Already saw the reveal
    if (profile.has_seen_ambassador_reveal) {
      return Response.json({ eligible: false, already_seen: true });
    }

    const gameStats = profile.game_stats || {};
    const badges = profile.badges || [];
    const winBadges = badges.filter(b => b.type === 'win');
    const gamesPlayed = Object.keys(gameStats);
    const playTime = profile.total_play_time_minutes || 0;

    // Path 1: Master — played every game + 2 win badges
    const playedAll = TOTAL_GAMES.every(g => gamesPlayed.includes(g) && (gameStats[g]?.times_played || 0) > 0);
    if (playedAll && winBadges.length >= MASTER_MIN_BADGES) {
      // Promote
      await base44.entities.PlayerProfile.update(profile.id, {
        ambassador_status: 'ambassador',
        ambassador_path: 'master',
      });
      return Response.json({
        eligible: true,
        path: 'master',
        profile: { ...profile, ambassador_status: 'ambassador', ambassador_path: 'master' }
      });
    }

    // Path 2: Specialist — skipped at most one game (with < SPECIALIST_SKIP_THRESHOLD mins),
    // but has extra badges + hours
    const skippedGames = TOTAL_GAMES.filter(g => {
      const gs = gameStats[g];
      if (!gs) return true;
      return (gs.times_played || 0) === 0 || (gs.total_time_minutes || 0) < SPECIALIST_SKIP_THRESHOLD;
    });

    if (
      skippedGames.length <= 1 &&
      winBadges.length >= SPECIALIST_MIN_BADGES &&
      playTime >= SPECIALIST_MIN_PLAYTIME
    ) {
      await base44.entities.PlayerProfile.update(profile.id, {
        ambassador_status: 'ambassador',
        ambassador_path: 'specialist',
      });
      return Response.json({
        eligible: true,
        path: 'specialist',
        profile: { ...profile, ambassador_status: 'ambassador', ambassador_path: 'specialist' }
      });
    }

    return Response.json({ eligible: false, stats: { gamesPlayed: gamesPlayed.length, winBadges: winBadges.length, playTime } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});