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
    if (nah && (frei || j - top[i] < 6) && q.winter && k.frost && st.frost && nass[c] + riss[c] > 0.35) {
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
  const regen = Math.round(k.wasser * W * 0.16 * (q.winter && k.frost > 0.6 ? 0.4 : 1));
  for (let n = 0; n < regen && q.tropfen.length < 3500; n++) q.tropfen.push({ x: Math.floor(z() * W), y: 0, unter: false, last: 0, saett: 0, alter: 0, dir: 0 });
  // Bäche von außen: führen auch in der Trockenzeit Wasser (schwächer)
  for (const qu of q.quellen) {
    const n = Math.round((6 + 14 * k.wasser) * qu.staerke);
    for (let i = 0; i < n && q.tropfen.length < 3500; i++) q.tropfen.push({ x: qu.x, y: qu.y, unter: false, last: 0, saett: 0, alter: 0, dir: 1, fluss: true });
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

  if (q.stand % 4 === 0) bloeckeFallen(q);
  // Höhlendecken: tragen wie ein Gewölbe, bis die Spannweite zu groß wird
  let durchbruch = false;
  if (q.stand % 3 === 0) { const g = gewoelbe(q, draussen); einsturz += g.brueche; durchbruch = g.durch; }
  // Auftauboden über Dauerfrost: die obersten Zellen sind im Sommer wassergesättigt (→ Bodenfließen)
  if (k.frost > 0.6 && !q.winter) for (let i = 0; i < W; i++) for (let j = top[i]; j < top[i] + 4 && j < H; j++) {
    const c = j * W + i;
    if (STOFFE[stoff[c]].locker) nass[c] = Math.max(nass[c], 0.5 * k.frost);
  }
  // Am Hangfuß am Kartenrand trägt ein Fluss Lockermaterial fort
  for (const i of [0, 1, W - 2, W - 1]) {
    const j = top[i];
    if (j < H && STOFFE[stoff[j * W + i]].locker && z() < 0.6) { stoff[j * W + i] = LUFT; riss[j * W + i] = 0; nass[j * W + i] = 0; }
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
      // auf gleicher Höhe verlaufen (ebener Spiegel)
      const ni = i + d0;
      if (ni >= 0 && ni < W && stoff[j * W + ni] === LUFT && z() < 0.5) { stoff[j * W + ni] = WASSER; stoff[c] = LUFT; continue; }
      if (runde > 0) continue;
      if (fest(stoff[u]) && draussen[c]) {
        const su = STOFFE[stoff[u]];
        // in Klüften (Karst!) versickert ein Tümpel schnell, auf Ton bleibt er stehen
        const p = Math.min(0.9, (su.durch * (1 - nass[u] * 0.5) + Math.min(1, riss[u]) * (su.loes ? 1.5 : 0.7)) * 0.3);
        if (z() < p) {
          stoff[c] = LUFT; nass[u] = Math.min(1, nass[u] + 0.3);
          if (q.tropfen.length < 3500) q.tropfen.push({ x: i, y: j + 1, unter: true, last: 0, saett: 0, alter: 0, dir: 0 });
          continue;
        }
      }
      if (j > 0 && stoff[c - W] === LUFT && draussen[c - W] && z() < 0.01 + 0.04 * k.sonne) stoff[c] = LUFT;
    }
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
    for (const n of [c - 1, c + 1, c - W, c + W]) if (riss[n] >= 0.3 && fest(stoff[n]) && nass[n] < nass[c]) { const f = (nass[c] - nass[n]) * 0.25; nass[c] -= f; nass[n] += f; }
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
  q.stand++;
  return q;
}

function tausche(q: Querschnitt, a: number, b: number) {
  const { stoff, eltern, riss, nass } = q;
  [stoff[a], stoff[b]] = [stoff[b], stoff[a]];
  [eltern[a], eltern[b]] = [eltern[b], eltern[a]];
  [riss[a], riss[b]] = [riss[b], riss[a]];
  [nass[a], nass[b]] = [nass[b], nass[a]];
}

function bewegeTropfen(q: Querschnitt, k: Klima, top: Int16Array, bewuchs: Float32Array, E: Record<Kraft, number>, draussen: Uint8Array) {
  const { W, H, stoff, riss, nass, eltern } = q;
  const z = q.zufall;
  const neu: Tropfen[] = [];
  // frei für Tropfen: Luft (Wasserflächen tragen — darüber fließt es weiter)
  const frei = (i: number, j: number) => i >= 0 && i < W && j >= 0 && j < H && stoff[j * W + i] === LUFT;
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
          if (riss[kk] >= 1) { stoff[kk] = LUFT; riss[kk] = 0; E.chemie++; }
        }
        t.saett = Math.min(1, t.saett + 0.008);
      }
      // Abspülung: das fließende Wasser nimmt lockeres Korn unter sich mit
      const menge = t.menge ?? (t.last ? 1 : 0);
      if ((!t.last || (t.last === m && menge < 3)) && st.locker && st.spuel && z() < k.wasser * st.spuel * 0.35 * (1 - 0.85 * bewuchs[t.x])) {
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
    // Lösung: Kohlensäure frisst Kalk und Gips, vor allem entlang der Klüfte
    if (st.loes && k.chemie && t.saett < 1) {
      riss[c] += (k.chemie * st.loes * 0.09 * (0.3 + riss[c]) * (1 - t.saett)) / q.haerte[c];
      // an Höhlendecken löst Kondenswasser zusätzlich (Kondenskorrosion)
      if (c + W < W * H && !fest(stoff[c + W]) && !draussen[c + W]) riss[c] += k.chemie * st.loes * 0.05 * (1 - t.saett) / q.haerte[c];
      t.saett = Math.min(1, t.saett + 0.1 / Math.max(1, st.loes / 2));
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
/**
 * Gesteinsblöcke ohne Verbindung zum Untergrund (z. B. Wollsäcke, aus denen
 * der Grus gespült wurde) fallen eine Zelle tiefer, wenn darunter Platz ist.
 */
function bloeckeFallen(q: Querschnitt) {
  const { W, H, stoff } = q;
  const N = W * H;
  const fels = (k: number) => istFels(stoff[k]);
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
  // lose Blöcke: jedes Teil für sich; es fällt nur als Ganzes und nur, wenn unter ihm überall Luft ist
  const teil = new Int32Array(N).fill(-1);
  let nr = 0;
  for (let k0 = 0; k0 < N; k0++) {
    if (!fels(k0) || halt[k0] || teil[k0] >= 0) continue;
    const zellen: number[] = [k0];
    teil[k0] = nr;
    for (let t = 0; t < zellen.length; t++) {
      const k = zellen[t], i = k % W, j = (k - i) / W;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        const kk = jj * W + ii;
        if (teil[kk] < 0 && fels(kk) && !halt[kk]) { teil[kk] = nr; zellen.push(kk); }
      }
    }
    let frei = true;
    for (const k of zellen) {
      const u = k + W;
      if (u >= N) { frei = false; break; }
      if (teil[u] === nr) continue;
      if (fest(stoff[u])) { frei = false; break; }
    }
    if (frei) {
      zellen.sort((x, y) => y - x); // unten zuerst
      for (const k of zellen) { tausche(q, k, k + W); teil[k + W] = nr; teil[k] = -1; }
    }
    nr++;
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
