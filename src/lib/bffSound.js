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

export async function playBffSound(name, { volume = 0.9 } = {}) {
  const template = getAudio(name);
  if (!template) return false;

  try {
    const audio = template.cloneNode(true);
    audio.volume = Math.max(0, Math.min(1, Number(volume) || 0.9));
    await audio.play();
    return true;
  } catch (error) {
    console.warn('[BFF Sound] playback blocked or unavailable', name, error);
    return false;
  }
}
