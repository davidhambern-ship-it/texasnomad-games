import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/lib/sw-cleanup.js'

function showGlobalCrash(kind, errorLike, eventMeta = {}) {
  try {
    const sourceError = errorLike?.reason || errorLike;
    const message =
      sourceError?.message ||
      errorLike?.message ||
      errorLike?.reason?.message ||
      errorLike?.reason ||
      String(errorLike || 'Unknown error');
    const stack = sourceError?.stack || errorLike?.stack || '';
    const location = [
      eventMeta.filename || '',
      eventMeta.lineno ? `line ${eventMeta.lineno}` : '',
      eventMeta.colno ? `col ${eventMeta.colno}` : '',
    ].filter(Boolean).join(' • ');
    let lastAuthRequest = '';
    try {
      lastAuthRequest = localStorage.getItem('tng_last_auth_request') || '';
    } catch {}

    let overlay = document.getElementById('tng-global-crash-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'tng-global-crash-overlay';
      overlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:2147483647',
        'background:#050505',
        'color:#fff',
        'padding:24px',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'font-family:Arial,sans-serif'
      ].join(';');

      const card = document.createElement('div');
      card.style.cssText = [
        'width:min(760px,100%)',
        'border:1px solid rgba(239,68,68,.5)',
        'border-radius:16px',
        'background:rgba(239,68,68,.06)',
        'padding:24px'
      ].join(';');

      const title = document.createElement('div');
      title.textContent = 'TNG APP CRASH';
      title.style.cssText = 'color:#f87171;font-weight:700;letter-spacing:.12em;margin-bottom:12px';

      const body = document.createElement('pre');
      body.id = 'tng-global-crash-message';
      body.style.cssText = 'white-space:pre-wrap;word-break:break-word;color:rgba(255,255,255,.85);font-size:14px;line-height:1.5;margin:0';

      card.appendChild(title);
      card.appendChild(body);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
    }

    const body = document.getElementById('tng-global-crash-message');
    if (body) {
      body.textContent = [
        `${kind}: ${message}`,
        location ? `SOURCE: ${location}` : '',
        stack ? `STACK:\n${stack}` : '',
        lastAuthRequest ? `LAST NEON AUTH REQUEST: ${lastAuthRequest}` : '',
        `URL: ${window.location.href}`,
      ].filter(Boolean).join('\n\n');
    }
  } catch (overlayError) {
    console.error('[TNG global crash overlay failed]', overlayError);
  }
}

window.addEventListener('error', (event) => {
  console.error('[TNG global error]', event.error || event.message);
  showGlobalCrash('ERROR', event.error || event.message, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[TNG unhandled rejection]', event.reason);
  showGlobalCrash('UNHANDLED PROMISE', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)