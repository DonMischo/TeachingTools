/**
 * Geometrie-Grundbegriffe (Klasse 5–7) — reine Rechnung ohne Oberfläche:
 * Winkelarten, Lage von Geraden, Lot und Abstand, Winkel an geschnittenen
 * Parallelen, Symmetrie auf Kästchenpapier, Drehfiguren und das
 * Winkel-Billard. Die Oberfläche liegt in `components/grundbegriffe/`.
 *
 * Koordinaten: wo nicht anders gesagt, mathematisch (y nach oben, Winkel in
 * Grad gegen den Uhrzeigersinn, 0° = rechts).
 */
import type { Zufall } from "@/lib/geometrie/aufgabe";

export type Pt = { x: number; y: number };

/* ─────────────────────────────────────────────────────────── Winkel ── */

export type WinkelArt = "null" | "spitz" | "recht" | "stumpf" | "gestreckt" | "ueberstumpf" | "voll";

export const WINKELARTEN: { id: Exclude<WinkelArt, "null">; label: string; bereich: string; farbe: string }[] = [
  { id: "spitz", label: "spitzer Winkel", bereich: "0° < α < 90°", farbe: "#16a34a" },
  { id: "recht", label: "rechter Winkel", bereich: "α = 90°", farbe: "#2563eb" },
  { id: "stumpf", label: "stumpfer Winkel", bereich: "90° < α < 180°", farbe: "#d97706" },
  { id: "gestreckt", label: "gestreckter Winkel", bereich: "α = 180°", farbe: "#9333ea" },
  { id: "ueberstumpf", label: "überstumpfer Winkel", bereich: "180° < α < 360°", farbe: "#dc2626" },
  { id: "voll", label: "Vollwinkel", bereich: "α = 360°", farbe: "#0891b2" },
];

/** Winkelart eines Winkels in Grad (0 bis 360). */
export function winkelArt(g: number): WinkelArt {
  const e = 1e-9;
  if (g < e) return "null";
  if (g < 90 - e) return "spitz";
  if (g <= 90 + e) return "recht";
  if (g < 180 - e) return "stumpf";
  if (g <= 180 + e) return "gestreckt";
  if (g < 360 - e) return "ueberstumpf";
  return "voll";
}

export const winkelArtLabel = (g: number) => WINKELARTEN.find(w => w.id === winkelArt(g))?.label ?? "Nullwinkel";

/** Auf [0, 360) gebracht. */
export const norm = (g: number) => ((g % 360) + 360) % 360;

/** Richtung von `a` nach `b` in Grad (mathematisch, y nach oben). */
export const richtung = (a: Pt, b: Pt) => norm(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI);

/** Punkt in Richtung `grad` im Abstand `r` von `m` (mathematisch). */
export const polar = (m: Pt, r: number, grad: number): Pt => ({ x: m.x + r * Math.cos(grad * Math.PI / 180), y: m.y + r * Math.sin(grad * Math.PI / 180) });

export const GRIECHISCH = ["α", "β", "γ", "δ", "ε", "φ"] as const;

/* ──────────────────────────────────────────────────────────── Lage ── */

export type Lage = "parallel" | "senkrecht" | "schneiden" | "gleich";

/** Schnittwinkel zweier Geraden durch a1a2 und b1b2, zwischen 0° und 90°. */
export function schnittwinkel(a1: Pt, a2: Pt, b1: Pt, b2: Pt): number {
  const d = Math.abs(richtung(a1, a2) - richtung(b1, b2)) % 180;
  return Math.min(d, 180 - d);
}

/** Schnittpunkt der Geraden a1a2 und b1b2; null bei Parallelen. */
export function schnittpunkt(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt | null {
  const dax = a2.x - a1.x, day = a2.y - a1.y, dbx = b2.x - b1.x, dby = b2.y - b1.y;
  const n = dax * dby - day * dbx;
  if (Math.abs(n) < 1e-9) return null;
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / n;
  return { x: a1.x + t * dax, y: a1.y + t * day };
}

/** Fußpunkt des Lots von `p` auf die Gerade durch `a` und `b`. */
export function lotfuss(p: Pt, a: Pt, b: Pt): Pt {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

export const abstand = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);

export function lage(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Lage {
  const w = schnittwinkel(a1, a2, b1, b2);
  if (w < 1e-6) return abstand(lotfuss(b1, a1, a2), b1) < 1e-6 ? "gleich" : "parallel";
  return Math.abs(w - 90) < 1e-6 ? "senkrecht" : "schneiden";
}

/* ─────────────────────────────────────────── Winkel an Parallelen ── */

/**
 * Zwei Geraden g (oben, Schnittpunkt S₁) und h (unten, S₂) werden von einer
 * Geraden s geschnitten. An jedem Schnittpunkt heißen die Winkel gegen den
 * Uhrzeigersinn α (rechts oben), β (links oben), γ (links unten), δ (rechts unten).
 */
export type WinkelName = "α" | "β" | "γ" | "δ";
export type WinkelId = `${WinkelName}${1 | 2}`;
export const WINKEL_NAMEN: WinkelName[] = ["α", "β", "γ", "δ"];
export const WINKEL_IDS: WinkelId[] = ["α1", "β1", "γ1", "δ1", "α2", "β2", "γ2", "δ2"];

export type Beziehung = "neben" | "scheitel" | "stufen" | "wechsel";
export const BEZIEHUNGEN: { id: Beziehung; label: string; regel: string; nurParallel: boolean }[] = [
  { id: "neben", label: "Nebenwinkel", regel: "Nebenwinkel ergänzen sich zu 180°.", nurParallel: false },
  { id: "scheitel", label: "Scheitelwinkel", regel: "Scheitelwinkel sind gleich groß.", nurParallel: false },
  { id: "stufen", label: "Stufenwinkel", regel: "Stufenwinkel an Parallelen sind gleich groß.", nurParallel: true },
  { id: "wechsel", label: "Wechselwinkel", regel: "Wechselwinkel an Parallelen sind gleich groß.", nurParallel: true },
];

const IDX: Record<WinkelName, number> = { "α": 0, "β": 1, "γ": 2, "δ": 3 };
const id = (i: number, s: 1 | 2) => `${WINKEL_NAMEN[((i % 4) + 4) % 4]}${s}` as WinkelId;
export const teile = (w: WinkelId) => ({ name: w[0] as WinkelName, i: IDX[w[0] as WinkelName], s: Number(w[1]) as 1 | 2 });

/** Die Partner eines Winkels in einer Beziehung. */
export function partner(w: WinkelId, b: Beziehung): WinkelId[] {
  const { i, s } = teile(w);
  const t: 1 | 2 = s === 1 ? 2 : 1;
  switch (b) {
    case "neben": return [id(i + 1, s), id(i + 3, s)];
    case "scheitel": return [id(i + 2, s)];
    case "stufen": return [id(i, t)];
    case "wechsel": return [id(i + 2, t)];
  }
}

/** Welche Beziehung zwei Winkel haben (null = keine der vier). */
export function beziehung(a: WinkelId, b: WinkelId): Beziehung | null {
  for (const x of BEZIEHUNGEN) if (partner(a, x.id).includes(b)) return x.id;
  return null;
}

/**
 * Größe eines Winkels: `phi` ist α₁ (Winkel zwischen g nach rechts und s nach
 * oben), `kipp` dreht h gegen g (0 = parallel).
 */
export function winkelGroesse(w: WinkelId, phi: number, kipp = 0): number {
  const { i, s } = teile(w);
  const a = s === 1 ? phi : phi - kipp;
  return i % 2 === 0 ? a : 180 - a;
}

/* ────────────────────────────────────────── Kästchen-Symmetrie ── */

/** Ein Kästchen [Spalte, Zeile]; Zeile 0 ist oben. */
export type Zelle = [number, number];
export const schluessel = ([c, r]: Zelle) => `${c},${r}`;
export const ausSchluessel = (k: string): Zelle => k.split(",").map(Number) as Zelle;

/**
 * Spiegelachse auf Kästchenpapier, in Gitterlinien gemessen: »senkrecht« bei
 * x = k, »waagerecht« bei y = k, »diagonal« durch (k₀|0) nach rechts unten, »gegendiagonal« nach links unten.
 */
export type GitterAchse =
  | { art: "senkrecht"; k: number } | { art: "waagerecht"; k: number }
  | { art: "diagonal"; k: number } | { art: "gegendiagonal"; k: number };

export function spiegleZelle([c, r]: Zelle, a: GitterAchse): Zelle {
  switch (a.art) {
    case "senkrecht": return [2 * a.k - c - 1, r];
    case "waagerecht": return [c, 2 * a.k - r - 1];
    // Gerade y = x − k: (x|y) → (y + k | x − k), für Kästchen mit Mitte (c + ½ | r + ½)
    case "diagonal": return [r + a.k, c - a.k];
    // Gerade y = −x + k: (x|y) → (k − y | k − x)
    case "gegendiagonal": return [a.k - r - 1, a.k - c - 1];
  }
}

/** Punktspiegelung am Gitterpunkt `z` (Ecke von Kästchen). */
export const punktspiegleZelle = ([c, r]: Zelle, z: Pt): Zelle => [2 * z.x - c - 1, 2 * z.y - r - 1];

/** Vierteldrehung im Uhrzeigersinn um den Gitterpunkt `z` (y nach unten). */
export const dreheZelle = ([c, r]: Zelle, z: Pt): Zelle => {
  const x = c + 0.5 - z.x, y = r + 0.5 - z.y;
  return [z.x - y - 0.5, z.y + x - 0.5];
};

export function abbild(zellen: Zelle[], f: (z: Zelle) => Zelle): Zelle[] {
  return zellen.map(f);
}

export function gleicheMenge(a: Zelle[], b: Zelle[]): boolean {
  const A = new Set(a.map(schluessel)), B = new Set(b.map(schluessel));
  return A.size === B.size && [...A].every(k => B.has(k));
}

export type AchsenTyp = "senkrecht" | "waagerecht" | "diagonal" | "gegendiagonal";
export const ACHSEN_TYPEN: { id: AchsenTyp; label: string }[] = [
  { id: "senkrecht", label: "senkrecht │" },
  { id: "waagerecht", label: "waagerecht ─" },
  { id: "diagonal", label: "schräg ╲" },
  { id: "gegendiagonal", label: "schräg ╱" },
];

/** Umriss der Figur in Gitterlinien. */
export function kasten(zellen: Zelle[]) {
  const cs = zellen.map(z => z[0]), rs = zellen.map(z => z[1]);
  const c0 = Math.min(...cs), r0 = Math.min(...rs), c1 = Math.max(...cs) + 1, r1 = Math.max(...rs) + 1;
  return { c0, r0, c1, r1 };
}

/** Die vier möglichen Achsen durch die Mitte der Figur (Diagonalen nur bei quadratischem Umriss). */
export function kandidaten(zellen: Zelle[]): Partial<Record<AchsenTyp, GitterAchse>> {
  const { c0, r0, c1, r1 } = kasten(zellen);
  const mx = (c0 + c1) / 2, my = (r0 + r1) / 2;
  const k: Partial<Record<AchsenTyp, GitterAchse>> = { senkrecht: { art: "senkrecht", k: mx }, waagerecht: { art: "waagerecht", k: my } };
  if (c1 - c0 === r1 - r0) {
    k.diagonal = { art: "diagonal", k: mx - my };
    k.gegendiagonal = { art: "gegendiagonal", k: mx + my };
  }
  return k;
}

/** Welche der vier Achsen bilden die Figur auf sich selbst ab? */
export function symmetrieAchsen(zellen: Zelle[]): AchsenTyp[] {
  const k = kandidaten(zellen);
  return ACHSEN_TYPEN.map(a => a.id).filter(t => k[t] && gleicheMenge(zellen, zellen.map(z => spiegleZelle(z, k[t]!))));
}

/** Ist die Figur punktsymmetrisch zu ihrer Mitte? */
export function punktsymmetrisch(zellen: Zelle[]): boolean {
  const { c0, r0, c1, r1 } = kasten(zellen);
  return gleicheMenge(zellen, zellen.map(z => punktspiegleZelle(z, { x: (c0 + c1) / 2, y: (r0 + r1) / 2 })));
}

/** Ohne doppelte Kästchen. */
export const ohneDoppelte = (zellen: Zelle[]) => [...new Set(zellen.map(schluessel))].map(ausSchluessel);

export type Gruppe = "keine" | "senkrecht" | "waagerecht" | "diagonal" | "zwei" | "vier" | "punkt" | "dreh4";

/**
 * Zufallsfigur im n × n-Feld mit den Symmetrien einer Gruppe: einige
 * Kästchen würfeln, dann jedes mit allen Abbildungen der Gruppe ergänzen.
 * Die Figur kann zufällig mehr Symmetrie haben — die Antwort rechnet
 * `symmetrieAchsen` darum aus der fertigen Figur.
 */
export function symmetrischeFigur(r: Zufall, gruppe: Gruppe, n = 6): Zelle[] {
  const m = { x: n / 2, y: n / 2 };
  const s: GitterAchse = { art: "senkrecht", k: m.x }, w: GitterAchse = { art: "waagerecht", k: m.y };
  const d: GitterAchse = { art: "diagonal", k: 0 };
  const erz: ((z: Zelle) => Zelle)[] = {
    keine: [], senkrecht: [(z: Zelle) => spiegleZelle(z, s)], waagerecht: [(z: Zelle) => spiegleZelle(z, w)],
    diagonal: [(z: Zelle) => spiegleZelle(z, d)], zwei: [(z: Zelle) => spiegleZelle(z, s), (z: Zelle) => spiegleZelle(z, w)],
    vier: [(z: Zelle) => spiegleZelle(z, s), (z: Zelle) => spiegleZelle(z, d)],
    punkt: [(z: Zelle) => punktspiegleZelle(z, m)], dreh4: [(z: Zelle) => dreheZelle(z, m)],
  }[gruppe];
  for (let versuch = 0; versuch < 50; versuch++) {
    const start: Zelle[] = Array.from({ length: 3 + Math.floor(r() * 4) }, () => [Math.floor(r() * n), Math.floor(r() * n)]);
    let fig = ohneDoppelte(start);
    for (let runde = 0; runde < 8; runde++) fig = ohneDoppelte([...fig, ...erz.flatMap(f => fig.map(f))]);
    // Zu dünn oder ohne Halt wirkt nicht wie eine Figur — nochmal würfeln.
    const ok = fig.length >= 6 && fig.length <= n * n - 8;
    if (!ok) continue;
    if (gruppe === "keine" && (symmetrieAchsen(fig).length || punktsymmetrisch(fig))) continue;
    return fig;
  }
  return gruppe === "keine" ? [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2], [3, 1], [2, 3]] : [[1, 1], [2, 1], [3, 1], [4, 1], [1, 4], [2, 4], [3, 4], [4, 4]];
}

/**
 * Halbe Figur zum Ergänzen: Kästchen auf einer Seite der Achse (bzw. eine
 * Hälfte bei der Punktspiegelung) und die Lösung dazu.
 */
export function halbeFigur(r: Zufall, n: number, art: "senkrecht" | "waagerecht" | "diagonal" | "punkt") {
  const mitte = n / 2;
  const achse: GitterAchse | null = art === "senkrecht" ? { art, k: mitte } : art === "waagerecht" ? { art, k: mitte } : art === "diagonal" ? { art, k: 0 } : null;
  const z = { x: mitte, y: mitte };
  const bild = (c: Zelle) => (achse ? spiegleZelle(c, achse) : punktspiegleZelle(c, z));
  const seite = ([c, r_]: Zelle) => art === "senkrecht" ? c < mitte : art === "waagerecht" ? r_ < mitte : art === "diagonal" ? c > r_ : c < mitte;
  for (let versuch = 0; versuch < 50; versuch++) {
    const vorlage: Zelle[] = [];
    // Zusammenhängend wachsen lassen, damit es wie eine Figur aussieht.
    let p: Zelle = art === "diagonal" ? [Math.floor(mitte) + 1, Math.floor(mitte) - 1] : [Math.floor(mitte) - 1, Math.floor(mitte) - 1];
    const ziel = 5 + Math.floor(r() * 5);
    for (let i = 0; i < 80 && vorlage.length < ziel; i++) {
      if (seite(p) && !vorlage.some(v => v[0] === p[0] && v[1] === p[1])) vorlage.push(p);
      const [dc, dr] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)];
      const q: Zelle = [p[0] + dc, p[1] + dr];
      if (q[0] >= 0 && q[1] >= 0 && q[0] < n && q[1] < n && seite(q)) p = q;
    }
    if (vorlage.length < 4) continue;
    const loesung = vorlage.map(bild);
    if (loesung.some(([c, r_]) => c < 0 || r_ < 0 || c >= n || r_ >= n)) continue;
    return { vorlage, loesung, achse, zentrum: achse ? null : z };
  }
  const vorlage: Zelle[] = [[1, 1], [2, 1], [2, 2]];
  return { vorlage, loesung: vorlage.map(bild), achse, zentrum: achse ? null : z };
}

/* ─────────────────────────────────────────────── Drehfiguren ── */

export type Drehfigur = { name: string; n: number; flaechen: Pt[][]; achsen: number };

/**
 * Figuren mit n-zähliger Drehsymmetrie um (0|0): Windräder (ohne
 * Spiegelachsen), Sterne und regelmäßige Vielecke (mit n Achsen).
 */
export function drehfigur(art: "windrad" | "stern" | "vieleck" | "propeller", n: number): Drehfigur {
  const um = (pts: Pt[], g: number) => pts.map(p => {
    const w = g * Math.PI / 180;
    return { x: p.x * Math.cos(w) - p.y * Math.sin(w), y: p.x * Math.sin(w) + p.y * Math.cos(w) };
  });
  const rund = <T,>(k: number, f: (i: number) => T) => Array.from({ length: k }, (_, i) => f(i));
  switch (art) {
    case "vieleck":
      return { name: `regelmäßiges ${n}-Eck`, n, achsen: n, flaechen: [rund(n, i => polar({ x: 0, y: 0 }, 3, 90 + i * 360 / n))] };
    case "stern":
      return { name: `${n}-zackiger Stern`, n, achsen: n, flaechen: [rund(2 * n, i => polar({ x: 0, y: 0 }, i % 2 ? 1.4 : 3, 90 + i * 180 / n))] };
    case "windrad": {
      // Ein schiefer Flügel — darum hat das Windrad keine Spiegelachse.
      const fluegel: Pt[] = [{ x: 0, y: 0 }, { x: 3, y: 0.2 }, { x: 2.2, y: 1.3 }];
      return { name: `Windrad mit ${n} Flügeln`, n, achsen: 0, flaechen: rund(n, i => um(fluegel, i * 360 / n)) };
    }
    case "propeller": {
      const blatt: Pt[] = [{ x: 0.4, y: -0.25 }, { x: 3, y: -0.6 }, { x: 3.1, y: 0.3 }, { x: 0.4, y: 0.25 }];
      return { name: `Propeller mit ${n} Blättern`, n, achsen: 0, flaechen: rund(n, i => um(blatt, i * 360 / n)) };
    }
  }
}

/* ─────────────────────────────────────────────── Winkel-Billard ── */

/** Rechteckiges Hindernis (Bande in der Mitte des Tischs). */
export type Klotz = { x0: number; y0: number; x1: number; y1: number };
export type Tisch = { w: number; h: number; ball: Pt; loch: Pt; klotze: Klotz[]; pflicht: number };
export type Stoss = { pfad: Pt[]; banden: number; versenkt: boolean; zuFrueh: boolean };

export const LOCH_R = 0.38;
const MAX_BANDEN = 6, MAX_WEG = 90;

type Wand = { a: Pt; b: Pt; senkrecht: boolean };

function waende(t: Tisch): Wand[] {
  const w: Wand[] = [];
  const rechteck = (x0: number, y0: number, x1: number, y1: number) => {
    w.push({ a: { x: x0, y: y0 }, b: { x: x1, y: y0 }, senkrecht: false }, { a: { x: x0, y: y1 }, b: { x: x1, y: y1 }, senkrecht: false });
    w.push({ a: { x: x0, y: y0 }, b: { x: x0, y: y1 }, senkrecht: true }, { a: { x: x1, y: y0 }, b: { x: x1, y: y1 }, senkrecht: true });
  };
  rechteck(0, 0, t.w, t.h);
  for (const k of t.klotze) rechteck(k.x0, k.y0, k.x1, k.y1);
  return w;
}

/**
 * Spielt einen Stoß in Richtung `grad` durch: gerade Bahnen, an jeder Bande
 * Einfallswinkel = Ausfallswinkel. Rollt der Ball über das Loch, fällt er
 * hinein — zählt aber nur mit genug Banden davor (sonst `zuFrueh`).
 */
export function stoss(t: Tisch, grad: number): Stoss {
  const ws = waende(t);
  let p = { ...t.ball };
  let d = { x: Math.cos(grad * Math.PI / 180), y: Math.sin(grad * Math.PI / 180) };
  const pfad: Pt[] = [p];
  let banden = 0, weg = 0;
  while (banden <= MAX_BANDEN && weg < MAX_WEG) {
    // Nächste Wand in Laufrichtung
    let best = Infinity, treffer: Wand[] = [];
    for (const w of ws) {
      let s: number;
      if (w.senkrecht) {
        if (Math.abs(d.x) < 1e-12) continue;
        s = (w.a.x - p.x) / d.x;
        const y = p.y + s * d.y;
        if (y < Math.min(w.a.y, w.b.y) - 1e-9 || y > Math.max(w.a.y, w.b.y) + 1e-9) continue;
      } else {
        if (Math.abs(d.y) < 1e-12) continue;
        s = (w.a.y - p.y) / d.y;
        const x = p.x + s * d.x;
        if (x < Math.min(w.a.x, w.b.x) - 1e-9 || x > Math.max(w.a.x, w.b.x) + 1e-9) continue;
      }
      if (s < 1e-7) continue;
      if (s < best - 1e-9) { best = s; treffer = [w]; } else if (Math.abs(s - best) < 1e-9) treffer.push(w);
    }
    if (!treffer.length) break;
    // Loch auf diesem Stück?
    const s0 = (t.loch.x - p.x) * d.x + (t.loch.y - p.y) * d.y;
    if (s0 > 0 && s0 < best) {
      const q = { x: p.x + s0 * d.x, y: p.y + s0 * d.y };
      if (abstand(q, t.loch) < LOCH_R) {
        pfad.push(q);
        return { pfad, banden, versenkt: banden >= t.pflicht, zuFrueh: banden < t.pflicht };
      }
    }
    p = { x: p.x + best * d.x, y: p.y + best * d.y };
    weg += best;
    pfad.push(p);
    banden++;
    // Ecke: beide Richtungen kehren um.
    if (treffer.some(w => w.senkrecht)) d = { x: -d.x, y: d.y };
    if (treffer.some(w => !w.senkrecht)) d = { x: d.x, y: -d.y };
  }
  return { pfad, banden, versenkt: false, zuFrueh: false };
}

/** Alle ganzen Grad, mit denen der Tisch lösbar ist. */
export function loesungen(t: Tisch): number[] {
  const l: number[] = [];
  for (let g = 0; g < 360; g++) if (stoss(t, g).versenkt) l.push(g);
  return l;
}

const imKlotz = (p: Pt, k: Klotz, rand = 0) => p.x > k.x0 - rand && p.x < k.x1 + rand && p.y > k.y0 - rand && p.y < k.y1 + rand;

/**
 * Tisch für eine Runde: Runde 1–3 eine Bande Pflicht, 4–6 zwei, ab 7 mit
 * Hindernis in der Mitte. Gewürfelt wird, bis ganze Grad zum Ziel führen
 * (aber nicht zu viele — sonst wäre es Zufall).
 */
export function tischFuer(runde: number, r: Zufall = Math.random): Tisch {
  const w = 12, h = 7;
  const pflicht = runde < 3 ? 1 : runde < 6 ? 2 : 1 + (runde % 2);
  for (let versuch = 0; versuch < 400; versuch++) {
    const klotze: Klotz[] = [];
    if (runde >= 6) {
      const kx = 4.5 + r() * 2, ky = 1.5 + r() * 2.5;
      klotze.push(r() < 0.5 ? { x0: kx, y0: ky, x1: kx + 0.5, y1: ky + 2.2 } : { x0: kx - 1, y0: ky, x1: kx + 1.2, y1: ky + 0.5 });
    }
    const zufallsPunkt = () => ({ x: 1 + Math.round(r() * 20) / 2, y: 1 + Math.round(r() * 10) / 2 });
    const ball = zufallsPunkt(), loch = zufallsPunkt();
    if (abstand(ball, loch) < 3.5) continue;
    if (klotze.some(k => imKlotz(ball, k, 0.6) || imKlotz(loch, k, 0.6))) continue;
    const t: Tisch = { w, h, ball, loch, klotze, pflicht };
    const l = loesungen(t);
    if (l.length >= 1 && l.length <= 8) return t;
  }
  return { w, h, ball: { x: 2, y: 2 }, loch: { x: 10, y: 2 }, klotze: [], pflicht: 1 };
}

/** Das Loch an den vier Außenbanden gespiegelt — der Spiegeltrick für eine Bande. */
export function spiegelLoecher(t: Tisch): Pt[] {
  const { x, y } = t.loch;
  return [{ x, y: -y }, { x, y: 2 * t.h - y }, { x: -x, y }, { x: 2 * t.w - x, y }];
}
