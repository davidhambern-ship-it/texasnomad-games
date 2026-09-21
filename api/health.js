import { pool } from '../server/db/client.js';
import { methodNotAllowed, sendError, sendJson } from '../server/http/respond.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);

  try {
    await pool.query('select 1');
    return sendJson(response, 200, {
      status: 'ok',
      service: 'tng-api',
      database: 'connected',
    });
  } catch (error) {
    return sendError(response, error);
  }
}
