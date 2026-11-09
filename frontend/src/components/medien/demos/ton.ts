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

/** Rauschen ab `start` Sekunden, wahlweise durch einen Bandpass (Modem, Feuerknistern, Bandrauschen) */
export function rauschen(dauer: number, start = 0, laut = 0.08, band?: { freq: number; q?: number }) {
  const a = audio();
  if (!a) return;
  const n = Math.max(1, Math.floor(a.sampleRate * dauer));
  const puffer = a.createBuffer(1, n, a.sampleRate);
  const d = puffer.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const quelle = a.createBufferSource(), g = a.createGain();
  quelle.buffer = puffer;
  const t = a.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(laut, t + 0.02);
  g.gain.setValueAtTime(laut, t + Math.max(0.02, dauer - 0.05));
  g.gain.linearRampToValueAtTime(0, t + dauer);
  let kette: AudioNode = quelle;
  if (band) {
    const f = a.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = band.freq; f.Q.value = band.q ?? 1;
    kette = kette.connect(f);
  }
  kette.connect(g).connect(a.destination);
  quelle.start(t);
}

/** Frequenzumtastung: ein Ton, der `baud`-mal pro Sekunde zufällig zwischen den Frequenzen springt (so »sprachen« Modems) */
export function fsk(frequenzen: number[], dauer: number, start = 0, baud = 300, laut = 0.08, art: OscillatorType = "sine") {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator(), g = a.createGain();
  o.type = art;
  for (let s = 0; s < dauer; s += 1 / baud) o.frequency.setValueAtTime(frequenzen[Math.floor(Math.random() * frequenzen.length)], t + s);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(laut, t + 0.01);
  g.gain.setValueAtTime(laut, t + dauer - 0.02);
  g.gain.linearRampToValueAtTime(0, t + dauer);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dauer + 0.02);
}

/** Tastentöne des Telefons (DTMF): zwei Töne gleichzeitig je Ziffer */
const DTMF: Record<string, [number, number]> = {
  "1": [697, 1209], "2": [697, 1336], "3": [697, 1477], "4": [770, 1209], "5": [770, 1336], "6": [770, 1477],
  "7": [852, 1209], "8": [852, 1336], "9": [852, 1477], "*": [941, 1209], "0": [941, 1336], "#": [941, 1477],
};
export function dtmf(ziffern: string, start = 0, laenge = 0.09, pause = 0.07): number {
  let t = start;
  for (const z of ziffern) {
    const p = DTMF[z];
    if (p) { ton(p[0], laenge, t, "sine", 0.08); ton(p[1], laenge, t, "sine", 0.08); }
    t += laenge + pause;
  }
  return t;
}

/** Klingeln wie beim alten Telefon: zwei kurze Stöße schnell wechselnder Töne */
export function klingeln(start = 0) {
  for (const s of [0, 0.5]) fsk([1000, 1250], 0.35, start + s, 40, 0.07, "square");
}
