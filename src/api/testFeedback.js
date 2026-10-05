import { TNG_SERVICE_ORIGIN } from '@/lib/tngServiceOrigin';

const FEEDBACK_API_BASE = TNG_SERVICE_ORIGIN;

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
