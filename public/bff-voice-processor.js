class BFFVoiceCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = Math.max(320, Math.round(sampleRate * 0.02));
    this.buffer = new Float32Array(this.chunkSize);
    this.offset = 0;
  }

  flush() {
    if (!this.offset) return;

    const pcm = new Int16Array(this.offset);
    for (let i = 0; i < this.offset; i += 1) {
      const value = Math.max(-1, Math.min(1, this.buffer[i]));
      pcm[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
    }

    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs?.[0]?.[0];
    if (!channel?.length) return true;

    let cursor = 0;
    while (cursor < channel.length) {
      const available = this.chunkSize - this.offset;
      const count = Math.min(available, channel.length - cursor);
      this.buffer.set(channel.subarray(cursor, cursor + count), this.offset);
      this.offset += count;
      cursor += count;

      if (this.offset >= this.chunkSize) this.flush();
    }

    return true;
  }
}

registerProcessor('bff-voice-capture', BFFVoiceCaptureProcessor);
