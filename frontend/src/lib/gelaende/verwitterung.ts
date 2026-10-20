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
s(KALK, { name: "Kalkstein", farbe: [214, 210, 192], locker: false, durch: 0.05, sonne: 0.4, frost: 0.25, loes: 1, hydro: 0, wind: 0, spuel: 0, rutsch: 0 });
s(GRANIT, { name: "Granit", farbe: [168, 160, 158], locker: false, durch: 0.02, sonne: 0.8, frost: 0.6, loes: 0, hydro: 0.5, wind: 0, spuel: 0, rutsch: 0 });
s(SCHIEFER, { name: "Schiefer", farbe: [86, 92, 104], locker: false, durch: 0.05, sonne: 0.5, frost: 0.9, loes: 0, hydro: 0.35, wind: 0, spuel: 0, rutsch: 0 });
s(GIPS, { name: "Gips", farbe: [236, 232, 226], locker: false, durch: 0.05, sonne: 0.3, frost: 0.4, loes: 8, hydro: 0, wind: 0, spuel: 0, rutsch: 0 });
s(SCHUTT, { name: "Gesteinsschutt", farbe: [150, 140, 130], locker: true, durch: 0.8, sonne: 0.2, frost: 0.5, loes: 0, hydro: 0.3, wind: 0, spuel: 0.08, rutsch: 0.35 });
s(GRUS, { name: "Grus (zerfallener Granit)", farbe: [190, 176, 156], locker: true, durch: 0.7, sonne: 0, frost: 0.1, loes: 0, hydro: 0.1, wind: 0.6, spuel: 0.8, rutsch: 0.6 });
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
  { id: "harz", icon: "🌲", label: "Mittelgebirge (Harz)", text: "Rau und nass: viel Regen und Nebel, häufiger Frostwechsel, starker Wind auf den Kuppen, Fichtenwald.", k: { sonne: 0.3, wind: 0.7, wasser: 0.85, frost: 0.85, chemie: 0.55, pflanzen: 0.6, richtung: 1 } },
  { id: "eiszeit", icon: "🥶", label: "Eiszeit", text: "Kaltzeit vor dem Eis: Frostwechsel, Schmelzwasser im Sommer, kaum Pflanzen — Bodenfließen und Abspülung räumen Lockermaterial ab.", k: { sonne: 0.25, wind: 0.6, wasser: 0.7, frost: 1, chemie: 0.05, pflanzen: 0.03, richtung: 1 } },
  { id: "tundra", icon: "🧊", label: "Tundra", text: "Lange Winter, kurzer Sommer, Dauerfrost: Frostsprengung und Bodenfließen.", k: { sonne: 0.2, wind: 0.5, wasser: 0.3, frost: 0.9, chemie: 0.05, pflanzen: 0.25, richtung: 1 } },
];

export interface Tropfen {
  x: number; y: number;
  /** im Untergrund (versickert) */
  unter: boolean;
  /** mitgeführtes Korn (Stoff) oder 0 */
  last: number;
  /** wie viele Körner (bis 3) */
  menge?: number;
  /** Sättigung mit gelöstem Kalk 0..1: gesättigtes Wasser löst nichts mehr, bildet aber Tropfsteine */
  saett: number;
  alter: number;
  /** Fließrichtung (Schwung), 0 = noch keine */
  dir: number;
  /** Mischungskorrosion: so viele Schritte noch besonders aggressiv (nach seitlichem Fließen) */
  misch?: number;
  /** wie oft schon in einer Senke angestiegen */
  stau?: number;
  /** gehört zu einem Bach (abgedichtetes Bachbett: versickert nur in löslichem oder durchlässigem Gestein) */
  fluss?: boolean;
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
  /** Beschriftungen der Formen (Zellkoordinaten) */
  marken: { text: string; x: number; y: number }[];
  /** Bäche, die von außen hereinfließen */
  quellen: { x: number; y: number; staerke: number }[];
  /** Meldungen dieses Schritts (z. B. Einsturz) */
  ereignisse: string[];
  /** zählt jeden Schritt hoch (für Zwischenspeicher beim Zeichnen) */
  stand: number;
  gestein: Gestein;
  /** Luft mit kurzem Weg zum Himmel (1) — alles andere ist Höhle */
  draussen?: Uint8Array;
  /** wie viel Wasser zuletzt durch jede Zelle floss (gleitend) — zeigt die Wasserwege */
  fluss?: Float32Array;
  /** vom Grundwasser gelöst und fortgetragen (Zellen) */
  geloest?: number;
  /** 1 = Teil eines losgelösten Blocks (kann fallen und rollen) */
  lose?: Uint8Array;
  /** Lupe: Vergrößerung gegenüber der Übersicht und Sickerwasser, das von oben in den Ausschnitt kommt */
  lupe?: { faktor: number; x0: number; y0: number; zufluss: Float32Array; saettOben: Float32Array };
  /** Zellen eines Blocks, der schon gefallen oder gerollt ist */
  gerollt?: Uint8Array;
  /** Hangrutschungen (Ort, Zeit) */
  rutschungen?: { x: number; y: number; jahr: number }[];
  /** Orte, an denen eine Höhlendecke bis zur Oberfläche durchbrach (für »Einsturzdoline«) */
  einstuerze?: { x: number; jahr: number }[];
  /** Karstwasser-Netz: Durchfluss je Zelle in diesem Schritt (Sickerwasser bis zur Quelle) */
  karst?: Float32Array;
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

export const leereWirkung = (): Record<Kraft, number> => ({ sonne: 0, wind: 0, wasser: 0, frost: 0, chemie: 0, pflanzen: 0 });
const leer = leereWirkung;

// ---------------------------------------------------------------- Hilfen

const fest = (m: number) => m !== LUFT && m !== WASSER;
const NACHBARN8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const istFels = (m: number) => fest(m) && !STOFFE[m].locker;

/** Zerfallsprodukt eines Felses je nach Ursache */
function produkt(m: number, ursache: Kraft, z: () => number): number {
  if (m === GRANIT) return ursache === "chemie" || z() < 0.75 ? GRUS : SCHUTT; // Granit zerfällt meist zu Grus (Abgrusung)
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
  q.winter = q.stand % 3 === 2;
  const f = q.lupe?.faktor ?? 1;

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
      p = e === GRANIT ? GRUS : e === SANDSTEIN ? SAND : e === SCHIEFER || e === BASALT ? TON : e === KALK || e === GIPS ? (ursache === "chemie" ? LUFT : BODEN) : SAND;
    }
    stoff[c] = p;
    riss[c] = 0;
    if (p !== LUFT && m !== SCHUTT) eltern[c] = m;
    E[ursache]++;
  };

  // »Draußen«: Luft, die vom Himmel aus auf kurzem Weg erreichbar ist (≤ 2 m in Höhleneingänge hinein).
  // Frost, Sonne und Wurzeln wirken nur dort — in der Höhle ist es das ganze Jahr gleich kühl und feucht.
  const draussen = luftDraussen(q, top, 8);
  q.draussen = draussen;
  const offenNach = (i: number, j: number) => i >= 0 && i < W && j >= 0 && j < H ? draussen[j * W + i] === 1 : j < 0;
  const ausgesetzt = (i: number, j: number) => offenNach(i, j - 1) || offenNach(i - 1, j) || offenNach(i + 1, j) || offenNach(i, j + 1);
  /** Ecken und Kanten verwittern schneller als Flächen: offene Nachbarn zählen */
  const kante = (i: number, j: number) => {
    let offen = 0;
    for (const [a, bb] of NACHBARN8) { const ii = i + a, jj = j + bb; const m2 = at(ii, jj); if (!istFels(m2) || (ii >= 0 && jj >= 0 && ii < W && jj < H && riss[jj * W + ii] > 0.4)) offen++; }
    // ganz eingeschlossenes, heiles Gestein bietet keine Angriffsfläche — Verwitterung frisst sich von Klüften und Ecken her ein
    return 0.09 * offen * offen;
  };

  // ☀️ Sonne, ❄️ Frost, 🧪 Chemie, 🌱 Wurzeln — an Felszellen nahe der Oberfläche
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = j * W + i, m = stoff[c];
    if (!fest(m)) continue;
    const st = STOFFE[m];
    const frei = ausgesetzt(i, j);
    const ecke = kante(i, j);
    // Tiefe: Risse machen das Innere zugänglich
    const nah = frei || (riss[c] > 0.3 && (j - top[i]) < 12);
    // chemisch wirkt Wasser auch in der Tiefe, wo es hinkommt
    if (!nah && !(k.chemie && st.hydro && nass[c] > 0.08)) continue;
    const schutz = 1 - 0.7 * bewuchs[i] * (j - top[i] < 3 ? 1 : 0);
    const h = haerte[c];
    if (nah && frei && st.sonne && k.sonne) {
      // Temperaturwechsel: nur die oberste Schicht, ohne Schatten durch Pflanzen
      riss[c] += (k.sonne * k.sonne * st.sonne * 0.025 * schutz * ecke) / h;
      if (riss[c] >= 1) { zerfall(i, j, "sonne"); continue; }
    }
    if (nah && (frei || j - top[i] < 6 || (riss[c] > 0.3 && j - top[i] < 14)) && q.winter && k.frost && st.frost && nass[c] + riss[c] > 0.35) {
      riss[c] += (k.frost * st.frost * (nass[c] + 0.5 * riss[c]) * 0.15 * ecke) / h;
      if (riss[c] >= 1) { zerfall(i, j, "frost"); continue; }
    }
    if (k.chemie && st.hydro && nass[c] > 0.08) {
      // Wollsack: je mehr Nachbarn schon zersetzt oder offen sind, desto schneller (Ecken runden sich)
      riss[c] += (ecke * 0.75) * (k.chemie * k.chemie * st.hydro * nass[c] * 0.06 * (frei ? 1.5 : 1) * (0.5 + riss[c])) / h;
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
  // in der Lupe nur dort Regen, wo der Ausschnitt oben an den Himmel grenzt
  let offenOben = W;
  if (q.lupe) { offenOben = 0; for (let i = 0; i < W; i++) if (!fest(stoff[i])) offenOben++; }
  const regen = Math.round(k.wasser * offenOben * 0.16 * (q.winter && k.frost > 0.6 ? 0.4 : 1));
  for (let n = 0; n < regen && q.tropfen.length < 6000; n++) q.tropfen.push({ x: Math.floor(z() * W), y: 0, unter: false, last: 0, saett: 0, alter: 0, dir: 0 });
  // Bäche von außen: führen auch in der Trockenzeit Wasser (schwächer)
  // Lupe: Sickerwasser aus dem Gestein darüber, so viel und so gesättigt wie in der Übersicht dort floss
  if (q.lupe) for (let i = 0; i < W; i++) {
    const w = q.lupe.zufluss[i] * k.wasser;
    if (w <= 0 || !fest(stoff[i])) continue;
    const n = Math.floor(w) + (z() < w % 1 ? 1 : 0);
    for (let m = 0; m < n && q.tropfen.length < 6000; m++) q.tropfen.push({ x: i, y: 0, unter: true, last: 0, saett: q.lupe.saettOben[i], alter: 0, dir: 0 });
  }
  for (const qu of q.quellen) {
    const n = Math.round((6 + 14 * k.wasser) * qu.staerke);
    for (let i = 0; i < n && q.tropfen.length < 6000; i++) q.tropfen.push({ x: qu.x, y: qu.y, unter: false, last: 0, saett: 0, alter: 0, dir: 1, fluss: true });
  }
  for (let sub = 0; sub < 16; sub++) bewegeTropfen(q, k, top, bewuchs, E, draussen);

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
      if (!istFels(m) || fest(at(i - d, j)) || !offenNach(i - d, j)) continue;
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
  let einsturz = 0;
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
        if (k.frost && (q.winter || k.frost > 0.6) && nass[c] > 0.3) { p += 0.35 * k.frost; }
        if (z() > p) continue;
        const d = z() < 0.5 ? -1 : 1;
        for (const dd of [d, -d]) {
          const ni = i + dd;
          if (ni < 0 || ni >= W) continue;
          // nasser Ton und auftauender Boden fließen auch über flachere Hänge (Rutschung, Solifluktion)
          const fliesst = (m === TON || m === BODEN || m === LOESS || m === GRUS || m === SAND) && p > 0.3 && ni + dd >= 0 && ni + dd < W && !fest(stoff[j * W + ni]) && !fest(stoff[(j + 1) * W + ni + dd]);
          if (fliesst) { tausche(q, c, j * W + ni); E[k.frost && q.winter ? "frost" : "wasser"]++; break; }
          if (!fest(stoff[j * W + ni]) && !fest(stoff[(j + 1) * W + ni])) {
            // Schutt braucht steileres Gefälle (bleibt als Halde liegen)
            if (m === SCHUTT && j + 2 < H && fest(stoff[(j + 2) * W + ni])) break;
            tausche(q, c, (j + 1) * W + ni);
            if (m === TON || m === LOESS || (k.frost && q.winter)) E[m === TON || m === LOESS ? "wasser" : "frost"]++;
            break;
          }
        }
      } else if (!fest(unten) && j + 1 < H && draussen[c + W]) {
        // Überhang an einer offenen Wand: bricht, wenn rissig (Felssturz). Höhlendecken regelt gewoelbe().
        const halt = (fest(at(i - 1, j)) && fest(at(i - 1, j + 1)) ? 1 : 0) + (fest(at(i + 1, j)) && fest(at(i + 1, j + 1)) ? 1 : 0);
        if (riss[c] > 0.55 && (halt < 2 || riss[c] > 0.85)) { eltern[c] = m; stoff[c] = SCHUTT; riss[c] = 0.2; if (j - top[i] < 40) einsturz++; }
      }
    }
  }

  if (q.stand % 2 === 0) bloeckeFallen(q, top);
  // Karstwasser: Wege von jeder Versickerungsstelle bis zur Quelle; Lösung entlang der Wege
  if (k.wasser > 0) karstNetz(q, k, top, draussen, bewuchs, E);
  // Höhlendecken: tragen wie ein Gewölbe, bis die Spannweite zu groß wird
  let durchbruch = false;
  if (q.stand % 3 === 0) { const g = gewoelbe(q, draussen); einsturz += g.brueche; durchbruch = g.durch; }
  // Auftauboden über Dauerfrost: die obersten Zellen sind im Sommer wassergesättigt (→ Bodenfließen)
  if (k.frost > 0.6 && !q.winter) for (let i = 0; i < W; i++) for (let j = top[i]; j < top[i] + 4 && j < H; j++) {
    const c = j * W + i;
    if (STOFFE[stoff[c]].locker) nass[c] = Math.max(nass[c], 0.5 * k.frost);
  }
  // Am Hangfuß am Kartenrand trägt ein Fluss Lockermaterial fort — nur, was sich über der alten Oberfläche abgelagert hat
  for (const i of [0, 1, W - 2, W - 1]) {
    const j = top[i];
    if (j >= H || !STOFFE[stoff[j * W + i]].locker || z() > 0.6) continue;
    let alt = 0; while (alt < H && !fest(q.start[alt * W + i])) alt++;
    if (j < alt) { stoff[j * W + i] = LUFT; riss[j * W + i] = 0; nass[j * W + i] = 0; }
  }
  q.ereignisse = [];
  if (durchbruch) q.ereignisse.push(q.gestein === "gips" ? "💥 Erdfall! Die Decke eines Hohlraums ist bis zur Oberfläche eingebrochen." : "💥 Höhlendecke bis zur Oberfläche eingebrochen — eine Einsturzdoline entsteht.");
  else if (einsturz >= 12) q.ereignisse.push(q.gestein === "kalk" || q.gestein === "gips" ? "🪨 Deckeneinbruch in einer Höhle — darüber bleibt ein neues, stabiles Gewölbe." : "💥 Felssturz!");

  // 💧 Tümpel, Seen, Höhlenwasser: fließen bergab (mehrmals je Schritt), stauen sich, verdunsten, versickern
  for (let runde = 0; runde < 6; runde++) for (let j = H - 2; j >= 0; j--) {
    const links = (runde + j) % 2 === 0;
    for (let n = 0; n < W; n++) {
      const i = links ? n : W - 1 - n;
      const c = j * W + i;
      if (stoff[c] !== WASSER) continue;
      const u = c + W;
      if (stoff[u] === LUFT) { stoff[u] = WASSER; stoff[c] = LUFT; continue; }
      const d0 = z() < 0.5 ? -1 : 1;
      let bewegt = false;
      for (const d of [d0, -d0]) {
        const ni = i + d;
        if (ni < 0 || ni >= W || stoff[j * W + ni] !== LUFT) continue;
        if (stoff[(j + 1) * W + ni] === LUFT) { stoff[(j + 1) * W + ni] = WASSER; stoff[c] = LUFT; bewegt = true; break; } // schräg bergab
      }
      if (bewegt) continue;
      // auf gleicher Höhe verlaufen: zum tiefer liegenden Gelände hin; auf ebenem Talboden zum nächsten Rand (Vorfluter)
      const tl = top[Math.max(0, i - 4)], tr = top[Math.min(W - 1, i + 4)];
      const hang = tr > tl + 1 ? 1 : tl > tr + 1 ? -1 : 0;
      const dz = hang || (z() < 0.6 ? (i < W / 2 ? -1 : 1) : d0);
      const ni = i + dz;
      if (ni >= 0 && ni < W && stoff[j * W + ni] === LUFT && z() < 0.85) { stoff[j * W + ni] = WASSER; stoff[c] = LUFT; continue; }
      if (runde > 0) continue;
      // Wasser darüber durchfeuchtet den Boden (auch Ton quillt langsam auf)
      if (fest(stoff[u])) nass[u] = Math.min(1, nass[u] + 0.05);
      // in Höhlen versickert stehendes Wasser durch offene Klüfte im Boden (der Fels ist sonst gesättigt)
      if (fest(stoff[u]) && !draussen[c] && riss[u] > 0.35 && z() < riss[u] * 0.15) {
        stoff[c] = LUFT;
        if (q.tropfen.length < 6000) q.tropfen.push({ x: i, y: j + 1, unter: true, last: 0, saett: 0.6, alter: 0, dir: 0 });
        continue;
      }
      if (fest(stoff[u]) && draussen[c]) {
        const su = STOFFE[stoff[u]];
        // in Klüften (Karst!) versickert ein Tümpel schnell, auf Ton bleibt er stehen
        const p = Math.min(0.9, (su.durch * (1 - nass[u] * 0.5) + Math.min(1, riss[u]) * (su.loes ? 1.5 : 0.7)) * 0.3);
        if (z() < p) {
          stoff[c] = LUFT; nass[u] = Math.min(1, nass[u] + 0.3);
          if (q.tropfen.length < 6000) q.tropfen.push({ x: i, y: j + 1, unter: true, last: 0, saett: 0, alter: 0, dir: 0 });
          continue;
        }
      }
      if (j > 0 && stoff[c - W] === LUFT && draussen[c - W] && z() < 0.01 + 0.04 * k.sonne) stoff[c] = LUFT;
    }
  }
  // 🟫 Hangrutschungen: durchnässtes Lockermaterial an steilen Hängen rutscht als Ganzes ab
  if (q.stand % 3 === 0) rutschungen(q, top, E);
  // Gewässer, die bis an den Kartenrand reichen, fließen über den Talfluss ab:
  // ihr Spiegel sinkt (oberste Wasserzellen verschwinden), bis sie nicht mehr über den Rand reichen
  {
    const imRand = new Uint8Array(W * H);
    const st: number[] = [];
    for (let j = 0; j < H; j++) for (const i of [0, W - 1]) { const c = j * W + i; if (stoff[c] === WASSER) { imRand[c] = 1; st.push(c); } }
    while (st.length) {
      const c = st.pop()!, i = c % W;
      for (const n of [c - 1, c + 1, c - W, c + W]) {
        if (n < 0 || n >= W * H || imRand[n] || stoff[n] !== WASSER) continue;
        if ((n === c - 1 && i === 0) || (n === c + 1 && i === W - 1)) continue;
        imRand[n] = 1; st.push(n);
      }
    }
    for (let c = W; c < W * H; c++) if (imRand[c] && stoff[c - W] === LUFT && z() < 0.7) stoff[c] = LUFT;
  }
  // Wasser, das den Kartenrand erreicht, fließt ab
  for (let j = 0; j < H; j++) for (const i of [0, W - 1]) if (stoff[j * W + i] === WASSER) stoff[j * W + i] = LUFT;

  // 🌱 Bodenbildung und Austrocknen
  for (let i = 0; i < W; i++) {
    const j = top[i];
    if (j >= H) continue;
    const c = j * W + i, m = stoff[c];
    if (bewuchs[i] > 0.3 && (m === GRUS || m === LOESS || m === TON || m === SAND || m === SCHUTT) && z() < bewuchs[i] * 0.01) { stoff[c] = BODEN; E.pflanzen++; }
  }
  // Kluftwasser verteilt sich im ganzen Kluftnetz (auch in waagerechten Fugen)
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    const c = j * W + i;
    if (riss[c] < 0.3 || !fest(stoff[c])) continue;
    for (const n of [c - 1, c + 1, c - W, c + W]) if (riss[n] >= 0.3 && fest(stoff[n]) && nass[n] < nass[c]) { const f = (nass[c] - nass[n]) * 0.4; nass[c] -= f; nass[n] += f; }
  }
  for (let c = 0; c < W * H; c++) {
    if (!fest(stoff[c])) { nass[c] = 0; continue; }
    // Wasser sickert in lockerem, durchlässigem Material nach unten
    const below = c + W;
    if (below < W * H && fest(stoff[below]) && STOFFE[stoff[c]].durch > 0.3 && nass[c] > nass[below]) {
      const f = (nass[c] - nass[below]) * 0.3 * Math.min(STOFFE[stoff[below]].durch + riss[below], 1);
      nass[c] -= f; nass[below] += f;
    } else if (below < W * H && stoff[below] === TON && fest(stoff[c]) && nass[c] > nass[below] + 0.1) {
      // Ton nimmt Wasser nur langsam auf — aber er nimmt es auf (Quellen, Aufweichen)
      const f = (nass[c] - nass[below]) * 0.06;
      nass[c] -= f; nass[below] += f;
    }
    nass[c] *= 0.985 - 0.02 * k.sonne;
  }

  for (const kk of KRAEFTE) q.wirkungMittel[kk.id] = q.wirkungMittel[kk.id] * 0.9 + E[kk.id] * 0.1;
  q.wirkung = E;
  q.jahr += 100 / f;
  q.stand++;
  if (q.fluss) for (let c = 0; c < W * H; c++) q.fluss[c] *= 0.97;
  return q;
}

function tausche(q: Querschnitt, a: number, b: number) {
  const { stoff, eltern, riss, nass } = q;
  [stoff[a], stoff[b]] = [stoff[b], stoff[a]];
  [eltern[a], eltern[b]] = [eltern[b], eltern[a]];
  [riss[a], riss[b]] = [riss[b], riss[a]];
  [nass[a], nass[b]] = [nass[b], nass[a]];
}

/** oberste feste Zelle der Ausgangslandschaft je Spalte (zwischengespeichert) */
const startOberkante = new WeakMap<Uint8Array, Int16Array>();
function startOben(q: Querschnitt, i: number): number {
  let t = startOberkante.get(q.start);
  if (!t) {
    t = new Int16Array(q.W);
    for (let x = 0; x < q.W; x++) { let j = 0; while (j < q.H && !fest(q.start[j * q.W + x])) j++; t[x] = j; }
    startOberkante.set(q.start, t);
  }
  return t[Math.max(0, Math.min(q.W - 1, i))];
}

function bewegeTropfen(q: Querschnitt, k: Klima, top: Int16Array, bewuchs: Float32Array, E: Record<Kraft, number>, draussen: Uint8Array) {
  const { W, H, stoff, riss, nass, eltern } = q;
  const z = q.zufall;
  const neu: Tropfen[] = [];
  // frei für Tropfen: Luft (Wasserflächen tragen — darüber fließt es weiter)
  const frei = (i: number, j: number) => i >= 0 && i < W && j >= 0 && j < H && stoff[j * W + i] === LUFT;
  for (const t of q.tropfen) {
    t.alter++;
    if (t.alter > (t.unter ? 3000 : 900)) { if (t.y < H && t.x >= 0 && t.x < W && t.y >= 0) nass[t.y * W + t.x] = Math.min(1, nass[t.y * W + t.x] + 0.3); continue; }
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
      if (t.saett > 0.3 && !draussen[t.y * W + t.x] && z() < 0.25 * t.saett) {
        if (frei(t.x, t.y)) { stoff[t.y * W + t.x] = SINTER; E.chemie++; }
        continue;
      }
      // versickern — gefrorener Boden (Permafrost) lässt kaum Wasser hinein: es fließt oberflächlich ab
      const gefroren = q.winter ? 1 - 0.9 * k.frost : 1 - 0.6 * Math.max(0, k.frost - 0.6) / 0.4;
      // in Höhlen ist der Fels darunter schon wassergesättigt (Karstwasserspiegel): das Wasser fließt als Bach weiter
      const p = m === WASSER || !draussen[t.y * W + t.x] ? 0 : t.fluss && !st.loes
        ? Math.min(0.95, st.durch * (1 - nass[c])) * gefroren * 0.3
        : Math.min(0.95, st.durch * (1 - nass[c]) + riss[c] * 0.7) * gefroren;
      if (z() < p) { t.unter = true; t.y++; nass[c] = Math.min(1, nass[c] + 0.15); neu.push(t); continue; }
      // abfließen: dorthin, wo der Boden tiefer liegt — auch in Höhlen; mit Schwung
      const tiefe = (x: number) => { if (!frei(x, t.y)) return -1; let y = t.y; while (y + 1 < H && frei(x, y + 1) && y - t.y < 30) y++; return y - t.y; };
      const tl = tiefe(t.x - 1), tr = tiefe(t.x + 1);
      // Seitenerosion: lockeres Material in Fließrichtung wird mitgerissen (Bach schneidet sich durch)
      if (t.dir && !frei(t.x + t.dir, t.y) && t.x + t.dir >= 0 && t.x + t.dir < W) {
        const kk = t.y * W + t.x + t.dir, mm = stoff[kk];
        if (fest(mm) && STOFFE[mm].locker && STOFFE[mm].spuel && !t.last && z() < 0.5 * STOFFE[mm].spuel + (t.fluss ? 0.3 : 0)) {
          t.last = mm; t.menge = 1; stoff[kk] = LUFT; riss[kk] = 0; nass[kk] = 0; E.wasser++;
        }
      }
      let d = 0;
      if (tl < 0 && tr < 0) d = 0;
      else if (tl < 0) d = 1;
      else if (tr < 0) d = -1;
      else if (tl !== tr) d = tl > tr ? -1 : 1;
      else d = t.dir || (z() < 0.5 ? -1 : 1);
      // hin und her in einer Mulde: Wendungen zählen
      if (d !== 0 && t.dir && d === -t.dir) t.stau = (t.stau ?? 0) + 1;
      if (d === 0 || (t.stau ?? 0) > 6) {
        // Senke: Das Wasser bleibt als Tümpel stehen (füllt die Mulde, bis es überläuft); mitgeführtes Korn sinkt zuerst
        if (frei(t.x, t.y)) stoff[t.y * W + t.x] = t.last || WASSER;
        else nass[c] = Math.min(1, nass[c] + 0.25);
        continue;
      }
      if (d === t.dir) t.stau = 0;
      t.dir = d;
      // Höhlenbach: ungesättigtes Wasser löst den Kalk am Boden (Korrosion)
      if (k.chemie && t.saett < 1 && !draussen[t.y * W + t.x]) {
        // Boden und die Wand in Fließrichtung: der Bach weitet seinen Gang (Fließfacetten, Canyon)
        for (const kk of [c, t.y * W + t.x + d]) {
          const mm = stoff[kk];
          if (kk < 0 || kk >= W * H || !fest(mm) || !STOFFE[mm].loes) continue;
          riss[kk] += k.chemie * STOFFE[mm].loes * 0.06 * (1 - t.saett);
          if (riss[kk] >= 1) { stoff[kk] = LUFT; riss[kk] = 0; E.chemie++; q.geloest = (q.geloest ?? 0) + 1; }
        }
        t.saett = Math.min(1, t.saett + 0.008);
        if (q.fluss) q.fluss[c] += 1;
      }
      // Abspülung: das fließende Wasser nimmt lockeres Korn unter sich mit
      const menge = t.menge ?? (t.last ? 1 : 0);
      // Erosionsbasis: zum Kartenrand hin (Talfluss) kann sich das Wasser nicht unter die alte Oberfläche eintiefen
      const randAbstand = Math.min(t.x, W - 1 - t.x);
      const basis = randAbstand < 40 ? startOben(q, t.x) + randAbstand * 0.4 : H;
      if (t.y + 1 < basis && (!t.last || (t.last === m && menge < 3)) && st.locker && st.spuel && z() < k.wasser * st.spuel * 0.35 * (1 - 0.85 * bewuchs[t.x])) {
        t.last = m; t.menge = menge + 1; stoff[c] = LUFT; eltern[c] = LUFT; riss[c] = 0; nass[c] = 0; E.wasser++;
      } else if (t.last && z() < 0.012 * (tl === tr ? 3 : 1)) {
        // Ablagerung, wo es flacher wird
        if (frei(t.x, t.y)) { stoff[t.y * W + t.x] = t.last; t.menge = menge - 1; if (!t.menge) t.last = 0; }
      }
      t.x += d;
      if (t.x < 0 || t.x >= W) continue;
      neu.push(t);
      continue;
    }
    // im Untergrund
    if (t.y >= H || t.y < 0) continue;
    const c = t.y * W + t.x, m = stoff[c];
    if (!fest(m)) {
      // aus der Decke in einen Hohlraum: gesättigtes Wasser lässt einen Tropfstein wachsen (Stalaktit)
      if (t.saett > 0.35 && t.y > 0 && !draussen[c] && fest(stoff[c - W]) && z() < 0.15 * t.saett) { stoff[c] = SINTER; E.chemie++; t.saett *= 0.5; t.y++; }
      t.unter = false; neu.push(t); continue;
    }
    const st = STOFFE[m];
    nass[c] = Math.min(1, nass[c] + 0.04);
    if (q.fluss) q.fluss[c] += 1;
    // Lösung: Kohlensäure frisst Kalk und Gips, vor allem entlang der Klüfte
    if (st.loes && k.chemie && t.saett < 1) {
      const mischung = (t.misch ?? 0) > 0 ? 3 : 1;
      if (t.misch) t.misch--;
      // viel Durchfluss = schnelle, turbulente Strömung: Wasser bleibt aggressiv, löst mehr (Röhren wachsen sich selbst groß)
      const durchfluss = q.fluss ? Math.min(3, q.fluss[c] / 15) : 0;
      riss[c] += (k.chemie * st.loes * 0.09 * mischung * (0.3 + riss[c] + durchfluss) * (1 - t.saett) * (q.karst ? 0.15 : 1)) / q.haerte[c];
      // an Höhlendecken löst Kondenswasser zusätzlich (Kondenskorrosion)
      if (c + W < W * H && !fest(stoff[c + W]) && !draussen[c + W]) riss[c] += k.chemie * st.loes * 0.05 * (1 - t.saett) / q.haerte[c];
      // nahe der Sättigung löst Wasser nur noch langsam — darum bleibt es bis in die Tiefe etwas aggressiv
      t.saett = Math.min(1, t.saett + 0.035 / Math.max(1, st.loes / 2) / (1 + durchfluss));
      if (riss[c] >= 1) { stoff[c] = LUFT; riss[c] = 0; nass[c] = 0; E.chemie++; q.geloest = (q.geloest ?? 0) + 1; t.unter = false; neu.push(t); continue; }
    }
    const durch = (i: number, j: number) => {
      if (i < 0 || i >= W || j >= H) return -1;
      const cc = j * W + i, mm = stoff[cc];
      if (!fest(mm)) return 2;
      if (mm === TON) return 0; // Stauer: darauf fließt das Wasser seitlich ab
      return STOFFE[mm].durch * (1 - nass[cc] * 0.5) + riss[cc] * 0.8;
    };
    const runter = durch(t.x, t.y + 1);
    if (t.y + 1 >= H) continue;
    if (z() < runter) { t.y++; neu.push(t); continue; }
    // seitwärts in einer Kluft oder über einer undurchlässigen Schicht (→ Quelle am Hang):
    // bevorzugt hangab, dorthin wo das Gelände tiefer liegt
    const tl = top[Math.max(0, t.x - 4)], tr = top[Math.min(W - 1, t.x + 4)];
    // schon geweitete Wege ziehen Wasser an (positive Rückkopplung: so entstehen Karströhren)
    const pl = durch(t.x - 1, t.y), pr = durch(t.x + 1, t.y);
    const d = Math.abs(pl - pr) > 0.15 && z() < 0.7 ? (pl > pr ? -1 : 1) : tl > tr + 1 ? -1 : tr > tl + 1 ? 1 : z() < 0.5 ? -1 : 1;
    let bewegt = false;
    for (const dd of [d, -d]) {
      const pd = durch(t.x + dd, t.y);
      if (pd > 0 && z() < pd + 0.15) {
        t.x += dd;
        // Karstwasser fließt seitlich und mischt sich: Mischungskorrosion macht es wieder aggressiv
        t.saett *= 0.6;
        t.misch = 6;
        if (pd === 2) t.unter = false; // tritt am Hang aus (Quelle)
        bewegt = true;
        break;
      }
    }
    if (t.x < 0 || t.x >= W) continue;
    // festgesteckt: wird nach langer Zeit zu Bodenfeuchte (Grundwasser)
    if (bewegt || t.alter < 2000) neu.push(t);
    else nass[c] = Math.min(1, nass[c] + 0.2);
  }
  q.tropfen = neu;
}

/** Wie viel Gestein ist schon verwittert/abgetragen? (Anteil der Ausgangs-Felszellen, die kein Fels mehr sind) */
/**
 * Gesteinsblöcke ohne Verbindung zum Untergrund (z. B. Wollsäcke, aus denen
 * der Grus gespült wurde) fallen eine Zelle tiefer, wenn darunter Platz ist.
 */
function bloeckeFallen(q: Querschnitt, top: Int16Array) {
  const { W, H, stoff } = q;
  const N = W * H;
  if (!q.lose) q.lose = new Uint8Array(N);
  const lose = q.lose;
  for (let k = 0; k < N; k++) if (lose[k] && !istFels(stoff[k])) lose[k] = 0;
  // fester Untergrund: Fels, der über Fels mit dem Rand verbunden ist — lose Blöcke zählen nicht
  const fels = (k: number) => istFels(stoff[k]) && !lose[k];
  const halt = new Uint8Array(N);
  const st: number[] = [];
  for (let i = 0; i < W; i++) { const k = (H - 1) * W + i; if (fels(k)) { halt[k] = 1; st.push(k); } }
  for (let j = 0; j < H; j++) for (const i of [0, W - 1]) { const k = j * W + i; if (fels(k) && !halt[k]) { halt[k] = 1; st.push(k); } }
  while (st.length) {
    const k = st.pop()!, i = k % W, j = (k - i) / W;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + a, jj = j + b;
      if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
      const kk = jj * W + ii;
      if (!halt[kk] && fels(kk)) { halt[kk] = 1; st.push(kk); }
    }
  }
  // was nicht hält, wird zum losen Block
  for (let k = 0; k < N; k++) if (istFels(stoff[k]) && !halt[k]) lose[k] = 1;
  const teil = new Int32Array(N).fill(-1);
  let nr = 0;
  for (let k0 = 0; k0 < N; k0++) {
    if (!lose[k0] || teil[k0] >= 0) continue;
    const zellen: number[] = [k0];
    teil[k0] = nr;
    for (let t = 0; t < zellen.length; t++) {
      const k = zellen[t], i = k % W, j = (k - i) / W;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        const kk = jj * W + ii;
        if (teil[kk] < 0 && lose[kk]) { teil[kk] = nr; zellen.push(kk); }
      }
    }
    // große Massen (ganze Bergteile) rutschen hier nicht — dafür ist der Schnitt zu grob
    if (zellen.length > 4000) { for (const k of zellen) lose[k] = 0; nr++; continue; }
    // erst fallen, sonst hangab rollen (eine Zelle schräg nach unten)
    let mx = 0, my = 0, links = 0, rechts = 0;
    for (const k of zellen) { const i = k % W; if (i > 0) links += top[i - 1]; if (i < W - 1) rechts += top[i + 1]; }
    const hangab = links > rechts ? -1 : 1;
    for (const [dx, dy] of [[0, 1], [hangab, 1], [-hangab, 1]]) {
      let ok = true;
      for (const k of zellen) {
        const i = k % W, j = (k - i) / W, ii = i + dx, jj = j + dy;
        if (ii < 0 || ii >= W || jj >= H) { ok = false; break; }
        const kk = jj * W + ii;
        if (teil[kk] === nr) continue;
        if (fest(stoff[kk])) { ok = false; break; }
      }
      if (ok) { mx = dx; my = dy; break; }
    }
    if (my) {
      // Zellen in Bewegungsrichtung zuerst verschieben
      zellen.sort((x, y) => { const jx = Math.floor(x / W), jy = Math.floor(y / W); return jy - jx || (mx ? (y % W - x % W) * mx : 0); });
      for (const k of zellen) {
        const ziel = k + my * W + mx;
        tausche(q, k, ziel);
        lose[ziel] = 1; lose[k] = 0;
        (q.gerollt ??= new Uint8Array(N))[ziel] = 1; q.gerollt[k] = 0;
        teil[ziel] = nr; teil[k] = -1;
      }
    }
    nr++;
  }
}

/**
 * Karstwasser-Netz. Jeder Schritt:
 *   1. Quellen: Stellen im löslichen Gestein, die direkt über dem Stauer (Ton)
 *      oder am Grund an die freie Luft grenzen.
 *   2. Kürzeste Wege (Dijkstra) von den Quellen ins Gestein; ein Schritt kostet
 *      umso weniger, je weiter die Kluft schon ist (Höhlen fast nichts), bergauf
 *      fließt Wasser nur ungern (gespannt).
 *   3. Jede Versickerungsstelle oben schickt Regen den Weg entlang zur Quelle;
 *      der Durchfluss summiert sich auf.
 *   4. Lösung ∝ Durchfluss × Aggressivität; die Aggressivität sinkt mit dem
 *      gelösten Kalk, in schnellen, großen Röhren langsamer. Geweitete Wege
 *      kosten weniger und ziehen mehr Wasser an — so wachsen Röhren und Höhlen.
 *   5. Wenig Wasser, das gesättigt aus der Decke in eine Höhle tropft, baut
 *      Tropfsteine; im Höhlenbach mit viel Durchfluss wachsen keine.
 */
function karstNetz(q: Querschnitt, k: Klima, top: Int16Array, draussen: Uint8Array, bewuchs: Float32Array, E: Record<Kraft, number>) {
  const { W, H, stoff, riss, haerte } = q;
  const N = W * H;
  const loeslich = (m: number) => fest(m) && STOFFE[m].loes > 0 && m !== SINTER;
  const hohl = (c: number) => !fest(stoff[c]) && !draussen[c];
  const netz = (c: number) => loeslich(stoff[c]) || hohl(c) || stoff[c] === SINTER;
  let gibt = false;
  for (let c = 0; c < N; c++) if (loeslich(stoff[c])) { gibt = true; break; }
  if (!gibt) { q.karst = undefined; return; }
  if (!q.karst) q.karst = new Float32Array(N);
  const fl = q.karst;
  fl.fill(0);
  // Float64: mit Float32 rundet der gespeicherte Wert auf und »verbessert« sich endlos
  const kosten = new Float64Array(N).fill(Infinity);
  const nach = new Int32Array(N).fill(-1);
  const heap: number[] = [];
  const kl = (a: number, b: number) => kosten[a] < kosten[b];
  const push = (x: number) => { heap.push(x); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (!kl(heap[i], heap[p])) break; [heap[i], heap[p]] = [heap[p], heap[i]]; i = p; } };
  const pop = () => { const t = heap[0], l = heap.pop()!; if (heap.length) { heap[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && kl(heap[a], heap[m])) m = a; if (b < heap.length && kl(heap[b], heap[m])) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
  // 1. Quellen
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = j * W + i;
    if (!netz(c)) continue;
    // Stauer direkt darunter oder unter einer dünnen Decke aus Boden/Schutt (Quelle am Hangfuß)
    let amStauer = j === H - 1;
    for (let d = 1; d <= 5 && !amStauer && j + d < H; d++) {
      const m = stoff[c + d * W];
      if (m === TON || m === SCHIEFER) amStauer = true;
      else if (!(STOFFE[m].locker || !fest(m))) break;
    }
    // an der Luft — oder unter einer dünnen, lockeren Decke am Hang
    let anLuft = (i > 0 && draussen[c - 1] === 1) || (i < W - 1 && draussen[c + 1] === 1) || (j + 1 < H && draussen[c + W] === 1);
    for (const dx of [-1, 1]) for (let d = 1; d <= 4 && !anLuft; d++) {
      const ii = i + dx * d;
      if (ii < 0 || ii >= W) break;
      const m = stoff[j * W + ii];
      if (draussen[j * W + ii]) anLuft = true;
      else if (!STOFFE[m].locker) break;
    }
    if (amStauer && anLuft) { kosten[c] = 0; push(c); }
  }
  if (!heap.length) return;
  // 2. Wege
  const durch = (c: number) => (hohl(c) ? 25 : 0.03 + riss[c] * 1.2 + (stoff[c] === SINTER ? 0 : 0));
  while (heap.length) {
    const c = pop(), i = c % W, j = (c - i) / W;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + a, jj = j + b;
      if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
      const n = jj * W + ii;
      if (!netz(n)) continue;
      // Wasser fließt von n nach c: von oben nach unten leicht, von unten nach oben schwer
      const richtung = b === 1 ? 4 : b === -1 ? 0.6 : 1;
      const kk = kosten[c] + richtung / durch(n);
      if (kk < kosten[n]) { kosten[n] = kk; nach[n] = c; push(n); }
    }
  }
  // 3. Versickerung oben: in jeder Spalte die oberste lösliche Zelle
  const regen = k.wasser * (q.winter && k.frost > 0.6 ? 0.4 : 1);
  for (let i = 0; i < W; i++) {
    const j = top[i];
    if (j >= H) continue;
    const c = j * W + i;
    if (!netz(c) || nach[c] < 0 && kosten[c] !== 0) continue;
    // Zufluss von der Seite: Wasser, das an Hängen abläuft, sammelt sich in Mulden
    const mulde = (top[Math.max(0, i - 3)] < j ? 1 : 0) + (top[Math.min(W - 1, i + 3)] < j ? 1 : 0);
    let menge = regen * (1 - 0.4 * bewuchs[i]) * (1 + mulde);
    let aggr = 1; // Kohlensäure aus dem Boden
    let x = c, schritte = 0;
    while (x >= 0 && schritte < 3000) {
      fl[x] += menge;
      if (loeslich(stoff[x])) {
        const st = STOFFE[stoff[x]];
        const groesse = Math.min(4, (q.fluss ? q.fluss[x] : 0) / 40);
        riss[x] += (k.chemie * st.loes * 0.0025 * menge * aggr * (0.3 + riss[x])) / haerte[x];
        aggr *= 1 - 0.02 / (1 + groesse);
        if (riss[x] >= 1) { stoff[x] = LUFT; riss[x] = 0; q.nass[x] = 0; E.chemie++; q.geloest = (q.geloest ?? 0) + 1; }
      }
      // Wasser, das als dünnes Rinnsal gesättigt in eine Höhle tropft: Tropfstein
      const n = nach[x];
      if (n >= 0 && hohl(n) && loeslich(stoff[x]) && n === x + W && aggr < 0.6 && menge < 1.5 && q.zufall() < 0.04) {
        // Stalagmit am Boden darunter, sonst Stalaktit an der Decke
        let y = n;
        while (y + W < N && hohl(y + W)) y += W;
        if (q.zufall() < 0.6 && y !== n) stoff[y] = SINTER; else stoff[n] = SINTER;
        E.chemie++;
        break;
      }
      if (n >= 0 && hohl(n)) aggr = Math.max(aggr, Math.min(0.6, aggr + 0.01)); // Mischung im Gang hält das Wasser etwas aggressiv
      // Wasser in einem offenen Gang löst die Wände: Boden und Seiten stark (Canyon), Decke wenig
      if (hohl(x) && aggr > 0.05) {
        const i0 = x % W;
        for (const [nb, f] of [[x + W, 1], [x - 1, 0.6], [x + 1, 0.6], [x - W, 0.15]] as const) {
          if (nb < 0 || nb >= N || (nb === x - 1 && i0 === 0) || (nb === x + 1 && i0 === W - 1)) continue;
          const mm = stoff[nb];
          if (!loeslich(mm)) continue;
          riss[nb] += (k.chemie * STOFFE[mm].loes * 0.003 * Math.min(fl[x], 80) * aggr * f) / haerte[nb];
          if (riss[nb] >= 1) { stoff[nb] = LUFT; riss[nb] = 0; q.nass[nb] = 0; E.chemie++; q.geloest = (q.geloest ?? 0) + 1; }
        }
      }
      x = n;
      schritte++;
    }
  }
  if (q.fluss) for (let c = 0; c < N; c++) q.fluss[c] += fl[c] * 0.5;
}

/**
 * Hangrutschung: Wo Lockermaterial (Ton, Löss, Boden, Grus, Schutt) an einem
 * steilen Hang so nass ist, dass es seinen Halt verliert, gleitet eine ganze
 * Scholle ein Stück hangab. Je steiler und nasser, desto eher.
 */
function rutschungen(q: Querschnitt, top: Int16Array, E: Record<Kraft, number>) {
  const { W, H, stoff, nass } = q;
  const z = q.zufall;
  const locker = (m: number) => fest(m) && STOFFE[m].locker;
  for (let i0 = 8; i0 < W - 8; i0 += 5) {
    const s = top[i0 + 6] - top[i0 - 6];
    const steil = Math.abs(s) / 12; // Zellen je Zelle
    if (steil < 0.3) continue;
    const dir = s > 0 ? 1 : -1;
    const D = 4;
    const zellen: number[] = [];
    let summe = 0;
    for (let i = i0 - 6; i <= i0 + 6; i++) for (let j = top[i]; j < Math.min(H, top[i] + D); j++) {
      const c = j * W + i;
      if (!locker(stoff[c])) break;
      zellen.push(c); summe += nass[c];
    }
    if (zellen.length < 30) continue;
    const feucht = summe / zellen.length;
    // Schwelle: steiler Hang rutscht schon bei weniger Wasser
    const schwelle = 0.45 - 0.3 * Math.min(1, steil);
    if (feucht < schwelle || z() > 0.35) continue;
    // vorderste Zellen zuerst bewegen (in Rutschrichtung, dann nach unten)
    zellen.sort((a, b) => ((b % W) - (a % W)) * dir || b - a);
    let bewegt = 0;
    for (const c of zellen) {
      const i = c % W, j = (c - i) / W;
      for (const [dx, dy] of [[dir, 1], [dir, 0]]) {
        const ii = i + dx, jj = j + dy;
        if (ii < 0 || ii >= W || jj >= H) continue;
        const n = jj * W + ii;
        if (!fest(stoff[n])) { tausche(q, c, n); bewegt++; break; }
      }
    }
    if (bewegt > 20) {
      E.wasser += bewegt;
      (q.rutschungen ??= []).push({ x: i0, y: top[i0], jahr: q.jahr });
      q.ereignisse.push("🟫 Hangrutschung! Der durchnässte Hang ist abgeglitten.");
    }
  }
}

/** Tragfähigkeit (relativ) der Decke je Stoff */
const TRAGT: Record<number, number> = { [KALK]: 1.2, [GIPS]: 0.7, [SANDSTEIN]: 1, [GRANIT]: 2, [BASALT]: 1.6, [SCHIEFER]: 0.8, [SINTER]: 1.2, [TON]: 0.3 };

/**
 * Höhlendecken als Gewölbe: Eine Decke trägt, solange die Spannweite klein ist
 * im Verhältnis zur Deckendicke und Festigkeit (und den Rissen darin).
 * Wird sie zu weit, bricht ein kuppelförmiges Stück heraus — darüber bleibt
 * ein neues, gewölbtes Dach. Reicht die Kuppel bis zur Oberfläche: Einsturzdoline.
 * Die Spannweite ist in diesem Schnitt höchstens ~1,6 × Höhlenhöhe: Ein langer
 * Gang trägt quer zu seiner Richtung, nicht über seine ganze Länge.
 */
function gewoelbe(q: Querschnitt, draussen: Uint8Array): { brueche: number; durch: boolean } {
  const { W, H, stoff, riss, eltern } = q;
  let brueche = 0, durch = false;
  const unterLuft = (x: number, y: number) => !fest(stoff[y * W + x]) && !draussen[y * W + x] && fest(stoff[(y - 1) * W + x]);
  const brich = (x: number, y: number) => {
    const k = y * W + x, m = stoff[k];
    if (!fest(m) || m === SCHUTT) return;
    if (!STOFFE[m].locker) eltern[k] = m;
    stoff[k] = STOFFE[m].locker ? m : SCHUTT; riss[k] = 0.2; brueche++;
  };
  for (let y = 1; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (!unterLuft(x, y)) { x++; continue; }
      let x1 = x;
      while (x1 + 1 < W && unterLuft(x1 + 1, y)) x1++;
      const L = x1 - x + 1;
      let hmax = 0, f = 0, rs = 0;
      for (let xx = x; xx <= x1; xx++) {
        let h = 0;
        while (y + h < H && !fest(stoff[(y + h) * W + xx]) && h < 80) h++;
        hmax = Math.max(hmax, h);
        const dk = (y - 1) * W + xx;
        f += STOFFE[stoff[dk]].locker ? 0.15 : TRAGT[stoff[dk]] ?? 0.8;
        rs += Math.min(1, riss[dk]);
      }
      f /= L; rs /= L;
      const c = (x + x1) >> 1;
      let d = 0;
      for (let yy = y - 1; yy >= 0 && fest(stoff[yy * W + c]); yy--) d++;
      const spann = Math.min(L, 1.6 * hmax);
      const krit = (5 + 1.1 * d) * f * (1 - 0.6 * rs);
      if (spann >= 4 && spann > krit) {
        const hd = Math.max(2, Math.min(d, Math.round(spann * 0.45)));
        let vorher = brueche;
        for (let xx = x; xx <= x1; xx++) {
          const t = (xx - c) / (L / 2 + 0.5);
          const h = Math.round(hd * Math.sqrt(Math.max(0, 1 - t * t)));
          for (let yy = y - 1; yy >= y - h && yy >= 0; yy--) brich(xx, yy);
        }
        if (hd >= d && brueche - vorher > 6) {
          // bis oben durchgebrochen: Trichter bis zur Oberfläche
          durch = true;
          vorher = brueche;
          (q.einstuerze ??= []).push({ x: c, jahr: q.jahr });
          for (let xx = Math.max(0, c - (L >> 2)); xx <= Math.min(W - 1, c + (L >> 2)); xx++) for (let yy = y - 1; yy >= 0; yy--) { if (!fest(stoff[yy * W + xx])) break; brich(xx, yy); }
        }
      }
      x = x1 + 1;
    }
  }
  return { brueche, durch };
}

/** Luftzellen, die vom Himmel aus in höchstens `tief` Zellen erreichbar sind (1) */
function luftDraussen(q: Querschnitt, top: Int16Array, tief: number): Uint8Array {
  const { W, H, stoff } = q;
  const N = W * H;
  const dist = new Int16Array(N).fill(-1);
  const aus = new Uint8Array(N);
  const reihe: number[] = [];
  for (let i = 0; i < W; i++) for (let j = 0; j < Math.min(top[i], H); j++) { const k = j * W + i; dist[k] = 0; aus[k] = 1; reihe.push(k); }
  for (let r = 0; r < reihe.length; r++) {
    const k = reihe[r], d = dist[k];
    if (d >= tief) continue;
    const i = k % W, j = (k - i) / W;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + a, jj = j + b;
      if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
      const kk = jj * W + ii;
      if (dist[kk] >= 0 || fest(stoff[kk])) continue;
      dist[kk] = d + 1; aus[kk] = 1; reihe.push(kk);
    }
  }
  return aus;
}

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
