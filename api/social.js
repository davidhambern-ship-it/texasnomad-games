import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  or,
} from 'drizzle-orm';

import { requireAccount } from '../server/auth/require-account.js';
import { db } from '../server/db/client.js';
import {
  directMessages,
  friendships,
  gameInvites,
  gameRooms,
  hostSessions,
  playerProfiles,
  roomParticipants,
  socialNotifications,
} from '../server/db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../server/http/respond.js';

const ACTIVE_ROOM_STATUSES = ['lobby', 'live', 'paused'];
const ACTIVE_HOST_STATUSES = ['ready', 'live'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value, message = 'Choose a valid TNG player.') {
  if (!UUID_PATTERN.test(String(value || ''))) {
    const error = new Error(message);
    error.statusCode = 400;
    error.code = 'INVALID_PLAYER_ID';
    throw error;
  }
}

async function profilesFor(accountIds, executor = db) {
  const ids = [...new Set((accountIds || []).filter(Boolean))];
  if (!ids.length) return new Map();

  const rows = await executor.select({
    accountId: playerProfiles.accountId,
    displayName: playerProfiles.displayName,
    handle: playerProfiles.handle,
  }).from(playerProfiles).where(inArray(playerProfiles.accountId, ids));

  return new Map(rows.map((row) => [row.accountId, row]));
}

function publicProfile(profile, accountId) {
  return {
    accountId,
    displayName: profile?.displayName || profile?.handle || 'Player',
    handle: profile?.handle || null,
  };
}

async function friendshipBetween(a, b, executor = db) {
  const [friendship] = await executor.select().from(friendships).where(or(
    and(eq(friendships.requesterAccountId, a), eq(friendships.recipientAccountId, b)),
    and(eq(friendships.requesterAccountId, b), eq(friendships.recipientAccountId, a)),
  )).limit(1);

  return friendship || null;
}

async function requireAcceptedFriendship(a, b, executor = db) {
  const friendship = await friendshipBetween(a, b, executor);
  if (!friendship || friendship.status !== 'accepted') {
    const error = new Error('Direct messages and game invites are for TNG friends.');
    error.statusCode = 403;
    error.code = 'FRIENDSHIP_REQUIRED';
    throw error;
  }
  return friendship;
}

async function currentRoomForAccount(accountId, executor = db) {
  const [hosted] = await executor
    .select({
      roomId: gameRooms.id,
      roomCode: gameRooms.roomCode,
      gameId: gameRooms.gameId,
      status: gameRooms.status,
      updatedAt: gameRooms.updatedAt,
    })
    .from(hostSessions)
    .innerJoin(gameRooms, eq(gameRooms.hostSessionId, hostSessions.id))
    .where(and(
      eq(hostSessions.hostAccountId, accountId),
      inArray(hostSessions.status, ACTIVE_HOST_STATUSES),
      inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
    ))
    .orderBy(desc(gameRooms.updatedAt))
    .limit(1);

  if (hosted) return { ...hosted, role: 'host' };

  const [playing] = await executor
    .select({
      roomId: gameRooms.id,
      roomCode: gameRooms.roomCode,
      gameId: gameRooms.gameId,
      status: gameRooms.status,
      updatedAt: gameRooms.updatedAt,
    })
    .from(roomParticipants)
    .innerJoin(gameRooms, eq(gameRooms.id, roomParticipants.roomId))
    .where(and(
      eq(roomParticipants.accountId, accountId),
      isNull(roomParticipants.leftAt),
      inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
    ))
    .orderBy(desc(gameRooms.updatedAt))
    .limit(1);

  return playing ? { ...playing, role: 'player' } : null;
}

async function createNotification({
  recipientAccountId,
  actorAccountId = null,
  type,
  payload = {},
}, executor = db) {
  const [notification] = await executor.insert(socialNotifications).values({
    recipientAccountId,
    actorAccountId,
    type,
    payload,
  }).returning();

  return notification;
}

async function hydrateNotifications(rows, executor = db) {
  const profileMap = await profilesFor(rows.map((row) => row.actorAccountId), executor);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    actor: row.actorAccountId
      ? publicProfile(profileMap.get(row.actorAccountId), row.actorAccountId)
      : null,
    payload: row.payload || {},
    deliveredAt: row.deliveredAt,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }));
}

async function socialState(accountId, executor = db) {
  const relations = await executor.select().from(friendships).where(or(
    eq(friendships.requesterAccountId, accountId),
    eq(friendships.recipientAccountId, accountId),
  ));

  const otherIds = relations.map((row) => (
    row.requesterAccountId === accountId
      ? row.recipientAccountId
      : row.requesterAccountId
  ));

  const invites = await executor.select().from(gameInvites).where(and(
    eq(gameInvites.recipientAccountId, accountId),
    eq(gameInvites.status, 'pending'),
    gt(gameInvites.expiresAt, new Date()),
  )).orderBy(desc(gameInvites.createdAt)).limit(20);

  const notifications = await executor.select().from(socialNotifications).where(and(
    eq(socialNotifications.recipientAccountId, accountId),
    isNull(socialNotifications.readAt),
  )).orderBy(desc(socialNotifications.createdAt)).limit(40);

  const profileMap = await profilesFor([
    ...otherIds,
    ...invites.map((row) => row.senderAccountId),
    ...notifications.map((row) => row.actorAccountId),
  ], executor);

  const friends = [];
  const incomingRequests = [];
  const outgoingRequests = [];

  for (const row of relations) {
    const otherId = row.requesterAccountId === accountId
      ? row.recipientAccountId
      : row.requesterAccountId;
    const other = publicProfile(profileMap.get(otherId), otherId);

    if (row.status === 'accepted') {
      friends.push({
        friendshipId: row.id,
        ...other,
      });
    } else if (row.status === 'pending' && row.recipientAccountId === accountId) {
      incomingRequests.push({
        friendshipId: row.id,
        ...other,
        createdAt: row.createdAt,
      });
    } else if (row.status === 'pending' && row.requesterAccountId === accountId) {
      outgoingRequests.push({
        friendshipId: row.id,
        ...other,
        createdAt: row.createdAt,
      });
    }
  }

  return {
    friends,
    incomingRequests,
    outgoingRequests,
    invites: invites.map((invite) => ({
      id: invite.id,
      sender: publicProfile(profileMap.get(invite.senderAccountId), invite.senderAccountId),
      roomCode: invite.roomCode,
      gameId: invite.gameId,
      status: invite.status,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    })),
    notifications: await hydrateNotifications(notifications, executor),
    currentRoom: await currentRoomForAccount(accountId, executor),
  };
}

async function searchPlayers(accountId, query) {
  const q = String(query || '').trim();
  if (q.length < 2) {
    const error = new Error('Search with at least 2 characters.');
    error.statusCode = 400;
    error.code = 'SEARCH_TOO_SHORT';
    throw error;
  }

  const results = await db.select({
    accountId: playerProfiles.accountId,
    displayName: playerProfiles.displayName,
    handle: playerProfiles.handle,
  }).from(playerProfiles).where(and(
    or(
      ilike(playerProfiles.displayName, `%${q}%`),
      ilike(playerProfiles.handle, `%${q.replace(/^@/, '')}%`),
    ),
  )).limit(12);

  const filtered = results.filter((row) => row.accountId !== accountId);
  const relationRows = filtered.length
    ? await db.select().from(friendships).where(and(
        or(
          eq(friendships.requesterAccountId, accountId),
          eq(friendships.recipientAccountId, accountId),
        ),
        or(
          inArray(friendships.requesterAccountId, filtered.map((row) => row.accountId)),
          inArray(friendships.recipientAccountId, filtered.map((row) => row.accountId)),
        ),
      ))
    : [];

  const relationByOther = new Map();
  for (const row of relationRows) {
    const other = row.requesterAccountId === accountId
      ? row.recipientAccountId
      : row.requesterAccountId;
    relationByOther.set(other, row);
  }

  return filtered.map((row) => {
    const relation = relationByOther.get(row.accountId);
    return {
      ...row,
      friendship: relation
        ? {
            id: relation.id,
            status: relation.status,
            direction: relation.requesterAccountId === accountId ? 'outgoing' : 'incoming',
          }
        : null,
    };
  });
}

async function requestFriend(accountId, targetAccountId) {
  assertUuid(targetAccountId);
  if (targetAccountId === accountId) {
    const error = new Error('You cannot friend-request yourself.');
    error.statusCode = 400;
    error.code = 'SELF_FRIEND_REQUEST';
    throw error;
  }

  const [target] = await db.select({
    accountId: playerProfiles.accountId,
  }).from(playerProfiles).where(eq(playerProfiles.accountId, targetAccountId)).limit(1);

  if (!target) {
    const error = new Error('That TNG player could not be found.');
    error.statusCode = 404;
    error.code = 'PLAYER_NOT_FOUND';
    throw error;
  }

  return db.transaction(async (transaction) => {
    const existing = await friendshipBetween(accountId, targetAccountId, transaction);

    let friendship;
    if (existing) {
      if (existing.status === 'accepted') {
        const error = new Error('You are already friends.');
        error.statusCode = 409;
        error.code = 'ALREADY_FRIENDS';
        throw error;
      }
      if (existing.status === 'pending') {
        const error = new Error('A friend request is already pending.');
        error.statusCode = 409;
        error.code = 'FRIEND_REQUEST_PENDING';
        throw error;
      }

      [friendship] = await transaction.update(friendships).set({
        requesterAccountId: accountId,
        recipientAccountId: targetAccountId,
        status: 'pending',
        respondedAt: null,
        updatedAt: new Date(),
      }).where(eq(friendships.id, existing.id)).returning();
    } else {
      [friendship] = await transaction.insert(friendships).values({
        requesterAccountId: accountId,
        recipientAccountId: targetAccountId,
      }).returning();
    }

    await createNotification({
      recipientAccountId: targetAccountId,
      actorAccountId: accountId,
      type: 'friend_request',
      payload: { friendshipId: friendship.id },
    }, transaction);

    return friendship;
  });
}

async function respondFriend(accountId, friendshipId, response) {
  assertUuid(friendshipId, 'Choose a valid friend request.');
  if (!['accepted', 'declined'].includes(response)) {
    const error = new Error('Choose accept or decline.');
    error.statusCode = 400;
    error.code = 'INVALID_FRIEND_RESPONSE';
    throw error;
  }

  return db.transaction(async (transaction) => {
    const [request] = await transaction.select().from(friendships).where(and(
      eq(friendships.id, friendshipId),
      eq(friendships.recipientAccountId, accountId),
      eq(friendships.status, 'pending'),
    )).limit(1);

    if (!request) {
      const error = new Error('That friend request is no longer pending.');
      error.statusCode = 404;
      error.code = 'FRIEND_REQUEST_NOT_FOUND';
      throw error;
    }

    const [updated] = await transaction.update(friendships).set({
      status: response,
      respondedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(friendships.id, request.id)).returning();

    if (response === 'accepted') {
      await createNotification({
        recipientAccountId: request.requesterAccountId,
        actorAccountId: accountId,
        type: 'friend_accepted',
        payload: { friendshipId: request.id },
      }, transaction);
    }

    return updated;
  });
}

async function removeFriend(accountId, friendshipId) {
  assertUuid(friendshipId, 'Choose a valid friendship.');

  const [existing] = await db.select().from(friendships).where(and(
    eq(friendships.id, friendshipId),
    or(
      eq(friendships.requesterAccountId, accountId),
      eq(friendships.recipientAccountId, accountId),
    ),
  )).limit(1);

  if (!existing) {
    const error = new Error('Friendship not found.');
    error.statusCode = 404;
    error.code = 'FRIENDSHIP_NOT_FOUND';
    throw error;
  }

  await db.delete(friendships).where(eq(friendships.id, existing.id));
}

async function sendMessage(accountId, recipientAccountId, body) {
  assertUuid(recipientAccountId);
  await requireAcceptedFriendship(accountId, recipientAccountId);

  const message = String(body || '').trim();
  if (!message || message.length > 1200) {
    const error = new Error('Messages must be between 1 and 1200 characters.');
    error.statusCode = 400;
    error.code = 'INVALID_MESSAGE';
    throw error;
  }

  return db.transaction(async (transaction) => {
    const [row] = await transaction.insert(directMessages).values({
      senderAccountId: accountId,
      recipientAccountId,
      body: message,
    }).returning();

    await createNotification({
      recipientAccountId,
      actorAccountId: accountId,
      type: 'message',
      payload: {
        messageId: row.id,
        preview: message.slice(0, 120),
      },
    }, transaction);

    return row;
  });
}

async function conversation(accountId, friendAccountId) {
  assertUuid(friendAccountId);
  await requireAcceptedFriendship(accountId, friendAccountId);

  const rows = await db.select().from(directMessages).where(or(
    and(
      eq(directMessages.senderAccountId, accountId),
      eq(directMessages.recipientAccountId, friendAccountId),
    ),
    and(
      eq(directMessages.senderAccountId, friendAccountId),
      eq(directMessages.recipientAccountId, accountId),
    ),
  )).orderBy(desc(directMessages.createdAt)).limit(100);

  await db.update(directMessages).set({
    readAt: new Date(),
  }).where(and(
    eq(directMessages.senderAccountId, friendAccountId),
    eq(directMessages.recipientAccountId, accountId),
    isNull(directMessages.readAt),
  ));

  return rows.reverse().map((row) => ({
    id: row.id,
    senderAccountId: row.senderAccountId,
    recipientAccountId: row.recipientAccountId,
    body: row.body,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }));
}

async function sendInvite(accountId, recipientAccountId) {
  assertUuid(recipientAccountId);
  await requireAcceptedFriendship(accountId, recipientAccountId);

  const room = await currentRoomForAccount(accountId);
  if (!room) {
    const error = new Error('Start or join a live room before inviting a friend.');
    error.statusCode = 409;
    error.code = 'NO_CURRENT_ROOM';
    throw error;
  }

  return db.transaction(async (transaction) => {
    await transaction.update(gameInvites).set({
      status: 'expired',
      respondedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(gameInvites.senderAccountId, accountId),
      eq(gameInvites.recipientAccountId, recipientAccountId),
      eq(gameInvites.status, 'pending'),
    ));

    const expiresAt = new Date(Date.now() + (2 * 60 * 60 * 1000));
    const [invite] = await transaction.insert(gameInvites).values({
      senderAccountId: accountId,
      recipientAccountId,
      roomId: room.roomId,
      roomCode: room.roomCode,
      gameId: room.gameId,
      expiresAt,
    }).returning();

    await createNotification({
      recipientAccountId,
      actorAccountId: accountId,
      type: 'game_invite',
      payload: {
        inviteId: invite.id,
        roomCode: room.roomCode,
        gameId: room.gameId,
      },
    }, transaction);

    return invite;
  });
}

async function respondInvite(accountId, inviteId, response) {
  assertUuid(inviteId, 'Choose a valid game invite.');
  if (!['accepted', 'declined'].includes(response)) {
    const error = new Error('Choose accept or decline.');
    error.statusCode = 400;
    error.code = 'INVALID_INVITE_RESPONSE';
    throw error;
  }

  return db.transaction(async (transaction) => {
    const [invite] = await transaction.select().from(gameInvites).where(and(
      eq(gameInvites.id, inviteId),
      eq(gameInvites.recipientAccountId, accountId),
      eq(gameInvites.status, 'pending'),
      gt(gameInvites.expiresAt, new Date()),
    )).limit(1);

    if (!invite) {
      const error = new Error('That game invite is no longer available.');
      error.statusCode = 404;
      error.code = 'GAME_INVITE_NOT_FOUND';
      throw error;
    }

    const [room] = invite.roomId
      ? await transaction.select().from(gameRooms).where(and(
          eq(gameRooms.id, invite.roomId),
          inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
        )).limit(1)
      : [];

    const nextStatus = response === 'accepted' && room ? 'accepted' : response === 'accepted' ? 'expired' : 'declined';

    const [updated] = await transaction.update(gameInvites).set({
      status: nextStatus,
      respondedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(gameInvites.id, invite.id)).returning();

    if (nextStatus === 'accepted') {
      await createNotification({
        recipientAccountId: invite.senderAccountId,
        actorAccountId: accountId,
        type: 'invite_accepted',
        payload: {
          inviteId: invite.id,
          roomCode: invite.roomCode,
          gameId: invite.gameId,
        },
      }, transaction);
    }

    return {
      invite: updated,
      joinPath: nextStatus === 'accepted' ? `/join/${invite.roomCode}` : null,
    };
  });
}

async function claimNotifications(accountId) {
  return db.transaction(async (transaction) => {
    const rows = await transaction.select().from(socialNotifications).where(and(
      eq(socialNotifications.recipientAccountId, accountId),
      isNull(socialNotifications.deliveredAt),
    )).orderBy(asc(socialNotifications.createdAt)).limit(5);

    if (!rows.length) return [];

    const ids = rows.map((row) => row.id);
    const deliveredAt = new Date();

    await transaction.update(socialNotifications).set({
      deliveredAt,
    }).where(inArray(socialNotifications.id, ids));

    return hydrateNotifications(
      rows.map((row) => ({ ...row, deliveredAt })),
      transaction,
    );
  });
}

async function markNotification(accountId, notificationId) {
  assertUuid(notificationId, 'Choose a valid notification.');
  const [updated] = await db.update(socialNotifications).set({
    deliveredAt: new Date(),
    readAt: new Date(),
  }).where(and(
    eq(socialNotifications.id, notificationId),
    eq(socialNotifications.recipientAccountId, accountId),
  )).returning();

  return updated || null;
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    return methodNotAllowed(response, ['GET', 'POST']);
  }

  try {
    const account = await requireAccount(request);

    if (request.method === 'GET') {
      return sendJson(response, 200, {
        social: await socialState(account.id),
      });
    }

    const action = String(request.body?.action || '').trim();

    if (action === 'search_players') {
      return sendJson(response, 200, {
        players: await searchPlayers(account.id, request.body?.query),
      });
    }

    if (action === 'request_friend') {
      await requestFriend(account.id, request.body?.accountId);
      return sendJson(response, 200, {
        social: await socialState(account.id),
      });
    }

    if (action === 'respond_friend') {
      await respondFriend(
        account.id,
        request.body?.friendshipId,
        request.body?.response,
      );
      return sendJson(response, 200, {
        social: await socialState(account.id),
      });
    }

    if (action === 'remove_friend') {
      await removeFriend(account.id, request.body?.friendshipId);
      return sendJson(response, 200, {
        social: await socialState(account.id),
      });
    }

    if (action === 'send_message') {
      const message = await sendMessage(
        account.id,
        request.body?.recipientAccountId,
        request.body?.body,
      );
      return sendJson(response, 201, { message });
    }

    if (action === 'conversation') {
      return sendJson(response, 200, {
        messages: await conversation(account.id, request.body?.friendAccountId),
      });
    }

    if (action === 'send_invite') {
      const invite = await sendInvite(account.id, request.body?.recipientAccountId);
      return sendJson(response, 201, { invite });
    }

    if (action === 'respond_invite') {
      return sendJson(
        response,
        200,
        await respondInvite(
          account.id,
          request.body?.inviteId,
          request.body?.response,
        ),
      );
    }

    if (action === 'claim_notifications') {
      return sendJson(response, 200, {
        notifications: await claimNotifications(account.id),
      });
    }

    if (action === 'mark_notification') {
      return sendJson(response, 200, {
        notification: await markNotification(account.id, request.body?.notificationId),
      });
    }

    if (action === 'mark_all_read') {
      await db.update(socialNotifications).set({
        deliveredAt: new Date(),
        readAt: new Date(),
      }).where(and(
        eq(socialNotifications.recipientAccountId, account.id),
        isNull(socialNotifications.readAt),
      ));

      return sendJson(response, 200, {
        social: await socialState(account.id),
      });
    }

    const error = new Error('Unknown TNG social action.');
    error.statusCode = 400;
    error.code = 'INVALID_SOCIAL_ACTION';
    throw error;
  } catch (error) {
    return sendError(response, error);
  }
}
