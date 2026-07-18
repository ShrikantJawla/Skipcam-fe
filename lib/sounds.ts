let ctx: AudioContext | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.04,
) {
  const audio = getCtx();
  if (!audio) return;
  void audio.resume();
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
}

export function playSoftTap() {
  tone(420, 0.06, "triangle", 0.03);
}

export function playMatchChime() {
  tone(523.25, 0.12, "sine", 0.045);
  setTimeout(() => tone(659.25, 0.16, "sine", 0.04), 70);
}

export function playSendTick() {
  tone(780, 0.05, "square", 0.02);
}

export function playReactPop() {
  tone(640, 0.08, "triangle", 0.035);
}
