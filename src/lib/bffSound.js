const RAW_BASE = 'https://raw.githubusercontent.com/jonjonsson/SoundMonster/main/Attribution%20license';

export const BFF_SOUND_URLS = {
  applause: `${RAW_BASE}/applause.mp3`,
  awww: `${RAW_BASE}/aww%20group.mp3`,
  buzz: `${RAW_BASE}/buzzer.mp3`,
  correct: `${RAW_BASE}/ding%20bell.mp3`,
  bye: `${RAW_BASE}/buzzer.mp3`,
  round_start: `${RAW_BASE}/announcement%20timpani%20roll.mp3`,
};

const cache = new Map();

function getAudio(name) {
  const url = BFF_SOUND_URLS[name];
  if (!url || typeof Audio === 'undefined') return null;

  if (!cache.has(name)) {
    const audio = new Audio(url);
    audio.preload = 'auto';
    cache.set(name, audio);
  }

  return cache.get(name);
}

export function preloadBffSounds() {
  if (typeof Audio === 'undefined') return;
  Object.keys(BFF_SOUND_URLS).forEach((name) => {
    const audio = getAudio(name);
    try {
      audio?.load?.();
    } catch {
      // Browsers can defer media loading until the first user interaction.
    }
  });
}

let unlockArmed = false;

export function armBffSoundUnlock() {
  if (typeof document === 'undefined' || unlockArmed) return;
  unlockArmed = true;

  const unlock = () => {
    Object.keys(BFF_SOUND_URLS).forEach((name) => {
      const audio = getAudio(name);
      if (!audio) return;

      try {
        audio.muted = true;
        audio.currentTime = 0;
        const result = audio.play();

        Promise.resolve(result)
          .catch(() => {})
          .finally(() => {
            try {
              audio.pause();
              audio.currentTime = 0;
              audio.muted = false;
            } catch {
              // Ignore media cleanup failures.
            }
          });
      } catch {
        // A later interaction can still allow normal playback.
      }
    });
  };

  document.addEventListener('pointerdown', unlock, { once: true, capture: true });
  document.addEventListener('keydown', unlock, { once: true, capture: true });
}

export async function playBffSound(name, { volume = 0.9 } = {}) {
  const audio = getAudio(name);
  if (!audio) return false;

  try {
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    audio.volume = Math.max(0, Math.min(1, Number(volume) || 0.9));
    await audio.play();
    return true;
  } catch (error) {
    console.warn('[BFF Sound] playback blocked or unavailable', name, error);
    return false;
  }
}
