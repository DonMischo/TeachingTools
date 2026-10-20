/**
 * Küste von oben, ein Schritt = ein Jahr (bei Sturmflut: eine Sturmflut).
 *
 *   Wellen    laufen aus einer Richtung an; wie stark sie eine Uferzelle
 *             treffen, hängt vom offenen Wasser davor ab (Anlauf) — flaches
 *             Wasser davor (Brandungsplatte, Sandbank, Watt) bremst sie.
 *   Kliff     wird am Fuß ausgehöhlt (Brandungshohlkehle); ist die Kerbe tief
 *             genug, bricht die Wand ab. Übrig bleibt eine Brandungsplatte.
 *   Sand      wandert im flachen Wasser mit der Welle schräg die Küste entlang
 *             (Strandversatz); wo es tiefer wird oder geschützt ist, setzt er
 *             sich ab — Haken und Nehrungen wachsen. Am Strand weht der Wind
 *             Sand zu Dünen auf.
 *   Deich     hält, solange die Flut nicht überläuft; läuft sie über, wird er
 *             ausgespült und bricht. Dahinter liegt die Marsch unter dem
 *             Sturmflutspiegel.
 * Eigenes Modell für den Unterricht, Größen grob geeicht: Kreidekliff
 * ≈ 0,3–1 m/Jahr Rückgang, Sturmflut ≈ +3 m.
 */
import { fbm, perlin, zufallsquelle } from "./rauschen";
import { haufen, type Marke } from "./formen";

export const KUESTEN = [
  { id: "steil", icon: "🪨", label: "Steilküste", text: "Hohes Kliff aus Kreide und Mergel mit Kaps und Buchten (wie Rügen oder Møn)." },
  { id: "flach", icon: "🏖️", label: "Flachküste", text: "Sandstrand, Dünen und ein Kap — der Sand wandert die Küste entlang (wie Usedom oder Sylt)." },
  { id: "deich", icon: "🛡️", label: "Marsch mit Deich", text: "Tiefes Land hinter dem Deich, davor das Watt (wie an der Nordsee)." },
] as const;
export type KuestenTyp = (typeof KUESTEN)[number]["id"];

export interface KuestenWahl { typ: KuestenTyp; seed: number; /** Deichkrone in m (nur Marsch) */ deich?: number }

export interface Kueste {
  wahl: KuestenWahl;
  n: number;
  zelle: number;
  /** Höhe in m über Mittelwasser */
  h: Float32Array;
  /** Ausgangshöhe */
  start: Float32Array;
  /** Widerstand gegen Abtrag 0..1 (1 = Granit, 0,1 = Sand) */
  haerte: Float32Array;
  /** 1 = Deich */
  deich: Uint8Array;
  /** Hohlkehle am Kliff (m) */
  kerbe: Float32Array;
  /** Sand im Wasser (m Schichtdicke) */
  sand: Float32Array;
  /** 1 = gerade überflutet */
  flut: Uint8Array;
  /** 1 = bei Mittelwasser zu Beginn Meer */
  startFlut: Uint8Array;
  /** Deich zu Beginn */
  startDeich: Uint8Array;
  jahr: number;
  zufall: () => number;
  /** Bilanz seit Start in m³ */
  abgetragen: number;
  angelandet: number;
}

export interface KuestenParameter {
  /** Richtung, AUS der Wind und Wellen kommen, in Grad (0 = Norden, 90 = Osten) */
  wind: number;
  /** Sturmflut in diesem Schritt */
  sturm: boolean;
  /** Meeresspiegelanstieg gegenüber heute in m */
  anstieg: number;
}

export const STANDARD_KUESTE: KuestenParameter = { wind: 200, sturm: false, anstieg: 0 };

const SAND = 0.12;

/** Meer liegt immer im Süden (unten); Land oben */
export function kuesteErzeugen(wahl: KuestenWahl, n = 256, zelle = 6): Kueste {
  const z = zufallsquelle(wahl.seed);
  const r = perlin(wahl.seed), r2 = perlin(wahl.seed + 9);
  const N = n * n, B = n * zelle;
  const h = new Float32Array(N), haerte = new Float32Array(N), deich = new Uint8Array(N);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * zelle, y = (j + 0.5) * zelle, k = j * n + i;
    // Küstenlinie: von links nach rechts, mit Kaps und Buchten
    const linie = B * 0.55 + (wahl.typ === "flach" ? 0 : 1) * 180 * fbm(r, x / 900, 0.3, 3) + (wahl.typ === "flach" ? -260 * Math.exp(-(((x - B * 0.3) / 260) ** 2)) : 0);
    const s = linie - y; // > 0 an Land
    if (wahl.typ === "steil") {
      const plateau = 38 + 18 * fbm(r2, x / 700, y / 700, 4);
      const meer = -2 - 0.03 * Math.max(0, -s) - 4 * (1 - Math.exp(Math.min(0, s) / 60));
      h[k] = s > 0 ? plateau * Math.min(1, 0.92 + s / 2000) : meer;
      haerte[k] = 0.35 + 0.5 * Math.max(0, fbm(r2, x / 300 + 4, y / 300, 3)); // Kreide mit härteren Lagen (Feuerstein)
    } else if (wahl.typ === "flach") {
      const strand = s > 0 ? Math.min(3, s / 25) : 0;
      const duene = s > 30 && s < 150 ? 8 * Math.sin(((s - 30) / 120) * Math.PI) * (0.6 + 0.4 * fbm(r2, x / 200, 1, 2)) : 0;
      const hinten = s > 150 ? 4 + 6 * fbm(r2, x / 800, y / 800, 3) : 0;
      // Kap aus Geschiebemergel, an dem der Sand vorbeiwandern muss
      const kap = Math.exp(-(((x - B * 0.3) / 220) ** 2) - (((y - (linie + 40)) / 260) ** 2));
      h[k] = s > 0 ? Math.max(strand + duene, hinten) + 22 * kap : -0.5 + s * 0.02;
      haerte[k] = kap > 0.3 ? 0.22 : s > 150 ? 0.3 : SAND;
    } else {
      // Marsch: hinter dem Deich ±1 m, davor flaches Watt, dahinter Geest
      const geest = s > 900 ? Math.min(14, (s - 900) / 40) : 0;
      h[k] = s > 0 ? -0.4 + 1.4 * fbm(r2, x / 500, y / 500, 3) + geest : -0.8 + s * 0.004 + 0.4 * fbm(r, x / 300, y / 300, 2);
      haerte[k] = s > 0 ? 0.25 : SAND;
      if (s > 20 && s < 44) { deich[k] = 1; h[k] = wahl.deich ?? 8; haerte[k] = 0.9; }
    }
  }
  const k: Kueste = {
    wahl, n, zelle, h, start: Float32Array.from(h), haerte, deich, kerbe: new Float32Array(N), sand: new Float32Array(N),
    flut: new Uint8Array(N), startFlut: new Uint8Array(N), startDeich: Uint8Array.from(deich), jahr: 0, zufall: z, abgetragen: 0, angelandet: 0,
  };
  fluten(k, 0);
  k.startFlut.set(k.flut);
  return k;
}

/** alles, was vom Meer (unterer Rand) aus unter dem Spiegel W erreichbar ist */
export function fluten(k: Kueste, W: number) {
  const { n, h } = k;
  k.flut.fill(0);
  const st: number[] = [];
  for (let i = 0; i < n; i++) { const q = (n - 1) * n + i; if (h[q] < W) { k.flut[q] = 1; st.push(q); } }
  while (st.length) {
    const q = st.pop()!, i = q % n, j = (q - i) / n;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + a, jj = j + b;
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
      const r = jj * n + ii;
      if (!k.flut[r] && h[r] < W) { k.flut[r] = 1; st.push(r); }
    }
  }
}

/** Wasserstand dieses Schritts */
export const wasserstand = (p: KuestenParameter) => p.anstieg + (p.sturm ? 3 : 0);

/** Wellenlaufrichtung (wohin die Wellen laufen) als Einheitsvektor in Kartenkoordinaten */
function laufrichtung(p: KuestenParameter) {
  const w = (p.wind * Math.PI) / 180;
  // Wind AUS Richtung w (0 = Norden = −y) → Wellen laufen nach w + 180°
  return { x: -Math.sin(w), y: Math.cos(w) };
}

/** offener Anlauf vor einer Uferzelle, gedämpft durch Flachwasser (0..1) */
function exposition(k: Kueste, i: number, j: number, W: number, d: { x: number; y: number }): number {
  let offen = 0, flach = 0;
  for (let s = 1; s <= 60; s++) {
    const ii = Math.round(i - d.x * s), jj = Math.round(j - d.y * s);
    if (ii < 0 || jj < 0 || ii >= k.n || jj >= k.n) { offen += 60 - s; break; }
    const t = W - k.h[jj * k.n + ii];
    if (t <= 0) break; // Land im Weg (Kap schützt die Bucht)
    offen++;
    if (t < 1.5) flach++;
  }
  return Math.min(1, offen / 60) * Math.exp(-flach / 15);
}

export function kuestenSchritt(k: Kueste, p: KuestenParameter = STANDARD_KUESTE): Kueste {
  const { n, h, haerte, kerbe, sand, deich } = k;
  const N = n * n, A = k.zelle * k.zelle;
  const W = wasserstand(p);
  const welle = p.sturm ? 4 : 1.2;
  const d = laufrichtung(p);
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const nass = (q: number) => h[q] < W;

  // 1) Brandung an Uferzellen
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
    const q = j * n + i;
    if (nass(q)) continue;
    let ufer = false;
    for (const [a, b] of NB) if (nass((j + b) * n + i + a)) { ufer = true; break; }
    if (!ufer) continue;
    const E = exposition(k, i, j, W, d) * welle * welle;
    if (E <= 0) continue;
    const ueber = h[q] - W;
    let ab = 0;
    if (deich[q]) {
      // Deich: hält, bis die Wellen überlaufen; dann spült es ihn aus
      if (W + welle * 0.6 > h[q]) {
        ab = 0.8 + k.zufall() * 0.8;
        // überlaufendes Wasser spült auch die Landseite aus
        for (let s = 1; s <= 6; s++) {
          const r = Math.round(j + d.y * s) * n + Math.round(i + d.x * s);
          if (r >= 0 && r < N && deich[r]) h[r] = Math.max(h[r] - ab * (1 - s / 8), W - 1);
        }
      }
    } else if (ueber > 3) {
      kerbe[q] += (0.25 * E) / Math.max(0.05, haerte[q]);
      if (kerbe[q] > ueber * 0.25) { ab = ueber + 1.5; kerbe[q] = 0; }
    } else ab = Math.min(ueber + 0.5, (0.05 * E) / Math.max(0.05, haerte[q]));
    if (ab <= 0) continue;
    h[q] -= ab;
    k.abgetragen += ab * A;
    // Material ins Wasser vor der Zelle; feiner Kreideschlamm geht zum Teil verloren
    const verlust = haerte[q] > 0.3 && !deich[q] ? 0.6 : 0;
    let ziel = -1;
    for (const [a, b] of NB) { const r = (j + b) * n + i + a; if (nass(r) && (ziel < 0 || h[r] > h[ziel])) ziel = r; }
    if (ziel >= 0) sand[ziel] += ab * (1 - verlust);
    if (deich[q] && h[q] < W) deich[q] = 0;
  }

  // 2) Strandversatz: Sand wandert im Flachwasser mit der Welle, sonst setzt er sich
  const neu = new Float32Array(N);
  const quer = [{ x: -d.y, y: d.x }, { x: d.y, y: -d.x }];
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
    const q = j * n + i;
    const s = sand[q];
    if (s <= 0) continue;
    const tiefe = W - h[q];
    if (tiefe <= 0) { neu[q] += s; continue; }
    const kraft = tiefe < 5 ? 0.85 : 0.15;
    // in Laufrichtung; ist dort Land, an der Küste entlang (die Seite, die zur Welle passt)
    let ziel = -1;
    for (const v of [d, ...quer]) {
      const ii = Math.round(i + v.x), jj = Math.round(j + v.y);
      const r = jj * n + ii;
      if (r === q || !nass(r)) continue;
      if (v === d || ziel < 0) ziel = r;
      if (v === d) break;
    }
    if (ziel < 0) { neu[q] += s; continue; }
    neu[ziel] += s * kraft;
    neu[q] += s * (1 - kraft);
  }
  sand.set(neu);
  for (let q = 0; q < N; q++) {
    if (sand[q] <= 0) continue;
    const tiefe = W - h[q];
    // absetzen: in ruhigem oder tieferem Wasser mehr, nie über den Spiegel
    const rate = tiefe > 5 ? 0.5 : 0.12;
    const ab = Math.min(sand[q] * rate, Math.max(0, tiefe + 0.4));
    h[q] += ab;
    sand[q] -= ab;
    if (ab > 0 && h[q] > W - 0.3) { haerte[q] = SAND; k.angelandet += ab * A; }
  }

  // 3) Dünen: trockener Strand, Wind weht Sand landeinwärts
  const w = { x: d.x, y: d.y };
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
    const q = j * n + i;
    if (deich[q] || haerte[q] > SAND + 0.01) continue;
    const ueber = h[q] - W;
    if (ueber < 0.3 || ueber > 14) continue;
    const r = Math.round(j + w.y) * n + Math.round(i + w.x);
    if (r === q || nass(r) || deich[r]) continue;
    // Sand wandert nur über Sand; am Bewuchs dahinter bleibt er liegen (Vordüne)
    const m = Math.min(0.08, Math.max(0, (h[q] - h[r]) * 0.1 + 0.03));
    if (haerte[r] > SAND + 0.01) { if (h[q] - W < 12) h[q] += 0.01; continue; }
    h[q] -= m; h[r] += m;
  }

  // 4) Flut
  fluten(k, W);
  k.jahr++;
  return k;
}

/** Fläche, die gerade unter Wasser steht, aber zu Beginn Land war (ha) */
export function ueberflutet(k: Kueste): number {
  let c = 0;
  for (let q = 0; q < k.h.length; q++) if (k.flut[q] && !k.startFlut[q]) c++;
  return (c * k.zelle * k.zelle) / 10000;
}

/** Wie weit ist die Küste in der Mitte jeder Spalte zurückgewichen? mittlerer Rückgang in m */
export function rueckgang(k: Kueste): number {
  let s = 0, c = 0;
  for (let i = 0; i < k.n; i++) {
    let a = 0, b = 0;
    for (let j = 0; j < k.n; j++) { if (k.start[j * k.n + i] >= 0) a = j; if (k.h[j * k.n + i] >= 0) b = j; }
    s += (a - b) * k.zelle; c++;
  }
  return s / c;
}

/** Farben: Meer nach Tiefe, Sand, Kreide, Wiese, Deich, überflutetes Land */
export function kuestenFarben(k: Kueste, p: KuestenParameter): Uint8ClampedArray {
  const { n, h, haerte, deich, flut } = k;
  const W = wasserstand(p);
  const px = new Uint8ClampedArray(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const q = j * n + i;
    const hl = h[j * n + Math.max(0, i - 1)], hr = h[j * n + Math.min(n - 1, i + 1)];
    const ho = h[Math.max(0, j - 1) * n + i], hu = h[Math.min(n - 1, j + 1) * n + i];
    const nx = -(hr - hl) / (2 * k.zelle) * 2, ny = -(hu - ho) / (2 * k.zelle) * 2;
    const licht = Math.max(0, (-0.6 * nx - 0.6 * ny + 0.53) / (Math.hypot(nx, ny, 1) * 0.98));
    const sch = 0.55 + 0.6 * licht;
    let c: number[];
    if (h[q] < W && !flut[q]) c = [104 * sch, 150 * sch, 80 * sch]; // trockener Polder unter dem Meeresspiegel
    else if (h[q] < W) {
      const t = Math.min(1, (W - h[q]) / 12);
      c = h[q] >= 0 ? [120, 170, 205] : [118 - 70 * t, 178 - 70 * t, 205 - 30 * t];
      if (k.sand[q] > 0.02) c = [c[0] + 30, c[1] + 22, c[2] - 10];
    } else if (deich[q]) c = [96 * sch, 140 * sch, 70 * sch];
    else if (haerte[q] <= SAND + 0.01 && h[q] - W < 16) c = [232 * sch, 214 * sch, 160 * sch];
    else if (h[q] - W > 4 && (Math.abs(hr - hl) > 4 || Math.abs(hu - ho) > 4)) c = [236 * sch, 236 * sch, 228 * sch]; // Kliffwand
    else c = [120 * sch, 165 * sch, 88 * sch];
    px[q * 4] = c[0]; px[q * 4 + 1] = c[1]; px[q * 4 + 2] = c[2]; px[q * 4 + 3] = 255;
  }
  return px;
}

/** Formen der Küste erkennen: Kliff, Brandungsplatte, Anlandung (Haken, Nehrung), Dünen, Deichbruch, überflutetes Land */
export function kuestenFormen(k: Kueste, p: KuestenParameter): Marke[] {
  const { n, h, haerte, flut, startFlut, start, deich, startDeich } = k;
  const N = n * n, W = wasserstand(p);
  const aus: Marke[] = [];
  const maske = () => new Uint8Array(N);
  const kliff = maske(), platte = maske(), an = maske(), duene = maske(), bruch = maske(), unter = maske();
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
    const q = j * n + i;
    const land = h[q] >= W;
    // Kliff: hohe Landzelle, nach Süden (Meer) fällt es binnen 6 Zellen bis fast auf den Wasserspiegel
    if (land && h[q] - W > 6) { for (let d = 1; d <= 6 && j + d < n; d++) if (h[q + d * n] < W + 1.5) { kliff[q] = 1; break; } }
    if (k.wahl.typ === "steil" && !land && W - h[q] < 2.5 && haerte[q] > SAND + 0.01 && start[q] >= 0) platte[q] = 1;
    if (land && startFlut[q] && haerte[q] <= SAND + 0.01) an[q] = 1;
    if (land && haerte[q] <= SAND + 0.01 && h[q] - W > 5 && !deich[q]) duene[q] = 1;
    if (startDeich[q] && !deich[q] && h[q] < W + 1) bruch[q] = 1;
    if (flut[q] && !startFlut[q]) unter[q] = 1;
  }
  const dazu = (m: Uint8Array, min: number, text: string, erklaerung: string, max = 2) => {
    for (const g of haufen(m, n, min).slice(0, max)) aus.push({ text, erklaerung, x: g.x, y: g.y });
  };
  dazu(kliff, 12, "🪨 Kliff", "Steilwand: Die Brandung untergräbt den Fuß, die Wand bricht nach.");
  dazu(platte, 25, "🟫 Brandungsplatte", "Flacher Felssockel unter Wasser — hier stand früher das Kliff.");
  dazu(an, 15, "🏖️ Anlandung (Haken/Nehrung)", "Der Strandversatz hat Sand abgelagert, wo vorher Wasser war.");
  dazu(duene, 15, "🏜️ Düne", "Vom Wind aufgewehter Sand hinter dem Strand.", 1);
  dazu(bruch, 3, "💥 Deichbruch", "Das Wasser lief über den Deich und spülte ihn aus.");
  if (k.wahl.typ === "steil") dazu(unter, 40, "↩️ Küstenrückgang", "Hier war früher Land — die Brandung hat das Kliff zurückverlegt.", 1);
  else dazu(unter, 40, "🌊 überflutetes Land", "Land, das zu Beginn trocken war, steht unter Wasser.", 1);
  return aus;
}
