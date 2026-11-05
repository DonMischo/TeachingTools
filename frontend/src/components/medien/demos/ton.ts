/** Kleine Töne für die Demos (Morse-Piep, Plattenspieler). Ohne Web Audio bleibt es still. */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Ton ab `start` Sekunden (relativ zu jetzt) für `dauer` Sekunden */
export function ton(freq: number, dauer: number, start = 0, art: OscillatorType = "sine", laut = 0.15) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator(), g = a.createGain();
  o.type = art;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(laut, t + 0.01);
  g.gain.setValueAtTime(laut, t + Math.max(0.01, dauer - 0.02));
  g.gain.linearRampToValueAtTime(0, t + dauer);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dauer + 0.02);
}

/** Dauerton für die Morsetaste: gibt eine Stopp-Funktion zurück */
export function dauerton(freq = 650): () => void {
  const a = audio();
  if (!a) return () => {};
  const o = a.createOscillator(), g = a.createGain();
  o.frequency.value = freq;
  g.gain.value = 0.15;
  o.connect(g).connect(a.destination);
  o.start();
  return () => { g.gain.setTargetAtTime(0, a.currentTime, 0.01); o.stop(a.currentTime + 0.05); };
}
