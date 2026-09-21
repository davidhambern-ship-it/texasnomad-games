import { base44 } from '@/api/base44Client';

function previewHost() {
  if (typeof window === 'undefined') return false;

  const candidates = [
    window.location.href,
    document.referrer,
    window.localStorage.getItem('base44_from_url'),
    window.localStorage.getItem('base44_app_base_url'),
  ].filter(Boolean);

  return candidates.some((value) => {
    try {
      const url = new URL(value, window.location.origin);
      const host = url.hostname.toLowerCase();

      if (
        host.endsWith('.base44.app') &&
        (host.startsWith('preview--') || host.startsWith('preview-sandbox--'))
      ) {
        return true;
      }

      return host === 'app.base44.com' && url.pathname.includes('/editor/preview');
    } catch {
      return false;
    }
  });
}

export const isBase44Preview = previewHost();

export async function getPreviewTngProfile(user) {
  if (!user) return null;

  const profiles = await base44.entities.PlayerProfile.filter({
    user_id: user.id,
  });

  return profiles[0] || null;
}

export async function createPreviewTngProfile(user, { displayName, handle }) {
  if (!user) {
    throw new Error('You must be signed in before creating a TNG profile.');
  }

  const cleanDisplayName = String(displayName || '').trim();
  const cleanHandle = String(handle || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();

  if (cleanDisplayName.length < 2 || cleanDisplayName.length > 50) {
    throw new Error('Display name must be between 2 and 50 characters.');
  }

  if (!/^[a-z0-9_]{3,24}$/.test(cleanHandle)) {
    throw new Error('Handle must be 3–24 characters using letters, numbers, or underscores.');
  }

  const existingProfile = await getPreviewTngProfile(user);
  if (existingProfile) return existingProfile;

  const existingHandle = await base44.entities.PlayerProfile.filter({
    handle: cleanHandle,
  });

  if (existingHandle.length > 0) {
    throw new Error('That TNG handle is already taken.');
  }

  return base44.entities.PlayerProfile.create({
    user_id: user.id,
    username: cleanDisplayName,
    handle: cleanHandle,
    onboarding_complete: true,
    profile_locked: true,
    total_games_played: 0,
    total_play_time_minutes: 0,
    game_stats: {},
    badges: [],
    favorite_games: [],
    playstyle_tags: [],
    ambassador_status: 'player',
    ambassador_path: 'none',
    has_seen_ambassador_reveal: false,
    referral_count: 0,
    subscription_status: 'free',
    member_since: new Date().toISOString(),
    host_stats: {
      total_sessions: 0,
      total_host_time_minutes: 0,
      last_hosted: null,
    },
  });
}
