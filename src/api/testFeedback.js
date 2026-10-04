const IS_RAILWAY_TEMP_HOST =
  typeof window !== 'undefined' &&
  window.location.hostname.endsWith('.up.railway.app');

const FEEDBACK_API_BASE =
  import.meta.env.VITE_TEST_FEEDBACK_API_BASE ||
  (IS_RAILWAY_TEMP_HOST
    ? ''
    : 'https://tng-live-production.up.railway.app');

export async function submitTestFeedback({
  gameId,
  roomCode = '',
  reportType = 'feedback',
  message,
  testerName = '',
}) {
  const response = await fetch(`${FEEDBACK_API_BASE}/test-feedback`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gameId,
      roomCode,
      reportType,
      message,
      testerName,
      pageUrl: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload?.error?.message ||
      payload?.error ||
      `Feedback submission failed (${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }

  return payload;
}
