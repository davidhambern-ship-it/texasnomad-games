import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';

export default function BFFGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');

  if (!roomCode) {
    window.location.href = '/';
    return null;
  }

  return <BFFViewer roomCode={roomCode} />;
}

// postMessage bridge script injected into the HTML iframe
const BRIDGE_SCRIPT = `
<script>
(function() {
  // Wait for the board to be fully initialized
  function waitForBoard(cb) {
    if (typeof renderAll === 'function') { cb(); }
    else { setTimeout(() => waitForBoard(cb), 100); }
  }

  window.addEventListener('message', function(e) {
    waitForBoard(function() {
      var cmd = e.data;
      if (!cmd || !cmd.type) return;

      if (cmd.type === 'LOAD_SURVEY') {
        // Override the current question with data from the host
        if (cmd.question && cmd.answers) {
          questions[currentQuestion] = {
            question: cmd.question,
            answers: cmd.answers.map(function(a) { return { answer: a.text, points: a.points }; })
          };
          setupRevealArray();
          byeStep = 0;
          deadRevealMode = false;
          endSteal(false, true);
          renderAll();
        }
      }

      if (cmd.type === 'SET_FAMILIES') {
        if (cmd.family1) { leftFamilyName = cmd.family1; }
        if (cmd.family2) { rightFamilyName = cmd.family2; }
        renderFamilyNames();
        renderBankOwner();
      }

      if (cmd.type === 'SET_SCORES') {
        if (typeof cmd.score1 === 'number') leftScore = cmd.score1;
        if (typeof cmd.score2 === 'number') rightScore = cmd.score2;
        renderScores();
      }

      if (cmd.type === 'REVEAL_ANSWER') {
        if (typeof cmd.index === 'number') {
          toggleReveal(cmd.index, false);
        }
      }

      if (cmd.type === 'REVEAL_ALL') {
        getRound().answers.forEach(function(_, i) {
          if (!revealed[i]) { revealed[i] = true; }
        });
        renderAnswers();
        renderBank();
        renderScores();
      }

      if (cmd.type === 'CLEAR_BOARD') {
        clearBoard();
      }

      if (cmd.type === 'TRIGGER_BYE') {
        triggerBye();
      }

      if (cmd.type === 'SET_BANK') {
        if (typeof cmd.value === 'number') {
          roundBankScore = cmd.value;
          renderBank();
        }
      }

      if (cmd.type === 'SET_ACTIVE_TURN') {
        // left = family1, right = family2
        if (cmd.turn === 1) { bankOwner = 'left'; }
        if (cmd.turn === 2) { bankOwner = 'right'; }
        renderBankOwner();
      }
    });
  });
})();
<\/script>
`;

const BFF_HTML_URL = 'https://media.base44.com/files/public/6a1faf9539e2c1e12925ead8/9ab2a4d29_BFF-GameBoard-v73-fuzzy-synonym-scan.html';

function BFFViewer({ roomCode }) {
  const { room, loading } = useGameRoom(roomCode, 'bff', 'viewer');
  const gs = room?.game_state || {};
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [iframeReady, setIframeReady] = useState(false);
  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const prevGsRef = useRef({});

  // Load & patch the HTML once
  useEffect(() => {
    fetch(BFF_HTML_URL)
      .then(r => r.text())
      .then(html => {
        // Inject bridge script just before </body>
        const patched = html.replace('</body>', BRIDGE_SCRIPT + '</body>');
        setHtmlContent(patched);
      });
  }, []);

  // Fullscreen handler
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  // Send a postMessage to the iframe
  const sendToBoard = useCallback((msg) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(msg, '*');
    } catch (e) {}
  }, []);

  // When iframe loads, mark ready and do a full sync
  const handleIframeLoad = () => {
    setIframeReady(true);
  };

  // Sync game state into iframe whenever it changes
  useEffect(() => {
    if (!iframeReady || !gs) return;
    const prev = prevGsRef.current;

    // Family names
    if (gs.family1 !== prev.family1 || gs.family2 !== prev.family2) {
      sendToBoard({ type: 'SET_FAMILIES', family1: gs.family1, family2: gs.family2 });
    }

    // Scores
    if (gs.score1 !== prev.score1 || gs.score2 !== prev.score2) {
      sendToBoard({ type: 'SET_SCORES', score1: gs.score1 || 0, score2: gs.score2 || 0 });
    }

    // Active turn
    if (gs.active_turn !== prev.active_turn) {
      sendToBoard({ type: 'SET_ACTIVE_TURN', turn: gs.active_turn });
    }

    // Round bank
    if (gs.round_bank !== prev.round_bank) {
      sendToBoard({ type: 'SET_BANK', value: gs.round_bank || 0 });
    }

    // Survey/question changed
    const questionChanged = gs.current_question !== prev.current_question;
    const answersChanged = JSON.stringify(gs.answers) !== JSON.stringify(prev.answers);

    if (questionChanged || answersChanged) {
      if (gs.current_question && gs.answers?.length > 0) {
        sendToBoard({
          type: 'LOAD_SURVEY',
          question: gs.current_question,
          answers: gs.answers,
        });
      }
    } else if (iframeReady && gs.answers?.length > 0) {
      // Sync individual reveals
      gs.answers.forEach((ans, i) => {
        const wasRevealed = prev.answers?.[i]?.revealed;
        if (ans.revealed && !wasRevealed) {
          sendToBoard({ type: 'REVEAL_ANSWER', index: i });
        }
      });
    }

    prevGsRef.current = JSON.parse(JSON.stringify(gs));
  }, [gs, iframeReady, sendToBoard]);

  // On first ready, do a full sync
  useEffect(() => {
    if (!iframeReady || !gs?.current_question) return;
    const timer = setTimeout(() => {
      sendToBoard({ type: 'SET_FAMILIES', family1: gs.family1, family2: gs.family2 });
      sendToBoard({ type: 'SET_SCORES', score1: gs.score1 || 0, score2: gs.score2 || 0 });
      sendToBoard({ type: 'SET_ACTIVE_TURN', turn: gs.active_turn });
      sendToBoard({ type: 'SET_BANK', value: gs.round_bank || 0 });
      if (gs.current_question && gs.answers?.length > 0) {
        sendToBoard({ type: 'LOAD_SURVEY', question: gs.current_question, answers: gs.answers });
        // After a brief delay, reveal any already-revealed answers
        setTimeout(() => {
          gs.answers?.forEach((ans, i) => {
            if (ans.revealed) sendToBoard({ type: 'REVEAL_ANSWER', index: i });
          });
        }, 600);
      }
      prevGsRef.current = JSON.parse(JSON.stringify(gs));
    }, 800); // small delay to let board JS finish init
    return () => clearTimeout(timer);
  }, [iframeReady]); // eslint-disable-line

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <header className="sticky top-0 z-50 border-b border-[#BC13FE]/30 bg-[#050505]/90 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-2 text-[#FFD700] hover:text-[#FF5F1F] transition-colors">
              <div className="w-7 h-7 rounded-full bg-[#BC13FE]/20 border border-[#FFD700] flex items-center justify-center">
                <span className="font-bold text-[10px]">TN</span>
              </div>
            </Link>
            <span className="font-heading text-base tracking-widest text-[#FFD700] uppercase">BFF — BIGO FAMILY FEUD</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse" />
              <span className="font-heading text-[10px] tracking-widest text-[#BC13FE] uppercase">ROOM {roomCode}</span>
            </div>
            {room?.host_connected && (
              <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 font-heading text-[9px] tracking-widest uppercase">
                🔴 HOST LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="hidden sm:flex px-3 py-1 border border-[#FFD700]/40 text-[#FFD700]/80 font-heading text-xs tracking-widest uppercase rounded hover:bg-[#FFD700]/10 transition-all">← LOBBY</Link>
            <button onClick={handleFullscreen}
              className="px-3 py-1 bg-[#FF5F1F] text-white font-heading text-xs tracking-widest uppercase rounded hover:bg-[#FF5F1F]/80 transition-all">
              {isFullscreen ? '✕ EXIT' : '⛶ FULL'}
            </button>
          </div>
        </div>
      </header>

      {loading || !htmlContent ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 flex flex-col" style={{ background: '#080516' }}>
          <iframe
            ref={iframeRef}
            srcdoc={htmlContent}
            title="BFF Game Board"
            className="flex-1 w-full border-0"
            style={{ minHeight: 'calc(100vh - 3rem)' }}
            allow="microphone"
            allowFullScreen
            onLoad={handleIframeLoad}
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
          />
        </div>
      )}
    </div>
  );
}