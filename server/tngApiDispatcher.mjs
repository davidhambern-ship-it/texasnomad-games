import health from './tng-api/health.js';
import profile from './tng-api/profile.js';
import deviceSession from './tng-api/device-session.js';
import hostSession from './tng-api/host/session.js';
import hostRoom from './tng-api/host/room.js';
import hostRoomState from './tng-api/host/room-state.js';
import playerRoom from './tng-api/player/room.js';
import spadesHost from './tng-api/spades/host.js';
import spadesPlayer from './tng-api/spades/player.js';
import hangmanPlayer from './tng-api/hangman/player.js';
import hangmanHost from './tng-api/hangman/host.js';
import wordSearchPlayer from './tng-api/word-search/player.js';
import wordSearchHost from './tng-api/word-search/host.js';
import squareBizQuestions from './tng-api/square-biz/questions.js';
import squareBizHost from './tng-api/square-biz/host.js';
import squareBizPlayer from './tng-api/square-biz/player.js';
import battleSudokuHost from './tng-api/battle-sudoku/host.js';
import battleSudokuPlayer from './tng-api/battle-sudoku/player.js';
import publicLiveRooms from './tng-api/public/live-rooms.js';
import social from './tng-api/social.js';

const routes = new Map([
  ['/', health],
  ['/health', health],
  ['/profile', profile],
  ['/device-session', deviceSession],
  ['/host/session', hostSession],
  ['/host/room', hostRoom],
  ['/host/room-state', hostRoomState],
  ['/player/room', playerRoom],
  ['/spades/host', spadesHost],
  ['/spades/player', spadesPlayer],
  ['/hangman/player', hangmanPlayer],
  ['/hangman/host', hangmanHost],
  ['/word-search/player', wordSearchPlayer],
  ['/word-search/host', wordSearchHost],
  ['/square-biz/questions', squareBizQuestions],
  ['/square-biz/host', squareBizHost],
  ['/square-biz/player', squareBizPlayer],
  ['/battle-sudoku/host', battleSudokuHost],
  ['/battle-sudoku/player', battleSudokuPlayer],
  ['/public/live-rooms', publicLiveRooms],
  ['/social', social],
]);

function configuredOrigins() {
  return new Set(
    (process.env.TNG_ALLOWED_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function isBase44PreviewOrigin(origin) {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' &&
      host.endsWith('.base44.app') &&
      (host.startsWith('preview--') || host.startsWith('preview-sandbox--'));
  } catch {
    return false;
  }
}

function isTngStagingOrigin(origin) {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' &&
      (
        host === 'texasnomad-games-git-staging-live-test-texasnomadgames.vercel.app' ||
        (host.endsWith('.vercel.app') || host.endsWith('.pages.dev') || host.endsWith('.workers.dev'))
      );
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin) {
  return configuredOrigins().has(origin) || isBase44PreviewOrigin(origin) || isTngStagingOrigin(origin);
}

function corsHeaders(request) {
  const origin = request.headers.get('origin');
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, content-type, x-tng-guest-token, x-tng-device-id, x-tng-room-code',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  });

  if (origin && isAllowedOrigin(origin)) {
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
      if (origin && !isAllowedOrigin(origin)) {
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
