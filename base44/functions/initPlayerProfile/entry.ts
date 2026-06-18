import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Called by automation when a new User record is created.
// Creates a PlayerProfile record linked to that user.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const userId = body?.data?.id || body?.event?.entity_id;
    const userEmail = body?.data?.email || '';
    const userFullName = body?.data?.full_name || '';

    if (!userId) {
      return Response.json({ error: 'No user_id in payload' }, { status: 400 });
    }

    // Check if profile already exists
    const existing = await base44.asServiceRole.entities.PlayerProfile.filter({ user_id: userId });
    if (existing && existing.length > 0) {
      return Response.json({ message: 'Profile already exists', profile_id: existing[0].id });
    }

    // Generate a unique referral code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const referralCode = 'TNG' + Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    const profile = await base44.asServiceRole.entities.PlayerProfile.create({
      user_id: userId,
      username: userFullName || userEmail.split('@')[0] || 'Nomad',
      total_games_played: 0,
      total_play_time_minutes: 0,
      game_stats: {},
      badges: [],
      favorite_games: [],
      playstyle_tags: [],
      ambassador_status: 'player',
      ambassador_path: 'none',
      has_seen_ambassador_reveal: false,
      referral_code: referralCode,
      referral_count: 0,
      subscription_status: 'free',
      profile_theme: 'neon-noir',
      pinned_games: [],
      member_since: new Date().toISOString(),
    });

    return Response.json({ success: true, profile_id: profile.id, referral_code: referralCode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});