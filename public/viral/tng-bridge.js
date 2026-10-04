(() => {
  const params = new URLSearchParams(window.location.search);
  const requestedJoin = String(params.get('join') || '').trim().toUpperCase();
  const requestedDisplay = String(params.get('display') || '').trim().toUpperCase();
  const requestedHost = params.get('host') === '1';
  let hostModeActive = requestedHost;

  const RELAY_ORIGIN = window.location.hostname.endsWith('.up.railway.app')
    ? window.location.origin
    : 'https://tng-live-production.up.railway.app';

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

    const response = await fetch('https://auth.texasnomadgames.com/neon-auth/get-session', {
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

    if (!requestedDisplay) {
      revealOnlineTabs();
      mountFeedback();
    }

    startHostDisplaySync();
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
