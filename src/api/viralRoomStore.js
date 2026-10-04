const IS_RAILWAY_TEMP_HOST =
  typeof window !== 'undefined' &&
  window.location.hostname.endsWith('.up.railway.app');

const VIRAL_API_BASE =
  import.meta.env.VITE_VIRAL_API_BASE ||
  (IS_RAILWAY_TEMP_HOST
    ? ''
    : 'https://tng-live-production.up.railway.app');

export async function resolveViralRoom(roomCode) {
  const code = String(roomCode || '').trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) {
    return { live: false, roomCode: code };
  }

  const response = await fetch(
    `${VIRAL_API_BASE}/viral-live/resolve?code=${encodeURIComponent(code)}`,
    {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload?.error?.message ||
      payload?.error ||
      `VIRAL room lookup failed (${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }

  return payload;
}
