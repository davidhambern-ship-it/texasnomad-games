(() => {
  const params = new URLSearchParams(window.location.search);
  const requestedJoin = String(params.get('join') || '').trim().toUpperCase();

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
        }, 60);
      }

      if (attempts >= 80) window.clearInterval(timer);
    }, 125);
  }

  const API_BASE = window.location.hostname.endsWith('.up.railway.app')
    ? ''
    : 'https://tng-live-production.up.railway.app';

  function currentRoomCode() {
    const fromQuery = String(params.get('join') || '').trim().toUpperCase();
    if (/^[A-Z]{4}$/.test(fromQuery)) return fromQuery;

    const tag = String(document.getElementById('roomTag')?.textContent || '');
    const match = tag.match(/ROOM\s+([A-Z]{4})/i);
    return match ? match[1].toUpperCase() : '';
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mountFeedback();
      autoJoin();
    }, { once: true });
  } else {
    mountFeedback();
    autoJoin();
  }
})();
