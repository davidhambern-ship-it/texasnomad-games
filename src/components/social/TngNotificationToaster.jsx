import React, { useEffect, useRef, useState } from 'react';

import { tngApi } from '@/api/tngApi';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

function notificationCopy(notification, { displayMode = false } = {}) {
  const actor = notification?.actor;
  const name = actor?.handle ? `@${actor.handle}` : actor?.displayName || 'A player';
  const payload = notification?.payload || {};

  switch (notification?.type) {
    case 'friend_request':
      return {
        eyebrow: 'FRIEND REQUEST',
        title: `${name} wants to connect`,
        body: 'Open your profile to accept or decline.',
        tone: '#FFD700',
      };
    case 'friend_accepted':
      return {
        eyebrow: 'NEW FRIEND',
        title: `${name} accepted your request`,
        body: 'You can message or invite each other now.',
        tone: '#4ade80',
      };
    case 'message':
      return {
        eyebrow: 'NEW MESSAGE',
        title: `Message from ${name}`,
        body: displayMode
          ? 'Check your TNG messages when you get a chance.'
          : (payload.preview || 'Open your profile to read it.'),
        tone: '#22d3ee',
      };
    case 'game_invite':
      return {
        eyebrow: 'GAME INVITE',
        title: `${name} invited you to play`,
        body: payload.gameId
          ? `${String(payload.gameId).replace(/-/g, ' ').toUpperCase()} · ROOM ${payload.roomCode || ''}`
          : 'Open your profile to see the invite.',
        tone: '#FF5F1F',
      };
    case 'invite_accepted':
      return {
        eyebrow: 'INVITE ACCEPTED',
        title: `${name} is on the way`,
        body: payload.roomCode ? `ROOM ${payload.roomCode}` : 'Your friend accepted the game invite.',
        tone: '#BC13FE',
      };
    default:
      return {
        eyebrow: 'TNG',
        title: 'New notification',
        body: 'Open your profile for details.',
        tone: '#BC13FE',
      };
  }
}

function ToastCard({ notification, displayMode = false }) {
  const copy = notificationCopy(notification, { displayMode });

  return (
    <div
      className="w-[min(330px,calc(100vw-1.5rem))] rounded-xl border bg-[#090411]/95 p-3 shadow-2xl backdrop-blur-md"
      style={{
        borderColor: `${copy.tone}88`,
        boxShadow: `0 0 22px ${copy.tone}22`,
      }}
    >
      <div
        className="text-[6px] uppercase tracking-[.18em]"
        style={{ ...PS2, color: copy.tone }}
      >
        {copy.eyebrow}
      </div>
      <div className="mt-1.5 text-sm font-black text-white/90">
        {copy.title}
      </div>
      <div className="mt-1 text-[11px] leading-relaxed text-white/50">
        {copy.body}
      </div>
    </div>
  );
}

export function TngNotificationToaster({
  enabled = true,
  pollMs = 4500,
  topClass = 'top-20',
}) {
  const [items, setItems] = useState([]);
  const seenRef = useRef(new Set());

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const poll = async () => {
      try {
        const payload = await tngApi.social.action('claim_notifications');
        const incoming = Array.isArray(payload?.notifications)
          ? payload.notifications
          : [];

        if (cancelled || incoming.length === 0) return;

        const fresh = incoming.filter((item) => {
          if (!item?.id || seenRef.current.has(item.id)) return false;
          seenRef.current.add(item.id);
          return true;
        });

        if (!fresh.length) return;

        setItems((current) => [...current, ...fresh].slice(-3));

        for (const item of fresh) {
          window.setTimeout(() => {
            setItems((current) => current.filter((row) => row.id !== item.id));
          }, 7500);
        }
      } catch {
        // Notifications are optional UI. Never let a polling error disturb gameplay.
      }
    };

    poll();
    const interval = window.setInterval(poll, pollMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enabled, pollMs]);

  if (!enabled || items.length === 0) return null;

  return (
    <div className={`pointer-events-none fixed right-3 z-[190] flex flex-col gap-2 ${topClass}`}>
      {items.map((item) => (
        <ToastCard key={item.id} notification={item} />
      ))}
    </div>
  );
}

export function DisplayNotificationStack({ notifications = [] }) {
  if (!Array.isArray(notifications) || notifications.length === 0) return null;

  return (
    <div className="pointer-events-none absolute right-4 top-16 z-[190] flex max-w-[360px] flex-col gap-2">
      {notifications.slice(-3).map((item) => (
        <ToastCard key={item.id} notification={item} displayMode />
      ))}
    </div>
  );
}
