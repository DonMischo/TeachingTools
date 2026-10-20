/**
 * Verwitterung im Querschnitt: ein Gitter aus Gesteinszellen (Seitenansicht,
 * oben Luft). Fünf Kräfte wirken, jede einzeln regelbar:
 *
 *   ☀️ Sonne    Temperaturverwitterung: Tag/Nacht dehnt und schrumpft die
 *               Oberfläche, es entstehen Risse, Schalen platzen ab.
 *   💨 Wind     bläst lockere, feine Körner fort (Deflation) und schleift
 *               bodennahen Fels mit Sand (Korrasion → Pilzfelsen); Dünen.
 *   💧 Wasser   Regen fließt ab und nimmt Lockermaterial mit oder versickert
 *               in durchlässigem Gestein und Klüften.
 *   ❄️ Frost    Wasser in Rissen gefriert (+9 % Volumen) und sprengt sie auf;
 *               nasser Boden kriecht hangab (Solifluktion).
 *   🧪 Chemie   Kohlensäure löst Kalk und Gips (Karst: Höhlen, Dolinen,
 *               Tropfsteine), Hydrolyse zersetzt Granit zu Grus und Schiefer zu Ton.
 *   🌱 Pflanzen Wurzeln sprengen, Bodenbildung, Bewuchs schützt vor Abtrag.
 *
 * Eigenes, stark vereinfachtes Modell für den Unterricht — qualitativ, nicht
 * maßstäblich. Ein Schritt ≈ 100 Jahre.
 */
import { perlin, zufallsquelle } from "./rauschen";

export const LUFT = 0, WASSER = 1, SAND = 2, TON = 3, LOESS = 4, SANDSTEIN = 5, KALK = 6, GRANIT = 7, SCHIEFER = 8, GIPS = 9, SCHUTT = 10, GRUS = 11, BODEN = 12, SINTER = 13, BASALT = 14;

export interface Stoff {
  name: string;
  farbe: [number, number, number];
  /** locker (rieselt, kann fortgetragen werden) */
  locker: boolean;
  /** Wasserdurchlässigkeit 0..1 */
  durch: number;
  /** Empfindlichkeit für Temperaturwechsel */
  sonne: number;
  /** Wasseraufnahme für Frostsprengung */
  frost: number;
  /** löslich in Kohlensäure (Karst) */
  loes: number;
  /** Hydrolyse (chemische Zersetzung der Minerale) */
  hydro: number;
  /** vom Wind verwehbar (fein, locker) */
  wind: number;
  /** vom fließenden Wasser abtragbar */
  spuel: number;
  /** Rutschneigung: Wahrscheinlichkeit, schräg abzurutschen (locker) */
  rutsch: number;
}

export const STOFFE: Stoff[] = [];
const s = (i: number, x: Stoff) => { STOFFE[i] = x; };
s(LUFT, { name: "Luft", farbe: [0, 0, 0], locker: false, durch: 1, sonne: 0, frost: 0, loes: 0, hydro: 0, wind: 0, spuel: 0, rutsch: 0 });
s(WASSER, { name: "Wasser", farbe: [70, 130, 200], locker: false, durch: 1, sonne: 0, frost: 0, loes: 0, hydro: 0, wind: 0, spuel: 0, rutsch: 0 });
s(SAND, { name: "Sand", farbe: [226, 200, 140], locker: true, durch: 0.9, sonne: 0, frost: 0, loes: 0, hydro: 0, wind: 1, spuel: 0.5, rutsch: 0.8 });
s(TON, { name: "Ton", farbe: [150, 128, 110], locker: true, durch: 0.04, sonne: 0, frost: 0, loes: 0, hydro: 0, wind: 0.1, spuel: 0.25, rutsch: 0.05 });
s(LOESS, { name: "Löss", farbe: [214, 182, 120], locker: true, durch: 0.5, sonne: 0, frost: 0, loes: 0.05, hydro: 0, wind: 0.8, spuel: 0.7, rutsch: 0.02 });
s(SANDSTEIN, { name: "Sandstein", farbe: [196, 132, 98], locker: false, durch: 0.35, sonne: 0.6, frost: 0.8, loes: 0, hydro: 0.08, wind: 0, spuel: 0, rutsch: 0 });
s(KALK, { name: "Kalkstein", farbe: [214, 210, 192], locker: false, durch: 0.05, sonne: 0.4, frost: 0.5, loes: 1, hydro: 0, wind: 0, spuel: 0, rutsch: 0 });
s(GRANIT, { name: "Granit", farbe: [168, 160, 158], locker: false, durch: 0.02, sonne: 0.8, frost: 0.3, loes: 0, hydro: 0.5, wind: 0, spuel: 0, rutsch: 0 });
s(SCHIEFER, { name: "Schiefer", farbe: [86, 92, 104], locker: false, durch: 0.05, sonne: 0.5, frost: 0.9, loes: 0, hydro: 0.35, wind: 0, spuel: 0, rutsch: 0 });
s(GIPS, { name: "Gips", farbe: [236, 232, 226], locker: false, durch: 0.05, sonne: 0.3, frost: 0.4, loes: 8, hydro: 0, wind: 0, spuel: 0, rutsch: 0 });
s(SCHUTT, { name: "Gesteinsschutt", farbe: [150, 140, 130], locker: true, durch: 0.8, sonne: 0.2, frost: 0.5, loes: 0, hydro: 0.3, wind: 0, spuel: 0.08, rutsch: 0.35 });
s(GRUS, { name: "Grus (zerfallener Granit)", farbe: [190, 176, 156], locker: true, durch: 0.7, sonne: 0, frost: 0.1, loes: 0, hydro: 0.1, wind: 0.6, spuel: 0.5, rutsch: 0.6 });
s(BODEN, { name: "Boden (Humus)", farbe: [92, 70, 48], locker: true, durch: 0.5, sonne: 0, frost: 0.2, loes: 0, hydro: 0, wind: 0.3, spuel: 0.2, rutsch: 0.2 });
s(SINTER, { name: "Tropfstein (Sinter)", farbe: [238, 222, 190], locker: false, durch: 0, sonne: 0, frost: 0, loes: 0.3, hydro: 0, wind: 0, spuel: 0, rutsch: 0 });
s(BASALT, { name: "Basalt", farbe: [64, 64, 70], locker: false, durch: 0.03, sonne: 0.9, frost: 0.3, loes: 0, hydro: 0.4, wind: 0, spuel: 0, rutsch: 0 });

export const KRAEFTE = [
  { id: "sonne", icon: "☀️", label: "Sonne", text: "Temperaturverwitterung: Tag und Nacht dehnen und schrumpfen die Oberfläche — es reißt, Schalen platzen ab." },
  { id: "wind", icon: "💨", label: "Wind", text: "Weht lockeres, feines Material fort (Deflation), schleift mit Sand bodennahen Fels (Korrasion) und häuft Dünen auf." },
  { id: "wasser", icon: "💧", label: "Wasser", text: "Regen spült Lockermaterial hangab oder versickert in durchlässigem Gestein und Klüften." },
  { id: "frost", icon: "❄️", label: "Frost", text: "Frostsprengung: Wasser in Rissen gefriert, dehnt sich um 9 % aus und sprengt das Gestein. Nasser Boden kriecht hangab." },
  { id: "chemie", icon: "🧪", label: "Chemie", text: "Kohlensäure im Wasser löst Kalk und Gips (Karst). Hydrolyse zersetzt Granit zu Grus und Schiefer zu Ton." },
  { id: "pflanzen", icon: "🌱", label: "Pflanzen", text: "Wurzeln sprengen Fels (biologische Verwitterung), Humus bildet Boden, Bewuchs schützt vor Abtrag." },
] as const;
export type Kraft = (typeof KRAEFTE)[number]["id"];
export type Klima = Record<Kraft, number> & { richtung: 1 | -1 };

export const KLIMATE: { id: string; icon: string; label: string; text: string; k: Klima }[] = [
  { id: "mittel", icon: "🌳", label: "Mitteleuropa", text: "Gemäßigt: Frostwechsel im Winter, Regen, viel Bewuchs.", k: { sonne: 0.3, wind: 0.2, wasser: 0.5, frost: 0.5, chemie: 0.4, pflanzen: 0.8, richtung: 1 } },
  { id: "wueste", icon: "🏜️", label: "Wüste", text: "Heiße Tage, kalte Nächte, kaum Regen, starker Wind, kein Bewuchs: Temperaturverwitterung und Wind.", k: { sonne: 1, wind: 1, wasser: 0.05, frost: 0, chemie: 0.05, pflanzen: 0, richtung: -1 } },
  { id: "gebirge", icon: "🏔️", label: "Hochgebirge", text: "Täglicher Frostwechsel, wenig Bewuchs: Frostsprengung und Schutthalden.", k: { sonne: 0.5, wind: 0.4, wasser: 0.4, frost: 1, chemie: 0.1, pflanzen: 0.1, richtung: 1 } },
  { id: "tropen", icon: "🌴", label: "Tropen", text: "Warm und sehr feucht: chemische Verwitterung reicht tief, dicke Verwitterungsdecke.", k: { sonne: 0.3, wind: 0.1, wasser: 1, frost: 0, chemie: 1, pflanzen: 1, richtung: 1 } },
  { id: "tundra", icon: "🧊", label: "Tundra", text: "Lange Winter, kurzer Sommer, Dauerfrost: Frostsprengung und Bodenfließen.", k: { sonne: 0.2, wind: 0.5, wasser: 0.3, frost: 0.9, chemie: 0.05, pflanzen: 0.25, richtung: 1 } },
];

export interface Tropfen {
  x: number; y: number;
  /** im Untergrund (versickert) */
  unter: boolean;
  /** mitgeführtes Korn (Stoff) oder 0 */
  last: number;
  /** Sättigung mit gelöstem Kalk 0..1: gesättigtes Wasser löst nichts mehr, bildet aber Tropfsteine */
  saett: number;
  alter: number;
}

export interface Querschnitt {
  W: number; H: number;
  /** Meter je Zelle */
  zelle: number;
  stoff: Uint8Array;
  /** Ausgangsgestein (für Schuttfarbe und Zerfallsprodukte) */
  eltern: Uint8Array;
  /** Risse 0..1 (≥ 1: Zerfall) */
  riss: Float32Array;
  /** Nässe 0..1 */
  nass: Float32Array;
  /** Härte-Faktor je Zelle (Schichten verschieden fest) */
  haerte: Float32Array;
  tropfen: Tropfen[];
  jahr: number;
  /** Winter im Jahreslauf (für Frost und Anzeige) */
  winter: boolean;
  /** Wirkung je Kraft im letzten Schritt (Anzahl Ereignisse) */
  wirkung: Record<Kraft, number>;
  /** gleitende Wirkung (für Balken) */
  wirkungMittel: Record<Kraft, number>;
  start: Uint8Array;
  zufall: () => number;
}

export const GESTEINE = [
  { id: "granit", icon: "🪨", label: "Granit", stoff: GRANIT },
  { id: "sandstein", icon: "🧱", label: "Sandstein", stoff: SANDSTEIN },
  { id: "kalk", icon: "🕳️", label: "Kalkstein (Karst)", stoff: KALK },
  { id: "gips", icon: "🤍", label: "Gips (Gipskarst)", stoff: GIPS },
  { id: "schiefer", icon: "🪶", label: "Schiefer", stoff: SCHIEFER },
  { id: "basalt", icon: "⬛", label: "Basalt", stoff: BASALT },
  { id: "loess", icon: "🌾", label: "Löss", stoff: LOESS },
  { id: "ton", icon: "🏺", label: "Ton", stoff: TON },
  { id: "sand", icon: "🏖️", label: "Sand", stoff: SAND },
] as const;
export type Gestein = (typeof GESTEINE)[number]["id"];

const leer = (): Record<Kraft, number> => ({ sonne: 0, wind: 0, wasser: 0, frost: 0, chemie: 0, pflanzen: 0 });

/** Querschnitt aufbauen: Oberfläche, Schichten, Klüfte je nach Gestein */
export function querschnitt(g: Gestein, seed = 1, W = 200, H = 110): Querschnitt {
  const z = zufallsquelle(seed);
  const r = perlin(seed);
  const N = W * H;
  const stoff = new Uint8Array(N), riss = new Float32Array(N), nass = new Float32Array(N), haerte = new Float32Array(N).fill(1);
  // Oberfläche (Zellen von oben bis zum Boden)
  const ober = (i: number): number => {
    const x = i / W;
    switch (g) {
      case "granit": return 40 + 10 * r(x * 3, 0.5) - 16 * Math.exp(-(((x - 0.45) / 0.09) ** 2)) - 8 * Math.exp(-(((x - 0.78) / 0.06) ** 2)); // Felsburgen
      case "sandstein": return x < 0.55 ? 30 + 2 * r(x * 6, 1) : x < 0.6 ? 30 + (x - 0.55) * 900 : Math.abs(x - 0.8) < 0.022 ? 42 : 75 + 2 * r(x * 6, 1); // Tafelberg, Steilwand, Felsnadel davor
      case "kalk": case "gips": return 34 + 5 * r(x * 4, 2);
      case "schiefer": return 20 + x * 55 + 3 * r(x * 8, 3); // Hang
      case "basalt": return 26 + 6 * r(x * 3, 4) + (x > 0.7 ? (x - 0.7) * 90 : 0);
      case "loess": return 34 + 3 * r(x * 3, 5) + 22 * Math.exp(-(((x - 0.5) / 0.035) ** 2)); // Hohlweg
      case "ton": return x < 0.2 ? 20 + 3 * r(x * 5, 6) : x < 0.75 ? 20 + (x - 0.2) * 110 + 3 * r(x * 5, 6) : 80 + 2 * r(x * 5, 6); // steiler Hang
      case "sand": return 42 + 12 * Math.sin(x * Math.PI * 3 + 0.5) * (0.6 + 0.4 * r(x * 2, 7));
    }
  };
  for (let i = 0; i < W; i++) {
    const o = Math.max(4, Math.min(H - 6, Math.round(ober(i))));
    for (let j = o; j < H; j++) {
      const k = j * W + i;
      const tief = j - o;
      let m: number;
      switch (g) {
        case "granit": m = GRANIT; break;
        case "sandstein": {
          // harte und weiche Bänke wechseln
          m = SANDSTEIN;
          haerte[k] = 0.6 + 0.9 * (Math.sin(j * 0.55) > 0.2 ? 1 : 0.35);
          break;
        }
        case "kalk": m = j > H - 22 ? TON : KALK; haerte[k] = 0.8 + 0.4 * (Math.sin(j * 0.4) > 0 ? 1 : 0); break; // Kalk auf undurchlässigem Ton → Karstquelle
        case "gips": m = j > H - 22 ? TON : GIPS; break;
        case "schiefer": m = SCHIEFER; break;
        case "basalt": m = j > H - 40 ? SANDSTEIN : BASALT; break; // Basaltdecke über Sandstein
        case "loess": m = j > 72 ? KALK : LOESS; break;
        case "ton": m = j > H - 25 ? SANDSTEIN : TON; break;
        case "sand": m = j > H - 20 ? TON : SAND; break;
      }
      // dünne Bodendecke, wo Pflanzen wachsen können
      if (tief < 2 && (g === "kalk" || g === "gips" || g === "loess" || g === "ton" || g === "schiefer" || g === "basalt") && z() < 0.85) m = BODEN;
      if (tief < 2 && g === "granit" && z() < 0.3) m = GRUS;
      if (tief < 3 && g === "sandstein" && o > 70) m = SAND; // Sandebene vor der Wand
      stoff[k] = m;
      nass[k] = STOFFE[m].durch > 0.3 ? 0.2 : 0.05;
    }
  }
  // Klüfte und Schichtfugen: Schwächezonen mit Anfangsrissen
  const kluft = (i: number, j: number, v: number) => { const k = j * W + i; if (i >= 0 && j >= 0 && i < W && j < H && stoff[k] !== LUFT) riss[k] = Math.max(riss[k], v); };
  if (g === "granit") {
    // Wollsack-Klüftung: senkrecht und waagerecht, gegen die Tiefe weiter auseinander
    for (let i = 6 + Math.floor(z() * 8); i < W; i += 12 + Math.floor(z() * 8)) for (let j = 0; j < H; j++) kluft(i + Math.round(r(j / 20, i) * 2), j, 0.45);
    let j = 32;
    while (j < H) { for (let i = 0; i < W; i++) kluft(i, j + Math.round(r(i / 30, j) * 2), 0.45); j += 6 + Math.floor((j - 30) * 0.15) + Math.floor(z() * 3); }
  }
  if (g === "sandstein") for (let i = 10 + Math.floor(z() * 10); i < W; i += 16 + Math.floor(z() * 10)) for (let j = 0; j < H; j++) kluft(i, j, 0.4);
  if (g === "kalk" || g === "gips") {
    for (let i = 8 + Math.floor(z() * 6); i < W; i += 14 + Math.floor(z() * 9)) for (let j = 0; j < H - 22; j++) kluft(i, j, 0.5);
    for (let j = 40; j < H - 22; j += 8) for (let i = 0; i < W; i++) kluft(i, j, 0.3);
  }
  if (g === "schiefer") {
    // steil gestellte Schieferung: schräge Fugen
    for (let i0 = -H; i0 < W; i0 += 4) for (let j = 0; j < H; j++) kluft(i0 + Math.round(j * 0.6), j, 0.35);
  }
  if (g === "basalt") {
    // Säulen: senkrechte Fugen dicht an dicht
    for (let i = 0; i < W; i += 4 + Math.floor(z() * 2)) for (let j = 0; j < H - 40; j++) kluft(i, j, 0.4);
  }
  for (let k = 0; k < N; k++) if (stoff[k] === LUFT) { nass[k] = 0; riss[k] = 0; }
  return {
    W, H, zelle: 0.25, stoff, eltern: Uint8Array.from(stoff), riss, nass, haerte, tropfen: [], jahr: 0, winter: false,
    wirkung: leer(), wirkungMittel: leer(), start: Uint8Array.from(stoff), zufall: z,
  };
}

// ---------------------------------------------------------------- Hilfen

const fest = (m: number) => m !== LUFT && m !== WASSER;
const istFels = (m: number) => fest(m) && !STOFFE[m].locker;

/** Zerfallsprodukt eines Felses je nach Ursache */
function produkt(m: number, ursache: Kraft, z: () => number): number {
  if (m === GRANIT) return ursache === "chemie" ? GRUS : SCHUTT;
  if (m === SANDSTEIN) return ursache === "frost" && z() < 0.4 ? SCHUTT : SAND;
  if (m === SCHIEFER) return ursache === "chemie" ? TON : SCHUTT;
  if (m === BASALT) return ursache === "chemie" ? TON : SCHUTT;
  if (m === KALK || m === GIPS) return ursache === "chemie" ? LUFT : SCHUTT;
  if (m === SINTER) return LUFT;
  if (m === SCHUTT) return LUFT; // wird unten genauer behandelt
  return m;
}

export function schritt(q: Querschnitt, k: Klima): Querschnitt {
  const { W, H, stoff, eltern, riss, nass, haerte } = q;
  const z = q.zufall;
  const E = leer();
  const at = (i: number, j: number) => (i < 0 || i >= W || j >= H ? GRANIT : j < 0 ? LUFT : stoff[j * W + i]);
  q.winter = Math.floor(q.jahr / 100) % 3 === 2;

  // Oberkante je Spalte und Bewuchs
  const top = new Int16Array(W);
  for (let i = 0; i < W; i++) { let j = 0; while (j < H && !fest(stoff[j * W + i])) j++; top[i] = j; }
  const bewuchs = new Float32Array(W);
  for (let i = 0; i < W; i++) {
    const m = top[i] < H ? stoff[top[i] * W + i] : LUFT;
    const nahrhaft = m === BODEN ? 1 : m === LOESS || m === TON || m === GRUS ? 0.6 : m === SAND ? 0.3 : m === SCHUTT ? 0.25 : 0.1;
    // Pflanzen brauchen Wasser
    bewuchs[i] = k.pflanzen * nahrhaft * Math.min(1, 0.25 + k.wasser * 1.2);
  }

  const zerfall = (i: number, j: number, ursache: Kraft) => {
    const c = j * W + i, m = stoff[c];
    let p = produkt(m, ursache, z);
    if (m === SCHUTT) {
      const e = eltern[c];
      p = e === GRANIT ? GRUS : e === SANDSTEIN ? SAND : e === SCHIEFER || e === BASALT ? TON : e === KALK || e === GIPS ? (ursache === "chemie" ? LUFT : TON) : SAND;
    }
    stoff[c] = p;
    riss[c] = 0;
    if (p !== LUFT && m !== SCHUTT) eltern[c] = m;
    E[ursache]++;
  };

  const ausgesetzt = (i: number, j: number) => !fest(at(i, j - 1)) || !fest(at(i - 1, j)) || !fest(at(i + 1, j)) || !fest(at(i, j + 1));

  // ☀️ Sonne, ❄️ Frost, 🧪 Chemie, 🌱 Wurzeln — an Felszellen nahe der Oberfläche
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = j * W + i, m = stoff[c];
    if (!fest(m)) continue;
    const st = STOFFE[m];
    const frei = ausgesetzt(i, j);
    // Tiefe: Risse machen das Innere zugänglich
    const nah = frei || (riss[c] > 0.3 && (j - top[i]) < 12);
    // chemisch wirkt Wasser auch in der Tiefe, wo es hinkommt
    if (!nah && !(k.chemie && st.hydro && nass[c] > 0.08)) continue;
    const schutz = 1 - 0.7 * bewuchs[i] * (j - top[i] < 3 ? 1 : 0);
    const h = haerte[c];
    if (nah && frei && st.sonne && k.sonne) {
      // Temperaturwechsel: nur die oberste Schicht, ohne Schatten durch Pflanzen
      riss[c] += (k.sonne * k.sonne * st.sonne * 0.025 * schutz) / h;
      if (riss[c] >= 1) { zerfall(i, j, "sonne"); continue; }
    }
    if (nah && q.winter && k.frost && st.frost && nass[c] + riss[c] > 0.35) {
      riss[c] += (k.frost * st.frost * (nass[c] + 0.5 * riss[c]) * 0.15) / h;
      if (riss[c] >= 1) { zerfall(i, j, "frost"); continue; }
    }
    if (k.chemie && st.hydro && nass[c] > 0.08) {
      riss[c] += (k.chemie * k.chemie * st.hydro * nass[c] * 0.08 * (frei ? 1.5 : 1) * (0.5 + riss[c])) / h;
      if (riss[c] >= 1) { zerfall(i, j, "chemie"); continue; }
    }
    if (k.pflanzen && frei && bewuchs[i] > 0.2 && j - top[i] < 3 && istFels(m)) {
      riss[c] += (bewuchs[i] * 0.012) / h;
      if (riss[c] >= 1) { zerfall(i, j, "pflanzen"); continue; }
    }
    // Schutt zerfällt weiter zu Feinmaterial
    if (m === SCHUTT && frei && z() < 0.05 * (k.frost * (q.winter ? 1 : 0) + k.chemie + k.sonne * 0.5)) zerfall(i, j, k.chemie > k.frost ? "chemie" : "frost");
  }

  // 💧 Regen
  const regen = Math.round(k.wasser * W * 0.12 * (q.winter && k.frost > 0.6 ? 0.4 : 1));
  for (let n = 0; n < regen && q.tropfen.length < 1600; n++) q.tropfen.push({ x: Math.floor(z() * W), y: 0, unter: false, last: 0, saett: 0, alter: 0 });
  for (let sub = 0; sub < 16; sub++) bewegeTropfen(q, k, top, bewuchs, E);

  // 💨 Wind: Deflation und Dünen, Korrasion
  if (k.wind > 0) {
    const d = k.richtung;
    for (let n = 0; n < W; n++) {
      const i = d > 0 ? W - 1 - n : n; // in Windrichtung von hinten, damit nichts doppelt wandert
      const j = top[i];
      if (j >= H) continue;
      const c = j * W + i, m = stoff[c];
      const st = STOFFE[m];
      if (!st.locker || !st.wind) continue;
      // nasses Material und Bewuchs halten fest; Lee hinter Hindernissen schützt
      const luv = top[Math.max(0, Math.min(W - 1, i - d * 3))];
      const imLee = luv < j - 3;
      const p = k.wind * k.wind * st.wind * 0.25 * (1 - 0.9 * bewuchs[i]) * (1 - nass[c]) * (imLee ? 0.2 : 1);
      if (z() > p) continue;
      // weiter fliegen, wo es bergab geht
      // Körner springen in Windrichtung, den Luvhang hinauf; hinter dem Kamm fallen sie in den Lee
      let x = i;
      const weit = 1 + Math.floor(z() * 6 * k.wind);
      for (let s1 = 0; s1 < weit; s1++) {
        const nx = x + d;
        if (nx < 0 || nx >= W) { x = -1; break; }
        if (top[nx] < top[x] - 2) break; // Wand: bleibt davor liegen
        const faellt = top[nx] > top[x] + 1;
        x = nx;
        if (faellt) break;
      }
      stoff[c] = LUFT; riss[c] = 0; nass[c] = 0;
      E.wind++;
      if (x >= 0 && x !== i) {
        const ziel = top[x] - 1;
        if (ziel >= 0 && !fest(stoff[ziel * W + x])) { stoff[ziel * W + x] = m; eltern[ziel * W + x] = eltern[c]; top[x] = ziel; }
      }
      top[i] = j + 1;
    }
    // Korrasion: Sandgebläse am Fuß der Felsen (bis ~1 m über Grund)
    let sandDa = 0;
    for (let i = 0; i < W; i++) if (top[i] < H && STOFFE[stoff[top[i] * W + i]].wind > 0.4) sandDa++;
    if (sandDa > 3) for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
      const c = j * W + i, m = stoff[c];
      if (!istFels(m) || fest(at(i - d, j))) continue;
      // Grund vor dem Fels (luvseitig)
      let gx = i - d, grund = H;
      for (let s1 = 0; s1 < 6 && gx >= 0 && gx < W; s1++, gx -= d) grund = Math.min(grund, top[gx]);
      const ueber = grund - j;
      if (ueber < 0 || ueber > 4) continue;
      riss[c] += (k.wind * k.wind * 0.03 * (1 - ueber / 6)) / haerte[c];
      if (riss[c] >= 1) { stoff[c] = SAND; eltern[c] = m; riss[c] = 0; E.wind++; }
    }
  }

  // Schwerkraft: Lockermaterial rieselt, Fels mit Luft darunter und Rissen bricht
  for (let j = H - 2; j >= 0; j--) {
    const links = z() < 0.5;
    for (let n = 0; n < W; n++) {
      const i = links ? n : W - 1 - n;
      const c = j * W + i, m = stoff[c];
      if (!fest(m)) continue;
      const unten = stoff[c + W];
      const st = STOFFE[m];
      if (st.locker) {
        if (!fest(unten)) { tausche(q, c, c + W); continue; }
        // Rutschen: Löss steht senkrecht, solange er trocken ist; Ton rutscht nass
        let p = st.rutsch;
        if (m === LOESS) p = nass[c] > 0.5 ? 0.6 : 0.01;
        if (m === TON) p = nass[c] > 0.45 ? 0.5 : 0.03;
        if (k.frost && q.winter && nass[c] > 0.3) { p += 0.15 * k.frost; }
        if (z() > p) continue;
        const d = z() < 0.5 ? -1 : 1;
        for (const dd of [d, -d]) {
          const ni = i + dd;
          if (ni < 0 || ni >= W) continue;
          // nasser Ton und auftauender Boden fließen auch über flachere Hänge (Rutschung, Solifluktion)
          const fliesst = (m === TON || m === BODEN || m === LOESS) && p > 0.3 && ni + dd >= 0 && ni + dd < W && !fest(stoff[j * W + ni]) && !fest(stoff[(j + 1) * W + ni + dd]);
          if (fliesst) { tausche(q, c, j * W + ni); E[k.frost && q.winter ? "frost" : "wasser"]++; break; }
          if (!fest(stoff[j * W + ni]) && !fest(stoff[(j + 1) * W + ni])) {
            // Schutt braucht steileres Gefälle (bleibt als Halde liegen)
            if (m === SCHUTT && j + 2 < H && fest(stoff[(j + 2) * W + ni])) break;
            tausche(q, c, (j + 1) * W + ni);
            if (m === TON || m === LOESS || (k.frost && q.winter)) E[m === TON || m === LOESS ? "wasser" : "frost"]++;
            break;
          }
        }
      } else if (!fest(unten) && j + 1 < H) {
        // Fels über Hohlraum: bricht, wenn rissig (Felssturz, Höhlendecke → Doline)
        const halt = (fest(at(i - 1, j)) && fest(at(i - 1, j + 1)) ? 1 : 0) + (fest(at(i + 1, j)) && fest(at(i + 1, j + 1)) ? 1 : 0);
        if (riss[c] > 0.55 && (halt < 2 || riss[c] > 0.85)) { eltern[c] = m; stoff[c] = SCHUTT; riss[c] = 0.2; }
      }
    }
  }

  // 🌱 Bodenbildung und Austrocknen
  for (let i = 0; i < W; i++) {
    const j = top[i];
    if (j >= H) continue;
    const c = j * W + i, m = stoff[c];
    if (bewuchs[i] > 0.3 && (m === GRUS || m === LOESS || m === TON || m === SAND || m === SCHUTT) && z() < bewuchs[i] * 0.01) { stoff[c] = BODEN; E.pflanzen++; }
  }
  for (let c = 0; c < W * H; c++) {
    if (!fest(stoff[c])) { nass[c] = 0; continue; }
    // Wasser sickert in lockerem, durchlässigem Material nach unten
    const below = c + W;
    if (below < W * H && fest(stoff[below]) && STOFFE[stoff[c]].durch > 0.3 && nass[c] > nass[below]) {
      const f = (nass[c] - nass[below]) * 0.3 * Math.min(STOFFE[stoff[below]].durch + riss[below], 1);
      nass[c] -= f; nass[below] += f;
    }
    nass[c] *= 0.985 - 0.02 * k.sonne;
  }

  for (const kk of KRAEFTE) q.wirkungMittel[kk.id] = q.wirkungMittel[kk.id] * 0.9 + E[kk.id] * 0.1;
  q.wirkung = E;
  q.jahr += 100;
  return q;
}

function tausche(q: Querschnitt, a: number, b: number) {
  const { stoff, eltern, riss, nass } = q;
  [stoff[a], stoff[b]] = [stoff[b], stoff[a]];
  [eltern[a], eltern[b]] = [eltern[b], eltern[a]];
  [riss[a], riss[b]] = [riss[b], riss[a]];
  [nass[a], nass[b]] = [nass[b], nass[a]];
}

function bewegeTropfen(q: Querschnitt, k: Klima, top: Int16Array, bewuchs: Float32Array, E: Record<Kraft, number>) {
  const { W, H, stoff, riss, nass, eltern } = q;
  const z = q.zufall;
  const neu: Tropfen[] = [];
  const frei = (i: number, j: number) => i >= 0 && i < W && j >= 0 && j < H && !fest(stoff[j * W + i]);
  for (const t of q.tropfen) {
    t.alter++;
    if (t.alter > 700) { if (t.y < H && t.x >= 0 && t.x < W && t.y >= 0) nass[t.y * W + t.x] = Math.min(1, nass[t.y * W + t.x] + 0.3); continue; }
    if (!t.unter) {
      // in der Luft: fallen
      if (frei(t.x, t.y + 1)) {
        t.y++;
        if (t.y >= H) continue;
        neu.push(t);
        continue;
      }
      if (t.y + 1 >= H) continue;
      const c = (t.y + 1) * W + t.x, m = stoff[c], st = STOFFE[m];
      // Tropfstein: gesättigtes Wasser tropft in die Höhle, gibt CO₂ ab, Kalk fällt aus
      if (t.saett > 0.3 && t.y > top[t.x] + 2 && z() < 0.5 * t.saett) {
        if (frei(t.x, t.y)) { stoff[t.y * W + t.x] = SINTER; E.chemie++; }
        continue;
      }
      // versickern
      const p = Math.min(0.95, st.durch * (1 - nass[c]) + riss[c] * 0.7);
      if (z() < p) { t.unter = true; t.y++; nass[c] = Math.min(1, nass[c] + 0.15); neu.push(t); continue; }
      // abfließen: dorthin, wo es tiefer geht
      const l = frei(t.x - 1, t.y), r = frei(t.x + 1, t.y);
      let d = 0;
      if (l && r) d = top[t.x - 1] > top[t.x + 1] ? -1 : top[t.x + 1] > top[t.x - 1] ? 1 : z() < 0.5 ? -1 : 1;
      else if (l) d = -1; else if (r) d = 1;
      if (d === 0) {
        // Senke: Wasser bleibt stehen, sickert langsam ein
        nass[c] = Math.min(1, nass[c] + 0.25);
        if (t.last && frei(t.x, t.y)) { stoff[t.y * W + t.x] = t.last; t.last = 0; }
        continue;
      }
      nass[c] = Math.min(1, nass[c] + 0.08 * (1 - st.durch));
      // Abspülung: das fließende Wasser nimmt lockeres Korn unter sich mit
      if (!t.last && st.locker && st.spuel && z() < k.wasser * st.spuel * 0.35 * (1 - 0.85 * bewuchs[t.x])) {
        t.last = m; stoff[c] = LUFT; eltern[c] = LUFT; riss[c] = 0; nass[c] = 0; E.wasser++;
      } else if (t.last && z() < 0.04) {
        // Ablagerung, wo es flacher wird
        if (frei(t.x, t.y)) { stoff[t.y * W + t.x] = t.last; t.last = 0; }
      }
      t.x += d;
      if (t.x < 0 || t.x >= W) continue;
      neu.push(t);
      continue;
    }
    // im Untergrund
    if (t.y >= H || t.y < 0) continue;
    const c = t.y * W + t.x, m = stoff[c];
    if (!fest(m)) { t.unter = false; neu.push(t); continue; } // in eine Höhle getropft
    const st = STOFFE[m];
    nass[c] = Math.min(1, nass[c] + 0.04);
    // Lösung: Kohlensäure frisst Kalk und Gips, vor allem entlang der Klüfte
    if (st.loes && k.chemie && t.saett < 1) {
      riss[c] += (k.chemie * st.loes * 0.12 * (0.3 + riss[c]) * (1 - t.saett)) / q.haerte[c];
      t.saett = Math.min(1, t.saett + 0.12 / Math.max(1, st.loes / 2));
      if (riss[c] >= 1) { stoff[c] = LUFT; riss[c] = 0; nass[c] = 0; E.chemie++; t.unter = false; neu.push(t); continue; }
    }
    const durch = (i: number, j: number) => {
      if (i < 0 || i >= W || j >= H) return -1;
      const cc = j * W + i, mm = stoff[cc];
      if (!fest(mm)) return 2;
      return STOFFE[mm].durch * (1 - nass[cc] * 0.5) + riss[cc] * 0.8;
    };
    const runter = durch(t.x, t.y + 1);
    if (t.y + 1 >= H) continue;
    if (z() < runter) { t.y++; neu.push(t); continue; }
    // seitwärts in einer Kluft oder über einer undurchlässigen Schicht (→ Quelle am Hang)
    const d = z() < 0.5 ? -1 : 1;
    let bewegt = false;
    for (const dd of [d, -d]) {
      const pd = durch(t.x + dd, t.y);
      if (pd > 0 && z() < pd + 0.15) {
        t.x += dd;
        // Karstwasser fließt seitlich und mischt sich: Mischungskorrosion macht es wieder aggressiv
        t.saett *= 0.6;
        if (pd === 2) t.unter = false; // tritt am Hang aus (Quelle)
        bewegt = true;
        break;
      }
    }
    if (t.x < 0 || t.x >= W) continue;
    // festgesteckt: wird nach langer Zeit zu Bodenfeuchte (Grundwasser)
    if (bewegt || t.alter < 300) neu.push(t);
    else nass[c] = Math.min(1, nass[c] + 0.2);
  }
  q.tropfen = neu;
}

/** Wie viel Gestein ist schon verwittert/abgetragen? (Anteil der Ausgangs-Felszellen, die kein Fels mehr sind) */
export function verwittert(q: Querschnitt): number {
  let fels = 0, weg = 0;
  for (let c = 0; c < q.stoff.length; c++) {
    if (!istFels(q.start[c])) continue;
    fels++;
    if (q.stoff[c] !== q.start[c]) weg++;
  }
  return fels ? weg / fels : 0;
}

/** abgetragene Fläche im Querschnitt (m²): war Gestein oder Boden, ist jetzt Luft */
export function abgetragen(q: Querschnitt): number {
  let n = 0;
  for (let c = 0; c < q.stoff.length; c++) if (fest(q.start[c]) && !fest(q.stoff[c])) n++;
  return n * q.zelle * q.zelle;
}

/** Hohlräume unter der Oberfläche (Höhlen) in m² */
export function hoehlen(q: Querschnitt): number {
  let n = 0;
  for (let i = 0; i < q.W; i++) {
    let j = 0;
    while (j < q.H && !fest(q.stoff[j * q.W + i])) j++;
    for (; j < q.H; j++) if (!fest(q.stoff[j * q.W + i])) n++;
  }
  return n * q.zelle * q.zelle;
}
