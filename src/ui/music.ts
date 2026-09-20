import medievalTrackUrl from '../assets/medieval_horizons-medieval-horizons-my-pointed-shoes-470870.mp3';

let audioEl: HTMLAudioElement | null = null;
let userVolume = 0.5;

function ensureAudio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio(medievalTrackUrl);
    audioEl.loop = true;
    audioEl.volume = userVolume;
  }
  return audioEl;
}

export function startMusic(): void {
  const audio = ensureAudio();
  if (audio.paused) void audio.play().catch(() => {});
}

export function setMusicVolume(v: number): void {
  userVolume = Math.max(0, Math.min(1, v));
  const audio = ensureAudio();
  audio.volume = userVolume;
  if (userVolume > 0 && audio.paused) void audio.play().catch(() => {});
}
