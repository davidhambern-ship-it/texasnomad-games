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
    family_names_set: bffFamilyNamesReady(gameState),
    mics_ready: bffMicsReady(players, gameState),
    round_stage: gameState.round_stage || 'setup',
    faceoff_players: gameState.faceoff_players || {},
    faceoff_results: gameState.faceoff_results || {},
    faceoff_attempted: gameState.faceoff_attempted || { 1: [], 2: [] },
    faceoff_winner_id: gameState.faceoff_winner_id || null,
    faceoff_winner_team: Number(gameState.faceoff_winner_team) || null,
    faceoff_x_event: gameState.faceoff_x_event || null,
    play_pass_choice: gameState.play_pass_choice || null,
    active_player_id: gameState.active_player_id || null,
    answer_deadline_at: Number(gameState.answer_deadline_at) || null,
    consecutive_timeouts: Number(gameState.consecutive_timeouts) || 0,
    original_playing_team: Number(gameState.original_playing_team) || null,
    steal_team: Number(gameState.steal_team) || null,
    match_complete: Boolean(gameState.match_complete),
    match_tied: Boolean(gameState.match_tied),
    winning_team: Number(gameState.winning_team) || null,
    is_tiebreak: Boolean(gameState.is_tiebreak),
    dysfunction: gameState.dysfunction || null,
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


function bffFamilyNamesReady(gameState = {}) {
  const family1 = String(gameState.family1 || '').trim();
  const family2 = String(gameState.family2 || '').trim();

  return Boolean(
    family1 &&
    family2 &&
    family1.toLowerCase() !== 'family 1' &&
    family2.toLowerCase() !== 'family 2'
  );
}

function bffTeamForPlayer(gameState = {}, playerId) {
  return Number((gameState.playerTeams || {})[String(playerId)] || 0) || null;
}

function bffTeamRoster(players = [], gameState = {}, team) {
  return players
    .filter((player) => bffTeamForPlayer(gameState, player.playerId) === Number(team))
    .slice()
    .sort((a, b) =>
      Number(a.seatNumber || 999) - Number(b.seatNumber || 999)
      || Number(a.joinedAt || 0) - Number(b.joinedAt || 0)
    );
}

function bffNextPlayerId(players = [], gameState = {}, team, currentPlayerId) {
  const roster = bffTeamRoster(players, gameState, team);
  if (!roster.length) return null;

  const currentIndex = roster.findIndex(
    (player) => String(player.playerId) === String(currentPlayerId || ''),
  );

  if (currentIndex < 0) return roster[0].playerId;
  return roster[(currentIndex + 1) % roster.length]?.playerId || roster[0].playerId;
}

function bffAssignedPlayers(players = [], gameState = {}) {
  return players.filter((player) => [1, 2].includes(bffTeamForPlayer(gameState, player.playerId)));
}

function bffMicsReady(players = [], gameState = {}) {
  const assigned = bffAssignedPlayers(players, gameState);
  if (!assigned.length) return false;

  const hasTeam1 = assigned.some((player) => bffTeamForPlayer(gameState, player.playerId) === 1);
  const hasTeam2 = assigned.some((player) => bffTeamForPlayer(gameState, player.playerId) === 2);
  if (!hasTeam1 || !hasTeam2) return false;

  const offers = gameState.voice_offers || {};
  return assigned.every((player) => Boolean(offers[String(player.playerId)]?.sdp));
}

function bffFaceoffAttempted(gameState = {}, team) {
  const attempted = gameState.faceoff_attempted || {};
  return Array.isArray(attempted[String(team)])
    ? attempted[String(team)].map(String)
    : [];
}

function bffMarkFaceoffAttempt(gameState, playerId) {
  const team = bffTeamForPlayer(gameState, playerId);
  if (!team) return;

  const attempted = {
    ...(gameState.faceoff_attempted || {}),
    [String(team)]: bffFaceoffAttempted(gameState, team),
  };
  const id = String(playerId);
  if (!attempted[String(team)].includes(id)) attempted[String(team)].push(id);
  gameState.faceoff_attempted = attempted;
}

function bffNextUnattemptedPlayer(players, gameState, team, currentPlayerId) {
  const roster = bffTeamRoster(players, gameState, team);
  if (!roster.length) return null;

  const attempted = new Set(bffFaceoffAttempted(gameState, team));
  const currentIndex = Math.max(
    0,
    roster.findIndex((player) => String(player.playerId) === String(currentPlayerId || '')),
  );

  for (let offset = 1; offset <= roster.length; offset += 1) {
    const player = roster[(currentIndex + offset) % roster.length];
    if (player && !attempted.has(String(player.playerId))) return player.playerId;
  }

  return null;
}

function bffStartFamilyTurn(gameState, playerId) {
  gameState.active_player_id = playerId || null;
  gameState.answer_deadline_at = playerId ? Date.now() + 20000 : null;
  gameState.buzzer_open = false;
  gameState.buzzer_phase = 'board_shown';
  gameState.round_stage = playerId ? 'family_play' : gameState.round_stage;
}

function bffEnterSteal(gameState) {
  const originalTeam = Number(gameState.control_team || gameState.active_turn || 1) === 2 ? 2 : 1;
  const stealTeam = originalTeam === 1 ? 2 : 1;

  gameState.original_playing_team = originalTeam;
  gameState.steal_team = stealTeam;
  gameState.steal_mode = true;
  gameState.consecutive_timeouts = 0;
  gameState.round_stage = 'steal_ready';
  gameState.active_player_id = null;
  gameState.answer_deadline_at = null;
  gameState.buzzer_open = false;
  gameState.buzzer_phase = 'board_shown';
  gameState.buzz_winner = null;
}

function bffApplyMatchCompletion(gameState) {
  if (Number(gameState.round_number || 1) < 5) return;

  const score1 = Number(gameState.score1 || 0);
  const score2 = Number(gameState.score2 || 0);

  gameState.match_complete = score1 !== score2;
  gameState.match_tied = score1 === score2;
  gameState.winning_team = score1 > score2 ? 1 : score2 > score1 ? 2 : null;
  gameState.round_stage = score1 === score2 ? 'match_tie' : 'match_complete';
}

function bffCompleteRound(gameState, awardedTeam = null) {
  const bank = Math.max(0, Number(gameState.round_bank || 0));

  if ([1, 2].includes(Number(awardedTeam))) {
    const scoreKey = Number(awardedTeam) === 2 ? 'score2' : 'score1';
    gameState[scoreKey] = Math.max(0, Number(gameState[scoreKey] || 0) + bank);
  }

  gameState.round_bank = 0;
  gameState.phase = 'round_over';
  gameState.round_stage = 'round_complete';
  gameState.active_player_id = null;
  gameState.answer_deadline_at = null;
  gameState.buzzer_open = false;
  gameState.buzzer_phase = 'board_shown';
  gameState.buzz_winner = null;
  gameState.steal_mode = false;
  gameState.consecutive_timeouts = 0;
  gameState.original_playing_team = null;
  gameState.steal_team = null;

  bffApplyMatchCompletion(gameState);
}

function bffFamilyTimeout(gameState, players) {
  if (gameState.round_stage !== 'family_play' || !gameState.active_player_id) return;

  const team = bffTeamForPlayer(gameState, gameState.active_player_id) || gameState.control_team;
  let streak = Number(gameState.consecutive_timeouts || 0) + 1;

  if (streak >= 2) {
    gameState.bye_count = Math.min(3, Number(gameState.bye_count || 0) + 1);
    gameState.sound_cue = { name: 'wrong_awww', at: Date.now() };
    streak = 0;
  }

  gameState.consecutive_timeouts = streak;

  if (Number(gameState.bye_count || 0) >= 3) {
    bffEnterSteal(gameState);
    return;
  }

  const nextPlayer = bffNextPlayerId(
    players,
    gameState,
    team,
    gameState.active_player_id,
  );
  bffStartFamilyTurn(gameState, nextPlayer);
}

function bffFaceoffPlayerIds(gameState = {}) {
  const pair = gameState.faceoff_players || {};
  return [pair['1'] || pair[1] || null, pair['2'] || pair[2] || null].filter(Boolean);
}

function bffOtherFaceoffPlayerId(gameState = {}, playerId) {
  return bffFaceoffPlayerIds(gameState).find(
    (id) => String(id) !== String(playerId || ''),
  ) || null;
}

function bffStartAnswerClock(gameState, playerId) {
  gameState.active_player_id = playerId || null;
  gameState.answer_deadline_at = playerId ? Date.now() + 15000 : null;
  gameState.buzzer_open = false;
  gameState.buzzer_phase = playerId ? 'answering' : 'board_shown';
  gameState.round_stage = playerId ? 'faceoff_answer' : gameState.round_stage;
}

function bffResolveFaceoffControl(gameState, players, winnerPlayerId) {
  const team = bffTeamForPlayer(gameState, winnerPlayerId);
  if (!team) return;

  gameState.control_team = team;
  gameState.active_turn = team;
  gameState.faceoff_winner_id = winnerPlayerId;
  gameState.faceoff_winner_team = team;
  gameState.steal_mode = false;
  gameState.buzzer_open = false;
  gameState.buzzer_phase = 'board_shown';
  gameState.answer_deadline_at = null;
  gameState.active_player_id = winnerPlayerId;

  if (gameState.is_tiebreak) {
    gameState.match_complete = true;
    gameState.match_tied = false;
    gameState.winning_team = team;
    gameState.phase = 'round_over';
    gameState.round_stage = 'match_complete';
    gameState.active_player_id = null;
    return;
  }

  gameState.round_stage = 'play_pass';
}

function bffFaceoffResults(gameState = {}) {
  return { ...(gameState.faceoff_results || {}) };
}

function bffChooseBestFaceoffResult(gameState) {
  const results = bffFaceoffResults(gameState);
  const pair = bffFaceoffPlayerIds(gameState);

  return pair
    .map((id) => ({ id, result: results[String(id)] }))
    .filter((entry) => entry.result && !entry.result.wrong)
    .sort((a, b) =>
      Number(b.result.points || 0) - Number(a.result.points || 0)
      || Number(a.result.answerIndex ?? 99) - Number(b.result.answerIndex ?? 99)
    )[0]?.id || null;
}

function bffFaceoffNoWinner(gameState) {
  gameState.score1 = Number(gameState.score1 || 0) - 5;
  gameState.score2 = Number(gameState.score2 || 0) - 5;
  gameState.round_bank = 0;
  gameState.sound_cue = { name: 'wrong_awww', at: Date.now() };
  bffCompleteRound(gameState, null);
}

function bffAdvanceFaceoffPair(gameState, players) {
  const pair = gameState.faceoff_players || {};
  const current1 = pair['1'] || pair[1] || null;
  const current2 = pair['2'] || pair[2] || null;
  const next1 = bffNextUnattemptedPlayer(players, gameState, 1, current1);
  const next2 = bffNextUnattemptedPlayer(players, gameState, 2, current2);

  gameState.faceoff_results = {};
  gameState.buzz_winner = null;
  gameState.faceoff_x_event = null;
  gameState.buzzer_open = false;
  gameState.buzzer_phase = 'board_shown';
  gameState.active_player_id = null;
  gameState.answer_deadline_at = null;

  if (!next1 && !next2) {
    bffFaceoffNoWinner(gameState);
    return;
  }

  gameState.faceoff_players = {
    1: next1 || current1,
    2: next2 || current2,
  };

  if (next1 && next2) {
    gameState.round_stage = 'faceoff_ready';
    gameState.active_player_id = null;
    gameState.answer_deadline_at = null;
    return;
  }

  bffStartAnswerClock(gameState, next1 || next2);
}

function bffResolveFaceoffAfterAttempt(gameState, players, playerId) {
  const results = bffFaceoffResults(gameState);
  const thisResult = results[String(playerId)] || null;
  const otherPlayerId = bffOtherFaceoffPlayerId(gameState, playerId);
  const otherResult = otherPlayerId ? results[String(otherPlayerId)] : null;

  if (thisResult && !thisResult.wrong && Number(thisResult.answerIndex) === 0) {
    bffResolveFaceoffControl(gameState, players, playerId);
    return;
  }

  if (otherPlayerId && !otherResult) {
    bffStartAnswerClock(gameState, otherPlayerId);
    return;
  }

  const winner = bffChooseBestFaceoffResult(gameState);
  if (winner) {
    bffResolveFaceoffControl(gameState, players, winner);
    return;
  }

  bffAdvanceFaceoffPair(gameState, players);
}

function bffAdvanceFaceoffAfterMiss(gameState, players, playerId, { showX = false } = {}) {
  const results = bffFaceoffResults(gameState);
  results[String(playerId)] = {
    ...(results[String(playerId)] || {}),
    wrong: true,
    at: Date.now(),
  };
  gameState.faceoff_results = results;
  bffMarkFaceoffAttempt(gameState, playerId);

  if (showX) {
    gameState.faceoff_x_event = {
      playerId,
      at: Date.now(),
    };
    gameState.sound_cue = {
      name: 'faceoff_wrong',
      at: Date.now(),
    };
  }

  bffResolveFaceoffAfterAttempt(gameState, players, playerId);
}


async function pickBffDysfunctionPrompt(usedIds = []) {
  const used = Array.isArray(usedIds)
    ? usedIds.map((id) => Number(id)).filter(Number.isFinite)
    : [];

  let result = await bffPool.query(
    'select id, prompt from public.bff_dysfunction_prompts where active = true and not (id = any($1::bigint[])) order by random() limit 1',
    [used],
  );

  if (!result.rows.length) {
    result = await bffPool.query(
      'select id, prompt from public.bff_dysfunction_prompts where active = true order by random() limit 1',
    );
  }

  const prompt = result.rows[0] || null;
  return prompt
    ? { id: Number(prompt.id), prompt: String(prompt.prompt || '') }
    : null;
}

function bffDysfunctionSideMembers(dysfunction = {}, side) {
  return Object.entries(dysfunction.side_assignments || {})
    .filter(([, value]) => value === side)
    .map(([playerId]) => playerId);
}

function bffDysfunctionPoints(voterIds, votes) {
  const targets = voterIds.map((id) => votes[String(id)]).filter(Boolean);
  if (!targets.length) return 0;

  const counts = new Map();
  targets.forEach((target) => counts.set(target, (counts.get(target) || 0) + 1));
  const max = Math.max(...counts.values());

  if (targets.length >= 3) {
    if (max === targets.length) return 3;
    if (max >= 2) return 2;
    return 0;
  }

  if (targets.length === 2) return max === 2 ? 3 : 0;
  return 1;
}

function bffDysfunctionUnanimous(voterIds, votes) {
  if (!voterIds.length) return false;
  const targets = voterIds.map((id) => votes[String(id)]).filter(Boolean);
  return targets.length === voterIds.length && new Set(targets).size === 1;
}

function bffDysfunctionDefensePlayer(votes = {}) {
  const counts = new Map();
  Object.values(votes).forEach((target) => {
    if (!target) return;
    counts.set(String(target), (counts.get(String(target)) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0]?.[0] || null;
}

async function bffLoadNextDysfunctionPrompt(gameState) {
  const dysfunction = { ...(gameState.dysfunction || {}) };
  const prompt = await pickBffDysfunctionPrompt(dysfunction.used_prompt_ids || []);
  if (!prompt) throw new Error('No Family Dysfunction prompts are available.');

  const used = Array.isArray(dysfunction.used_prompt_ids)
    ? dysfunction.used_prompt_ids.slice()
    : [];

  dysfunction.prompt_id = prompt.id;
  dysfunction.prompt = prompt.prompt;
  dysfunction.used_prompt_ids = used.includes(prompt.id) ? [prompt.id] : [...used, prompt.id];
  dysfunction.votes = {};
  dysfunction.votes_revealed = false;
  dysfunction.defense_player_id = null;

  gameState.dysfunction = dysfunction;
  gameState.round_stage = 'dysfunction_vote';
  gameState.active_player_id = null;
  gameState.answer_deadline_at = null;
}

async function bffAdvanceDysfunctionAfterDefense(gameState) {
  const dysfunction = { ...(gameState.dysfunction || {}) };

  if (Number(dysfunction.prompt_number || 1) >= 5) {
    const scoreA = Number(dysfunction.scoreA || 0);
    const scoreB = Number(dysfunction.scoreB || 0);

    if (scoreA !== scoreB) {
      dysfunction.completed = true;
      dysfunction.winner_side = scoreA > scoreB ? 'A' : 'B';
      gameState.dysfunction = dysfunction;
      gameState.round_stage = 'dysfunction_complete';
      gameState.phase = 'finale_complete';
      gameState.active_player_id = null;
      gameState.answer_deadline_at = null;
      return;
    }

    dysfunction.sudden_death = true;
  }

  dysfunction.prompt_number = Number(dysfunction.prompt_number || 1) + 1;
  gameState.dysfunction = dysfunction;
  await bffLoadNextDysfunctionPrompt(gameState);
}

async function applyBffHostAction(room, body = {}, players = []) {
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
    const family1 = String(body.family1 || '').trim();
    const family2 = String(body.family2 || '').trim();

    if (!family1 || !family2) {
      throw new Error('Both family names are required before the round can start.');
    }

    next.family1 = family1;
    next.family2 = family2;
    next.family_names_set = bffFamilyNamesReady(next);
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

  if (action === 'set_faceoff_player') {
    const team = Number(body.team);
    const playerId = String(body.playerId || '');

    if (![1, 2].includes(team) || !playerId) return next;
    if (bffTeamForPlayer(next, playerId) !== team) {
      throw new Error('That player is not assigned to this family.');
    }

    next.faceoff_players = {
      ...(next.faceoff_players || {}),
      [team]: playerId,
    };
    next.faceoff_attempted = { 1: [], 2: [] };
    next.faceoff_results = {};
    next.buzz_winner = null;
    next.active_player_id = null;
    next.answer_deadline_at = null;
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';

    if (next.current_question) next.round_stage = 'faceoff_ready';
    return next;
  }

  if (action === 'start_round') {
    if (!bffFamilyNamesReady(next)) {
      throw new Error('Enter both family names before starting the round.');
    }
    if (!bffMicsReady(players, next)) {
      throw new Error('Every assigned family player must turn their microphone on before Start Round.');
    }

    const survey = await pickBffSurvey(next);
    if (!survey) throw new Error('No active BFF surveys are available.');

    const previousUsed = Array.isArray(next.used_survey_ids)
      ? next.used_survey_ids.map((id) => Number(id)).filter(Number.isFinite)
      : [];

    next.phase = 'playing';
    next.is_tiebreak = false;
    next.family_names_set = true;
    next.round_stage = 'faceoff_setup';
    next.round_number = Math.max(1, Number(next.round_number || next.roundNumber || 1));
    next.round_bank = 0;
    next.bye_count = 0;
    next.consecutive_timeouts = 0;
    next.steal_mode = false;
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';
    next.buzz_winner = null;
    next.active_player_id = null;
    next.answer_deadline_at = null;
    next.faceoff_players = {};
    next.faceoff_results = {};
    next.faceoff_attempted = { 1: [], 2: [] };
    next.faceoff_x_event = null;
    next.faceoff_winner_id = null;
    next.faceoff_winner_team = null;
    next.play_pass_choice = null;
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
    next.is_tiebreak = false;
    next.round_stage = 'faceoff_setup';
    next.round_bank = 0;
    next.bye_count = 0;
    next.consecutive_timeouts = 0;
    next.steal_mode = false;
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';
    next.buzz_winner = null;
    next.active_player_id = null;
    next.answer_deadline_at = null;
    next.faceoff_results = {};
    next.faceoff_attempted = { 1: [], 2: [] };
    next.faceoff_x_event = null;
    next.faceoff_winner_id = null;
    next.faceoff_winner_team = null;
    next.play_pass_choice = null;
    next.answers = normalizeBffRankedAnswers(getBffAnswers(next));
    next.answer_count = next.answers.length;
    next.sound_cue = null;
    return next;
  }

  if (action === 'next_question') {
    if (Number(next.round_number || 1) >= 5) return next;

    next.phase = 'waiting';
    next.is_tiebreak = false;
    next.round_number = Math.max(1, Number(next.round_number || next.roundNumber || 1) + 1);
    next.round_bank = 0;
    next.bye_count = 0;
    next.consecutive_timeouts = 0;
    next.steal_mode = false;
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';
    next.buzz_winner = null;
    next.round_stage = 'setup';
    next.active_player_id = null;
    next.answer_deadline_at = null;
    next.faceoff_results = {};
    next.faceoff_attempted = { 1: [], 2: [] };
    next.faceoff_x_event = null;
    next.faceoff_winner_id = null;
    next.faceoff_winner_team = null;
    next.play_pass_choice = null;
    next.current_question = '';
    next.answers = [];
    next.answer_count = 0;
    next.current_survey_id = null;
    next.sound_cue = null;
    return next;
  }

  if (action === 'start_tiebreak') {
    if (next.round_stage !== 'match_tie') return next;

    const survey = await pickBffSurvey(next);
    if (!survey) throw new Error('No active BFF surveys are available.');

    next.is_tiebreak = true;
    next.phase = 'playing';
    next.round_stage = 'faceoff_setup';
    next.faceoff_players = {};
    next.faceoff_results = {};
    next.faceoff_attempted = { 1: [], 2: [] };
    next.faceoff_x_event = null;
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';
    next.buzz_winner = null;
    next.active_player_id = null;
    next.answer_deadline_at = null;
    next.current_question = survey.question;
    next.answers = survey.answers;
    next.answer_count = survey.answers.length;
    next.current_survey_id = survey.id;
    return next;
  }

  if (action === 'faceoff_timeout') {
    if (next.round_stage !== 'faceoff_answer' || !next.active_player_id) return next;
    bffAdvanceFaceoffAfterMiss(next, players, next.active_player_id, { showX: false });
    return next;
  }

  if (action === 'faceoff_wrong') {
    if (next.round_stage !== 'faceoff_answer' || !next.active_player_id) return next;
    bffAdvanceFaceoffAfterMiss(next, players, next.active_player_id, { showX: true });
    return next;
  }

  if (action === 'family_timeout') {
    bffFamilyTimeout(next, players);
    return next;
  }

  if (action === 'steal_miss') {
    if (next.round_stage !== 'steal_answer') return next;
    next.sound_cue = { name: 'wrong_awww', at: Date.now() };
    bffCompleteRound(next, Number(next.original_playing_team || 0));
    return next;
  }

  if (action === 'reveal_answer' || action === 'hide_answer') {
    const index = Math.max(0, Number(body.index) || 0);
    const answers = ensureBffAnswerSlot(getBffAnswers(next), index);
    const answer = answers[index];
    const reveal = action === 'reveal_answer';
    const wasRevealed = Boolean(answer.revealed);

    answers[index] = { ...answer, revealed: reveal };
    next.answers = answers;

    if (reveal && !wasRevealed) {
      next.round_bank = Math.max(0, Number(next.round_bank || 0) + Number(answer.points || 0));
      next.sound_cue = { name: 'correct_applause', at: Date.now() };

      if (next.round_stage === 'faceoff_answer' && next.active_player_id) {
        const playerId = String(next.active_player_id);
        const results = bffFaceoffResults(next);

        results[playerId] = {
          answerIndex: index,
          points: Number(answer.points || 0),
          wrong: false,
          at: Date.now(),
        };

        next.faceoff_results = results;
        bffMarkFaceoffAttempt(next, playerId);
        bffResolveFaceoffAfterAttempt(next, players, playerId);
      } else if (next.round_stage === 'family_play' && next.active_player_id) {
        const team = bffTeamForPlayer(next, next.active_player_id) || next.control_team;
        next.consecutive_timeouts = 0;
        const nextPlayer = bffNextPlayerId(players, next, team, next.active_player_id);
        bffStartFamilyTurn(next, nextPlayer);
      } else if (next.round_stage === 'steal_answer') {
        bffCompleteRound(next, Number(next.steal_team || 0));
      }
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
    if (next.round_stage !== 'family_play') return next;

    next.bye_count = Math.min(3, Number(next.bye_count || 0) + 1);
    next.consecutive_timeouts = 0;
    next.sound_cue = { name: 'wrong_awww', at: Date.now() };

    if (next.bye_count >= 3) {
      bffEnterSteal(next);
      return next;
    }

    const team = bffTeamForPlayer(next, next.active_player_id) || next.control_team;
    const nextPlayer = bffNextPlayerId(players, next, team, next.active_player_id);
    bffStartFamilyTurn(next, nextPlayer);
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
    if (!['family_play', 'steal_ready', 'steal_buzz', 'steal_answer', 'round_complete'].includes(next.round_stage)) {
      return next;
    }
    bffCompleteRound(next, team);
    return next;
  }

  if (action === 'open_buzzers') {
    if (next.round_stage === 'steal_ready') {
      next.round_stage = 'steal_buzz';
      next.buzzer_scope = 'steal';
      next.buzzer_open = true;
      next.buzzer_phase = 'buzzer_active';
      next.buzz_winner = null;
      return next;
    }

    const pair = next.faceoff_players || {};
    const team1Player = pair['1'] || pair[1];
    const team2Player = pair['2'] || pair[2];

    if (!team1Player || !team2Player) {
      throw new Error('Choose one faceoff player from each family first.');
    }

    next.round_stage = 'faceoff_buzz';
    next.buzzer_scope = 'faceoff';
    next.buzzer_open = true;
    next.buzzer_phase = 'buzzer_active';
    next.buzz_winner = null;
    next.active_player_id = null;
    next.answer_deadline_at = null;
    next.faceoff_results = {};
    return next;
  }

  if (action === 'hide_buzzers') {
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';
    if (next.round_stage === 'faceoff_buzz') next.round_stage = 'faceoff_ready';
    if (next.round_stage === 'steal_buzz') next.round_stage = 'steal_ready';
    return next;
  }

  if (action === 'reset_buzzers') {
    next.buzzer_open = false;
    next.buzzer_phase = 'board_shown';
    next.buzz_winner = null;
    return next;
  }

  if (action === 'start_dysfunction') {
    if (!next.match_complete || ![1, 2].includes(Number(next.winning_team))) {
      throw new Error('Finish the five-round match before starting Family Dysfunction.');
    }

    const roster = bffTeamRoster(players, next, Number(next.winning_team)).slice(0, 6);
    if (roster.length < 4) {
      throw new Error('Family Dysfunction needs at least four connected members from the winning family for a 2v2 finale.');
    }

    const voiceOffers = next.voice_offers || {};
    if (!roster.every((player) => Boolean(voiceOffers[String(player.playerId)]?.sdp))) {
      throw new Error('Every Family Dysfunction player must have their microphone on before the finale starts.');
    }

    const sideAssignments = {};
    roster.forEach((player, index) => {
      sideAssignments[String(player.playerId)] = index % 2 === 0 ? 'A' : 'B';
    });

    next.phase = 'dysfunction';
    next.round_stage = 'dysfunction_vote';
    next.active_player_id = null;
    next.answer_deadline_at = null;
    next.buzzer_open = false;
    next.buzz_winner = null;
    next.dysfunction = {
      family_team: Number(next.winning_team),
      family_name: Number(next.winning_team) === 2 ? next.family2 : next.family1,
      side_assignments: sideAssignments,
      scoreA: 0,
      scoreB: 0,
      prompt_number: 1,
      used_prompt_ids: [],
      votes: {},
      votes_revealed: false,
      sudden_death: false,
      completed: false,
      winner_side: null,
    };

    await bffLoadNextDysfunctionPrompt(next);
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
    round_stage: gameState.round_stage || 'setup',
    faceoff_players: gameState.faceoff_players || {},
    faceoff_winner_id: gameState.faceoff_winner_id || null,
    faceoff_winner_team: Number(gameState.faceoff_winner_team) || null,
    faceoff_x_event: gameState.faceoff_x_event || null,
    play_pass_choice: gameState.play_pass_choice || null,
    active_player_id: gameState.active_player_id || null,
    answer_deadline_at: Number(gameState.answer_deadline_at) || null,
    consecutive_timeouts: Number(gameState.consecutive_timeouts) || 0,
    original_playing_team: Number(gameState.original_playing_team) || null,
    steal_team: Number(gameState.steal_team) || null,
    match_complete: Boolean(gameState.match_complete),
    match_tied: Boolean(gameState.match_tied),
    winning_team: Number(gameState.winning_team) || null,
    is_tiebreak: Boolean(gameState.is_tiebreak),
    dysfunction: gameState.dysfunction
      ? {
          ...gameState.dysfunction,
          votes:
            gameState.dysfunction.votes_revealed
              ? gameState.dysfunction.votes || {}
              : {},
          my_vote: participant
            ? (gameState.dysfunction.votes || {})[participant.accountId || participant.playerId] || null
            : null,
        }
      : null,
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

    const locked = await client.query(
      'select id, room_code, game_id, status, revision, display_state, created_at, updated_at from public.game_rooms where id = $1::uuid for update',
      [room.id],
    );

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

    const familyTeam =
      Number((current.playerTeams || {})[participant.accountId] || participant.familyTeam || 0)
      || null;
    const playerId = String(participant.accountId || participant.playerId || '');
    const scope = current.buzzer_scope || (current.round_stage === 'steal_buzz' ? 'steal' : 'faceoff');

    let allowed = false;
    let nextStage = 'faceoff_answer';
    let deadlineMs = 15000;

    if (scope === 'steal') {
      allowed = familyTeam === Number(current.steal_team || 0);
      nextStage = 'steal_answer';
      deadlineMs = 20000;
    } else {
      const allowedFaceoffId =
        (current.faceoff_players || {})[String(familyTeam)]
        || (current.faceoff_players || {})[familyTeam];
      allowed = Boolean(
        familyTeam
        && String(allowedFaceoffId || '') === playerId
      );
    }

    if (!allowed) {
      await client.query('commit');
      return { gameState: current, room: lockedRoom };
    }

    const now = Date.now();
    const nextGameState = {
      ...current,
      round_stage: nextStage,
      buzzer_open: false,
      buzzer_phase: 'answering',
      control_team: scope === 'steal'
        ? Number(current.steal_team || familyTeam || current.control_team || 1)
        : familyTeam || current.control_team || 1,
      active_turn: scope === 'steal'
        ? Number(current.steal_team || familyTeam || current.active_turn || 1)
        : familyTeam || current.active_turn || 1,
      active_player_id: participant.accountId,
      answer_deadline_at: now + deadlineMs,
      sound_cue: { name: 'buzz', at: now },
      buzz_winner: {
        playerId: participant.accountId,
        playerName: participant.playerName || participant.name || 'Player',
        seatNumber: participant.seatNumber,
        familyTeam,
        teamName:
          familyTeam === 2
            ? (current.family2 || 'Family 2')
            : (current.family1 || 'Family 1'),
        timestamp: now,
      },
    };

    const nextDisplayState = wrapBffGameState(
      lockedRoom.display_state || {},
      nextGameState,
    );

    const updated = await client.query(
      'update public.game_rooms set display_state = $2::jsonb, revision = revision + 1, updated_at = now() where id = $1::uuid returning id, room_code, game_id, status, revision, display_state, created_at, updated_at',
      [room.id, JSON.stringify(nextDisplayState)],
    );

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


async function applyBffPlayerAction(room, participant, body = {}, players = []) {
  const action = String(body.action || '').trim();
  const current = extractBffGameState(room.display_state || {});
  const playerId = String(participant.accountId || participant.playerId || '');

  if (action === 'buzz') {
    return current;
  }

  if (action === 'play_pass') {
    if (
      current.round_stage !== 'play_pass'
      || String(current.faceoff_winner_id || '') !== playerId
    ) {
      return current;
    }

    const choice = String(body.choice || '').toLowerCase();
    if (!['play', 'pass'].includes(choice)) return current;

    const winnerTeam = Number(current.faceoff_winner_team || bffTeamForPlayer(current, playerId) || 0);
    if (![1, 2].includes(winnerTeam)) return current;

    const controlTeam = choice === 'play'
      ? winnerTeam
      : winnerTeam === 1 ? 2 : 1;
    const faceoffPlayerId =
      (current.faceoff_players || {})[String(controlTeam)]
      || (current.faceoff_players || {})[controlTeam]
      || null;
    const firstPlayer = bffNextPlayerId(players, current, controlTeam, faceoffPlayerId);

    const next = {
      ...current,
      play_pass_choice: choice,
      control_team: controlTeam,
      active_turn: controlTeam,
      consecutive_timeouts: 0,
      steal_mode: false,
      buzzer_open: false,
      buzzer_phase: 'board_shown',
      buzz_winner: null,
    };

    bffStartFamilyTurn(next, firstPlayer);
    return next;
  }

  if (action === 'dysfunction_vote') {
    if (current.round_stage !== 'dysfunction_vote' || !current.dysfunction) return current;

    const dysfunction = {
      ...current.dysfunction,
      votes: { ...(current.dysfunction.votes || {}) },
    };
    const side = dysfunction.side_assignments?.[playerId] || null;
    const targetId = String(body.targetPlayerId || '');
    if (!side || !targetId) return current;

    const targetSide = dysfunction.side_assignments?.[targetId] || null;
    if (!targetSide || targetSide === side) return current;

    dysfunction.votes[playerId] = targetId;

    const allVoters = Object.keys(dysfunction.side_assignments || {});
    const allVoted = allVoters.every((id) => Boolean(dysfunction.votes[String(id)]));

    const next = {
      ...current,
      dysfunction,
    };

    if (!allVoted) return next;

    const sideA = bffDysfunctionSideMembers(dysfunction, 'A');
    const sideB = bffDysfunctionSideMembers(dysfunction, 'B');
    const pointsA = bffDysfunctionPoints(sideA, dysfunction.votes);
    const pointsB = bffDysfunctionPoints(sideB, dysfunction.votes);

    dysfunction.scoreA = Number(dysfunction.scoreA || 0) + pointsA;
    dysfunction.scoreB = Number(dysfunction.scoreB || 0) + pointsB;
    dysfunction.last_pointsA = pointsA;
    dysfunction.last_pointsB = pointsB;
    dysfunction.votes_revealed = true;

    if (pointsA === 0 || pointsB === 0) {
      next.sound_cue = { name: 'awww', at: Date.now() };
    }

    if (dysfunction.sudden_death) {
      const unanimousA = bffDysfunctionUnanimous(sideA, dysfunction.votes);
      const unanimousB = bffDysfunctionUnanimous(sideB, dysfunction.votes);

      if (unanimousA !== unanimousB) {
        dysfunction.completed = true;
        dysfunction.winner_side = unanimousA ? 'A' : 'B';
        next.phase = 'finale_complete';
        next.round_stage = 'dysfunction_complete';
        next.active_player_id = null;
        next.answer_deadline_at = null;
        return next;
      }

      dysfunction.prompt_number = Number(dysfunction.prompt_number || 5) + 1;
      next.dysfunction = dysfunction;
      await bffLoadNextDysfunctionPrompt(next);
      return next;
    }

    const defensePlayerId = bffDysfunctionDefensePlayer(dysfunction.votes);
    dysfunction.defense_player_id = defensePlayerId;
    next.dysfunction = dysfunction;
    next.round_stage = 'dysfunction_defense';
    next.active_player_id = defensePlayerId;
    next.answer_deadline_at = defensePlayerId ? Date.now() + 10000 : null;
    return next;
  }

  if (action === 'voice_offer') {
    const sdp = String(body.sdp || '');
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
    if (['playing', 'dysfunction'].includes(current.phase)) {
      return current;
    }

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


async function reconcileBffTimers(room) {
  if (!room?.id) return room;

  const client = await bffPool.connect();

  try {
    await client.query('begin');

    const locked = await client.query(
      'select id, room_code, game_id, status, revision, display_state, created_at, updated_at from public.game_rooms where id = $1::uuid for update',
      [room.id],
    );

    const lockedRoom = locked.rows[0] || room;
    const current = extractBffGameState(lockedRoom.display_state || {});
    const deadline = Number(current.answer_deadline_at || 0);

    if (!deadline || Date.now() < deadline) {
      await client.query('commit');
      return lockedRoom;
    }

    const players = await loadBffParticipants(room.id, current);
    let changed = false;

    if (current.round_stage === 'faceoff_answer' && current.active_player_id) {
      bffAdvanceFaceoffAfterMiss(current, players, current.active_player_id, { showX: false });
      changed = true;
    } else if (current.round_stage === 'family_play' && current.active_player_id) {
      bffFamilyTimeout(current, players);
      changed = true;
    } else if (current.round_stage === 'steal_answer') {
      current.sound_cue = { name: 'wrong_awww', at: Date.now() };
      bffCompleteRound(current, Number(current.original_playing_team || 0));
      changed = true;
    } else if (current.round_stage === 'dysfunction_defense') {
      await bffAdvanceDysfunctionAfterDefense(current);
      changed = true;
    }

    if (!changed) {
      await client.query('commit');
      return lockedRoom;
    }

    const nextDisplayState = wrapBffGameState(
      lockedRoom.display_state || {},
      current,
    );

    const updated = await client.query(
      'update public.game_rooms set display_state = $2::jsonb, revision = revision + 1, updated_at = now() where id = $1::uuid returning id, room_code, game_id, status, revision, display_state, created_at, updated_at',
      [room.id, JSON.stringify(nextDisplayState)],
    );

    await client.query('commit');
    return updated.rows[0] || lockedRoom;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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

    let room = await loadRailwayBffPlayerRoom(roomCode);
    if (!room) {
      sendJson(res, 404, {
        error: { code: 'ROOM_NOT_FOUND', message: 'This BFF room is no longer active.' },
      });
      return;
    }

    room = await reconcileBffTimers(room);
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

    let room = await loadRailwayBffPlayerRoom(roomCode);
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
      nextGameState = await applyBffPlayerAction(room, participant, body || {}, players);
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

    let room = await loadRailwayBffHostRoom(controllerId);
    if (!room) {
      sendJson(res, 404, {
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'No active BFF room is attached to this Host Controller.',
        },
      });
      return;
    }

    room = await reconcileBffTimers(room);
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

    let room = await loadRailwayBffHostRoom(controllerId);
    if (!room) {
      sendJson(res, 404, {
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'No active BFF room is attached to this Host Controller.',
        },
      });
      return;
    }

    room = await reconcileBffTimers(room);
    const body = await readJsonBody(req).catch(() => ({}));
    await assignBffSeats(room.id);
    const actionPlayers = await loadBffParticipants(
      room.id,
      extractBffGameState(room.display_state || {}),
    );
    const nextGameState = await applyBffHostAction(room, body || {}, actionPlayers);
    const savedRoom = await saveBffGameState(room.id, room.display_state || {}, nextGameState);
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
