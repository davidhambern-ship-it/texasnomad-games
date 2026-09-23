const SQUARE_BIZ_AUDIO_ID = 'tng-square-biz-shared-jingle';
export const SQUARE_BIZ_AUDIO_SRC = '/assets/square-biz/Square%20Biz!.mp3';

export function getSquareBizAudio(audioSrc = SQUARE_BIZ_AUDIO_SRC) {
  if (typeof document === 'undefined') return null;

  let audio = document.getElementById(SQUARE_BIZ_AUDIO_ID);

  if (!audio) {
    audio = document.createElement('audio');
    audio.id = SQUARE_BIZ_AUDIO_ID;
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('aria-hidden', 'true');
    audio.style.display = 'none';
    document.body.appendChild(audio);
  }

  const resolved = new URL(audioSrc, window.location.origin).href;
  if (audio.src !== resolved) {
    audio.src = audioSrc;
    audio.load();
  }

  return audio;
}

export async function primeSquareBizAudio() {
  const audio = getSquareBizAudio();
  if (!audio) return false;

  const previousVolume = audio.volume;

  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0.001;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    return true;
  } catch {
    return false;
  } finally {
    audio.volume = Number.isFinite(previousVolume) ? previousVolume : 1;
  }
}
