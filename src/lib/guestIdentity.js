import { tngServiceUrl } from '@/lib/tngServiceOrigin';

const TOKEN_KEY = 'tng_guest_token';
const NAME_KEY = 'tng_guest_name';

export function getStoredGuestIdentity() {
  try {
    const token = String(localStorage.getItem(TOKEN_KEY) || '').trim();
    const name = String(localStorage.getItem(NAME_KEY) || '').trim();
    return token && name ? { token, name, isGuest: true } : null;
  } catch {
    return null;
  }
}

export async function createGuestIdentity(name) {
  const cleanName = String(name || '').replace(/[\\u0000-\\u001f<>]/g, '').trim().slice(0, 32);
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
  } catch {
    throw new Error('This browser could not save your guest session. Check its privacy settings.');
  }

  return {
    token: payload.token,
    name: payload.guest?.name || cleanName,
    isGuest: true,
  };
}

export function clearGuestIdentity() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NAME_KEY);
  } catch {}
}
