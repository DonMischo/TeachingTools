/**
 * Geräusche der Verkehrs-Simulation, alle im Browser erzeugt (Web Audio) —
 * keine Tondateien. Der AudioContext entsteht erst beim ersten Tastendruck
 * oder Tippen; vorher lassen Browser keinen Ton zu.
 */

export class Klang {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rauschen: AudioBuffer | null = null;
  private motor: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  an = true;

  /** Beim ersten Nutzerereignis aufrufen. */
  wecke() {
    if (this.ctx || typeof window === "undefined") { void this.ctx?.resume(); return; }
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return;
    const ctx = new C();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.an ? 0.5 : 0;
    this.master.connect(ctx.destination);
    const n = ctx.sampleRate;
    this.rauschen = ctx.createBuffer(1, n, n);
    const d = this.rauschen.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // Motorbrummen: Sägezahn durch Tiefpass, Lautstärke folgt dem nächsten Auto.
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 45;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 180;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start();
    this.motor = { osc, gain, filter };
  }

  setzeAn(an: boolean) {
    this.an = an;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(an ? 0.5 : 0, this.ctx.currentTime, 0.05);
  }

  schliesse() {
    void this.ctx?.close();
    this.ctx = null;
    this.motor = null;
  }

  private ton(freq: number, dauer: number, opt: { typ?: OscillatorType; laut?: number; bis?: number; ab?: number } = {}) {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master || !this.an) return;
    const t0 = ctx.currentTime + (opt.ab ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opt.typ ?? "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (opt.bis) osc.frequency.exponentialRampToValueAtTime(opt.bis, t0 + dauer);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opt.laut ?? 0.3, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dauer);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dauer + 0.05);
  }

  private geraeusch(dauer: number, opt: { freq?: number; q?: number; laut?: number; typ?: BiquadFilterType; ab?: number } = {}) {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master || !this.rauschen || !this.an) return;
    const t0 = ctx.currentTime + (opt.ab ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.rauschen;
    const f = ctx.createBiquadFilter();
    f.type = opt.typ ?? "bandpass";
    f.frequency.value = opt.freq ?? 1000;
    f.Q.value = opt.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opt.laut ?? 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dauer);
    src.connect(f).connect(g).connect(master);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dauer + 0.05);
  }

  schritt(rennen: boolean) { this.geraeusch(0.07, { freq: rennen ? 900 : 600, q: 2, laut: rennen ? 0.12 : 0.07 }); }
  hupe() { this.ton(415, 0.4, { typ: "square", laut: 0.12 }); this.ton(520, 0.4, { typ: "square", laut: 0.1 }); }
  /** Blindensignal der Fußgängerampel: Rot = langsames Ticken, Grün = schnelles. */
  ampelTick(gruen: boolean) { this.ton(gruen ? 1200 : 700, 0.03, { typ: "square", laut: 0.06 }); }
  tuerAuf() {
    this.geraeusch(0.6, { freq: 3000, q: 0.7, laut: 0.12, typ: "highpass" });
    this.ton(660, 0.35, { laut: 0.12, ab: 0.1 });
    this.ton(523, 0.5, { laut: 0.12, ab: 0.4 });
  }
  tuerZu() { for (let i = 0; i < 3; i++) this.ton(1000, 0.12, { typ: "square", laut: 0.06, ab: i * 0.22 }); }
  tramKlingel() {
    for (const ab of [0, 0.25]) for (const [f, l] of [[1480, 0.12], [2960, 0.05], [4440, 0.03]]) this.ton(f, 0.6, { laut: l, ab });
  }
  zugHorn() { this.ton(311, 1.2, { typ: "sawtooth", laut: 0.08 }); this.ton(370, 1.2, { typ: "sawtooth", laut: 0.07 }); }
  pfeife() {
    for (let i = 0; i < 8; i++) this.ton(i % 2 ? 2900 : 2700, 0.09, { laut: 0.1, ab: i * 0.09 });
  }
  erfolg() { [523, 659, 784].forEach((f, i) => this.ton(f, 0.25, { typ: "triangle", laut: 0.18, ab: i * 0.09 })); }
  grosserErfolg() { [523, 659, 784, 1047].forEach((f, i) => this.ton(f, 0.4, { typ: "triangle", laut: 0.2, ab: i * 0.12 })); }
  fehler() { this.ton(180, 0.35, { typ: "square", laut: 0.1, bis: 120 }); }
  crash() { this.geraeusch(0.5, { freq: 300, q: 0.5, laut: 0.5, typ: "lowpass" }); this.ton(80, 0.4, { laut: 0.4, bis: 40 }); }
  quizRichtig() { this.ton(880, 0.15, { typ: "triangle", laut: 0.15 }); this.ton(1320, 0.25, { typ: "triangle", laut: 0.15, ab: 0.1 }); }

  /** Brummen des nächsten Autos: `naehe` 0 (weit) bis 1 (direkt daneben), `tempo` in m/s. */
  motorbrummen(naehe: number, tempo: number) {
    if (!this.motor || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.motor.gain.gain.setTargetAtTime(this.an ? naehe * 0.12 : 0, t, 0.1);
    this.motor.osc.frequency.setTargetAtTime(40 + tempo * 4, t, 0.2);
    this.motor.filter.frequency.setTargetAtTime(150 + tempo * 25, t, 0.2);
  }
}
