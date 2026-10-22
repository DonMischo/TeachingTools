/**
 * Vulkan-Simulation: Auf einem Höhenfeld (160 × 160 Zellen à 100 m) wächst
 * ein Vulkan Ausbruch für Ausbruch. Die Form wird nicht vorgegeben, sie
 * entsteht aus dem Magma:
 *
 *   Kieselsäure (SiO₂)  → Temperatur, Zähigkeit η und Fließgrenze τ der Lava
 *   Gasgehalt × Zähigkeit → Anteil explosiver Förderung (Asche/Schlacke)
 *
 * Lava fließt als Zellautomat nach dem Bingham-Modell (wie SCIARA/MAGFLOW,
 * stark vereinfacht): Sie fließt nur, wo sie dicker ist als die kritische
 * Dicke h_c = τ / (ρ·g·Gefälle), mit v = ρ·g·s·h²/(3η)·(1 − 1,5r + 0,5r³),
 * r = h_c/h. Sie strahlt Wärme ab (σT⁴, dünne Lava kühlt schneller), wird
 * dabei zäher und erstarrt — dünnflüssige Basaltlava läuft weit und flach
 * (Schildvulkan), zähe Andesitlava bleibt kurz und dick, Rhyolith türmt
 * sich als Dom. Asche und Schlacke fallen um den Krater (Ring) und mit dem
 * Wind (Fahne), lockeres Material rutscht bis zum Schüttwinkel ab — erst
 * Lava darüber hält den steilen Kegel (Schichtvulkan).
 *
 * Jede Schicht (Ausbruch × Stoff) wird als Dicke je Zelle gespeichert, damit
 * der Querschnitt die echte Abfolge zeigt. Ein Ausbruch steht für eine
 * Ausbruchsphase (Jahrhunderte), nicht für einen einzelnen Tag.
 */
import { fbm, perlin, zufallsquelle } from "@/lib/gelaende/rauschen";
import { spiegel } from "@/lib/gelaende/erosion";

export const N_GITTER = 160;
export const ZELLE = 100;
const RHO = 2600, G_ERD = 9.81;
/** Sekunden je Lavaschritt (nur für Fließen und Abkühlen) */
const DT = 60;
/** Schüttwinkel lockerer Tephra (≈ 33°) */
const SCHUETT = Math.tan((33 * Math.PI) / 180);
/** steiler hält auch festes Gestein nicht (Felssturz) */
const FELS = Math.tan((42 * Math.PI) / 180);
/** höchstens so viele Schichten — ältere gleichartige werden zusammengefasst */
const MAX_SCHICHTEN = 90;
/** Volumen eines Ausbruchs bei Menge 1, in Zelle·Meter (× 10⁴ m³) */
export const V0 = 90000;
/** Lavaschritte, über die ein Ausbruch Lava fördert */
const DAUER = 110;
/** Schritte der Aschephase bei Explosivität 0,5 */
const ASCHE_DAUER = 90;
/** ab dieser Wassertiefe (m) gibt es keine Aschesäule mehr */
const WASSER_TIEF = 500;

export type Stoff = "basalt" | "andesit" | "rhyolith" | "schlacke" | "asche" | "ignimbrit" | "schutt";

export const STOFFE: Record<Stoff, { label: string; farbe: [number, number, number]; locker: boolean; text: string }> = {
  basalt: { label: "Basaltlava", farbe: [62, 58, 62], locker: false, text: "Dünnflüssig (wenig SiO₂, ~1200 °C): fließt weit, erstarrt in dünnen Decken." },
  andesit: { label: "Andesitlava", farbe: [112, 104, 100], locker: false, text: "Zähflüssig (~60 % SiO₂, ~1050 °C): kurze, dicke Ströme." },
  rhyolith: { label: "Zähe Lava (Dazit/Rhyolith)", farbe: [178, 162, 150], locker: false, text: "Sehr zäh (über 65 % SiO₂): türmt sich über dem Schlot zu einem Dom." },
  schlacke: { label: "Schlacke (Lapilli)", farbe: [138, 66, 50], locker: true, text: "Grobe, blasige Lavafetzen aus Fontänen — bleiben am Krater liegen." },
  asche: { label: "Asche und Lapilli (Tephra)", farbe: [200, 184, 146], locker: true, text: "Vom Gas zerrissenes Magma; fällt um den Krater und weit mit dem Wind." },
  ignimbrit: { label: "Ignimbrit (Glutwolke)", farbe: [226, 206, 174], locker: false, text: "Ablagerung einer Glutlawine beim Calderaausbruch; füllt Täler." },
  schutt: { label: "Blockschutt (Felssturz)", farbe: [150, 128, 112], locker: true, text: "Zu steile Wände (Dom, Lavafront, Calderarand) brechen ab; die Blöcke sammeln sich am Fuß." },
};

export interface Magma {
  /** Kieselsäure in Gewichts-% (45–75) */
  sio2: number;
  /** Gasgehalt in Gewichts-% (0–6) */
  gas: number;
  /** Fördermenge je Ausbruch, 1 = normal */
  menge: number;
  /** Wahrscheinlichkeit eines Flanken-/Spaltenausbruchs 0..1 */
  flanke: number;
  /** Wind aus Richtung (Grad, 0 = Nord, 90 = Ost) — die Fahne zieht dorthin, wohin er weht */
  windAus: number;
  /** Windstärke 0..2 */
  wind: number;
}

export const TYPEN = [
  {
    id: "schild", icon: "🛡️", label: "Schildvulkan",
    text: "Basaltmagma, wenig Gas: Dünnflüssige Lava fließt weit und baut flache Hänge (unter 10°). Ausbrüche auch aus Spalten an den Flanken — wie auf Hawaii oder Island.",
    magma: { sio2: 49, gas: 0.8, menge: 1, flanke: 0.4, windAus: 70, wind: 1 } as Magma,
  },
  {
    id: "schicht", icon: "🗻", label: "Schichtvulkan",
    text: "Andesitmagma, viel Gas: Explosive Ausbrüche werfen Asche, dazwischen fließt zähe Lava. Asche- und Lavaschichten wechseln sich ab, die Hänge werden steil (bis über 30°) — wie Vesuv, Ätna-Gipfel oder Fuji.",
    magma: { sio2: 61, gas: 4, menge: 0.8, flanke: 0.12, windAus: 250, wind: 1 } as Magma,
  },
  {
    id: "hotspot", icon: "🌺", label: "Hotspot (Hawaii)",
    text: "Ein ortsfester Mantelplume schmilzt die Pazifische Platte von unten an. Die Platte wandert nach Westen weiter — jeder Vulkan wird vom Schlot weggetragen, erlischt, sinkt und wird abgetragen. So entsteht eine Inselkette, die nach Westen immer älter wird (160 km breiter Ausschnitt).",
    magma: { sio2: 48, gas: 0.6, menge: 2, flanke: 0.35, windAus: 70, wind: 1 } as Magma,
  },
] as const;
export type TypId = (typeof TYPEN)[number]["id"];

/** Anteil explosiver Förderung: Gas zerreißt das Magma umso eher, je zäher es ist (Basalt mit wenig Gas fast 0) */
export function explosivAnteil(m: Pick<Magma, "sio2" | "gas">): number {
  const zaeh = Math.max(0, Math.min(1, (m.sio2 - 48) / 24));
  return Math.min(0.8, Math.max(0, Math.min(1.2, m.gas / 5) ** 1.5 * (0.35 + 0.65 * zaeh)));
}

/** Kennwerte der Lava aus dem SiO₂-Gehalt (grob nach Lehrbuchwerten) */
export function lavaWerte(sio2: number) {
  const s = Math.max(45, Math.min(75, sio2));
  return {
    /** Ausbruchstemperatur °C */
    t0: 1200 - (s - 48) * 14,
    /** Zähigkeit beim Austritt in Pa·s */
    eta: 10 ** (2 + (s - 48) * 0.29),
    /** Fließgrenze beim Austritt in Pa */
    tau: 10 ** (1.5 + 0.25 * Math.min(s - 48, 12) + 0.1 * Math.max(0, s - 60)),
    /** erstarrt so viele Kelvin unter t0 */
    spanne: 140,
    stoff: (s < 53 ? "basalt" : s < 63 ? "andesit" : "rhyolith") as Stoff,
    tephra: (s < 54 ? "schlacke" : "asche") as Stoff,
  };
}

export interface Schicht { stoff: Stoff; nr: number; d: Float32Array }

export type SchlotArt = "gipfel" | "flanke" | "spalte";
export interface Schlot { art: SchlotArt; nr: number; zellen: number[]; i: number; j: number }

export interface Ausbruch {
  nr: number;
  schlot: Schlot;
  /** Lava, die noch gefördert wird (Zelle·m) */
  rest: number;
  proSchritt: number;
  /** Anteil explosiver Förderung 0..1 */
  explosiv: number;
  tephra: number;
  schritt: number;
  /** Index der Lavaschicht dieses Ausbruchs (−1 = noch keine) */
  lavaSchicht: number;
  /** Schlot unter Wasser: "flach" = surtseyanisch (Dampfexplosionen), "tief" = Druck unterdrückt Explosionen */
  wasser: "flach" | "tief" | null;
  /** Aschephase: Tephra fällt Schritt für Schritt (Anteil je Zelle, Rest in Zelle·m); null = vorbei, dann fließt Lava */
  asche: { gewicht: Float32Array; rest: number; proSchritt: number; schicht: number } | null;
  t0: number; eta: number; tau: number; spanne: number;
  stoff: Stoff;
}

export interface Wolke { x: number; y: number; richtung: number; laenge: number; breite: number; alter: number; gross: boolean }

export interface Vulkan {
  n: number;
  zelle: number;
  seed: number;
  /** Grundgebirge (Oberkante, m) — sinkt bei einer Caldera */
  B: Float64Array;
  /** Oberfläche fest (m) = B + Summe der Schichten */
  G: Float64Array;
  /** Ausgangsgelände (m) */
  start: Float32Array;
  /** flüssige Lava (m) und ihre Temperatur (°C) */
  L: Float64Array;
  T: Float64Array;
  /** lockere Tephra obenauf (m) — darf rutschen */
  locker: Float64Array;
  schichten: Schicht[];
  meer: number | null;
  /** Hauptschlot — im Hotspot-Modus der ortsfeste Hotspot (nur die Platte wandert) */
  mitte: number;
  /** Richtungen der Spaltenzonen (rad) */
  rift: [number, number];
  ausbruch: Ausbruch | null;
  /** Anzahl begonnener Ausbrüche */
  nr: number;
  schlote: Schlot[];
  calderen: { i: number; j: number; r: number; nr: number }[];
  wolke: Wolke | null;
  zufall: () => number;
  gefoerdert: number;
  verloren: number;
  /** Arbeitsfelder */
  dL: Float64Array; dW: Float64Array; dIn: Float64Array;
  /** Hotspot: Platte wandert je Ausbruch um `tempo` Zellen nach Westen */
  platte: { tempo: number; versatz: number } | null;
  /** Rechteck mit flüssiger Lava [i0, i1, j0, j1] */
  box: Int32Array;
}

/**
 * `hotspot`: Ausschnitt 160 km (Zellen à 1 km) über 3000 m tiefem Ozeanboden;
 * die Platte wandert nach Westen über den ortsfesten Hotspot in der Mitte.
 */
export function vulkanStart(seed: number, meer = false, hotspot = false, n = N_GITTER): Vulkan {
  const N = n * n, r = perlin(seed), z = zufallsquelle(seed ^ 0x7a1c);
  const B = new Float64Array(N);
  const kippe = z() * Math.PI * 2;
  if (hotspot) meer = true;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i / n - 0.5, y = j / n - 0.5;
    B[j * n + i] = hotspot
      ? HOTSPOT_BODEN + fbm(r, i / 30, j / 30, 4) * 150
      : (meer ? -350 : 260) + fbm(r, i / 38, j / 38, 4) * 55 + (Math.cos(kippe) * x + Math.sin(kippe) * y) * 60;
  }
  // Hotspot im Osten, damit westlich davon Platz für die ältere Inselkette ist
  const mitte = Math.floor(n / 2) * n + (hotspot ? Math.round(n * 0.75) : Math.floor(n / 2));
  const a = z() * Math.PI;
  const v: Vulkan = {
    n, zelle: hotspot ? HOTSPOT_ZELLE : ZELLE, seed, B, G: Float64Array.from(B), start: Float32Array.from(B),
    L: new Float64Array(N), T: new Float64Array(N), locker: new Float64Array(N),
    schichten: [], meer: meer ? 0 : null, mitte, rift: [a, a + Math.PI * (0.75 + z() * 0.3)],
    ausbruch: null, nr: 0, schlote: [], calderen: [], wolke: null, zufall: z,
    gefoerdert: 0, verloren: 0, dL: new Float64Array(N), dW: new Float64Array(N), dIn: new Float64Array(N), box: Int32Array.from([n, -1, n, -1]),
    platte: hotspot ? { tempo: PLATTE_ZELLEN, versatz: 0 } : null,
  };
  if (hotspot) alteKette(v, r);
  return v;
}

// ---------- Hotspot: Platte wandert ----------

/** Ozeanboden (m) und Zellgröße (m) im Hotspot-Ausschnitt */
const HOTSPOT_BODEN = -3000, HOTSPOT_ZELLE = 2000;
/** Plattenweg je Ausbruch in Zellen (2 km) — bei 9 cm/Jahr ≈ 22 000 Jahre */
const PLATTE_ZELLEN = 1;
/** Der Nachschub aus dem Plume kommt in Schüben: alle so viele Ausbrüche ein neuer Vulkan */
const HOTSPOT_PERIODE = 34;
/** Fördermenge je Ausbruch über dem Hotspot (× V0 × Menge) im stärksten Schub */
const HOTSPOT_MENGE = 0.3;

/** Nachschub 0..1 im Schub-Zyklus des Plumes (beginnt mit einem jungen, wachsenden Seamount) */
export function hotspotSchub(nr: number): number {
  const phase = ((nr + HOTSPOT_PERIODE * 0.15) % HOTSPOT_PERIODE) / HOTSPOT_PERIODE;
  const puls = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
  return 0.08 + 0.92 * puls * puls;
}

/** Zustand des jüngsten Vulkans über dem Hotspot: Gipfelhöhe und Entwicklungsstufe */
export function hotspotPhase(v: Vulkan): { gipfel: number; phase: "seamount" | "flach" | "insel"; schub: number } {
  const n = v.n, hi = v.mitte % n, hj = Math.floor(v.mitte / n);
  let gipfel = -Infinity;
  for (let j = hj - 8; j <= hj + 8; j++) for (let i = hi - 8; i <= hi + 3; i++) gipfel = Math.max(gipfel, v.G[j * n + i]);
  const meer = v.meer ?? 0;
  return { gipfel, phase: gipfel > meer ? "insel" : gipfel > meer - 500 ? "flach" : "seamount", schub: hotspotSchub(v.nr + 1) };
}

/**
 * Ältere Inselkette westlich des Hotspots als Startzustand: je weiter weg,
 * desto älter, tiefer abgesunken und stärker abgetragen — bis zum Seamount.
 */
function alteKette(v: Vulkan, rausch: (x: number, y: number) => number) {
  const n = v.n, hi = v.mitte % n, hj = Math.floor(v.mitte / n);
  const schicht = neueSchicht(v, "basalt");
  // Abstand zum Hotspot (Zellen) und Gipfelhöhe (m über NN)
  const inseln: [number, number][] = [[HOTSPOT_PERIODE, 1100], [HOTSPOT_PERIODE * 2, 600], [HOTSPOT_PERIODE * 3, 100]];
  for (const [d, gipfel] of inseln) {
    const ci = hi - d, R = 24;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      // entlang der Kette (W–O) etwas gestreckt, Ränder unregelmäßig
      const dx = (i - ci) / 1.25, dy = j - hj, rr = Math.hypot(dx, dy) * (1 + 0.15 * rausch(i / 9, j / 9));
      if (rr >= R) continue;
      const k = j * n + i;
      let h = HOTSPOT_BODEN + (gipfel - HOTSPOT_BODEN) * (1 - rr / R) ** 1.6;
      // alte Inseln: Gipfel abgetragen (Brandungsplattform), Täler eingeschnitten
      if (h > 0) h = Math.max(0, h - (d / HOTSPOT_PERIODE - 1) * 300 * (0.5 + 0.5 * rausch(i / 4, j / 4)));
      const dicke = h - v.G[k];
      if (dicke > 0) auftragen(v, k, dicke, schicht);
    }
  }
}
/** Pazifische Platte: 9 cm/Jahr = 90 km je Million Jahre */
export const PLATTE_KM_JE_MIO = 90;

/** Jahre, die ein Ausbruch im Hotspot-Modus vertritt */
export function jahreJeAusbruch(v: Vulkan): number {
  return v.platte ? (v.platte.tempo * v.zelle) / (PLATTE_KM_JE_MIO * 1000) * 1e6 : 0;
}

/** Alter (Mio. Jahre) eines Punkts in Zellspalte i: so lange ist er vom Hotspot weggewandert */
export function alterBei(v: Vulkan, i: number): number {
  const hi = v.mitte % v.n;
  return Math.max(0, ((hi - i) * v.zelle) / 1000 / PLATTE_KM_JE_MIO);
}

/**
 * Platte nach Westen schieben (ganze Zellen), Alte Vulkane sinken (Auflast,
 * abkühlende Platte) und werden über dem Meer abgetragen; im Osten kommt
 * frischer Ozeanboden herein.
 */
function platteBewegen(v: Vulkan) {
  const p = v.platte!;
  p.versatz += p.tempo;
  const d = Math.floor(p.versatz);
  p.versatz -= d;
  const n = v.n, hi = v.mitte % n;
  if (d > 0) {
    const schiebe = (f: Float64Array | Float32Array, rand: (j: number) => number) => {
      for (let j = 0; j < n; j++) {
        const z = j * n;
        for (let i = 0; i < n - d; i++) f[z + i] = f[z + i + d];
        for (let i = n - d; i < n; i++) f[z + i] = rand(j);
      }
    };
    const boden = (j: number) => v.start[j * n + n - 1];
    schiebe(v.B, boden); schiebe(v.G, boden); schiebe(v.start, boden);
    schiebe(v.locker, () => 0);
    for (const s of v.schichten) schiebe(s.d, () => 0);
    for (const s of v.schlote) { s.i -= d; s.zellen = s.zellen.map(k => k - d); }
    v.schlote = v.schlote.filter(s => s.i >= 0);
    for (const c of v.calderen) c.i -= d;
    v.calderen = v.calderen.filter(c => c.i + c.r >= 0);
  }
  // Absinken (Auflast + abkühlende Platte) und Abtragung der erloschenen Vulkane (weiter als 15 Zellen vom Hotspot)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, auf = v.G[k] - v.start[k];
    if (auf <= 1 || hi - i < 15) continue;
    // ≈ 0,5 km Absinken je Mio. Jahre, Abtragung ≈ 1 % der Höhe über dem Meer je Ausbruch (22 000 Jahre)
    const senk = Math.min(auf, auf * 0.0025 + 3);
    v.B[k] -= senk; v.G[k] -= senk;
    if (v.meer !== null && v.G[k] > v.meer) abtragen(v, k, (v.G[k] - v.meer) * 0.01);
  }
}

// ---------- Schichten ----------

function neueSchicht(v: Vulkan, stoff: Stoff): number {
  v.schichten.push({ stoff, nr: v.nr, d: new Float32Array(v.n * v.n) });
  if (v.schichten.length > MAX_SCHICHTEN) zusammenfassen(v);
  return v.schichten.length - 1;
}

/** zwei alte Schichten zu einer — bevorzugt gleiche Stoffe, sonst die ältesten */
function zusammenfassen(v: Vulkan) {
  const s = v.schichten;
  let a = s.findIndex((x, i) => i < s.length - 6 && s[i + 1].stoff === x.stoff);
  if (a < 0) a = 0;
  const b = s[a + 1], q = s[a];
  let va = 0, vb = 0;
  for (let k = 0; k < q.d.length; k++) { va += q.d[k]; vb += b.d[k]; q.d[k] += b.d[k]; }
  if (vb > va) q.stoff = b.stoff;
  s.splice(a + 1, 1);
  // Indizes des laufenden Ausbruchs verschieben sich
  if (v.ausbruch && v.ausbruch.lavaSchicht > a) v.ausbruch.lavaSchicht--;
}

/** oben abtragen: erst Schichten von oben, dann Grundgebirge */
function abtragen(v: Vulkan, k: number, m: number) {
  let rest = m;
  for (let s = v.schichten.length - 1; s >= 0 && rest > 0; s--) {
    const d = v.schichten[s].d, x = Math.min(d[k], rest);
    d[k] -= x; rest -= x;
  }
  if (rest > 0) v.B[k] -= rest;
  v.G[k] -= m;
  v.locker[k] = Math.max(0, v.locker[k] - m);
}

function auftragen(v: Vulkan, k: number, m: number, schicht: number) {
  v.schichten[schicht].d[k] += m;
  v.G[k] += m;
  if (STOFFE[v.schichten[schicht].stoff].locker) v.locker[k] += m;
  else v.locker[k] = 0;
}

// ---------- Ausbruch ----------

const nbCache = new Map<number, { di: number; dj: number; o: number; d: number }[]>();
const NACHBARN = (n: number) => {
  let nb = nbCache.get(n);
  if (!nb) nbCache.set(n, nb = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([di, dj]) => ({ di, dj, o: dj * n + di, d: Math.hypot(di, dj) })));
  return nb;
};

function schlotWaehlen(v: Vulkan, m: Magma): Schlot {
  const n = v.n, z = v.zufall, ci = v.mitte % n, cj = (v.mitte - ci) / n;
  // Abstände in Zellen bei 100 m — im Hotspot-Maßstab (große Schilde) gröber
  const mass = v.zelle > ZELLE ? 0.4 : 1;
  const zellenUm = (i: number, j: number, r: number) => {
    const aus: number[] = [];
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (di * di + dj * dj <= r * r + 0.5) aus.push((j + dj) * n + i + di);
    return aus;
  };
  if (v.nr > 2 && z() < m.flanke) {
    if (m.sio2 < 54) {
      // Spalte entlang einer Riftzone: lange Reihe von Schloten
      const a = v.rift[z() < 0.5 ? 0 : 1] + (z() - 0.5) * 0.25;
      const d0 = (10 + z() * 35) * mass, l = 4 + Math.floor(z() * 6), zellen: number[] = [];
      for (let t = 0; t < l; t++) {
        const i = Math.round(ci + Math.cos(a) * (d0 + t)), j = Math.round(cj + Math.sin(a) * (d0 + t));
        if (i > 2 && j > 2 && i < n - 3 && j < n - 3) zellen.push(j * n + i);
      }
      const mi = zellen[Math.floor(zellen.length / 2)] ?? v.mitte;
      if (zellen.length) return { art: "spalte", nr: v.nr, zellen, i: mi % n, j: Math.floor(mi / n) };
    } else {
      const a = z() * Math.PI * 2, d = (12 + z() * 22) * mass;
      const i = Math.round(ci + Math.cos(a) * d), j = Math.round(cj + Math.sin(a) * d);
      return { art: "flanke", nr: v.nr, zellen: zellenUm(i, j, 1), i, j };
    }
  }
  return { art: "gipfel", nr: v.nr, zellen: zellenUm(ci, cj, 1), i: ci, j: cj };
}

/** Beginnt einen Ausbruch: Schlot wählen, Krater sprengen, Tephra ablagern; die Lava folgt in schritt() */
export function ausbrechen(v: Vulkan, m: Magma): Ausbruch {
  if (v.ausbruch) ausbruchBeenden(v);
  if (v.platte) platteBewegen(v);
  v.nr++;
  const z = v.zufall, lw = lavaWerte(m.sio2);
  const zaeh = Math.max(0, Math.min(1, (m.sio2 - 48) / 24));
  const schlot = schlotWaehlen(v, m);
  v.schlote.push(schlot);
  // Nebenausbrüche sind kleiner
  // über dem Hotspot kommt der Nachschub in Schüben: dazwischen trägt die Platte den Vulkan fort
  const versorgung = v.platte ? HOTSPOT_MENGE * hotspotSchub(v.nr) : 1;
  const menge = V0 * m.menge * versorgung * (schlot.art === "gipfel" ? 1 : 0.35) * (0.7 + z() * 0.6);
  // Schlot unter Wasser: flach (bis 500 m) verdampft das Meerwasser explosiv (surtseyanisch, auch bei Basalt);
  // tiefer unterdrückt der Wasserdruck Explosionen — es quillt Kissenlava, keine Aschesäule
  const tiefe = v.meer === null ? -1 : v.meer - v.G[schlot.zellen[Math.floor(schlot.zellen.length / 2)]];
  const wasser: Ausbruch["wasser"] = tiefe > WASSER_TIEF ? "tief" : tiefe > 0 ? "flach" : null;
  let explosiv = explosivAnteil(m) * (0.7 + z() * 0.6);
  if (wasser === "flach") explosiv = Math.max(explosiv, 0.3 + 0.3 * (1 - tiefe / WASSER_TIEF));
  if (wasser === "tief") explosiv *= 0.15;
  // im 320-km-Maßstab wäre ein Tuffkegel nur ein Bruchteil einer Zelle: Säule ja, Ablagerung klein
  const tephra = menge * (v.platte ? Math.min(explosiv, 0.05) : explosiv);
  const a: Ausbruch = {
    nr: v.nr, schlot, rest: menge - tephra, proSchritt: (menge - tephra) / DAUER, explosiv, tephra,
    schritt: 0, lavaSchicht: -1, asche: null, wasser, t0: lw.t0, eta: lw.eta, tau: lw.tau, spanne: lw.spanne, stoff: lw.stoff,
  };
  v.ausbruch = a;
  v.gefoerdert += menge;
  if (tephra > 50) tephraAblagern(v, m, a, tephra, explosiv, lw.tephra, zaeh);
  return a;
}

function tephraAblagern(v: Vulkan, m: Magma, a: Ausbruch, menge: number, explosiv: number, stoff: Stoff, zaeh: number) {
  const n = v.n, N = n * n, w = v.dW;
  const ci = a.schlot.i, cj = a.schlot.j;
  // Kraterradius (Zellen) und Sprengtiefe wachsen mit der Explosivität
  const rk = 1.2 + explosiv * 2.2;
  let rand = -Infinity;
  for (let k = 0; k < N; k++) {
    const i = k % n, j = (k - i) / n, r = Math.hypot(i - ci, j - cj);
    if (r > rk && r < rk + 1.5) rand = Math.max(rand, v.G[k]);
  }
  // Krater sprengen: Boden unter den Rand, das Material fliegt mit
  let gesprengt = 0;
  const boden = rand - (40 + explosiv * 120);
  const sl = neueSchicht(v, stoff);
  for (let k = 0; k < N; k++) {
    const i = k % n, j = (k - i) / n, r = Math.hypot(i - ci, j - cj);
    if (r <= rk && v.G[k] > boden) {
      const x = (v.G[k] - boden) * (1 - (r / (rk + 0.5)) ** 2);
      if (x > 0) { abtragen(v, k, x); gesprengt += x; }
    }
  }
  const gesamt = menge + gesprengt;
  // Ring um den Krater (Wurfschlacke) und Fahne mit dem Wind
  // Wurfweite in Zellen — im großen Hotspot-Maßstab mindestens 3 Zellen, sonst stehen Schlackennadeln
  const l1 = Math.max((300 + 250 * zaeh) / v.zelle, v.zelle > ZELLE ? 3 : 0);
  const l2 = (1500 + 3000 * zaeh * Math.min(1, m.gas / 4)) / v.zelle;
  // in der Tiefe bleibt alles am Schlot (Glasbruch, Hyaloklastit), keine Fahne
  const fahne = a.wasser === "tief" ? 0 : Math.min(0.85, (a.wasser === "flach" ? 0.45 : 0.2) + 0.6 * zaeh * Math.min(1.5, m.gas / 4));
  const wr = ((m.windAus + 180) * Math.PI) / 180;
  const wx = Math.sin(wr), wy = -Math.cos(wr), staerke = m.wind;
  let s1 = 0, s2 = 0;
  const ring = v.dL;
  for (let k = 0; k < N; k++) {
    const i = k % n, j = (k - i) / n, dx = i - ci, dy = j - cj, r = Math.hypot(dx, dy);
    ring[k] = r <= rk ? 0 : Math.exp(-(r - rk) / l1);
    const lang = dx * wx + dy * wy, quer = -dx * wy + dy * wx;
    const lw = l2 * (0.6 + staerke * 0.8);
    w[k] = r <= rk ? 0 : Math.exp(-((quer / (l2 * 0.45)) ** 2) - (lang > 0 ? lang / lw : -lang / (l2 * (0.6 - staerke * 0.2))));
    s1 += ring[k]; s2 += w[k];
  }
  const gewicht = new Float32Array(N);
  for (let k = 0; k < N; k++) gewicht[k] = (1 - fahne) * ring[k] / (s1 || 1) + fahne * w[k] / (s2 || 1);
  v.dL.fill(0); w.fill(0);
  // fällt während der Aschephase nach und nach (sichtbar als Eruptionssäule)
  const dauer = Math.round(ASCHE_DAUER * (0.5 + explosiv));
  a.asche = { gewicht, rest: gesamt, proSchritt: gesamt / dauer, schicht: sl };
  v.wolke = { x: ci, y: cj, richtung: wr, laenge: l2 * (1 + staerke), breite: l2 * 0.6, alter: 0, gross: false };
}

/** lockeres Material rutscht, bis kein Hang steiler ist als der Schüttwinkel */
export function rutschen(v: Vulkan, durchgaenge: number) {
  const n = v.n, nb = NACHBARN(n);
  let schicht = -1;
  for (let s = v.schichten.length - 1; s >= 0; s--) if (STOFFE[v.schichten[s].stoff].locker) { schicht = s; break; }
  if (schicht < 0) return;
  for (let p = 0; p < durchgaenge; p++) {
    let bewegt = 0;
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
      const k = j * n + i;
      if (v.locker[k] < 0.01) continue;
      for (const q of nb) {
        const kk = k + q.o, zuviel = v.G[k] - v.G[kk] - SCHUETT * v.zelle * q.d;
        if (zuviel <= 0.05) continue;
        const x = Math.min(v.locker[k], zuviel * 0.25);
        abtragen(v, k, x);
        auftragen(v, kk, x, schicht);
        bewegt += x;
        if (v.locker[k] < 0.01) break;
      }
    }
    if (bewegt < 1) break;
  }
}

/** zu steile Wände brechen ab: Material jeder Art wird zu lockerem Blockschutt, der dann rutscht */
export function felsstuerze(v: Vulkan, durchgaenge = 30) {
  const n = v.n, nb = NACHBARN(n);
  let schicht = -1;
  for (let p = 0; p < durchgaenge; p++) {
    let bewegt = 0;
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
      const k = j * n + i;
      for (const q of nb) {
        const kk = k + q.o, zuviel = v.G[k] - v.G[kk] - FELS * v.zelle * q.d;
        if (zuviel <= 2) continue;
        if (schicht < 0) schicht = neueSchicht(v, "schutt");
        const x = zuviel * 0.3;
        abtragen(v, k, x);
        auftragen(v, kk, x, schicht);
        bewegt += x;
      }
    }
    if (bewegt < 1) break;
  }
  if (schicht >= 0) rutschen(v, 40);
}

/** ein Lavaschritt (≈ 1 Minute Fließen); gibt false zurück, wenn kein Ausbruch mehr läuft */
export function schritt(v: Vulkan): boolean {
  const a = v.ausbruch;
  if (v.wolke) { v.wolke.alter++; if (v.wolke.alter > 90) v.wolke = null; }
  if (!a) return false;
  const { n, L, T, G, dL, dW, dIn } = v, nb = NACHBARN(n);
  // ein Schritt steht für mehr Zeit, wenn die Zellen größer sind (Hotspot: 2 km) — sonst liefe Lava viel zu weit
  const dt = DT * (v.zelle / ZELLE);
  a.schritt++;
  if (a.asche) {
    // Aschephase: Tephra rieselt, lockeres Material rutscht nach; erst danach Lava
    const x = Math.min(a.asche.rest, a.asche.proSchritt), g = a.asche.gewicht;
    a.asche.rest -= x;
    for (let k = 0; k < g.length; k++) if (g[k] * x > 1e-5) auftragen(v, k, g[k] * x, a.asche.schicht);
    if (a.asche.rest <= 1e-6) { rutschen(v, 60); a.asche = null; } else rutschen(v, 3);
    return true;
  }
  if (a.rest > 0) {
    const x = Math.min(a.rest, a.proSchritt), je = x / a.schlot.zellen.length;
    a.rest -= x;
    for (const k of a.schlot.zellen) { T[k] = (T[k] * L[k] + a.t0 * je) / (L[k] + je); L[k] += je; }
  }
  // nur das Rechteck um die flüssige Lava (plus Schlot) rechnen
  const bx = v.box;
  for (const k of a.schlot.zellen) { const i = k % n, j = (k - i) / n; bx[0] = Math.min(bx[0], i); bx[1] = Math.max(bx[1], i); bx[2] = Math.min(bx[2], j); bx[3] = Math.max(bx[3], j); }
  const i0 = Math.max(0, bx[0] - 1), i1 = Math.min(n - 1, bx[1] + 1), j0 = Math.max(0, bx[2] - 1), j1 = Math.min(n - 1, bx[3] + 1);
  // Fließen (Bingham)
  let aktiv = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * n + i, h = L[k];
    if (h < 1e-3) continue;
    aktiv++;
    if (i === 0 || j === 0 || i === n - 1 || j === n - 1) { v.verloren += h; dL[k] -= h; continue; }
    const kalt = a.t0 - T[k];
    // abkühlend zäher; die Fließgrenze wächst höchstens auf das Zehnfache (sonst stehen Dome senkrecht)
    let eta = a.eta * Math.exp(0.02 * kalt), tau = a.tau * Math.min(10, Math.exp(0.025 * kalt));
    // unter Wasser schreckt die Haut sofort ab (Kissenlava): sie türmt sich steil statt weit zu fließen
    if (v.meer !== null && G[k] < v.meer) { tau *= 3000; eta *= 100; }
    const S = G[k] + h;
    let summe = 0, anz = 0;
    const qs = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let q = 0; q < 8; q++) {
      const kk = k + nb[q].o, d = nb[q].d * v.zelle, delta = S - G[kk] - L[kk];
      if (delta <= 0) continue;
      const s = delta / d, hc = tau / (RHO * G_ERD * s);
      if (h <= hc) continue;
      const r = hc / h;
      const vel = ((RHO * G_ERD * s * h * h) / (3 * eta)) * (1 - 1.5 * r + 0.5 * r * r * r);
      const f = Math.min(0.5, (vel * dt) / d);
      qs[q] = f * Math.min(h - hc, delta * 0.5);
      summe += qs[q]; anz++;
    }
    if (!anz) continue;
    const skala = Math.min(1 / (anz * 0.5 + 0.5), (h * 0.9) / summe);
    for (let q = 0; q < 8; q++) {
      if (!qs[q]) continue;
      const x = qs[q] * skala, kk = k + nb[q].o;
      dL[k] -= x; dL[kk] += x; dIn[kk] += x; dW[kk] += x * T[k];
    }
  }
  // Übernehmen, Wärme mischen, abkühlen, erstarren
  const zuEnde = a.rest <= 0;
  const SIGMA = 0.9 * 5.67e-8;
  bx[0] = n; bx[1] = -1; bx[2] = n; bx[3] = -1;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * n + i;
    if (dL[k] === 0 && L[k] < 1e-3) continue;
    const neu = L[k] + dL[k];
    if (neu < 1e-3) { L[k] = 0; dL[k] = 0; dW[k] = 0; dIn[k] = 0; continue; }
    // Mischtemperatur: was bleibt (eigene Temperatur) + was zufließt (dW = Volumen × Temperatur)
    const bleibt = neu - dIn[k];
    T[k] = (T[k] * bleibt + dW[k]) / neu;
    L[k] = neu;
    dL[k] = 0; dW[k] = 0; dIn[k] = 0;
    const tk = T[k] + 273;
    const wasser = v.meer !== null && G[k] + L[k] < v.meer;
    let abk = ((SIGMA * (tk ** 4 - 300 ** 4) * dt) / (RHO * 1100 * Math.max(0.3, L[k])) * 0.35 + 0.12) * (dt / DT);
    // im Wasser viel schneller kalt — bei großen Zellen steckt das schon im längeren Zeitschritt
    if (wasser) abk *= Math.max(1.5, 25 / (dt / DT));
    if (zuEnde) abk *= 3;
    T[k] -= abk;
    if (T[k] < a.t0 - a.spanne || L[k] < 0.15) {
      if (a.lavaSchicht < 0) a.lavaSchicht = neueSchicht(v, a.stoff);
      auftragen(v, k, L[k], a.lavaSchicht);
      L[k] = 0;
    } else { bx[0] = Math.min(bx[0], i); bx[1] = Math.max(bx[1], i); bx[2] = Math.min(bx[2], j); bx[3] = Math.max(bx[3], j); }
  }
  if (zuEnde && aktiv === 0) { v.ausbruch = null; felsstuerze(v); return false; }
  return true;
}

/** laufenden Ausbruch sofort zu Ende rechnen */
export function ausbruchBeenden(v: Vulkan) {
  let i = 0;
  while (v.ausbruch && i++ < 5000) schritt(v);
}

/** Großer Ausbruch: Magmakammer leert sich, Gipfel bricht ein (Caldera), Glutwolken füllen die Täler */
export function caldera(v: Vulkan, m: Magma) {
  if (v.ausbruch) ausbruchBeenden(v);
  v.nr++;
  const n = v.n, N = n * n, ci = v.mitte % n, cj = (v.mitte - ci) / n;
  // Größe am Vulkan bemessen
  let hoch = -Infinity, rv = 0;
  for (let k = 0; k < N; k++) hoch = Math.max(hoch, v.G[k] - v.start[k]);
  for (let k = 0; k < N; k++) if (v.G[k] - v.start[k] > hoch * 0.2) { const i = k % n, j = (k - i) / n; rv = Math.max(rv, Math.hypot(i - ci, j - cj)); }
  const R = Math.max(5, Math.min(22, rv * 0.32));
  const tiefe = Math.max(150, Math.min(900, hoch * 0.45));
  // Gipfel wegsprengen: alles über dem Rand minus Tiefe
  let randH = Infinity;
  for (let k = 0; k < N; k++) { const i = k % n, j = (k - i) / n, r = Math.hypot(i - ci, j - cj); if (r > R && r < R + 1.5) randH = Math.min(randH, v.G[k]); }
  let weg = 0;
  for (let k = 0; k < N; k++) {
    const i = k % n, j = (k - i) / n, r = Math.hypot(i - ci, j - cj);
    if (r > R) continue;
    const kante = Math.min(1, (R - r) / 2);
    // Absinken der Scholle: Schichten sinken mit (Grundgebirge tiefer)
    const senk = tiefe * kante;
    v.B[k] -= senk; v.G[k] -= senk;
    const ueber = v.G[k] - (randH - tiefe * 0.5);
    if (ueber > 0) { abtragen(v, k, ueber * kante); weg += ueber * kante; }
  }
  // Ignimbrit: in Tälern dicker (Glutlawinen fließen bergab). Dünnflüssiges
  // Basaltmagma fließt unterirdisch ab — der Gipfel sackt ohne Glutwolken ein
  const explosiv = m.sio2 >= 54;
  const extra = explosiv ? V0 * m.menge * 3 : 0;
  const menge = weg + extra, w = v.dW;
  const glatt = new Float64Array(N);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let dj = -4; dj <= 4; dj += 2) for (let di = -4; di <= 4; di += 2) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < n && jj < n) { s += v.G[jj * n + ii]; c++; } }
    glatt[j * n + i] = s / c;
  }
  let sw = 0;
  for (let k = 0; k < N; k++) {
    const i = k % n, j = (k - i) / n, r = Math.hypot(i - ci, j - cj);
    w[k] = r <= R ? 0.15 : Math.exp(-(r - R) / (35)) * (1 + Math.min(4, Math.max(0, (glatt[k] - v.G[k]) / 25)));
    sw += w[k];
  }
  const sl = neueSchicht(v, explosiv ? "ignimbrit" : lavaWerte(m.sio2).tephra);
  for (let k = 0; k < N; k++) auftragen(v, k, (menge * w[k]) / sw, sl);
  w.fill(0);
  v.gefoerdert += extra;
  v.calderen.push({ i: ci, j: cj, r: R, nr: v.nr });
  felsstuerze(v);
  v.schlote.push({ art: "gipfel", nr: v.nr, zellen: [v.mitte], i: ci, j: cj });
  v.wolke = { x: ci, y: cj, richtung: ((m.windAus + 180) * Math.PI) / 180, laenge: 60, breite: 40, alter: 0, gross: true };
}

// ---------- Auswertung ----------

/** Seen in Kratern und Calderen (Priority-Flood aus der Erosion) */
export function kraterseen(v: Vulkan): Uint8Array {
  const N = v.n * v.n, F = spiegel(v.G, v.n, v.meer), aus = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (F[k] - v.G[k] > 3 && v.G[k] - v.start[k] > 20 && v.L[k] < 0.01) aus[k] = 1;
  return aus;
}

export interface Kennzahlen {
  /** Höhe über dem Umland (m) */
  hoehe: number;
  /** Gipfel über NN (m) */
  gipfel: number;
  /** Durchmesser am Fuß (m) */
  durchmesser: number;
  /** mittlere Hangneigung der Flanken (Grad) */
  neigung: number;
  /** steilster Abschnitt (90. Perzentil, Grad) */
  steil: number;
  /** Volumen km³ */
  volumen: number;
  /** Anteil Tephra (Asche, Schlacke) am Volumen 0..1 */
  tephraAnteil: number;
  form: { id: string; label: string; text: string };
}

export function kennzahlen(v: Vulkan, sio2: number): Kennzahlen {
  const { n, G, start, zelle } = v, N = n * n;
  let hoch = 0, gipfel = -Infinity, flaeche = 0, vol = 0;
  for (let k = 0; k < N; k++) {
    const d = G[k] - start[k];
    hoch = Math.max(hoch, d); gipfel = Math.max(gipfel, G[k]);
    if (d > 15) flaeche++;
    if (d > 0) vol += d;
  }
  const neig: number[] = [];
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
    const k = j * n + i, d = G[k] - start[k];
    if (d < hoch * 0.15 || d > hoch * 0.85) continue;
    // Calderawände zählen nicht zur Flanke
    if (v.calderen.some(c => Math.hypot(i - c.i, j - c.j) < c.r + 2)) continue;
    const gx = (G[k + 1] - G[k - 1]) / (2 * zelle), gy = (G[k + n] - G[k - n]) / (2 * zelle);
    neig.push((Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI);
  }
  neig.sort((a, b) => a - b);
  const neigung = neig.length ? neig.reduce((s, x) => s + x, 0) / neig.length : 0;
  const steil = neig.length ? neig[Math.floor(neig.length * 0.9)] : 0;
  let teph = 0, alles = 0;
  for (const s of v.schichten) { let x = 0; for (let k = 0; k < N; k++) x += s.d[k]; alles += x; if (s.stoff === "asche" || s.stoff === "schlacke") teph += x; }
  const durchmesser = 2 * Math.sqrt(flaeche / Math.PI) * zelle;
  const tephraAnteil = alles ? teph / alles : 0;
  return { hoehe: hoch, gipfel, durchmesser, neigung, steil, volumen: (vol * zelle * zelle) / 1e9, tephraAnteil, form: formErkennen(hoch, durchmesser, neigung, tephraAnteil, sio2, v.calderen.length > 0) };
}

export const FORMEN = {
  keiner: { label: "Noch kein Vulkan", text: "Erst ein paar Ausbrüche — lass ihn wachsen." },
  schild: { label: "Schildvulkan", text: "Breit und flach wie ein liegender Schild: Hänge unter 10°, gebaut aus vielen dünnen Lavadecken." },
  schicht: { label: "Schichtvulkan (Stratovulkan)", text: "Steiler Kegel aus abwechselnden Asche- und Lavaschichten. Die Lava verkittet die lockere Asche — so hält der steile Hang." },
  uebergang: { label: "Flacher Schichtvulkan", text: "Zwischen Schild und Kegel: zähere Lava oder mehr Asche würde ihn steiler machen." },
  schlacke: { label: "Schlackenkegel", text: "Kleiner, steiler Kegel fast nur aus Schlacke — bei gasreichem Basalt (wie die Vulkaneifel)." },
  dom: { label: "Lavadom (Quellkuppe)", text: "Sehr zähe Lava quillt aus dem Schlot und bleibt als Kuppe darüber stehen." },
  aschekegel: { label: "Aschekegel", text: "Steiler Kegel fast nur aus lockerer Asche — ohne Lava darin würde er bei jedem Regen zerfließen." },
} as const;

function formErkennen(hoch: number, dm: number, neigung: number, teph: number, sio2: number, mitCaldera: boolean): Kennzahlen["form"] {
  const f = (id: keyof typeof FORMEN) => ({ id, ...FORMEN[id], ...(mitCaldera && id !== "keiner" ? { label: FORMEN[id].label + " mit Caldera" } : {}) });
  if (hoch < 60) return f("keiner");
  if (neigung < 10) return f("schild");
  if (sio2 >= 65 && teph < 0.35) return f("dom");
  if (teph > 0.75) return f(sio2 < 54 ? "schlacke" : "aschekegel");
  if (dm < 3500 && sio2 < 54 && teph > 0.4) return f("schlacke");
  return neigung >= 15 ? f("schicht") : f("uebergang");
}

/** Schichten an einer Stelle (Bruchteil-Zellen) von unten nach oben — für den Querschnitt */
export function saeule(v: Vulkan, x: number, y: number): { b: number; d: number[]; l: number; g: number } {
  const n = v.n;
  const fx = Math.max(0, Math.min(n - 1.001, x - 0.5)), fy = Math.max(0, Math.min(n - 1.001, y - 0.5));
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, w = fy - j, k = j * n + i;
  const bl = (f: ArrayLike<number>) => f[k] * (1 - u) * (1 - w) + f[k + 1] * u * (1 - w) + f[k + n] * (1 - u) * w + f[k + n + 1] * u * w;
  return { b: bl(v.B), d: v.schichten.map(s => bl(s.d)), l: bl(v.L), g: bl(v.G) };
}

export interface KettenGlied { i: number; j: number; hoehe: number; alter: number; insel: boolean }

/** Hotspot: Gipfel der Kette (Inseln und Seamounts), von West nach Ost */
export function kette(v: Vulkan): KettenGlied[] {
  if (!v.platte) return [];
  const { n, G, start } = v, R = 9, aus: KettenGlied[] = [];
  for (let j = R; j < n - R; j++) for (let i = R; i < n - R; i++) {
    const k = j * n + i, h = G[k];
    if (h - start[k] < 400) continue;
    let gipfel = true;
    for (let dj = -R; dj <= R && gipfel; dj++) for (let di = -R; di <= R; di++) {
      const q = G[k + dj * n + di];
      if (q > h || (q === h && dj * n + di < 0)) { gipfel = false; break; }
    }
    if (gipfel) aus.push({ i, j, hoehe: h, alter: alterBei(v, i), insel: h > (v.meer ?? 0) });
  }
  return aus.sort((a, b) => a.i - b.i);
}
