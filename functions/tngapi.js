import health from '../api/health.js';
import profile from '../api/profile.js';
import deviceSession from '../api/device-session.js';
import hostSession from '../api/host/session.js';
import hostPairing from '../api/host/pairing.js';
import hostRoom from '../api/host/room.js';
import displayPair from '../api/display/pair.js';

const routes = new Map([
  ['/health', health],
  ['/profile', profile],
  ['/device-session', deviceSession],
  ['/host/session', hostSession],
  ['/host/pairing', hostPairing],
  ['/host/room', hostRoom],
  ['/display/pair', displayPair],
]);

function allowedOrigins() {
  return new Set(
    (process.env.TNG_ALLOWED_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function corsHeaders(request) {
  const origin = request.headers.get('origin');
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, content-type, x-tng-device-id',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  });

  if (origin && allowedOrigins().has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  return headers;
}

function nodeStyleHeaders(request) {
  const headers = {};
  for (const [key, value] of request.headers.entries()) {
    headers[key.toLowerCase()] = value;
  }
  return headers;
}

async function requestBody(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return undefined;
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) return undefined;
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

function responseAdapter(cors) {
  let statusCode = 200;
  const headers = new Headers(cors);

  return {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(name, value) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
      return this;
    },
    json(body) {
      return new Response(JSON.stringify(body), {
        status: statusCode,
        headers,
      });
    },
  };
}

function errorResponse(error, cors) {
  console.error('[tngapi]', error);
  const headers = new Headers(cors);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify({
    error: {
      code: 'FUNCTION_ERROR',
      message: 'The TNG service is temporarily unavailable.',
    },
  }), { status: 500, headers });
}

export default {
  async fetch(request) {
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('origin');
      if (origin && !allowedOrigins().has(origin)) {
        return new Response(null, { status: 403, headers: cors });
      }
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname !== '/' && url.pathname.endsWith('/')
      ? url.pathname.slice(0, -1)
      : url.pathname;
    const handler = routes.get(path);

    if (!handler) {
      const headers = new Headers(cors);
      headers.set('Content-Type', 'application/json; charset=utf-8');
      headers.set('Cache-Control', 'no-store');
      return new Response(JSON.stringify({
        error: { code: 'NOT_FOUND', message: 'TNG API route not found.' },
      }), { status: 404, headers });
    }

    try {
      const adaptedRequest = {
        method: request.method,
        headers: nodeStyleHeaders(request),
        body: await requestBody(request),
      };
      return await handler(adaptedRequest, responseAdapter(cors));
    } catch (error) {
      return errorResponse(error, cors);
    }
  },
};
