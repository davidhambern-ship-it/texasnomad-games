import { DurableObject } from "cloudflare:workers";

const ROOM_RE = /^[A-Z0-9]{4,8}$/;
const GAME_RE = /^(viral|rodeo-rumble)$/;

export class RoomCoordinator extends DurableObject {
  async fetch(request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    const instanceId = request.headers.get("X-TNG-Instance-ID") || "";
    if (!/^[a-f0-9-]{16,80}$/i.test(instanceId)) {
      return new Response("Invalid instance", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.serializeAttachment({ instanceId });
    this.ctx.acceptWebSocket(server, ["room"]);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, message) {
    let packet;
    try {
      packet = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }

    if (!packet || packet.t !== "broadcast" || !packet.event || typeof packet.event !== "object") {
      return;
    }

    const sender = socket.deserializeAttachment()?.instanceId;
    if (!sender) return;

    const payload = JSON.stringify({ t: "event", event: packet.event, origin: sender });
    for (const peer of this.ctx.getWebSockets("room")) {
      if (peer === socket || peer.readyState !== WebSocket.OPEN) continue;
      try { peer.send(payload); } catch { /* disconnected peer */ }
    }
  }

  async webSocketClose(socket) {
    try { socket.close(1000, "closed"); } catch { /* already closed */ }
  }

  async webSocketError(socket) {
    try { socket.close(1011, "socket error"); } catch { /* already closed */ }
  }
}

export default {
  async fetch(request, env) {
    const secret = env.TNG_ROOM_COORDINATOR_SECRET;
    if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/room\/([^/]+)\/([^/]+)$/);
    if (!match || !GAME_RE.test(match[1]) || !ROOM_RE.test(match[2].toUpperCase())) {
      return new Response("Invalid room", { status: 400 });
    }

    const id = env.ROOMS.idFromName(`${match[1]}:${match[2].toUpperCase()}`);
    return env.ROOMS.get(id).fetch(request);
  },
};
