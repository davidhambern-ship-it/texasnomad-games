export function sendJson(response, statusCode, body) {
  response.status(statusCode).setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  return response.json(body);
}

export function methodNotAllowed(response, allowed) {
  response.setHeader('Allow', allowed.join(', '));
  return sendJson(response, 405, {
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
  });
}

export function sendError(response, error) {
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const code = error.code || 'INTERNAL_ERROR';

  if (statusCode >= 500) {
    console.error(error);
  }

  return sendJson(response, statusCode, {
    error: {
      code,
      message: statusCode >= 500 ? 'The TNG service is temporarily unavailable.' : error.message,
    },
  });
}
