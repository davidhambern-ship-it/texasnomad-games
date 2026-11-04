import { tngServiceUrl } from '@/lib/tngServiceOrigin';

const TOKEN_KEY = 'tng_guest_token';
const NAME_KEY = 'tng_guest_name';
const EXPIRES_KEY = 'tng_guest_expires_at';

export function getStoredGuestIdentity() {
  try {
    const token = String(localStorage.getItem(TOKEN_KEY) || '').trim();
    const name = String(localStorage.getItem(NAME_KEY) || '').trim();
    const expiresAt = Number(localStorage.getItem(EXPIRES_KEY) || 0);
    if (expiresAt && Date.now() >= expiresAt * 1000) {
      clearGuestIdentity();
      return null;
    }
    return token && name ? { token, name, expiresAt: expiresAt || null, isGuest: true } : null;
  } catch {
    return null;
  }
}

export async function createGuestIdentity(name) {
  const cleanName = String(name || '').replace(/[\\u0000-\u001f<>]/g, '').trim().slice(0, 32);
  if (!cleanName) throw new Error('Enter a player name to continue.');

  const response = await fetch(tngServiceUrl('/tng-guest/identity'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: cleanName }),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.token) {
    throw new Error(payload?.error?.message || 'Guest play is not available right now.');
  }

  try {
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(NAME_KEY, payload.guest?.name || cleanName);
    if (payload.guest?.expiresAt) localStorage.setItem(EXPIRES_KEY, String(payload.guest.expiresAt));
  } catch {
    throw new Error('This browser could not save your guest session. Check its privacy settings.');
  }

  return {
    token: payload.token,
    name: payload.guest?.name || cleanName,
    expiresAt: payload.guest?.expiresAt || null,
    isGuest: true,
  };
}

export function clearGuestIdentity() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(EXPIRES_KEY);
  } catch {}
}
