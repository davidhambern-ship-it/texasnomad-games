import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const accountStatus = pgEnum('account_status', ['active', 'suspended', 'deleted']);
export const connectionRole = pgEnum('connection_role', [
  'player',
  'host_controller',
  'game_display',
  'spectator',
]);
export const deviceStatus = pgEnum('device_status', ['pairing', 'connected', 'disconnected', 'revoked']);
export const hostSessionStatus = pgEnum('host_session_status', ['pairing', 'ready', 'live', 'ended']);
export const roomStatus = pgEnum('room_status', ['lobby', 'live', 'paused', 'completed', 'abandoned']);
export const participantRole = pgEnum('participant_role', ['player', 'host_player']);
export const matchStatus = pgEnum('match_status', ['active', 'completed', 'voided']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  authSubject: varchar('auth_subject', { length: 255 }).notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  status: accountStatus('status').notNull().default('active'),
  ...timestamps,
}, (table) => [
  uniqueIndex('accounts_auth_subject_unique').on(table.authSubject),
  uniqueIndex('accounts_email_unique').on(sql`lower(${table.email})`),
]);

export const playerProfiles = pgTable('player_profiles', {
  accountId: uuid('account_id').primaryKey().references(() => accounts.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 50 }).notNull(),
  handle: varchar('handle', { length: 24 }).notNull(),
  normalizedHandle: varchar('normalized_handle', { length: 24 }).notNull(),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex('player_profiles_normalized_handle_unique').on(table.normalizedHandle),
  check('player_profiles_handle_format', sql`${table.normalizedHandle} ~ '^[a-z0-9_]{3,24}$'`),
]);

export const deviceSessions = pgTable('device_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  role: connectionRole('role').notNull(),
  status: deviceStatus('status').notNull().default('connected'),
  deviceLabel: varchar('device_label', { length: 100 }),
  tokenHash: varchar('token_hash', { length: 128 }),
  lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ...timestamps,
}, (table) => [
  index('device_sessions_account_idx').on(table.accountId),
  uniqueIndex('device_sessions_token_hash_unique').on(table.tokenHash),
  check(
    'device_sessions_display_identity',
    sql`(${table.role} = 'game_display' AND ${table.accountId} IS NULL) OR (${table.role} <> 'game_display' AND ${table.accountId} IS NOT NULL)`,
  ),
]);

export const hostSessions = pgTable('host_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  hostAccountId: uuid('host_account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  controllerDeviceId: uuid('controller_device_id').notNull().references(() => deviceSessions.id, { onDelete: 'restrict' }),
  displayDeviceId: uuid('display_device_id').references(() => deviceSessions.id, { onDelete: 'set null' }),
  status: hostSessionStatus('status').notNull().default('pairing'),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index('host_sessions_host_idx').on(table.hostAccountId),
  uniqueIndex('host_sessions_one_active_per_host')
    .on(table.hostAccountId)
    .where(sql`${table.status} IN ('pairing', 'ready', 'live')`),
  uniqueIndex('host_sessions_one_active_per_controller')
    .on(table.controllerDeviceId)
    .where(sql`${table.status} IN ('pairing', 'ready', 'live')`),
  uniqueIndex('host_sessions_one_active_per_display')
    .on(table.displayDeviceId)
    .where(sql`${table.displayDeviceId} IS NOT NULL AND ${table.status} IN ('ready', 'live')`),
]);

export const displayPairings = pgTable('display_pairings', {
  id: uuid('id').primaryKey().defaultRandom(),
  hostSessionId: uuid('host_session_id').notNull().references(() => hostSessions.id, { onDelete: 'cascade' }),
  codeHash: varchar('code_hash', { length: 128 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('display_pairings_code_hash_unique').on(table.codeHash),
  uniqueIndex('display_pairings_one_pending_per_host')
    .on(table.hostSessionId)
    .where(sql`${table.consumedAt} IS NULL`),
]);

export const gameRooms = pgTable('game_rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomCode: varchar('room_code', { length: 8 }).notNull(),
  gameId: varchar('game_id', { length: 64 }).notNull(),
  hostSessionId: uuid('host_session_id').notNull().references(() => hostSessions.id, { onDelete: 'restrict' }),
  status: roomStatus('status').notNull().default('lobby'),
  revision: integer('revision').notNull().default(0),
  displayState: jsonb('display_state').notNull().default({}),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index('game_rooms_host_session_idx').on(table.hostSessionId),
  uniqueIndex('game_rooms_one_active_per_host_session')
    .on(table.hostSessionId)
    .where(sql`${table.status} IN ('lobby', 'live', 'paused')`),
  uniqueIndex('game_rooms_active_code_unique')
    .on(table.roomCode)
    .where(sql`${table.status} IN ('lobby', 'live', 'paused')`),
  check('game_rooms_code_format', sql`${table.roomCode} ~ '^[A-Z0-9]{4,8}$'`),
]);

export const roomParticipants = pgTable('room_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => gameRooms.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
  deviceSessionId: uuid('device_session_id').notNull().references(() => deviceSessions.id, { onDelete: 'restrict' }),
  role: participantRole('role').notNull().default('player'),
  seatNumber: integer('seat_number'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp('left_at', { withTimezone: true }),
  lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('room_participants_account_unique').on(table.roomId, table.accountId),
  uniqueIndex('room_participants_device_unique').on(table.roomId, table.deviceSessionId),
  uniqueIndex('room_participants_seat_unique').on(table.roomId, table.seatNumber).where(sql`${table.seatNumber} IS NOT NULL`),
]);

// Private cards/dominoes are never included in the Game Display projection.
export const participantPrivateState = pgTable('participant_private_state', {
  roomId: uuid('room_id').notNull().references(() => gameRooms.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  revision: integer('revision').notNull().default(0),
  privateState: jsonb('private_state').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.roomId, table.accountId] })]);

export const gameEvents = pgTable('game_events', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  roomId: uuid('room_id').notNull().references(() => gameRooms.id, { onDelete: 'cascade' }),
  commandId: uuid('command_id').notNull(),
  actorAccountId: uuid('actor_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  actorDeviceId: uuid('actor_device_id').notNull().references(() => deviceSessions.id, { onDelete: 'restrict' }),
  expectedRevision: integer('expected_revision').notNull(),
  appliedRevision: integer('applied_revision').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('game_events_command_unique').on(table.commandId),
  uniqueIndex('game_events_room_revision_unique').on(table.roomId, table.appliedRevision),
  index('game_events_room_created_idx').on(table.roomId, table.createdAt),
]);

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => gameRooms.id, { onDelete: 'restrict' }),
  gameId: varchar('game_id', { length: 64 }).notNull(),
  hostAccountId: uuid('host_account_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
  status: matchStatus('status').notNull().default('active'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  result: jsonb('result').notNull().default({}),
}, (table) => [uniqueIndex('matches_room_unique').on(table.roomId)]);

export const matchParticipants = pgTable('match_participants', {
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
  teamKey: varchar('team_key', { length: 50 }),
  score: integer('score').notNull().default(0),
  won: boolean('won').notNull().default(false),
  result: jsonb('result').notNull().default({}),
}, (table) => [primaryKey({ columns: [table.matchId, table.accountId] })]);

export const playerGameStats = pgTable('player_game_stats', {
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  gameId: varchar('game_id', { length: 64 }).notNull(),
  gamesPlayed: integer('games_played').notNull().default(0),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  totalScore: bigint('total_score', { mode: 'number' }).notNull().default(0),
  bestScore: bigint('best_score', { mode: 'number' }).notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.accountId, table.gameId] })]);

export const gameStatEvents = pgTable('game_stat_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => gameRooms.id, { onDelete: 'cascade' }),
  gameId: varchar('game_id', { length: 64 }).notNull(),
  statKey: varchar('stat_key', { length: 100 }).notNull(),
  result: jsonb('result').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('game_stat_events_room_key_unique').on(table.roomId, table.statKey),
  index('game_stat_events_room_idx').on(table.roomId, table.createdAt),
]);

export const hostStats = pgTable('host_stats', {
  accountId: uuid('account_id').primaryKey().references(() => accounts.id, { onDelete: 'cascade' }),
  sessionsHosted: integer('sessions_hosted').notNull().default(0),
  gamesCompleted: integer('games_completed').notNull().default(0),
  uniquePlayersHosted: integer('unique_players_hosted').notNull().default(0),
  totalPlayersHosted: integer('total_players_hosted').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const friendships = pgTable('friendships', {
  id: uuid('id').primaryKey().defaultRandom(),
  requesterAccountId: uuid('requester_account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  recipientAccountId: uuid('recipient_account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index('friendships_requester_idx').on(table.requesterAccountId, table.status),
  index('friendships_recipient_idx').on(table.recipientAccountId, table.status),
  uniqueIndex('friendships_pair_unique').on(
    sql`least(${table.requesterAccountId}, ${table.recipientAccountId})`,
    sql`greatest(${table.requesterAccountId}, ${table.recipientAccountId})`,
  ),
  check('friendships_no_self_check', sql`${table.requesterAccountId} <> ${table.recipientAccountId}`),
  check('friendships_status_check', sql`${table.status} IN ('pending','accepted','declined')`),
]);

export const directMessages = pgTable('direct_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderAccountId: uuid('sender_account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  recipientAccountId: uuid('recipient_account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  body: varchar('body', { length: 1200 }).notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('direct_messages_recipient_idx').on(table.recipientAccountId, table.readAt, table.createdAt),
  index('direct_messages_pair_idx').on(table.senderAccountId, table.recipientAccountId, table.createdAt),
  check('direct_messages_no_self_check', sql`${table.senderAccountId} <> ${table.recipientAccountId}`),
]);

export const gameInvites = pgTable('game_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderAccountId: uuid('sender_account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  recipientAccountId: uuid('recipient_account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  roomId: uuid('room_id').references(() => gameRooms.id, { onDelete: 'set null' }),
  roomCode: varchar('room_code', { length: 8 }).notNull(),
  gameId: varchar('game_id', { length: 64 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index('game_invites_recipient_idx').on(table.recipientAccountId, table.status, table.expiresAt),
  index('game_invites_sender_idx').on(table.senderAccountId, table.createdAt),
  check('game_invites_no_self_check', sql`${table.senderAccountId} <> ${table.recipientAccountId}`),
  check('game_invites_status_check', sql`${table.status} IN ('pending','accepted','declined','expired')`),
]);

export const socialNotifications = pgTable('social_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipientAccountId: uuid('recipient_account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  actorAccountId: uuid('actor_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 40 }).notNull(),
  payload: jsonb('payload').notNull().default({}),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('social_notifications_recipient_idx').on(table.recipientAccountId, table.readAt, table.createdAt),
]);


export const squareBizQuestions = pgTable('square_biz_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  question: varchar('question', { length: 500 }).notNull(),
  choices: jsonb('choices').notNull(),
  correctAnswer: varchar('correct_answer', { length: 1 }).notNull(),
  category: varchar('category', { length: 100 }).notNull().default('General'),
  difficulty: varchar('difficulty', { length: 20 }).notNull().default('medium'),
  source: varchar('source', { length: 50 }).notNull().default('manual'),
  sourceRef: varchar('source_ref', { length: 255 }),
  active: boolean('active').notNull().default(true),
  timesUsed: integer('times_used').notNull().default(0),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex('square_biz_questions_question_unique').on(sql`lower(${table.question})`),
  index('square_biz_questions_active_category_idx').on(table.active, table.category),
  index('square_biz_questions_usage_idx').on(table.timesUsed, table.lastUsedAt),
  check('square_biz_questions_correct_answer_check', sql`${table.correctAnswer} IN ('A','B','C','D')`),
  check(
    'square_biz_questions_choices_shape_check',
    sql`jsonb_typeof(${table.choices}) = 'array' AND jsonb_array_length(${table.choices}) = 4`,
  ),
  check(
    'square_biz_questions_difficulty_check',
    sql`${table.difficulty} IN ('easy','medium','hard')`,
  ),
]);

export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  topic: varchar('topic', { length: 100 }).notNull(),
  aggregateId: uuid('aggregate_id'),
  payload: jsonb('payload').notNull(),
  attempts: integer('attempts').notNull().default(0),
  availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('outbox_events_pending_idx').on(table.processedAt, table.availableAt)]);
