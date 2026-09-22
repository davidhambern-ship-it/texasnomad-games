import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const port = Number(process.env.PORT || 3000);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function sendFile(res, filePath) {
  const body = await readFile(filePath);
  res.writeHead(200, {
    'Content-Type': mime[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  res.end(body);
}

const TNG_API_ORIGIN =
  'https://br-polished-glade-avfsrygs-tngapi.compute.c-11.us-east-1.aws.neon.tech';

const { Pool } = pg;
const bffPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
});

async function proxyTngApi(req, res) {
  const sourceUrl = new URL(req.url || '/', 'http://localhost');
  const targetPath = sourceUrl.pathname.replace(/^\/tng-api/, '') || '/';
  const targetUrl = `${TNG_API_ORIGIN}${targetPath}${sourceUrl.search}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (
      value !== undefined &&
      !['host', 'connection', 'content-length'].includes(key.toLowerCase())
    ) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : body,
    redirect: 'manual',
  });

  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
      responseHeaders[key] = value;
    }
  });

  const responseBody = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, responseHeaders);
  res.end(responseBody);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function verifyBffHostWithTngApi(req, controllerId) {
  const auth = String(req.headers.authorization || '');
  if (!auth) return { ok: false, status: 401, payload: { error: { code: 'AUTH_REQUIRED', message: 'Sign in again.' } } };

  const response = await fetch(`${TNG_API_ORIGIN}/host/room-state`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: auth,
      'X-TNG-Device-Id': controllerId,
    },
  });

  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

async function loadRailwayBffHostRoom(controllerId) {
  const { rows } = await bffPool.query(`
    select gr.id, gr.room_code, gr.game_id, gr.status, gr.revision, gr.display_state,
           gr.created_at, gr.updated_at, hs.id as host_session_id
    from public.host_sessions hs
    join public.game_rooms gr on gr.host_session_id = hs.id
    where hs.controller_device_id = $1::uuid
      and hs.status in ('pairing','ready','live')
      and gr.status in ('lobby','live','paused')
      and gr.game_id = 'bff'
    order by gr.updated_at desc
    limit 1
  `, [controllerId]);

  return rows[0] || null;
}

async function assignBffSeats(roomId) {
  const client = await bffPool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(`
      select id, seat_number
      from public.room_participants
      where room_id = $1::uuid and left_at is null
      order by joined_at asc
      for update
    `, [roomId]);

    const used = new Set(rows.filter((row) => row.seat_number != null).map((row) => Number(row.seat_number)));
    used.add(1);

    let nextSeat = 2;
    for (const row of rows) {
      if (row.seat_number != null) continue;
      while (used.has(nextSeat)) nextSeat += 1;
      await client.query(
        'update public.room_participants set seat_number = $1, last_heartbeat_at = now() where id = $2::uuid',
        [nextSeat, row.id],
      );
      used.add(nextSeat);
      nextSeat += 1;
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function loadBffParticipants(roomId, gameState = {}) {
  const { rows } = await bffPool.query(`
    select rp.id, rp.account_id, rp.device_session_id, rp.role::text as role, rp.seat_number,
           rp.joined_at, rp.last_heartbeat_at,
           pp.display_name, pp.handle, a.email
    from public.room_participants rp
    join public.accounts a on a.id = rp.account_id
    left join public.player_profiles pp on pp.account_id = rp.account_id
    where rp.room_id = $1::uuid
      and rp.left_at is null
    order by rp.seat_number nulls last, rp.joined_at
  `, [roomId]);

  const teamMap = gameState?.playerTeams || {};
  return rows.map((row) => ({
    playerId: row.account_id,
    accountId: row.account_id,
    participantId: row.id,
    deviceSessionId: row.device_session_id,
    role: row.role || 'player',
    seatNumber: row.seat_number,
    familyTeam: teamMap[row.account_id] ?? null,
    playerName: row.display_name || row.handle || row.email.split('@')[0],
    name: row.display_name || row.handle || row.email.split('@')[0],
    handle: row.handle || null,
    connected: true,
    active: true,
    joinedAt: row.joined_at ? new Date(row.joined_at).getTime() : Date.now(),
    lastActionAt: row.last_heartbeat_at ? new Date(row.last_heartbeat_at).getTime() : Date.now(),
  }));
}

async function ensureBffTeamAssignments(room, gameState = {}, players = []) {
  const teamMap = { ...(gameState.playerTeams || {}) };
  let team1Count = Object.values(teamMap).filter((value) => Number(value) === 1).length;
  let team2Count = Object.values(teamMap).filter((value) => Number(value) === 2).length;
  let changed = false;

  for (const player of players) {
    const playerId = String(player.playerId || '');
    if (!playerId || Object.prototype.hasOwnProperty.call(teamMap, playerId)) continue;

    const team = team1Count <= team2Count ? 1 : 2;
    teamMap[playerId] = team;
    if (team === 1) team1Count += 1;
    else team2Count += 1;
    changed = true;
  }

  if (!changed) {
    return { gameState, room };
  }

  const nextGameState = {
    ...gameState,
    playerTeams: teamMap,
  };

  const savedRoom = await saveBffGameState(room.id, room.display_state || {}, nextGameState);
  return {
    gameState: nextGameState,
    room: savedRoom ? { ...room, ...savedRoom } : room,
  };
}


function extractBffGameState(displayState = {}) {
  if (
    displayState &&
    typeof displayState === 'object' &&
    displayState.gameState &&
    typeof displayState.gameState === 'object'
  ) {
    return { ...displayState.gameState };
  }

  return displayState && typeof displayState === 'object'
    ? { ...displayState }
    : {};
}

function wrapBffGameState(displayState = {}, gameState = {}) {
  const base = displayState && typeof displayState === 'object'
    ? { ...displayState }
    : {};

  if (base.gameState && typeof base.gameState === 'object') {
    return {
      ...base,
      gameId: base.gameId || 'bff',
      screen: base.screen || 'game',
      gameState,
    };
  }

  return {
    ...base,
    ...gameState,
    gameId: 'bff',
  };
}

function getBffAnswers(gameState = {}) {
  const raw = Array.isArray(gameState.answers) ? gameState.answers : [];
  return raw.map((answer, index) => {
    if (typeof answer === 'string') {
      return {
        text: answer,
        points: 0,
        revealed: false,
        index,
      };
    }

    return {
      ...answer,
      index,
      revealed: Boolean(answer?.revealed),
      points: Number(answer?.points) || 0,
    };
  });
}

function sanitizeBffHostState(gameState = {}, players = []) {
  const answers = getBffAnswers(gameState);
  const answerCount = Math.max(
    answers.length,
    Number(gameState.answer_count || gameState.answerCount || 0),
  );

  const safeAnswers = Array.from({ length: answerCount }, (_, index) => {
    const answer = answers[index] || {};
    return {
      index,
      text: String(answer.text || answer.answer || ''),
      revealed: Boolean(answer.revealed),
      points: Number(answer.points) || 0,
    };
  });

  return {
    phase: gameState.phase || 'waiting',
    family1: gameState.family1 || 'Family 1',
    family2: gameState.family2 || 'Family 2',
    score1: Number(gameState.score1) || 0,
    score2: Number(gameState.score2) || 0,
    round_number: Number(gameState.round_number || gameState.roundNumber || 1),
    round_bank: Number(gameState.round_bank || gameState.roundBank || 0),
    current_question:
      gameState.current_question ||
      gameState.currentQuestion ||
      gameState.question ||
      '',
    control_team: Number(gameState.control_team || gameState.active_turn || 1),
    active_turn: Number(gameState.active_turn || gameState.control_team || 1),
    steal_mode: Boolean(gameState.steal_mode),
    bye_count: Math.max(0, Math.min(3, Number(gameState.bye_count) || 0)),
    buzzer_phase: gameState.buzzer_phase || null,
    buzzer_open: Boolean(gameState.buzzer_open || gameState.buzzer_phase === 'buzzer_active'),
    buzz_winner: gameState.buzz_winner || null,
    playerTeams: gameState.playerTeams || {},
    sound_cue: gameState.sound_cue || null,
    voice_offers: gameState.voice_offers || {},
    answers: safeAnswers,
    players,
  };
}

async function saveBffGameState(roomId, originalDisplayState, nextGameState) {
  const nextDisplayState = wrapBffGameState(originalDisplayState, nextGameState);

  const { rows } = await bffPool.query(`
    update public.game_rooms
    set display_state = $2::jsonb,
        revision = revision + 1,
        updated_at = now()
    where id = $1::uuid
    returning id, room_code, game_id, status, revision, display_state, created_at, updated_at
  `, [roomId, JSON.stringify(nextDisplayState)]);

  return rows[0] || null;
}

function ensureBffAnswerSlot(answers, index) {
  const next = answers.map((answer) => ({ ...answer }));
  while (next.length <= index) {
    next.push({
      text: '',
      answer: '',
      points: 0,
      revealed: false,
    });
  }
  return next;
}

function bffUndoSnapshot(gameState = {}) {
  const snapshot = JSON.parse(JSON.stringify(gameState || {}));
  delete snapshot._hostUndo;
  return snapshot;
}


function bffRankPoints(answerCount, index) {
  const scales = {
    1: [100],
    2: [65, 35],
    3: [50, 30, 20],
    4: [40, 30, 20, 10],
    5: [35, 25, 18, 13, 9],
    6: [30, 23, 18, 13, 9, 7],
    7: [28, 22, 17, 13, 9, 6, 5],
    8: [25, 20, 16, 13, 10, 7, 5, 4],
  };

  const scale = scales[Math.max(1, Math.min(8, Number(answerCount) || 1))] || scales[8];
  return Number(scale[index] ?? 0);
}

function normalizeBffRankedAnswers(rawAnswers = []) {
  const answers = Array.isArray(rawAnswers) ? rawAnswers.slice(0, 8) : [];

  return answers.map((answer, index) => ({
    ...answer,
    text: String(answer?.text || answer?.answer || ''),
    points: bffRankPoints(answers.length, index),
    revealed: false,
  }));
}

async function pickBffSurvey(gameState = {}) {
  const used = Array.isArray(gameState.used_survey_ids)
    ? gameState.used_survey_ids.map((id) => Number(id)).filter(Number.isFinite)
    : [];

  let query = `
    select id, question, answers
    from public.bff_surveys
    where active = true
      and not (id = any($1::bigint[]))
    order by random()
    limit 1
  `;
  let params = [used];

  let { rows } = await bffPool.query(query, params);

  if (!rows.length) {
    const reset = await bffPool.query(`
      select id, question, answers
      from public.bff_surveys
      where active = true
      order by random()
      limit 1
    `);
    rows = reset.rows;
  }

  const survey = rows[0] || null;
  if (!survey) return null;

  const answers = Array.isArray(survey.answers)
    ? survey.answers
    : [];

  return {
    id: Number(survey.id),
    question: String(survey.question || ''),
    answers: normalizeBffRankedAnswers(answers),
  };
}

async function applyBffHostAction(room, body = {}) {
  const action = String(body.action || '').trim();
  const current = extractBffGameState(room.display_state || {});

  if (action === 'undo_last_action') {
    if (!current._hostUndo) return current;
    const restored = JSON.parse(JSON.stringify(current._hostUndo));
    restored._hostUndo = bffUndoSnapshot(current);
    return restored;
  }

  const next = {
    ...current,
    _hostUndo: bffUndoSnapshot(current),
  };

  if (action === 'set_family_names') {
    next.family1 = String(body.family1 || '').trim() || next.family1 || 'Family 1';
    next.family2 = String(body.family2 || '').trim() || next.family2 || 'Family 2';
    return next;
  }

  if (action === 'assign_player') {
    const playerId = String(body.playerId || '');
    const team = body.team == null ? null : Number(body.team);
    const map = { ...(next.playerTeams || {}) };
    if (!playerId) return next;
    if (team === 1 || team === 2) map[playerId] = team;
    else map[playerId] = 0;
    next.playerTeams = map;
    return next;
  }

  if (action === 'start_round') {
    const survey = await pickBffSurvey(next);
    if (!survey) {
      throw new Error('No active BFF surveys are available.');
    }

    const previousUsed = Array.isArray(next.used_survey_ids)
      ? next.used_survey_ids.map((id) => Number(id)).filter(Number.isFinite)
      : [];

    next.phase = 'playing';
    next.round_number = Math.max(1, Number(next.round_number || next.roundNumber || 1));
    next.round_bank = 0;
    next.bye_count = 0;
    next.steal_mode = false;
    next.buzzer_open = true;
    next.buzzer_phase = 'buzzer_active';
    next.buzz_winner = null;
    next.current_survey_id = survey.id;
    next.used_survey_ids = previousUsed.includes(survey.id)
      ? [survey.id]
      : [...previousUsed, survey.id];
    next.current_question = survey.question;
    next.answers = survey.answers;
    next.answer_count = survey.answers.length;
    next.sound_cue = { name: 'round_start', at: Date.now() };
    return next;
  }

  if (action === 'reset_round') {
    next.phase = 'playing';
    next.round_bank = 0;
    next.bye_count = 0;
    next.steal_mode = false;
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';
    next.buzz_winner = null;
    next.answers = normalizeBffRankedAnswers(getBffAnswers(next));
    next.answer_count = next.answers.length;
    next.sound_cue = null;
    return next;
  }

  if (action === 'next_question') {
    next.phase = 'waiting';
    next.round_number = Math.max(1, Number(next.round_number || next.roundNumber || 1) + 1);
    next.round_bank = 0;
    next.bye_count = 0;
    next.steal_mode = false;
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';
    next.buzz_winner = null;
    next.current_question = '';
    next.answers = [];
    next.answer_count = 0;
    next.current_survey_id = null;
    return next;
  }

  if (action === 'reveal_answer' || action === 'hide_answer') {
    const index = Math.max(0, Number(body.index) || 0);
    const answers = ensureBffAnswerSlot(getBffAnswers(next), index);
    const answer = answers[index];
    const reveal = action === 'reveal_answer';
    const wasRevealed = Boolean(answer.revealed);

    answers[index] = {
      ...answer,
      revealed: reveal,
    };
    next.answers = answers;

    if (reveal && !wasRevealed) {
      next.round_bank = Math.max(0, Number(next.round_bank || 0) + Number(answer.points || 0));
      next.sound_cue = { name: 'correct_applause', at: Date.now() };
    }
    if (!reveal && wasRevealed) {
      next.round_bank = Math.max(0, Number(next.round_bank || 0) - Number(answer.points || 0));
    }
    return next;
  }

  if (action === 'add_points') {
    const amount = Number(body.amount) || 0;
    next.round_bank = Math.max(0, Number(next.round_bank || 0) + amount);
    return next;
  }

  if (action === 'add_bye') {
    next.bye_count = Math.min(3, Number(next.bye_count || 0) + 1);
    next.sound_cue = { name: 'wrong_awww', at: Date.now() };
    return next;
  }

  if (action === 'undo_bye') {
    next.bye_count = Math.max(0, Number(next.bye_count || 0) - 1);
    return next;
  }

  if (action === 'set_control_team') {
    const team = Number(body.team) === 2 ? 2 : 1;
    next.control_team = team;
    next.active_turn = team;
    return next;
  }

  if (action === 'toggle_steal') {
    next.steal_mode = !Boolean(next.steal_mode);
    return next;
  }

  if (action === 'award_bank') {
    const team = Number(body.team) === 2 ? 2 : 1;
    const bank = Math.max(0, Number(next.round_bank || 0));
    const scoreKey = team === 2 ? 'score2' : 'score1';
    next[scoreKey] = Math.max(0, Number(next[scoreKey] || 0) + bank);
    next.round_bank = 0;
    next.phase = 'round_over';
    return next;
  }

  if (action === 'open_buzzers') {
    next.buzzer_open = true;
    next.buzzer_phase = 'buzzer_active';
    next.buzz_winner = null;
    return next;
  }

  if (action === 'hide_buzzers') {
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';
    return next;
  }

  if (action === 'reset_buzzers') {
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';
    next.buzz_winner = null;
    return next;
  }

  if (action === 'voice_answer') {
    const playerId = String(body.playerId || '');
    const sdp = String(body.sdp || '');
    if (!playerId || !sdp) return next;

    next.voice_answers = {
      ...(next.voice_answers || {}),
      [playerId]: {
        sdp,
        at: Date.now(),
      },
    };
    return next;
  }

  if (action === 'sound') {
    next.sound_cue = {
      name: String(body.name || 'correct'),
      at: Date.now(),
    };
    return next;
  }

  return next;
}


async function verifyBffPlayerWithTngApi(req, deviceId, roomCode) {
  const auth = String(req.headers.authorization || '');
  if (!auth) {
    return {
      ok: false,
      status: 401,
      payload: { error: { code: 'AUTH_REQUIRED', message: 'Sign in again.' } },
    };
  }

  const response = await fetch(`${TNG_API_ORIGIN}/player/room`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: auth,
      'X-TNG-Device-Id': deviceId,
      'X-TNG-Room-Code': roomCode,
    },
  });

  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

async function loadRailwayBffPlayerRoom(roomCode) {
  const { rows } = await bffPool.query(`
    select gr.id, gr.room_code, gr.game_id, gr.status, gr.revision, gr.display_state,
           gr.created_at, gr.updated_at
    from public.game_rooms gr
    where upper(gr.room_code) = upper($1)
      and gr.game_id = 'bff'
      and gr.status in ('lobby','live','paused')
    order by gr.updated_at desc
    limit 1
  `, [roomCode]);

  return rows[0] || null;
}

function sanitizeBffPlayerState(gameState = {}, players = [], participant = null) {
  const answers = getBffAnswers(gameState);
  const answerCount = Math.max(
    answers.length,
    Number(gameState.answer_count || gameState.answerCount || 0),
  );

  const safeAnswers = Array.from({ length: answerCount }, (_, index) => {
    const answer = answers[index] || {};
    const revealed = Boolean(answer.revealed);
    return {
      index,
      revealed,
      points: revealed ? Number(answer.points) || 0 : 0,
      ...(revealed
        ? { text: String(answer.text || answer.answer || '') }
        : {}),
    };
  });

  return {
    phase: gameState.phase || 'waiting',
    family1: gameState.family1 || 'Family 1',
    family2: gameState.family2 || 'Family 2',
    score1: Number(gameState.score1) || 0,
    score2: Number(gameState.score2) || 0,
    round_number: Number(gameState.round_number || gameState.roundNumber || 1),
    round_bank: Number(gameState.round_bank || gameState.roundBank || 0),
    current_question:
      gameState.current_question ||
      gameState.currentQuestion ||
      gameState.question ||
      '',
    control_team: Number(gameState.control_team || gameState.active_turn || 1),
    active_turn: Number(gameState.active_turn || gameState.control_team || 1),
    steal_mode: Boolean(gameState.steal_mode),
    bye_count: Math.max(0, Math.min(3, Number(gameState.bye_count) || 0)),
    buzzer_phase: gameState.buzzer_phase || null,
    buzzer_open: Boolean(gameState.buzzer_open || gameState.buzzer_phase === 'buzzer_active'),
    buzz_winner: gameState.buzz_winner || null,
    playerTeams: gameState.playerTeams || {},
    sound_cue: gameState.sound_cue || null,
    voice_answer: participant
      ? (gameState.voice_answers || {})[participant.accountId || participant.playerId] || null
      : null,
    answers: safeAnswers,
    players,
  };
}

async function claimBffBuzz(room, participant) {
  const client = await bffPool.connect();

  try {
    await client.query('begin');

    const locked = await client.query(`
      select id, room_code, game_id, status, revision, display_state, created_at, updated_at
      from public.game_rooms
      where id = $1::uuid
      for update
    `, [room.id]);

    const lockedRoom = locked.rows[0];
    if (!lockedRoom) {
      await client.query('rollback');
      return { gameState: extractBffGameState(room.display_state || {}), room };
    }

    const current = extractBffGameState(lockedRoom.display_state || {});

    if (
      !(current.buzzer_open || current.buzzer_phase === 'buzzer_active')
      || current.buzz_winner
    ) {
      await client.query('commit');
      return { gameState: current, room: lockedRoom };
    }

    const teamMap = current.playerTeams || {};
    const familyTeam =
      Number(teamMap[participant.accountId] || participant.familyTeam || 0) || null;

    const nextGameState = {
      ...current,
      buzzer_open: false,
      buzzer_phase: 'buzzed',
      control_team: familyTeam || current.control_team || 1,
      active_turn: familyTeam || current.active_turn || 1,
      sound_cue: { name: 'buzz', at: Date.now() },
      buzz_winner: {
        playerId: participant.accountId,
        playerName: participant.playerName || participant.name || 'Player',
        seatNumber: participant.seatNumber,
        familyTeam,
        teamName:
          familyTeam === 2
            ? (current.family2 || 'Family 2')
            : (current.family1 || 'Family 1'),
        timestamp: Date.now(),
      },
    };

    const nextDisplayState = wrapBffGameState(
      lockedRoom.display_state || {},
      nextGameState,
    );

    const updated = await client.query(`
      update public.game_rooms
      set display_state = $2::jsonb,
          revision = revision + 1,
          updated_at = now()
      where id = $1::uuid
      returning id, room_code, game_id, status, revision, display_state, created_at, updated_at
    `, [room.id, JSON.stringify(nextDisplayState)]);

    await client.query('commit');

    return {
      gameState: nextGameState,
      room: updated.rows[0] || lockedRoom,
    };
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function applyBffPlayerAction(room, participant, body = {}) {
  const action = String(body.action || '').trim();
  const current = extractBffGameState(room.display_state || {});

  if (action === 'buzz') {
    if (!(current.buzzer_open || current.buzzer_phase === 'buzzer_active')) {
      return current;
    }

    if (current.buzz_winner) {
      return current;
    }

    const teamMap = current.playerTeams || {};
    const familyTeam = Number(teamMap[participant.accountId] || participant.familyTeam || 0) || null;

    return {
      ...current,
      buzzer_open: false,
      buzzer_phase: 'buzzed',
      control_team: familyTeam || current.control_team || 1,
      active_turn: familyTeam || current.active_turn || 1,
      sound_cue: { name: 'buzz', at: Date.now() },
      buzz_winner: {
        playerId: participant.accountId,
        playerName: participant.playerName || participant.name || 'Player',
        seatNumber: participant.seatNumber,
        familyTeam,
        teamName:
          familyTeam === 2
            ? (current.family2 || 'Family 2')
            : (current.family1 || 'Family 1'),
        timestamp: Date.now(),
      },
    };
  }

  if (action === 'voice_offer') {
    const sdp = String(body.sdp || '');
    const playerId = String(participant.accountId || participant.playerId || '');
    if (!sdp || !playerId) return current;

    return {
      ...current,
      voice_offers: {
        ...(current.voice_offers || {}),
        [playerId]: {
          sdp,
          playerId,
          playerName: participant.playerName || participant.name || 'Player',
          at: Date.now(),
        },
      },
    };
  }

  if (action === 'voice_stop') {
    const playerId = String(participant.accountId || participant.playerId || '');
    const offers = { ...(current.voice_offers || {}) };
    const answers = { ...(current.voice_answers || {}) };
    delete offers[playerId];
    delete answers[playerId];

    return {
      ...current,
      voice_offers: offers,
      voice_answers: answers,
    };
  }

  return current;
}

async function handleBffApi(req, res) {
  const sourceUrl = new URL(req.url || '/', 'http://localhost');
  const path = sourceUrl.pathname.replace(/^\/bff-api/, '') || '/';

  if (req.method === 'GET' && path === '/health') {
    sendJson(res, 200, { ok: true, service: 'railway-bff-api' });
    return;
  }

  if (req.method === 'GET' && path === '/player') {
    const deviceId = String(req.headers['x-tng-device-id'] || '');
    const roomCode = String(req.headers['x-tng-room-code'] || '').toUpperCase();

    if (!deviceId || !roomCode) {
      sendJson(res, 400, {
        error: {
          code: 'PLAYER_ROOM_REQUIRED',
          message: 'Player device and room code are required.',
        },
      });
      return;
    }

    const verified = await verifyBffPlayerWithTngApi(req, deviceId, roomCode);
    if (!verified.ok) {
      sendJson(res, verified.status || 401, verified.payload || {
        error: { code: 'PLAYER_SESSION_INVALID', message: 'Rejoin this BFF room.' },
      });
      return;
    }

    const room = await loadRailwayBffPlayerRoom(roomCode);
    if (!room) {
      sendJson(res, 404, {
        error: { code: 'ROOM_NOT_FOUND', message: 'This BFF room is no longer active.' },
      });
      return;
    }

    let internalState = extractBffGameState(room.display_state || {});
    let players = await loadBffParticipants(room.id, internalState);

    const assignmentResult = await ensureBffTeamAssignments(room, internalState, players);
    internalState = assignmentResult.gameState;
    const effectiveRoom = assignmentResult.room || room;
    players = await loadBffParticipants(room.id, internalState);

    const verifiedParticipant = verified.payload?.participant || null;
    const participant = players.find((player) =>
      String(player.deviceSessionId || '') === String(deviceId)
      || String(player.accountId || '') === String(verifiedParticipant?.accountId || '')
    ) || verifiedParticipant;

    if (!participant) {
      sendJson(res, 404, {
        error: { code: 'PLAYER_NOT_IN_ROOM', message: 'Rejoin this BFF room.' },
      });
      return;
    }

    const gameState = sanitizeBffPlayerState(internalState, players, participant);

    sendJson(res, 200, {
      room: {
        id: effectiveRoom.id || room.id,
        roomCode: effectiveRoom.room_code || room.room_code,
        gameId: effectiveRoom.game_id || room.game_id,
        status: effectiveRoom.status || room.status,
        revision: effectiveRoom.revision || room.revision,
        gameState,
        createdAt: effectiveRoom.created_at || room.created_at,
        updatedAt: effectiveRoom.updated_at || room.updated_at,
      },
      participant,
    });
    return;
  }

  if (req.method === 'POST' && path === '/player') {
    const deviceId = String(req.headers['x-tng-device-id'] || '');
    const roomCode = String(req.headers['x-tng-room-code'] || '').toUpperCase();

    if (!deviceId || !roomCode) {
      sendJson(res, 400, {
        error: {
          code: 'PLAYER_ROOM_REQUIRED',
          message: 'Player device and room code are required.',
        },
      });
      return;
    }

    const verified = await verifyBffPlayerWithTngApi(req, deviceId, roomCode);
    if (!verified.ok) {
      sendJson(res, verified.status || 401, verified.payload || {
        error: { code: 'PLAYER_SESSION_INVALID', message: 'Rejoin this BFF room.' },
      });
      return;
    }

    const room = await loadRailwayBffPlayerRoom(roomCode);
    if (!room) {
      sendJson(res, 404, {
        error: { code: 'ROOM_NOT_FOUND', message: 'This BFF room is no longer active.' },
      });
      return;
    }

    let internalState = extractBffGameState(room.display_state || {});
    let players = await loadBffParticipants(room.id, internalState);
    const verifiedParticipant = verified.payload?.participant || null;
    const participant = players.find((player) =>
      String(player.deviceSessionId || '') === String(deviceId)
      || String(player.accountId || '') === String(verifiedParticipant?.accountId || '')
    ) || verifiedParticipant;

    if (!participant) {
      sendJson(res, 404, {
        error: { code: 'PLAYER_NOT_IN_ROOM', message: 'Rejoin this BFF room.' },
      });
      return;
    }

    const body = await readJsonBody(req).catch(() => ({}));

    let nextGameState;
    let savedRoom;

    if (String(body?.action || '') === 'buzz') {
      const claim = await claimBffBuzz(room, participant);
      nextGameState = claim.gameState;
      savedRoom = claim.room;
    } else {
      nextGameState = await applyBffPlayerAction(room, participant, body || {});
      savedRoom = await saveBffGameState(
        room.id,
        room.display_state || {},
        nextGameState,
      );
    }

    players = await loadBffParticipants(room.id, nextGameState);
    const gameState = sanitizeBffPlayerState(nextGameState, players, participant);

    sendJson(res, 200, {
      room: {
        id: savedRoom?.id || room.id,
        roomCode: savedRoom?.room_code || room.room_code,
        gameId: savedRoom?.game_id || room.game_id,
        status: savedRoom?.status || room.status,
        revision: savedRoom?.revision || room.revision,
        gameState,
        createdAt: savedRoom?.created_at || room.created_at,
        updatedAt: savedRoom?.updated_at || room.updated_at,
      },
      participant,
    });
    return;
  }

  if (req.method === 'GET' && path === '/host') {
    const controllerId = String(req.headers['x-tng-device-id'] || '');
    if (!controllerId) {
      sendJson(res, 400, { error: { code: 'CONTROLLER_REQUIRED', message: 'Host controller is missing.' } });
      return;
    }

    const verified = await verifyBffHostWithTngApi(req, controllerId);
    if (!verified.ok) {
      sendJson(res, verified.status || 401, verified.payload || {
        error: { code: 'AUTH_REQUIRED', message: 'Sign in again.' },
      });
      return;
    }

    const room = await loadRailwayBffHostRoom(controllerId);
    if (!room) {
      sendJson(res, 404, {
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'No active BFF room is attached to this Host Controller.',
        },
      });
      return;
    }

    await assignBffSeats(room.id);
    let internalState = extractBffGameState(room.display_state || {});
    let players = await loadBffParticipants(room.id, internalState);

    const assignmentResult = await ensureBffTeamAssignments(room, internalState, players);
    internalState = assignmentResult.gameState;
    const effectiveRoom = assignmentResult.room || room;
    players = await loadBffParticipants(room.id, internalState);

    const gameState = sanitizeBffHostState(internalState, players);

    sendJson(res, 200, {
      room: {
        id: effectiveRoom.id || room.id,
        roomCode: effectiveRoom.room_code || room.room_code,
        gameId: effectiveRoom.game_id || room.game_id,
        status: effectiveRoom.status || room.status,
        revision: effectiveRoom.revision || room.revision,
        gameState,
        players,
        createdAt: effectiveRoom.created_at || room.created_at,
        updatedAt: effectiveRoom.updated_at || room.updated_at,
      },
    });
    return;
  }

  if (req.method === 'POST' && path === '/host') {
    const controllerId = String(req.headers['x-tng-device-id'] || '');
    if (!controllerId) {
      sendJson(res, 400, { error: { code: 'CONTROLLER_REQUIRED', message: 'Host controller is missing.' } });
      return;
    }

    const verified = await verifyBffHostWithTngApi(req, controllerId);
    if (!verified.ok) {
      sendJson(res, verified.status || 401, verified.payload || {
        error: { code: 'AUTH_REQUIRED', message: 'Sign in again.' },
      });
      return;
    }

    const room = await loadRailwayBffHostRoom(controllerId);
    if (!room) {
      sendJson(res, 404, {
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'No active BFF room is attached to this Host Controller.',
        },
      });
      return;
    }

    const body = await readJsonBody(req).catch(() => ({}));
    const nextGameState = await applyBffHostAction(room, body || {});
    const savedRoom = await saveBffGameState(room.id, room.display_state || {}, nextGameState);
    await assignBffSeats(room.id);
    const players = await loadBffParticipants(room.id, nextGameState);
    const gameState = sanitizeBffHostState(nextGameState, players);

    sendJson(res, 200, {
      room: {
        id: savedRoom?.id || room.id,
        roomCode: savedRoom?.room_code || room.room_code,
        gameId: savedRoom?.game_id || room.game_id,
        status: savedRoom?.status || room.status,
        revision: savedRoom?.revision || room.revision,
        gameState,
        players,
        createdAt: savedRoom?.created_at || room.created_at,
        updatedAt: savedRoom?.updated_at || room.updated_at,
      },
    });
    return;
  }

  sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'BFF route not found.' } });
}

const server = http.createServer(async (req, res) => {
  try {
    if ((req.url || '').startsWith('/tng-api')) {
      await proxyTngApi(req, res);
      return;
    }

    if ((req.url || '').startsWith('/bff-api')) {
      await handleBffApi(req, res);
      return;
    }

    const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const safePath = normalize(rawPath).replace(/^([.][.][/\\])+/, '');
    let filePath = join(root, safePath === '/' ? 'index.html' : safePath);

    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = join(filePath, 'index.html');
      await sendFile(res, filePath);
      return;
    } catch {}

    // React Router SPA fallback for /host, /join/:roomCode, /games/*, etc.
    await sendFile(res, join(root, 'index.html'));
  } catch (error) {
    console.error('[TNG temp host] request failed', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('TNG staging host error');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`TNG staging frontend listening on port ${port}`);

});
