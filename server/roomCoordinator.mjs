import { randomBytes } from 'node:crypto';
import WebSocket from 'ws';

const INSTANCE_ID = randomBytes(16).toString('hex');
const MAX_QUEUED_EVENTS = 100;

export function createRoomBridge({ game, roomCode, onEvent } = {}) {
  const base = String(process.env.TNG_ROOM_COORDINATOR_URL || '').replace(/\/$/, '');
  const secret = String(process.env.TNG_ROOM_COORDINATOR_SECRET || '');
  const gameId = String(game || '').trim();
  const code = String(roomCode || '').trim().toUpperCase();

  if (!base || !secret || !['viral', 'rodeo-rumble'].includes(gameId) || !/^[A-Z0-9]{4,8}$/.test(code)) {
    return { publish() {}, close() {} };
  }

  let socket = null;
  let closed = false;
  let retryTimer = null;
  let retryMs = 500;
  const queue = [];

  const flush = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    while (queue.length && socket.readyState === WebSocket.OPEN) {
      const event = queue.shift();
      try { socket.send(JSON.stringify({ t: 'broadcast', event })); }
      catch { queue.unshift(event); break; }
    }
  };

  const connect = () => {
    if (closed) return;
    const url = `${base}/room/${gameId}/${encodeURIComponent(code)}`;
    const next = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${secret}`,
        'X-TNG-Instance-ID': INSTANCE_ID,
      },
      handshakeTimeout: 8000,
      maxPayload: 64 * 1024,
    });
    socket = next;

    next.on('open', () => {
      retryMs = 500;
      flush();
    });
    next.on('message', (raw) => {
      let packet;
      try { packet = JSON.parse(raw.toString()); } catch { return; }
      if (packet?.t !== 'event' || !packet.event || typeof packet.event !== 'object') return;
      try { onEvent?.(packet.event); }
      catch (error) { console.warn('[TNG room bridge] event handler failed:', error?.message || error); }
    });
    next.on('error', (error) => {
      console.warn('[TNG room bridge] connection error:', error?.message || error);
    });
    next.on('close', () => {
      if (socket === next) socket = null;
      if (closed) return;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(connect, retryMs);
      retryTimer.unref?.();
      retryMs = Math.min(15000, retryMs * 2);
    });
  };

  connect();

  return {
    publish(event) {
      if (closed || !event || typeof event !== 'object') return;
      if (queue.length >= MAX_QUEUED_EVENTS) queue.shift();
      queue.push(event);
      flush();
    },
    close() {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      queue.length = 0;
      try { socket?.close(1000, 'room closed'); } catch { /* already closed */ }
      socket = null;
    },
  };
}
