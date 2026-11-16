/**
 * Wilson-Zyklus — ein Ozean öffnet sich und schließt sich wieder.
 *
 * Kinematisches Schulmodell eines Querschnitts (x in km, Zeit in Mio. Jahren):
 * zwei Kontinente A (links) und B (rechts), die zu Beginn ein Superkontinent
 * sind. Die Platten bewegen sich mit festen Geschwindigkeiten je Abschnitt;
 * der Ozeanboden besteht aus Streifen, die am Rücken entstehen, mit ihrer
 * Platte wandern, altern (tiefer, dicker) und an der Tiefseerinne abtauchen.
 * Jeder Streifen trägt die Magnetrichtung seiner Geburtszeit.
 *
 * Eichung: Öffnen mit 3 cm/Jahr (Atlantik 2–4), Schließen mit 4 cm/Jahr
 * (Anden 6–8), ein Zyklus ≈ 560 Mio. Jahre (echte 300–500). Tiefe des
 * Ozeanbodens nach Parsons & Sclater: 2,6 km + 0,345·√Alter.
 */

export const ZYKLUS = 560;
export const ANFANG_RIFT = 25;
export const AUFBRUCH = 55;
export const SUBDUKTION = 250;
export const RUECKEN_WEG = 310;
export const KOLLISION = 400;
export const GIPFEL = 450;

const V_AUF = 3000 / (SUBDUKTION - AUFBRUCH); // km/Mio. J je Seite
const V_ZU = 20; // je Kontinent
const SPREIZEN_ZU = 20; // volle Spreizrate beim Schließen

export interface Phase {
  id: string;
  von: number;
  bis: number;
  name: string;
  beispiel: string;
  text: string;
  grenzen: string;
  begriffe: string[];
}

export const PHASEN: Phase[] = [
  {
    id: "ruhe", von: 0, bis: ANFANG_RIFT, name: "Superkontinent",
    beispiel: "Pangäa vor 300 Mio. Jahren; heute die Aufwölbung Ostafrikas",
    text: "Ein großer Kontinent deckt den Mantel zu wie eine Decke. Darunter staut sich Wärme, heißes Gestein steigt auf und wölbt die Kruste nach oben.",
    grenzen: "keine Plattengrenze — noch",
    begriffe: ["Superkontinent", "Aufwölbung", "Manteldiapir (Plume)", "Wärmestau"],
  },
  {
    id: "graben", von: ANFANG_RIFT, bis: AUFBRUCH, name: "Grabenbruch",
    beispiel: "Ostafrikanischer Graben, Oberrheingraben",
    text: "Der Kontinent wird gedehnt und reißt. Entlang von Abschiebungen sinkt ein Graben ein, die Grabenschultern heben sich. Vulkane und flache Erdbeben begleiten das Aufreißen.",
    grenzen: "beginnende divergente Grenze",
    begriffe: ["Grabenbruch (Rift)", "Abschiebung", "Grabenschulter", "Vulkanismus"],
  },
  {
    id: "jung", von: AUFBRUCH, bis: 90, name: "Junges Meer",
    beispiel: "Rotes Meer, Golf von Aden",
    text: "Der Kontinent ist zerbrochen. Im Graben entsteht erstmals ozeanische Kruste aus Basalt, das Meer dringt ein. Aus einem Kontinent sind zwei geworden.",
    grenzen: "divergent (Mittelozeanischer Rücken)",
    begriffe: ["ozeanische Kruste", "Meeresbodenspreizung", "passiver Kontinentalrand"],
  },
  {
    id: "ozean", von: 90, bis: SUBDUKTION, name: "Ozean mit Rücken",
    beispiel: "Atlantik mit Mittelatlantischem Rücken und Island",
    text: "Am Rücken quillt ständig Magma auf und wird zu neuem Meeresboden. Je weiter vom Rücken, desto älter, kälter und tiefer liegt er. Die Magnetstreifen liegen spiegelbildlich zum Rücken. Die Kontinentränder sind ruhig und sammeln Sedimente (Schelf).",
    grenzen: "divergent in der Mitte, die Ränder sind keine Plattengrenzen",
    begriffe: ["Mittelozeanischer Rücken", "Magnetstreifen", "Schelf", "Tiefseeebene"],
  },
  {
    id: "subduktion", von: SUBDUKTION, bis: RUECKEN_WEG, name: "Subduktion beginnt",
    beispiel: "Pazifik: Anden, Japan",
    text: "Alter Meeresboden ist schwerer als der Mantel darunter und beginnt am Kontinentrand abzutauchen. Eine Tiefseerinne entsteht, über der abtauchenden Platte ein Vulkangürtel, Erdbeben reichen bis 700 km tief. Der Ozean schrumpft, obwohl der Rücken weiter spreizt.",
    grenzen: "divergent (Rücken) und konvergent (Tiefseerinne)",
    begriffe: ["Subduktion", "Tiefseerinne", "aktiver Kontinentalrand", "Vulkanbogen", "Benioff-Zone"],
  },
  {
    id: "schliessen", von: RUECKEN_WEG, bis: KOLLISION, name: "Ozean schließt sich",
    beispiel: "Mittelmeer",
    text: "Auch der Rücken ist abgetaucht. Nun wird nur noch Meeresboden verschluckt — der Ozean wird immer schmaler, die Kontinente kommen aufeinander zu.",
    grenzen: "konvergent",
    begriffe: ["Restozean", "Subduktion", "Vulkanbogen"],
  },
  {
    id: "kollision", von: KOLLISION, bis: GIPFEL, name: "Kollision",
    beispiel: "Himalaya, Alpen",
    text: "Kontinentale Kruste ist zu leicht, um abzutauchen. Die Kontinente stoßen zusammen, die Kruste staucht sich auf 70 km und bildet ein Hochgebirge mit tiefer Gebirgswurzel. Die abgetauchte Platte reißt ab. Reste des Meeresbodens bleiben in der Naht (Sutur) eingeklemmt.",
    grenzen: "konvergent (Kontinent gegen Kontinent)",
    begriffe: ["Kollision", "Faltengebirge", "Gebirgswurzel", "Sutur", "Ophiolith"],
  },
  {
    id: "abtragung", von: GIPFEL, bis: ZYKLUS, name: "Abtragung",
    beispiel: "Ural, Appalachen, Harz und Thüringer Wald (Variszikum)",
    text: "Wind, Wasser und Eis tragen das Gebirge ab; wie ein Eisberg taucht die leichte Wurzel dabei auf (Isostasie). Übrig bleibt ein Rumpfgebirge — und eine Narbe im Kontinent, an der er später oft wieder aufreißt. Der Zyklus beginnt von vorn.",
    grenzen: "keine mehr — ein neuer Superkontinent",
    begriffe: ["Abtragung", "Isostasie", "Rumpfgebirge", "Sutur"],
  },
];

export function phaseBei(t: number): Phase {
  const z = ((t % ZYKLUS) + ZYKLUS) % ZYKLUS;
  return PHASEN.find(p => z >= p.von && z < p.bis) ?? PHASEN[PHASEN.length - 1];
}

type Platte = "A" | "B" | "OB" | "ruecken";

/** Geschwindigkeit einer Platte in km pro Mio. Jahre (1 cm/Jahr = 10). */
export function geschwindigkeit(p: Platte, t: number): number {
  if (t < AUFBRUCH) return 0;
  if (t < SUBDUKTION) return p === "A" ? -V_AUF : p === "ruecken" ? 0 : V_AUF;
  if (t < KOLLISION) {
    if (p === "A") return V_ZU;
    if (p === "B") return -V_ZU;
    // Ist der Rücken abgetaucht, hängen beide Ozeanhälften an einer Platte —
    // sonst risse die abtauchende Platte in der Tiefe auseinander.
    if (p === "OB") return t < RUECKEN_WEG ? V_ZU + SPREIZEN_ZU : V_ZU;
    return t < RUECKEN_WEG ? V_ZU + SPREIZEN_ZU / 2 : 0;
  }
  return 0;
}

const KNICKE = [0, AUFBRUCH, SUBDUKTION, RUECKEN_WEG, KOLLISION, ZYKLUS];

/** Weg einer Platte von t = 0 bis t (stückweise konstante Geschwindigkeit). */
export function verschiebung(p: Platte, t: number): number {
  let s = 0;
  for (let i = 0; i < KNICKE.length - 1; i++) {
    const a = KNICKE[i], b = Math.min(KNICKE[i + 1], t);
    if (b <= a) break;
    s += geschwindigkeit(p, (a + b) / 2) * (b - a);
  }
  return s;
}

export const kanteA = (t: number) => verschiebung("A", t);
export const kanteB = (t: number) => verschiebung("B", t);
export const rueckenX = (t: number) => verschiebung("ruecken", t);
export const rinneAktiv = (t: number) => t >= SUBDUKTION && t < KOLLISION + 20;
export const rueckenAktiv = (t: number) => t >= AUFBRUCH && t < RUECKEN_WEG;

/** Magnetrichtung zur Zeit τ: fester Zufall, Umpolungen alle 2–9 Mio. Jahre. */
const UMPOLUNGEN: number[] = (() => {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const aus: number[] = [];
  for (let t = 0; t < ZYKLUS; t += 2 + 7 * r()) aus.push(t);
  return aus;
})();

export function normalGepolt(tau: number): boolean {
  let n = 0;
  for (const u of UMPOLUNGEN) { if (u > tau) break; n++; }
  return n % 2 === 1;
}

export interface Streifen {
  /** Mitte in km. */
  x: number;
  breite: number;
  geboren: number;
  alter: number;
  normal: boolean;
  seite: "A" | "B";
  /** Wie weit er schon hinter der Rinne abgetaucht ist (km), sonst 0. */
  abgetaucht: number;
}

export const STREIFEN_DT = 0.5;

/** Alle Ozeanboden-Streifen zur Zeit t (auch die abgetauchten). */
export function streifen(t: number): Streifen[] {
  const aus: Streifen[] = [];
  const ende = Math.min(t, RUECKEN_WEG);
  const rinne = kanteB(t);
  for (let tau = AUFBRUCH; tau < ende; tau += STREIFEN_DT) {
    const halb = Math.abs(geschwindigkeit("A", tau) - geschwindigkeit("ruecken", tau));
    const breite = halb * Math.min(STREIFEN_DT, t - tau);
    const r = rueckenX(tau);
    const normal = normalGepolt(tau);
    const alter = t - tau;
    const xa = r + verschiebung("A", t) - verschiebung("A", tau) - breite / 2;
    // Die B-Seite fährt mit »OB«: bis zur Subduktion hängt sie an Kontinent B.
    const xb = r + verschiebung("OB", t) - verschiebung("OB", tau) + breite / 2;
    const ab = (x: number) => (t >= SUBDUKTION ? Math.max(0, x - rinne) : 0);
    aus.push({ x: xa, breite, geboren: tau, alter, normal, seite: "A", abgetaucht: ab(xa) });
    aus.push({ x: xb, breite, geboren: tau, alter, normal, seite: "B", abgetaucht: ab(xb) });
  }
  return aus;
}

/** Wassertiefe des Ozeanbodens in km (Parsons & Sclater, ab 80 Mio. J flach). */
export function ozeanTiefe(alter: number): number {
  return 2.6 + 0.345 * Math.sqrt(Math.min(Math.max(alter, 0), 90));
}

/** Dicke der ozeanischen Lithosphäre in km (wächst mit √Alter, max. ≈ 100). */
export function lithoDicke(alter: number): number {
  return Math.min(100, 8 + 10 * Math.sqrt(Math.max(alter, 0)));
}

/** Breite des offenen Ozeans (nicht abgetaucht) in km. */
export function ozeanBreite(t: number): number {
  if (t < AUFBRUCH || t >= KOLLISION) return 0;
  return Math.max(0, kanteB(t) - kanteA(t));
}

/** Wie weit die Kollision fortgeschritten ist (0–1), danach die Abtragung. */
export function gebirge(t: number): number {
  if (t < KOLLISION) return 0;
  if (t < GIPFEL) return (t - KOLLISION) / (GIPFEL - KOLLISION);
  return Math.exp(-(t - GIPFEL) / 45);
}

/** Dehnung im Graben (0–1). */
export function riftGrad(t: number): number {
  if (t < ANFANG_RIFT) return 0;
  return Math.min(1, (t - ANFANG_RIFT) / (AUFBRUCH - ANFANG_RIFT));
}

/** Aufwölbung über dem Plume (km), vor und während des Rifts. */
export function aufwoelbung(t: number): number {
  if (t < ANFANG_RIFT) return 1.2 * (t / ANFANG_RIFT);
  if (t < 120) return 1.2 * Math.exp(-(t - ANFANG_RIFT) / 25);
  return 0;
}

/** Wie stark die Kontinentränder ausgedünnt sind (0–1). */
export function randAusduennung(t: number): number {
  if (t < KOLLISION) return riftGrad(t);
  return Math.max(0, 1 - (t - KOLLISION) / 30);
}

/**
 * Krustendicke eines Kontinents in km.
 * `d` = Abstand von seinem Rand (km, ≥ 0), `x` = Ort, für das Gebirge.
 */
export function krustenDicke(t: number, d: number, x: number): number {
  const rand = randAusduennung(t) * 25 * Math.exp(-Math.max(0, d) / 150);
  const g = gebirge(t);
  const berg = 35 * g * Math.exp(-(((x - 120) / 330) ** 2));
  // Graben vor dem Aufbruch: eine Senke in der Mitte des Superkontinents.
  const r = t < AUFBRUCH ? riftGrad(t) : 0;
  const graben = 22 * r * Math.exp(-((x / 200) ** 2));
  return 35 - rand + berg - graben;
}

/** Geländehöhe eines Kontinents aus der Krustendicke (Airy-Isostasie), km. */
export function kontinentHoehe(t: number, dicke: number, x: number): number {
  const plume = aufwoelbung(t) * Math.exp(-((x / 900) ** 2));
  const schulter = t >= ANFANG_RIFT && t < 150
    ? 0.9 * riftGrad(t) * Math.exp(-(t > AUFBRUCH ? (t - AUFBRUCH) / 40 : 0)) * Math.exp(-(((Math.abs(x) - 330) / 120) ** 2))
    : 0;
  return 0.5 + (dicke - 35) * 0.16 + plume + schulter;
}

/** Wo steht ein Punkt der abtauchenden Platte? s = Weg hinter der Rinne (km). */
export function plattenBahn(s: number): { dx: number; z: number; winkel: number } {
  // Erst flach (5°), nach 300 km steil (50°), auf der 660-km-Grenze legt sie
  // sich in einem weiten Bogen hin (sie kommt dort nicht ohne Weiteres durch).
  const knick = 300;
  const w0 = (5 * Math.PI) / 180, w1 = (50 * Math.PI) / 180;
  let dx = 0, z = 0, w = w0;
  const schritt = 5;
  for (let a = 0; a < s; a += schritt) {
    const ds = Math.min(schritt, s - a);
    w = z >= 600 ? Math.max(0, w - 0.008 * ds) : a < knick ? w0 + (w1 - w0) * (a / knick) : w1;
    dx += Math.cos(w) * ds;
    z += Math.sin(w) * ds;
  }
  return { dx, z, winkel: w };
}

/** Horizontaler Abstand Rinne → Vulkanbogen (Platte in ≈ 110 km Tiefe). */
export function bogenAbstand(): number {
  for (let s = 0; s < 1500; s += 5) {
    const p = plattenBahn(s);
    if (p.z >= 110) return p.dx;
  }
  return 300;
}

/** Ein Punkt auf der Oberseite der abtauchenden Platte (km). */
export interface PlattenPunkt { x: number; z: number; winkel: number; dick: number }

/** Ab hier reißt die Platte nach der Kollision ab (Weg hinter der Rinne, km). */
export const ABRISS_S = 400;

/**
 * Die abtauchende Platte als durchgehendes Band, Oberseite alle 10 km.
 * Ein Teil hängt an der Rinne; nach der Kollision reißt er ab: der obere
 * Stumpf schrumpft, der untere Teil sinkt in den tieferen Mantel.
 * Die Platte wird mit der Tiefe dünner (sie wärmt sich auf) und läuft
 * an den Enden spitz aus.
 */
export function abtauchendePlatte(t: number): { haengt: PlattenPunkt[]; sinkt: PlattenPunkt[]; abriss: number } | null {
  if (t < SUBDUKTION) return null;
  const abriss = t > KOLLISION + 15 ? (t - KOLLISION - 15) * 4 : 0;
  if (abriss > 700) return null;
  const ab = streifen(t).filter(s => s.abgetaucht > 0 && s.abgetaucht < 1500).sort((a, b) => a.abgetaucht - b.abgetaucht);
  if (!ab.length) return null;
  const rinne = kanteB(Math.min(t, KOLLISION));
  const zRinne = ozeanTiefe(ab[0].alter) + 3;
  const sMax = Math.min(1500, ab[ab.length - 1].abgetaucht + ab[ab.length - 1].breite / 2);
  // Nach dem Abriss schrumpft der Stumpf binnen 15 Mio. Jahren auf null.
  const stumpf = abriss > 0 ? Math.min(sMax, ABRISS_S * Math.max(0, 1 - (t - KOLLISION - 15) / 15)) : sMax;
  let k = 0;
  const punkt = (s: number, von: number, bis: number, tiefer: number): PlattenPunkt => {
    while (k < ab.length - 1 && ab[k].abgetaucht < s) k++;
    const p = plattenBahn(s);
    const spitze = Math.sqrt(Math.min(1, (bis - s) / 80, von > 0 ? (s - von) / 80 : 1));
    const dick = lithoDicke(ab[k].alter - s / 40) * (1 - 0.5 * Math.min(1, s / 1200)) * Math.max(0, spitze);
    return { x: rinne + p.dx, z: zRinne + p.z + tiefer, winkel: p.winkel, dick };
  };
  const band = (von: number, bis: number, tiefer: number) => {
    const aus: PlattenPunkt[] = [];
    if (bis - von < 10) return aus;
    k = 0;
    for (let s = von; s < bis; s += 10) aus.push(punkt(s, von, bis, tiefer));
    aus.push(punkt(bis, von, bis, tiefer));
    return aus;
  };
  return {
    haengt: band(0, stumpf, 0),
    sinkt: abriss > 0 ? band(Math.min(ABRISS_S, sMax), sMax, abriss) : [],
    abriss,
  };
}

/** Tiefe der Plattenoberseite unter x (km), Infinity, wo keine Platte ist. */
export function plattenOberseite(band: PlattenPunkt[], x: number): number {
  if (band.length < 2 || x < band[0].x || x > band[band.length - 1].x) return Infinity;
  let i = 1;
  while (i < band.length - 1 && band[i].x < x) i++;
  const a = band[i - 1], b = band[i];
  return a.z + ((b.z - a.z) * (x - a.x)) / Math.max(1e-6, b.x - a.x);
}

export interface Zustand {
  t: number;
  phase: Phase;
  kanteA: number;
  kanteB: number;
  ruecken: number | null;
  rinne: number | null;
  ozeanBreite: number;
  /** Höchster Gipfel in km über dem Meer. */
  gipfel: number;
}

export function zustand(t: number): Zustand {
  const g = gebirge(t);
  const gipfel = g > 0 ? kontinentHoehe(t, krustenDicke(t, 500, 120), 120) : kontinentHoehe(t, krustenDicke(t, 1000, 900), 900);
  return {
    t, phase: phaseBei(t),
    kanteA: kanteA(t), kanteB: kanteB(t),
    ruecken: rueckenAktiv(t) ? rueckenX(t) : null,
    rinne: rinneAktiv(t) && t < KOLLISION ? kanteB(t) : null,
    ozeanBreite: ozeanBreite(t),
    gipfel,
  };
}
