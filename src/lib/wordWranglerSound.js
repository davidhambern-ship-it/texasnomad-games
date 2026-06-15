// Sound manager for Word Wrangler game
// Uses Web Audio API for placeholder sounds that can be replaced with real audio files

class SoundManager {
  constructor() {
    this.muted = false;
    this.volume = 0.5;
    this.audioContext = null;
    this.sounds = {};
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  setMute(muted) {
    this.muted = muted;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  // Generate a simple beep tone
  playTone(frequency, duration, type = 'sine', startTime = 0) {
    if (this.muted || !this.audioContext) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    const now = this.audioContext.currentTime + startTime;
    gainNode.gain.setValueAtTime(this.volume * 0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  // Play whiplash sound for valid word
  playWhiplash() {
    this.init();
    if (this.muted) return;
    
    // Quick rising swipe sound
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(200, now);
    oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.15);
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(this.volume * 0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }

  // Play wrong/dry click sound
  playWrong() {
    this.init();
    if (this.muted) return;
    
    this.playTone(150, 0.1, 'square');
    setTimeout(() => this.playTone(100, 0.15, 'square'), 80);
  }

  // Play spurs jingle for tile selection
  playSpurs() {
    this.init();
    if (this.muted) return;
    
    this.playTone(600, 0.05, 'sine');
    setTimeout(() => this.playTone(800, 0.05, 'sine'), 50);
  }

  // Play rattlesnake sound for Outlaw tile
  playRattlesnake() {
    this.init();
    if (this.muted) return;
    
    // Create noise buffer for rattle effect
    const bufferSize = this.audioContext.sampleRate * 0.5;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(this.volume * 0.5, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
    
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    noise.start();
  }

  // Play gunshot sound
  playGunshot() {
    this.init();
    if (this.muted) return;
    
    // Noise burst
    const bufferSize = this.audioContext.sampleRate * 0.3;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(this.volume * 0.8, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    noise.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    noise.start();
  }

  // Play gold sparkle sound
  playGoldSparkle() {
    this.init();
    if (this.muted) return;
    
    // High-pitched twinkling
    [0, 50, 100].forEach((delay, i) => {
      setTimeout(() => {
        this.playTone(1200 + i * 200, 0.1, 'sine');
      }, delay);
    });
  }

  // Play diamond shine sound
  playDiamondShine() {
    this.init();
    if (this.muted) return;
    
    // Even higher twinkling
    [0, 40, 80, 120].forEach((delay, i) => {
      setTimeout(() => {
        this.playTone(1500 + i * 150, 0.08, 'sine');
      }, delay);
    });
  }

  // Play saloon doors sound
  playSaloonDoors() {
    this.init();
    if (this.muted) return;
    
    this.playTone(300, 0.2, 'triangle');
    setTimeout(() => this.playTone(250, 0.3, 'triangle'), 150);
  }

  // Play cup fill sound (score increase)
  playCupFill() {
    this.init();
    if (this.muted) return;
    
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(400, now);
    oscillator.frequency.linearRampToValueAtTime(600, now + 0.2);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(this.volume * 0.3, now);
    gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);
    
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }

  // Play crowd cheer
  playCrowdCheer() {
    this.init();
    if (this.muted) return;
    
    // Create noise with varying pitch
    const bufferSize = this.audioContext.sampleRate * 1.5;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.volume * 0.6, this.audioContext.currentTime + 0.5);
    gainNode.gain.linearRampToValueAtTime(0.01, this.audioContext.currentTime + 1.5);
    
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    noise.start();
  }

  // Play tile pop/disappear sound
  playTilePop() {
    this.init();
    if (this.muted) return;
    
    this.playTone(500, 0.08, 'sine');
  }

  // Play tile drop sound
  playTileDrop() {
    this.init();
    if (this.muted) return;
    
    this.playTone(300, 0.05, 'triangle');
  }
}

export const soundManager = new SoundManager();