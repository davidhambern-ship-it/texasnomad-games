import { useCallback, useEffect, useRef, useState } from 'react';

function wsUrl(roomCode, role, identity) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const params = new URLSearchParams({
    room: String(roomCode || ''),
    role: String(role || ''),
    id: String(identity || ''),
  });
  return `${protocol}//${window.location.host}/bff-voice?${params.toString()}`;
}

function packAudio(sampleRate, pcmBuffer) {
  const pcm = new Uint8Array(pcmBuffer);
  const packet = new ArrayBuffer(4 + pcm.byteLength);
  const view = new DataView(packet);
  view.setUint32(0, Number(sampleRate) || 48000, true);
  new Uint8Array(packet, 4).set(pcm);
  return packet;
}

export function useBffVoiceRelay({
  roomCode,
  role,
  identity,
  shouldSend = false,
  autoStart = false,
}) {
  const [status, setStatus] = useState('off');
  const [micReady, setMicReady] = useState(false);
  const [error, setError] = useState('');

  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const contextRef = useRef(null);
  const workletRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const stoppedRef = useRef(false);
  const shouldSendRef = useRef(Boolean(shouldSend));
  const nextPlaybackRef = useRef({ host: 0, player: 0 });

  useEffect(() => {
    shouldSendRef.current = Boolean(shouldSend);
    const track = streamRef.current?.getAudioTracks?.()[0];
    if (track) track.enabled = true;
  }, [shouldSend]);

  const ensureContext = useCallback(async () => {
    let context = contextRef.current;
    if (!context) {
      context = new (window.AudioContext || window.webkitAudioContext)();
      contextRef.current = context;
    }
    if (context.state === 'suspended') {
      await context.resume().catch(() => {});
    }
    return context;
  }, []);

  const playIncoming = useCallback(async (packet) => {
    if (!(packet instanceof ArrayBuffer) || packet.byteLength < 7) return;

    const view = new DataView(packet);
    const sourceKind = view.getUint8(0) === 1 ? 'host' : 'player';
    const sampleRate = view.getUint32(1, true) || 48000;
    const pcmBytes = packet.byteLength - 5;
    if (pcmBytes < 2 || pcmBytes % 2 !== 0) return;

    const samples = new Int16Array(packet.slice(5));
    const context = await ensureContext();
    const buffer = context.createBuffer(1, samples.length, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) {
      channel[i] = samples[i] / 32768;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);

    const now = context.currentTime;
    let startAt = Math.max(now + 0.025, nextPlaybackRef.current[sourceKind] || 0);

    if (startAt - now > 0.35) {
      startAt = now + 0.025;
    }

    source.start(startAt);
    nextPlaybackRef.current[sourceKind] = startAt + buffer.duration;
  }, [ensureContext]);

  const connectSocket = useCallback(() => {
    if (!roomCode || !identity || stoppedRef.current) return;

    const existing = socketRef.current;
    if (
      existing
      && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setStatus((current) => current === 'live' ? current : 'connecting');

    const socket = new WebSocket(wsUrl(roomCode, role, identity));
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;

    socket.onopen = () => {
      if (socketRef.current !== socket) return;
      setStatus('live');
      setError('');
    };

    socket.onmessage = (event) => {
      if (socketRef.current !== socket) return;

      if (typeof event.data === 'string') {
        try {
          const message = JSON.parse(event.data);
          if (message?.type === 'voice-ready') {
            setStatus('live');
          }
        } catch {}
        return;
      }

      playIncoming(event.data).catch(() => {});
    };

    socket.onerror = () => {
      if (socketRef.current !== socket) return;
      setStatus('connecting');
    };

    socket.onclose = () => {
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      if (stoppedRef.current) {
        setStatus('off');
        return;
      }

      setStatus('reconnecting');
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = window.setTimeout(connectSocket, 1200);
    };
  }, [identity, playIncoming, role, roomCode]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support microphone audio.');
      setStatus('error');
      return false;
    }

    stoppedRef.current = false;
    setError('');
    setStatus('connecting');

    try {
      let stream = streamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        streamRef.current = stream;
      }

      const context = await ensureContext();

      if (!workletRef.current) {
        await context.audioWorklet.addModule('/bff-voice-processor.js');

        const source = context.createMediaStreamSource(stream);
        const worklet = new AudioWorkletNode(context, 'bff-voice-capture');
        const silentGain = context.createGain();
        silentGain.gain.value = 0;

        source.connect(worklet);
        worklet.connect(silentGain);
        silentGain.connect(context.destination);

        worklet.port.onmessage = (event) => {
          const socket = socketRef.current;
          if (!shouldSendRef.current) return;
          if (!socket || socket.readyState !== WebSocket.OPEN) return;
          if (!(event.data instanceof ArrayBuffer)) return;

          try {
            socket.send(packAudio(context.sampleRate, event.data));
          } catch {}
        };

        workletRef.current = { source, worklet, silentGain };
      }

      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error('No microphone track was available.');
      track.enabled = true;

      setMicReady(true);
      connectSocket();
      return true;
    } catch (startError) {
      setMicReady(false);
      setStatus('error');
      setError(startError?.message || 'Microphone could not be started.');
      return false;
    }
  }, [connectSocket, ensureContext]);

  const stop = useCallback(() => {
    stoppedRef.current = true;

    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    try {
      socketRef.current?.close?.();
    } catch {}
    socketRef.current = null;

    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;

    if (workletRef.current) {
      try { workletRef.current.source?.disconnect?.(); } catch {}
      try { workletRef.current.worklet?.disconnect?.(); } catch {}
      try { workletRef.current.silentGain?.disconnect?.(); } catch {}
      workletRef.current = null;
    }

    setMicReady(false);
    setStatus('off');
  }, []);

  const setMuted = useCallback((muted) => {
    shouldSendRef.current = !muted;
  }, []);

  useEffect(() => {
    const resume = () => {
      contextRef.current?.resume?.().catch(() => {});
    };
    document.addEventListener('pointerdown', resume, { capture: true });
    document.addEventListener('keydown', resume, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', resume, { capture: true });
      document.removeEventListener('keydown', resume, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (!autoStart || !roomCode || !identity) return;
    start();
  }, [autoStart, identity, roomCode, start]);

  useEffect(() => () => {
    stoppedRef.current = true;
    if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
    try { socketRef.current?.close?.(); } catch {}
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    contextRef.current?.close?.().catch(() => {});
  }, []);

  return {
    status,
    micReady,
    error,
    start,
    stop,
    setMuted,
  };
}
