(() => {
  const params = new URLSearchParams(window.location.search);
  const requestedJoin = String(params.get('join') || '').trim().toUpperCase();
  const requestedDisplay = String(params.get('display') || '').trim().toUpperCase();
  const requestedHost = params.get('host') === '1';
  let hostModeActive = requestedHost;
  let viralPeerCount = 0;
  let viralDisplayAttached = false;

  const RELAY_ORIGIN = window.location.hostname.endsWith('.up.railway.app')
    ? window.location.origin
    : 'https://auth.texasnomadgames.com';

  const API_BASE = RELAY_ORIGIN === window.location.origin ? '' : RELAY_ORIGIN;
  const WS_BASE = RELAY_ORIGIN.replace(/^http/i, 'ws');

  function installClaudeCompatibilityBridge() {
    if (window.claude?.use) return;

    function createRoomConnection(roomName) {
      const normalized = String(roomName || '').trim().toLowerCase();
      if (!/^viral-[a-z]{4}$/.test(normalized)) {
        return Promise.reject(new Error('Invalid VIRAL room name.'));
      }

      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${WS_BASE}/viral-live?room=${encodeURIComponent(normalized)}`);
        const topicHandlers = new Map();
        const peerHandlers = new Set();
        let peers = [];
        let settled = false;
        let closedByUser = false;

        const failTimer = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          try { ws.close(); } catch {}
          reject(new Error('Timed out connecting to the VIRAL room.'));
        }, 8000);

        function notifyTopic(topic, message) {
          const handlers = topicHandlers.get(topic);
          if (!handlers) return;
          handlers.forEach((handler) => {
            try { handler(message); } catch {}
          });
        }

        function notifyPeers(change) {
          peerHandlers.forEach((handler) => {
            try { handler(change); } catch {}
          });
        }

        function send(payload) {
          if (ws.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error('VIRAL room is not connected.'));
          }
          try {
            ws.send(JSON.stringify(payload));
            return Promise.resolve();
          } catch (error) {
            return Promise.reject(error);
          }
        }

        const connection = {
          emit(topic, data) {
            return send({ t: 'emit', topic, data });
          },
          presence(presence) {
            return send({ t: 'presence', p: presence || {} });
          },
          on(topic, handler) {
            if (!topicHandlers.has(topic)) topicHandlers.set(topic, new Set());
            topicHandlers.get(topic).add(handler);
            return () => topicHandlers.get(topic)?.delete(handler);
          },
          onPeers(handler) {
            peerHandlers.add(handler);
            return () => peerHandlers.delete(handler);
          },
          peers() {
            return peers.map((peer) => ({
              ...peer,
              presence: peer?.presence && typeof peer.presence === 'object'
                ? { ...peer.presence }
                : {},
            }));
          },
          leave() {
            closedByUser = true;
            try { ws.close(1000, 'leave'); } catch {}
          },
        };

        ws.addEventListener('message', (event) => {
          let message;
          try { message = JSON.parse(String(event.data || '')); } catch { return; }
          if (!message || typeof message !== 'object') return;

          if (message.t === 'welcome') {
            peers = Array.isArray(message.peers) ? message.peers : [];
            viralPeerCount = peers.length;
            if (!settled) {
              settled = true;
              window.clearTimeout(failTimer);
              resolve(connection);
            }
            return;
          }

          if (message.t === 'msg' && typeof message.topic === 'string') {
            notifyTopic(message.topic, {
              data: message.data,
              from: message.from || null,
              sameTab: false,
            });
            return;
          }

          if (message.t === 'peers') {
            peers = Array.isArray(message.peers) ? message.peers : [];
            viralPeerCount = peers.length;
            notifyPeers({
              joined: Array.isArray(message.joined) ? message.joined : [],
              left: Array.isArray(message.left) ? message.left : [],
              peers: connection.peers(),
            });
          }
        });

        ws.addEventListener('error', () => {
          if (!settled) {
            settled = true;
            window.clearTimeout(failTimer);
            reject(new Error('Could not connect to the VIRAL room.'));
          }
        });

        ws.addEventListener('close', () => {
          window.clearTimeout(failTimer);
          if (!settled) {
            settled = true;
            reject(new Error('VIRAL room connection closed.'));
            return;
          }

          if (!closedByUser) {
            notifyPeers({
              joined: [],
              left: connection.peers(),
              peers: [],
            });
          }
          peers = [];
          viralPeerCount = 0;
        });
      });
    }

    const roomApi = {
      join(roomName) {
        return createRoomConnection(roomName);
      },
    };

    const userApi = {
      canEdit() {
        return true;
      },
    };

    window.claude = {
      ...(window.claude || {}),
      use(kind) {
        if (kind === 'room') return Promise.resolve(roomApi);
        if (kind === 'user') return Promise.resolve(userApi);
        return Promise.resolve(null);
      },
    };
  }

  function installHostAuthorizationBridge() {
    if (
      window.__TNG_VIRAL_HOST_AUTH_BRIDGED__ ||
      !window.claude ||
      typeof window.claude.use !== 'function'
    ) {
      return;
    }

    const originalUse = window.claude.use.bind(window.claude);

    window.claude.use = async function useWithTngHostAuth(kind) {
      const api = await originalUse(kind);
      if (kind !== 'room' || !api || typeof api.join !== 'function') return api;

      return new Proxy(api, {
        get(target, prop, receiver) {
          if (prop !== 'join') {
            const value = Reflect.get(target, prop, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
          }

          return async function joinWithTngHostAuth(roomName) {
            const connection = await target.join(roomName);
            if (!connection || typeof connection.presence !== 'function') {
              return connection;
            }

            const originalPresence = connection.presence.bind(connection);

            return new Proxy(connection, {
              get(conn, key, connReceiver) {
                if (key === 'emit') {
                  const originalEmit = conn.emit.bind(conn);
                  return function identityAwareEmit(topic, data) {
                    if (
                      topic === 'state' &&
                      data &&
                      typeof data === 'object' &&
                      Array.isArray(data.ro)
                    ) {
                      const namesBySeat = new Map();
                      try {
                        conn.peers().forEach((peer) => {
                          const seat = String(peer?.presence?.seat || '');
                          const name = String(peer?.presence?.name || '');
                          if (seat && name) namesBySeat.set(seat, name);
                        });
                      } catch {}

                      if (namesBySeat.size) {
                        const next = {
                          ...data,
                          ro: data.ro.map((row) => {
                            if (!Array.isArray(row)) return row;
                            const copy = [...row];
                            const verifiedName = namesBySeat.get(String(copy[0] || ''));
                            if (verifiedName) copy[1] = verifiedName;
                            return copy;
                          }),
                        };
                        return originalEmit(topic, next);
                      }
                    }
                    return originalEmit(topic, data);
                  };
                }

                if (key !== 'presence') {
                  const value = Reflect.get(conn, key, connReceiver);
                  return typeof value === 'function' ? value.bind(conn) : value;
                }

                return async function authorizedPresence(presence) {
                  const payload =
                    presence && typeof presence === 'object'
                      ? { ...presence }
                      : {};

                  if (payload.role !== 'host') {
                    if (typeof payload.seat === 'string' && payload.seat) {
                      const token = await getHostAuthToken().catch(() => '');
                      if (!token) {
                        throw new Error('Sign in to TNG before taking a VIRAL seat.');
                      }
                      payload._tngPlayerAuth = { token };
                    }
                    return originalPresence(payload);
                  }

                  window.TNG_VIRAL_HOST_AUTH = 'verifying';

                  const token = await getHostAuthToken().catch(() => '');
                  let deviceId = '';
                  try {
                    deviceId = String(
                      window.localStorage.getItem('tng_device_id') || '',
                    ).trim();
                  } catch {}

                  if (!token || !deviceId) {
                    window.TNG_VIRAL_HOST_AUTH = 'denied';
                    throw new Error(
                      'VIRAL Host mode requires an active TNG Host Controller.',
                    );
                  }

                  payload._tngHostAuth = { token, deviceId };

                  return new Promise((resolve, reject) => {
                    let settled = false;
                    let unsubscribe = () => {};

                    const finish = (ok, message) => {
                      if (settled) return;
                      settled = true;
                      window.clearTimeout(timer);
                      try { unsubscribe(); } catch {}

                      window.TNG_VIRAL_HOST_AUTH = ok ? 'verified' : 'denied';

                      if (ok) {
                        resolve();
                      } else {
                        reject(new Error(message || 'TNG Host authorization failed.'));
                      }
                    };

                    const timer = window.setTimeout(() => {
                      finish(false, 'TNG Host authorization timed out.');
                    }, 7000);

                    try {
                      unsubscribe = connection.on('__tng_host_auth', (message) => {
                        const data = message?.data || {};
                        if (data.ok === true) {
                          finish(true);
                          return;
                        }

                        if (data.code === 'ROOM_HOST_OWNED') {
                          finish(false, 'That VIRAL room is already owned by another TNG Host.');
                          return;
                        }

                        finish(false, 'This browser is not authorized as the TNG Host.');
                      });
                    } catch {
                      finish(false, 'TNG Host authorization could not start.');
                      return;
                    }

                    originalPresence(payload).catch((error) => {
                      finish(false, error?.message || 'TNG Host authorization could not be sent.');
                    });
                  });
                };
              },
            });
          };
        },
      });
    };

    window.__TNG_VIRAL_HOST_AUTH_BRIDGED__ = true;
  }

  function revealOnlineTabs() {
    if (document.getElementById('tng-viral-online-tabs')) return;
    const style = document.createElement('style');
    style.id = 'tng-viral-online-tabs';
    style.textContent = '#tHost,#tJoin{display:inline-flex!important}';
    document.head.appendChild(style);
  }

  function detectHostMode() {
    // Joiners and watch-only display clients must never claim a paired TNG display.
    if (requestedDisplay || requestedJoin) return false;
    if (hostModeActive) return true;

    const hostTab = document.getElementById('tHost');
    const hostPanel =
      document.getElementById('hostPanel') ||
      document.getElementById('hostSetup') ||
      document.getElementById('hOpen')?.closest('[role="tabpanel"], .panel, .view, section, div');

    const hostTabSelected =
      hostTab?.getAttribute('aria-selected') === 'true' ||
      hostTab?.classList.contains('active') ||
      hostTab?.classList.contains('selected');

    const hostControlsVisible = Boolean(
      document.getElementById('hOpen') &&
      document.getElementById('hOpen').offsetParent !== null
    );

    hostModeActive = Boolean(hostTabSelected || hostControlsVisible || hostPanel?.offsetParent !== null);
    return hostModeActive;
  }

  function autoHost() {
    if (!requestedHost) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const hostTab = document.getElementById('tHost');
      if (hostTab) {
        hostModeActive = true;
        hostTab.click();
        window.clearInterval(timer);
      }
      if (attempts >= 80) window.clearInterval(timer);
    }, 125);
  }

  function autoDisplayJoin() {
    if (!/^[A-Z]{4}$/.test(requestedDisplay)) return;

    let attempts = 0;
    let submitted = false;
    const timer = window.setInterval(() => {
      attempts += 1;

      if (!submitted) {
        const joinTab = document.getElementById('tJoin');
        const codeInput = document.getElementById('jCode');
        const joinButton = document.getElementById('jGo');

        if (joinTab && (!codeInput || !joinButton)) {
          joinTab.click();
        }

        const readyInput = document.getElementById('jCode');
        const readyButton = document.getElementById('jGo');
        if (readyInput && readyButton) {
          readyInput.value = requestedDisplay;
          readyInput.dispatchEvent(new Event('input', { bubbles: true }));
          readyButton.click();
          submitted = true;
        }
      }

      if (submitted) {
        const watchOnly = document.getElementById('watchOnly');
        if (watchOnly) {
          watchOnly.click();
          window.setTimeout(() => {
            document.getElementById('btnOverview')?.click();
          }, 250);
          window.clearInterval(timer);
          return;
        }
      }

      if (attempts >= 120) window.clearInterval(timer);
    }, 125);
  }

  function autoJoin() {
    if (!/^[A-Z]{4}$/.test(requestedJoin)) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;

      const joinTab = document.getElementById('tJoin');
      if (joinTab) {
        joinTab.click();

        window.setTimeout(() => {
          const codeInput = document.getElementById('jCode');
          const joinButton = document.getElementById('jGo');
          if (!codeInput || !joinButton) return;

          codeInput.value = requestedJoin;
          codeInput.dispatchEvent(new Event('input', { bubbles: true }));
          joinButton.click();
          window.clearInterval(timer);
        }, 80);
      }

      if (attempts >= 80) window.clearInterval(timer);
    }, 125);
  }

  function currentRoomCode() {
    const fromJoin = String(params.get('join') || '').trim().toUpperCase();
    if (/^[A-Z]{4}$/.test(fromJoin)) return fromJoin;
    if (/^[A-Z]{4}$/.test(requestedDisplay)) return requestedDisplay;

    const tag = String(document.getElementById('roomTag')?.textContent || '');
    const match = tag.match(/ROOM\s+([A-Z]{4})/i);
    return match ? match[1].toUpperCase() : '';
  }

  let cachedHostToken = '';
  let displaySyncTimer = null;

  async function getHostAuthToken(forceRefresh = false) {
    if (cachedHostToken && !forceRefresh) return cachedHostToken;

    const response = await fetch(`${RELAY_ORIGIN}/neon-auth/get-session`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return '';
    const payload = await response.json().catch(() => null);
    const token =
      payload?.data?.session?.token ||
      payload?.data?.token ||
      payload?.session?.token ||
      payload?.token ||
      '';
    if (token) cachedHostToken = token;
    return token;
  }

  async function syncHostDisplay(forceRefresh = false) {
    if (!detectHostMode()) return;

    const token = await getHostAuthToken(forceRefresh).catch(() => '');
    if (!token) return;

    const send = async (authToken) => fetch(`${RELAY_ORIGIN}/viral-display`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomCode: currentRoomCode() || null,
      }),
    });

    let response = await send(token).catch(() => null);
    try {
      window.sessionStorage.setItem(
        'tng_viral_display_sync',
        response ? `status:${response.status}` : 'network-error'
      );
    } catch {}

    if (response?.status === 401 && !forceRefresh) {
      cachedHostToken = '';
      const fresh = await getHostAuthToken(true).catch(() => '');
      if (fresh) response = await send(fresh).catch(() => null);
    }

    if (response?.ok) {
      const payload = await response.clone().json().catch(() => null);
      viralDisplayAttached = payload?.displayAttached === true;
    }
  }

  function startHostDisplaySync() {
    // A VIRAL display iframe uses ?display=ROOM and a player uses ?join=ROOM.
    // Neither should run host verification/claim heartbeats.
    if (requestedDisplay || requestedJoin || displaySyncTimer) return;

    const hostTab = document.getElementById('tHost');
    hostTab?.addEventListener('click', () => {
      hostModeActive = true;
      syncHostDisplay();
    });

    syncHostDisplay();
    displaySyncTimer = window.setInterval(() => {
      syncHostDisplay();
    }, 4000);
  }

  function mountSessionBar() {
    if (requestedDisplay || document.getElementById('tng-viral-session-root')) return;

    const playerMode = /^[A-Z]{4}$/.test(requestedJoin);
    const hostMode = !playerMode && detectHostMode();
    if (!playerMode && !hostMode) return;

    const style = document.createElement('style');
    style.id = 'tng-viral-session-layout';
    style.textContent = `
      .app {
        height: calc(100% - 68px) !important;
        margin-top: 68px !important;
      }
      @media (max-width: 700px) {
        .app {
          height: calc(100% - 76px) !important;
          margin-top: 76px !important;
        }
      }
    `;
    document.head.appendChild(style);

    const host = document.createElement('div');
    host.id = 'tng-viral-session-root';
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });

    root.innerHTML = `
      <style>
        :host { all: initial; }
        *, *::before, *::after { box-sizing: border-box; }
        .bar {
          position: fixed; left: 10px; right: 10px; top: 8px; z-index: 2147482500;
          min-height: 52px; border: 1px solid rgba(188,19,254,.42); border-radius: 13px;
          background: rgba(3,2,7,.96); color: #fff; padding: 8px 10px;
          box-shadow: 0 10px 28px rgba(0,0,0,.5), 0 0 20px rgba(188,19,254,.10);
          backdrop-filter: blur(14px);
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        }
        .left { min-width: 0; display: flex; align-items: center; gap: 10px; }
        .rocket { font-size: 22px; line-height: 1; }
        .info { min-width: 0; }
        .titleline { display:flex; align-items:center; gap:9px; min-width:0; }
        .title { font-size: 15px; font-weight: 900; letter-spacing:.04em; white-space:nowrap; }
        .code { color:#FFD700; font: 800 15px/1 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.15em; white-space:nowrap; }
        .status { margin-top:5px; display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
        .tag { display:inline-flex; align-items:center; gap:5px; font-size:8px; font-weight:800; letter-spacing:.13em; text-transform:uppercase; white-space:nowrap; }
        .hosttag { color:#BC13FE; }
        .player { color:#22D3EE; }
        .display { color:#FFD700; }
        .people { color:#4ADE80; }
        .dot { width:7px; height:7px; border-radius:999px; background:currentColor; box-shadow:0 0 8px currentColor; }
        .actions { display:flex; flex-shrink:0; align-items:center; gap:7px; }
        button {
          border:1px solid rgba(255,255,255,.18); border-radius:9px; background:rgba(255,255,255,.03);
          color:#fff; padding:9px 11px; cursor:pointer; font:800 9px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          letter-spacing:.09em; text-transform:uppercase;
        }
        button:hover { border-color:rgba(255,215,0,.65); color:#FFD700; }
        .leave { border-color:rgba(248,113,113,.45); color:#f87171; }
        .leave:hover { border-color:#f87171; color:#fca5a5; }
        @media (max-width:600px) {
          .bar { top:6px; left:6px; right:6px; padding:8px; }
          .title { font-size:13px; }
          .code { font-size:13px; }
          .status { gap:7px; }
          .tag { font-size:7px; }
          .actions button { padding:9px 8px; font-size:8px; }
          .rocket { display:none; }
        }
      </style>
      <div class="bar">
        <div class="left">
          <div class="rocket">🚀</div>
          <div class="info">
            <div class="titleline">
              <span class="title">VIRAL!</span>
              <span class="code">----</span>
            </div>
            <div class="status">
              <span class="tag mode"></span>
              <span class="tag displaytag" hidden><i class="dot"></i><span class="displaytext">DISPLAY</span></span>
              <span class="tag people"><i class="dot"></i><span class="peercount">0 CONNECTED</span></span>
            </div>
          </div>
        </div>
        <div class="actions">
          <button class="leave" type="button">${hostMode ? 'BACK TO HOST' : 'LEAVE GAME'}</button>
        </div>
      </div>
    `;

    const codeEl = root.querySelector('.code');
    const modeEl = root.querySelector('.mode');
    const displayTag = root.querySelector('.displaytag');
    const displayText = root.querySelector('.displaytext');
    const peerEl = root.querySelector('.peercount');
    const leave = root.querySelector('.leave');

    modeEl.className = `tag mode ${hostMode ? 'hosttag' : 'player'}`;
    modeEl.innerHTML = `<i class="dot"></i><span>${hostMode ? 'LIVE HOST' : 'PLAYER'}</span>`;

    async function exitHost() {
      leave.disabled = true;
      leave.textContent = 'EXITING…';

      try {
        const token = await getHostAuthToken().catch(() => '');
        if (token) {
          await fetch(`${RELAY_ORIGIN}/viral-display`, {
            method: 'DELETE',
            keepalive: true,
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }).catch(() => null);
        }
      } finally {
        window.location.replace('/host');
      }
    }

    leave.addEventListener('click', () => {
      if (hostMode) {
        exitHost();
      } else {
        window.location.replace('/games');
      }
    });

    function refreshBar() {
      const code = currentRoomCode();
      codeEl.textContent = code || '----';

      if (hostMode) {
        displayTag.hidden = false;
        displayTag.className = `tag displaytag ${viralDisplayAttached ? 'people' : 'display'}`;
        displayText.textContent = viralDisplayAttached ? 'DISPLAY CONNECTED' : 'HOST ONLY';
      } else {
        displayTag.hidden = true;
      }

      const peers = Math.max(0, Number(viralPeerCount || 0));
      peerEl.textContent = `${peers} CONNECTED`;
    }

    refreshBar();
    const timer = window.setInterval(refreshBar, 750);
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
  }

  function startSessionBarDetection() {
    if (requestedDisplay) return;

    mountSessionBar();
    if (document.getElementById('tng-viral-session-root')) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      mountSessionBar();
      if (document.getElementById('tng-viral-session-root') || attempts > 80) {
        window.clearInterval(timer);
      }
    }, 125);
  }

  function mountFeedback() {
    if (document.getElementById('tng-viral-feedback-root')) return;

    const host = document.createElement('div');
    host.id = 'tng-viral-feedback-root';
    document.body.appendChild(host);

    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        *, *::before, *::after { box-sizing: border-box; }
        button, textarea, select, input { font: inherit; }
        .fab {
          position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
          border: 1px solid rgba(255,215,0,.65); border-radius: 999px;
          background: rgba(5,2,8,.94); color: #FFD700; padding: 11px 15px;
          font: 700 11px/1.1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          letter-spacing: .08em; text-transform: uppercase; cursor: pointer;
          box-shadow: 0 0 22px rgba(255,215,0,.18);
        }
        .shade {
          position: fixed; inset: 0; z-index: 2147483001; display: none;
          align-items: center; justify-content: center; padding: 16px;
          background: rgba(0,0,0,.82);
        }
        .shade.open { display: flex; }
        .panel {
          width: min(520px,100%); border: 1px solid rgba(188,19,254,.6);
          border-radius: 18px; padding: 18px; color: white; background: #08030f;
          box-shadow: 0 0 60px rgba(188,19,254,.18);
          font: 14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        }
        .top { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        h2 { margin:0; color:#FFD700; font-size:18px; letter-spacing:.08em; text-transform:uppercase; }
        .meta { margin-top:4px; color:rgba(255,255,255,.48); font-size:12px; }
        .close { border:1px solid rgba(255,255,255,.16); background:transparent; color:rgba(255,255,255,.7); border-radius:9px; padding:7px 10px; cursor:pointer; }
        .types { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; margin:14px 0 10px; }
        .type { border:1px solid rgba(255,255,255,.16); background:transparent; color:rgba(255,255,255,.62); border-radius:9px; padding:9px 6px; cursor:pointer; font-weight:700; text-transform:uppercase; font-size:11px; }
        .type.active { border-color:#FFD700; color:#FFD700; background:rgba(255,215,0,.08); }
        textarea { width:100%; min-height:130px; resize:vertical; border:1px solid rgba(255,255,255,.16); border-radius:11px; background:rgba(0,0,0,.55); color:white; padding:11px; outline:none; }
        textarea:focus { border-color:#BC13FE; }
        .send { width:100%; margin-top:11px; border:2px solid #BC13FE; border-radius:11px; background:rgba(188,19,254,.14); color:#e7bdff; padding:11px; cursor:pointer; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
        .send:disabled { opacity:.4; cursor:default; }
        .status { min-height:20px; margin-top:8px; color:#FFD700; font-size:12px; }
        @media (max-width:520px){ .types{grid-template-columns:repeat(2,1fr)} .fab{right:10px;bottom:10px} }
      </style>
      <button class="fab" type="button">Report / Feedback</button>
      <div class="shade" role="dialog" aria-modal="true" aria-label="VIRAL human test feedback">
        <form class="panel">
          <div class="top">
            <div><h2>Human Test Report</h2><div class="meta">VIRAL! <span class="roommeta"></span></div></div>
            <button class="close" type="button">Close</button>
          </div>
          <div class="types">
            <button class="type active" type="button" data-type="bug">Bug</button>
            <button class="type" type="button" data-type="confusing">Confusing</button>
            <button class="type" type="button" data-type="feedback">Feedback</button>
            <button class="type" type="button" data-type="idea">Idea</button>
          </div>
          <textarea maxlength="3000" placeholder="What happened? What were you trying to do? If it broke, tell us what you saw."></textarea>
          <div class="status"></div>
          <button class="send" type="submit">Send Report</button>
        </form>
      </div>
    `;

    const fab = root.querySelector('.fab');
    const shade = root.querySelector('.shade');
    const close = root.querySelector('.close');
    const form = root.querySelector('form');
    const textarea = root.querySelector('textarea');
    const send = root.querySelector('.send');
    const status = root.querySelector('.status');
    const roomMeta = root.querySelector('.roommeta');
    const typeButtons = [...root.querySelectorAll('.type')];
    let reportType = 'bug';

    function open() {
      const room = currentRoomCode();
      roomMeta.textContent = room ? `· Room ${room}` : '';
      shade.classList.add('open');
      window.setTimeout(() => textarea.focus(), 0);
    }

    function shut() {
      shade.classList.remove('open');
      status.textContent = '';
    }

    fab.addEventListener('click', open);
    close.addEventListener('click', shut);
    shade.addEventListener('click', (event) => {
      if (event.target === shade) shut();
    });

    typeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        reportType = button.dataset.type || 'feedback';
        typeButtons.forEach((item) => item.classList.toggle('active', item === button));
      });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = textarea.value.trim();
      if (message.length < 3) return;

      send.disabled = true;
      send.textContent = 'Sending…';
      status.textContent = '';

      try {
        const response = await fetch(`${API_BASE}/test-feedback`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: 'viral',
            roomCode: currentRoomCode(),
            reportType,
            message,
            pageUrl: window.location.href,
            userAgent: navigator.userAgent,
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error?.message || `Could not send report (${response.status}).`);
        }

        textarea.value = '';
        status.textContent = 'Sent. Thank you.';
        window.setTimeout(shut, 900);
      } catch (error) {
        status.textContent = error?.message || 'Could not send report.';
      } finally {
        send.disabled = false;
        send.textContent = 'Send Report';
      }
    });
  }

  function boot() {
    installClaudeCompatibilityBridge();
    installHostAuthorizationBridge();

    if (!requestedDisplay) {
      revealOnlineTabs();
      mountFeedback();
    }

    startHostDisplaySync();
    startSessionBarDetection();
    autoHost();
    autoJoin();
    autoDisplayJoin();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
