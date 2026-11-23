/**
 * Ähnlichkeit und Maßstab: zentrische Streckung, Ähnlichkeit von Dreiecken,
 * Maßstab 1 : n umrechnen und Übungsaufgaben. Reine Rechnung, ohne React.
 * Koordinaten in Einheiten (Kästchen), y nach unten wie im SVG.
 */

export type P = { x: number; y: number };
export type Figur = P[];

export const strecke = (p: P, z: P, k: number): P => ({ x: z.x + k * (p.x - z.x), y: z.y + k * (p.y - z.y) });
export const streckeFigur = (f: Figur, z: P, k: number): Figur => f.map(p => strecke(p, z, k));
export const abstand = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
export const umfang = (f: Figur) => f.reduce((s, p, i) => s + abstand(p, f[(i + 1) % f.length]), 0);
export const flaeche = (f: Figur) => Math.abs(f.reduce((s, p, i) => { const q = f[(i + 1) % f.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
export const seiten = (f: Figur) => f.map((p, i) => abstand(p, f[(i + 1) % f.length]));

/** Innenwinkel an jeder Ecke in Grad */
export function winkel(f: Figur): number[] {
  return f.map((p, i) => {
    const a = f[(i + f.length - 1) % f.length], b = f[(i + 1) % f.length];
    const u = { x: a.x - p.x, y: a.y - p.y }, v = { x: b.x - p.x, y: b.y - p.y };
    const c = (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
    return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
  });
}

export const FIGUREN: { id: string; name: string; f: Figur }[] = [
  { id: "dreieck", name: "Dreieck", f: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1, y: -3 }] },
  { id: "haus", name: "Haus", f: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: -2 }, { x: 1.5, y: -3.5 }, { x: 0, y: -2 }] },
  { id: "pfeil", name: "Pfeil", f: [{ x: 0, y: -1 }, { x: 3, y: -1 }, { x: 3, y: -2 }, { x: 5, y: 0 }, { x: 3, y: 2 }, { x: 3, y: 1 }, { x: 0, y: 1 }] },
  { id: "drachen", name: "Drachen", f: [{ x: 0, y: 0 }, { x: 1.5, y: -1.5 }, { x: 0, y: -4 }, { x: -1.5, y: -1.5 }] },
];

/** Dreiecke ähnlich? Sortierte Seitenverhältnisse vergleichen; liefert den Faktor (groß : klein) oder null. */
export function aehnlichkeitsFaktor(a: Figur, b: Figur, toleranz = 0.01): number | null {
  if (a.length !== 3 || b.length !== 3) return null;
  const sa = seiten(a).sort((x, y) => x - y), sb = seiten(b).sort((x, y) => x - y);
  const k = sb[0] / sa[0];
  return sb.every((s, i) => Math.abs(s / sa[i] - k) <= toleranz * k) ? k : null;
}

/** Bedeutung des Streckfaktors in Worten */
export function streckText(k: number): string {
  if (k === 0) return "k = 0: alles fällt auf das Zentrum — keine Figur mehr.";
  const art = Math.abs(k) > 1 ? "Vergrößerung" : Math.abs(k) < 1 ? "Verkleinerung" : "gleich groß (deckungsgleich)";
  return `${art}${k < 0 ? ", dazu auf die andere Seite des Zentrums gespiegelt (k negativ)" : ""}`;
}

// ── Maßstab ──────────────────────────────────────────────────────────

/** Länge in cm schön mit passender Einheit */
export function laengeText(cm: number): string {
  const de = (x: number) => x.toLocaleString("de-DE", { maximumFractionDigits: 2 });
  if (Math.abs(cm) >= 100000) return `${de(cm / 100000)} km`;
  if (Math.abs(cm) >= 100) return `${de(cm / 100)} m`;
  if (Math.abs(cm) >= 1) return `${de(cm)} cm`;
  return `${de(cm * 10)} mm`;
}

/** Maßstab a : b (Bild : Wirklichkeit). Verkleinerung 1 : 25 000, Vergrößerung 10 : 1. */
export type Massstab = { bild: number; echt: number };
export const inWirklichkeit = (bildCm: number, m: Massstab) => (bildCm * m.echt) / m.bild;
export const imBild = (echtCm: number, m: Massstab) => (echtCm * m.bild) / m.echt;
export const massstabText = (m: Massstab) => `${m.bild.toLocaleString("de-DE")} : ${m.echt.toLocaleString("de-DE")}`;

export const MASSSTAEBE: { m: Massstab; wo: string }[] = [
  { m: { bild: 1, echt: 25000 }, wo: "Wanderkarte" },
  { m: { bild: 1, echt: 200000 }, wo: "Straßenkarte" },
  { m: { bild: 1, echt: 3000000 }, wo: "Atlaskarte Deutschland" },
  { m: { bild: 1, echt: 87 }, wo: "Modelleisenbahn H0" },
  { m: { bild: 1, echt: 100 }, wo: "Bauplan eines Hauses" },
  { m: { bild: 1, echt: 1000 }, wo: "Lageplan / Schulgelände" },
  { m: { bild: 10, echt: 1 }, wo: "Lupe, Insekt im Lehrbuch" },
  { m: { bild: 100, echt: 1 }, wo: "Mikroskop (Zellen)" },
];

// ── Aufgaben ─────────────────────────────────────────────────────────

export type Zufall = () => number;
const zz = (r: Zufall, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const eins = <T,>(r: Zufall, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const de = (x: number) => x.toLocaleString("de-DE", { maximumFractionDigits: 3 });

export type Aufgabe = { art: string; frage: string; loesung: number; einheit: string; weg: string[] };
export const AUFGABEN_ARTEN = [
  { id: "faktor", label: "Streckfaktor" },
  { id: "seite", label: "fehlende Seite" },
  { id: "flaeche", label: "Fläche und Umfang" },
  { id: "karte", label: "Karte → Wirklichkeit" },
  { id: "plan", label: "Wirklichkeit → Plan" },
  { id: "massstab", label: "Maßstab bestimmen" },
] as const;
export type AufgabenArt = (typeof AUFGABEN_ARTEN)[number]["id"];

export function aufgabe(art: AufgabenArt, r: Zufall = Math.random): Aufgabe {
  switch (art) {
    case "faktor": {
      const a = zz(r, 2, 9), k = eins(r, [0.5, 1.5, 2, 2.5, 3, 4]);
      return { art, frage: `Eine Strecke ist ${a} cm lang, ihr Bild nach der Streckung ${de(a * k)} cm. Wie groß ist der Streckfaktor k?`,
        loesung: k, einheit: "", weg: [`k = Bildstrecke : Originalstrecke = ${de(a * k)} : ${a} = ${de(k)}`] };
    }
    case "seite": {
      const a = zz(r, 2, 8), b = zz(r, 3, 9), k = eins(r, [1.5, 2, 2.5, 3]);
      return { art, frage: `Zwei Dreiecke sind ähnlich. Im kleinen sind zwei Seiten a = ${a} cm und b = ${b} cm, im großen ist a' = ${de(a * k)} cm. Wie lang ist b'?`,
        loesung: b * k, einheit: "cm", weg: [`k = a' : a = ${de(a * k)} : ${a} = ${de(k)}`, `b' = k · b = ${de(k)} · ${b} cm = ${de(b * k)} cm`] };
    }
    case "flaeche": {
      const A = zz(r, 4, 30), k = eins(r, [2, 3, 0.5, 1.5]);
      return { art, frage: `Eine Figur hat den Flächeninhalt ${A} cm². Sie wird mit k = ${de(k)} gestreckt. Wie groß ist die Bildfläche?`,
        loesung: A * k * k, einheit: "cm²", weg: [`Längen mal k, Flächen mal k²: k² = ${de(k * k)}`, `A' = ${de(k * k)} · ${A} cm² = ${de(A * k * k)} cm²`] };
    }
    case "karte": {
      const m = eins(r, [25000, 50000, 100000, 200000]), cm = zz(r, 2, 15) + eins(r, [0, 0.5]);
      const echtKm = (cm * m) / 100000;
      return { art, frage: `Auf einer Karte im Maßstab 1 : ${m.toLocaleString("de-DE")} sind zwei Orte ${de(cm)} cm voneinander entfernt. Wie weit ist das in Wirklichkeit (in km)?`,
        loesung: echtKm, einheit: "km", weg: [`${de(cm)} cm · ${m.toLocaleString("de-DE")} = ${de(cm * m)} cm`, `${de(cm * m)} cm = ${de(echtKm)} km (1 km = 100 000 cm)`] };
    }
    case "plan": {
      const m = eins(r, [50, 100, 200]), meter = zz(r, 3, 20);
      return { art, frage: `Ein Zimmer ist ${meter} m lang. Wie lang ist es auf einem Bauplan im Maßstab 1 : ${m} (in cm)?`,
        loesung: (meter * 100) / m, einheit: "cm", weg: [`${meter} m = ${meter * 100} cm`, `${meter * 100} cm : ${m} = ${de((meter * 100) / m)} cm`] };
    }
    case "massstab": {
      const m = eins(r, [10000, 20000, 25000, 50000]), cm = zz(r, 2, 8);
      const echtM = (cm * m) / 100;
      return { art, frage: `${de(cm)} cm auf der Karte sind in Wirklichkeit ${de(echtM)} m. Welcher Maßstab 1 : n? Gib n an.`,
        loesung: m, einheit: "", weg: [`${de(echtM)} m = ${de(echtM * 100)} cm`, `n = ${de(echtM * 100)} cm : ${de(cm)} cm = ${m.toLocaleString("de-DE")}`] };
    }
  }
}

/** Spiel »Zoom-Treffer«: Ziel = gestreckte Figur mit zufälligem Zentrum und Faktor */
export function zoomZiel(r: Zufall = Math.random, stufe: 1 | 2 | 3 = 1) {
  const fig = eins(r, FIGUREN);
  const ks = stufe === 1 ? [2, 0.5, 1.5] : stufe === 2 ? [2, 0.5, 1.5, 2.5, 3] : [-1, -2, -0.5, 1.5, 2.5, 3];
  const k = eins(r, ks);
  const z = { x: zz(r, -2, 4), y: zz(r, -3, 1) };
  return { fig, k, z, ziel: streckeFigur(fig.f, z, k) };
}

/** Mittlerer Abstand entsprechender Ecken */
export const passung = (a: Figur, b: Figur) => a.reduce((s, p, i) => s + abstand(p, b[i]), 0) / a.length;
