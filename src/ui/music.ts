/**
 * Procedural ambient drone — no external audio assets are available in this build.
 * A slow, minor-key pad meant to evoke an old-era fantasy title screen, generated
 * entirely with Web Audio oscillators so it can loop forever with zero asset weight.
 */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let started = false;
let userVolume = 0.05;

function ensureContext(): AudioContext {
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

export function startMusic(): void {
  if (started) {
    if (audioCtx?.state === 'suspended') void audioCtx.resume();
    return;
  }
  started = true;

  const ctx = ensureContext();
  masterGain = ctx.createGain();
  masterGain.gain.value = userVolume;
  masterGain.connect(ctx.destination);

  // A minor drone: root, fifth, and a soft octave-up voice for shimmer.
  const voices: { freq: number; type: OscillatorType; gain: number; detune?: number }[] = [
    { freq: 110.0, type: 'sine', gain: 1.0 }, // A2
    { freq: 164.81, type: 'triangle', gain: 0.5 }, // E3
    { freq: 220.0, type: 'sine', gain: 0.25, detune: 4 }, // A3, slightly detuned for shimmer
  ];

  for (const v of voices) {
    const osc = ctx.createOscillator();
    osc.type = v.type;
    osc.frequency.value = v.freq;
    if (v.detune) osc.detune.value = v.detune;
    const gain = ctx.createGain();
    gain.gain.value = v.gain;
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
  }

  // Slow breathing LFO on the master volume for a living, ambient pad feel.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = userVolume * 0.4;
  lfo.connect(lfoGain);
  lfoGain.connect(masterGain.gain);
  lfo.start();
}

export function setMusicEnabled(enabled: boolean): void {
  if (!started) {
    if (enabled) startMusic();
    return;
  }
  if (masterGain) masterGain.gain.value = enabled ? userVolume : 0;
}
