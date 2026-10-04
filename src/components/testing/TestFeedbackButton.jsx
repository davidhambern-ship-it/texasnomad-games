import React, { useState } from 'react';
import { submitTestFeedback } from '@/api/testFeedback';

const TYPES = [
  ['bug', 'Bug'],
  ['confusing', 'Confusing'],
  ['feedback', 'Feedback'],
  ['idea', 'Idea'],
];

export default function TestFeedbackButton({
  gameId,
  roomCode = '',
  testerName = '',
}) {
  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    setStatus('');

    try {
      await submitTestFeedback({
        gameId,
        roomCode,
        reportType,
        message: message.trim(),
        testerName,
      });
      setMessage('');
      setStatus('Sent. Thank you.');
      setTimeout(() => {
        setOpen(false);
        setStatus('');
      }, 1000);
    } catch (error) {
      setStatus(error?.message || 'Could not send report.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[240] rounded-full border border-[#FFD700]/60 bg-black/90 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,.18)]"
      >
        Report / Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-black/80 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <form
            onSubmit={submit}
            className="w-full max-w-lg rounded-2xl border border-[#BC13FE]/50 bg-[#08030f] p-5 text-left text-white shadow-[0_0_60px_rgba(188,19,254,.18)]"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-bold uppercase tracking-wider text-[#FFD700]">
                  Human Test Report
                </div>
                <div className="mt-1 text-xs text-white/50">
                  {String(gameId || 'game').toUpperCase()}
                  {roomCode ? ` · Room ${roomCode}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/60"
              >
                Close
              </button>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TYPES.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setReportType(value)}
                  className="rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wide"
                  style={{
                    borderColor: reportType === value ? '#FFD700' : 'rgba(255,255,255,.15)',
                    color: reportType === value ? '#FFD700' : 'rgba(255,255,255,.6)',
                    background: reportType === value ? 'rgba(255,215,0,.08)' : 'transparent',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              maxLength={3000}
              placeholder="What happened? What were you trying to do? If it broke, tell us what you saw."
              className="w-full resize-y rounded-xl border border-white/15 bg-black/60 p-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#BC13FE]"
              autoFocus
            />

            {status && (
              <div className="mt-3 text-sm text-[#FFD700]">{status}</div>
            )}

            <button
              type="submit"
              disabled={sending || message.trim().length < 3}
              className="mt-4 w-full rounded-xl border-2 border-[#BC13FE] bg-[#BC13FE]/15 px-4 py-3 text-sm font-bold uppercase tracking-widest text-[#E5B8FF] disabled:opacity-40"
            >
              {sending ? 'Sending…' : 'Send Report'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
