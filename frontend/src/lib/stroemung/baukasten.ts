/**
 * Baukasten von »Druck & Strömung«: eigene Rohrnetze auf dem Raster.
 *
 * Bauteile spannen sich von `a` nach `b` (wie im Stromkreis). Zweipole sind
 * an beiden Enden angeschlossen; Einpole (Behälter, Hahn, Zylinder …) nur an
 * `a`, die Strecke nach `b` ist ihr Körper. Leitungen sind ideal (fast ohne
 * Widerstand) — wer Reibung will, setzt ein Rohr.
 *
 * Höhe zählt: 1 Kästchen = 0,5 m. Jeder Rasterpunkt wird ein eigener Knoten
 * auf seiner Höhe, Leitungen verbinden sie — so zeigt ein Manometer unten in
 * einer senkrechten Leitung von selbst mehr Druck.
 */
import { rasterEditor, type RasterNetz, type RasterTeil, type Punkt } from "../raster/editor";
import { Stroemung } from "./loeser";
import type { Knoten, Medium, Teil } from "./modell";

export const RASTER_M = 0.5;

export type BkArt =
  | "quelle" | "pumpe" | "rohr" | "ventil" | "rueckschlag" | "druckminderer" | "durchfluss"
  | "behaelter" | "kessel" | "polster" | "hahn" | "zylinder" | "manometer";

export interface Feld { schluessel: string; label: string; einheit: string; faktor: number; min: number; max: number; schritt: number }
export interface BkInfo { name: string; icon: string; pole: 1 | 2; werte: Record<string, number>; felder: Feld[]; hilfe: string }

const f = (schluessel: string, label: string, einheit: string, faktor: number, min: number, max: number, schritt: number): Feld =>
  ({ schluessel, label, einheit, faktor, min, max, schritt });

/** Werte in SI; Felder rechnen mit `faktor` in die Anzeigeeinheit um. */
export const BK_TEILE: Record<BkArt, BkInfo> = {
  quelle: { name: "Netzanschluss", icon: "🔌", pole: 1, werte: { druck: 3e5 }, felder: [f("druck", "Druck", "bar", 1e5, 0, 10, 0.1)], hilfe: "Hält seinen Anschluss auf festem Überdruck — wie das Wasser- oder Druckluftnetz." },
  pumpe: { name: "Pumpe", icon: "⚙️", pole: 2, werte: { foerderdruck: 1e5, maxFluss: 1e-3 }, felder: [f("foerderdruck", "Förderdruck", "bar", 1e5, 0.1, 10, 0.1), f("maxFluss", "größter Durchfluss", "L/min", 1 / 60000, 1, 500, 1)], hilfe: "Fördert von a nach b. Je mehr sie liefert, desto weniger Druck schafft sie." },
  rohr: { name: "Rohr", icon: "➖", pole: 2, werte: { laenge: 5, durchmesser: 0.02 }, felder: [f("laenge", "Länge", "m", 1, 0.5, 200, 0.5), f("durchmesser", "Innendurchmesser", "mm", 0.001, 4, 100, 1)], hilfe: "Reibung nach Hagen-Poiseuille, bei Wasser und Luft zusätzlich turbulent." },
  ventil: { name: "Ventil", icon: "🔧", pole: 2, werte: { oeffnung: 1 }, felder: [f("oeffnung", "Öffnung", "%", 0.01, 0, 100, 1)], hilfe: "Engstelle zum Einstellen; 0 % ist zu." },
  rueckschlag: { name: "Rückschlagventil", icon: "▶", pole: 2, werte: {}, felder: [], hilfe: "Lässt nur von a nach b durch — wie eine Diode." },
  druckminderer: { name: "Druckminderer", icon: "⬇", pole: 2, werte: { druck: 2e5 }, felder: [f("druck", "Sollwert", "bar", 1e5, 0.2, 8, 0.1)], hilfe: "Hält hinter sich (b) den Sollwert, solange vorne mehr Druck ist." },
  durchfluss: { name: "Durchflussmesser", icon: "⏱", pole: 2, werte: {}, felder: [], hilfe: "Zeigt den Durchfluss von a nach b." },
  behaelter: { name: "Offener Behälter", icon: "🪣", pole: 1, werte: { flaeche: 0.1, fuellung: 0.5 }, felder: [f("flaeche", "Grundfläche", "m²", 1, 0.01, 10, 0.01), f("fuellung", "Füllung beim Start", "%", 0.01, 0, 100, 5)], hilfe: "Anschluss unten bei a; die Länge bis b ist die Höhe des Behälters." },
  kessel: { name: "Druckkessel", icon: "🛢️", pole: 1, werte: { volumen: 0.02, druck: 0 }, felder: [f("volumen", "Volumen", "L", 0.001, 1, 1000, 1), f("druck", "Druck beim Start", "bar", 1e5, 0, 10, 0.1)], hilfe: "Speichert Luft; mit Wasser bleibt er starr (Wasser lässt sich nicht zusammendrücken)." },
  polster: { name: "Ausdehnungsgefäß", icon: "🎈", pole: 1, werte: { volumen: 0.01, vordruck: 1e5 }, felder: [f("volumen", "Volumen", "L", 0.001, 1, 200, 1), f("vordruck", "Vordruck", "bar", 1e5, 0, 6, 0.1)], hilfe: "Ein Luftpolster nimmt Wasser auf, wenn der Druck den Vordruck übersteigt (Boyle)." },
  hahn: { name: "Hahn / Auslass", icon: "🚰", pole: 1, werte: { oeffnung: 1 }, felder: [f("oeffnung", "Öffnung", "%", 0.01, 0, 100, 5)], hilfe: "Lässt ins Freie ab; bei 3 bar und 100 % rund 12 L/min Wasser." },
  zylinder: { name: "Zylinder", icon: "🧱", pole: 1, werte: { durchmesser: 0.05, hub: 0.2, last: 200 }, felder: [f("durchmesser", "Kolben-⌀", "mm", 0.001, 10, 200, 1), f("hub", "Hub", "cm", 0.01, 5, 100, 1), f("last", "Last", "N", 1, 0, 50000, 10)], hilfe: "Fährt aus, wenn p·A die Last übertrifft (Pascal); zurück, wenn der Druck fällt." },
  manometer: { name: "Manometer", icon: "⏲", pole: 1, werte: {}, felder: [], hilfe: "Zeigt den Überdruck an seinem Anschluss a." },
};

export type BkTeil = RasterTeil<BkArt>;
export interface Baukasten extends RasterNetz<BkArt> { medium: Medium }

export const LEER: Baukasten = { version: 1, medium: "wasser", bauteile: [], draehte: [] };

export const anschluesse = (t: BkTeil): Punkt[] => (BK_TEILE[t.art].pole === 2 ? [t.a, t.b] : [t.a]);

export const editor = rasterEditor<BkArt>({
  anschluesse,
  leitetZwischen: art => BK_TEILE[art].pole === 2,
  starr: () => false,
});

export const wert = (t: BkTeil, k: string) => t.werte[k] ?? BK_TEILE[t.art].werte[k] ?? 0;
const schl = (p: Punkt) => `${p.x},${p.y}`;
/** Höhe eines Rasterpunkts in m (y wächst nach unten). */
export const hoehe = (p: Punkt) => -p.y * RASTER_M;

const R_LEITUNG = 1e3;      // Pa·s/m³: 1 L/s kostet 1 Pa
const R_VENTIL = 1e7;       // bei 100 % offen
const R_HAHN = 1.5e9;       // bei 100 % offen

/** Übersetzt den Baukasten in ein Netz für den Löser. Jeder Anschlusspunkt ist ein Knoten. */
export function zumNetz(bk: Baukasten): { knoten: Knoten[]; teile: Teil[] } {
  const punkte = new Map<string, Punkt>();
  for (const t of bk.bauteile) for (const p of anschluesse(t)) punkte.set(schl(p), p);
  for (const d of bk.draehte) { punkte.set(schl(d.a), d.a); punkte.set(schl(d.b), d.b); }
  const knoten: Knoten[] = [...punkte.entries()].map(([id, p]) => ({ id, z: hoehe(p) }));
  const turbulent = bk.medium !== "oel";
  const teile: Teil[] = bk.draehte.map(d => ({ id: d.id, art: "drossel", a: schl(d.a), b: schl(d.b), widerstand: R_LEITUNG }));
  for (const t of bk.bauteile) {
    const a = schl(t.a), b = schl(t.b), w = (k: string) => wert(t, k);
    const laengeM = Math.hypot(t.b.x - t.a.x, t.b.y - t.a.y) * RASTER_M;
    switch (t.art) {
      case "quelle": teile.push({ id: t.id, art: "druckquelle", a, druck: w("druck") }); break;
      case "pumpe": teile.push({ id: t.id, art: "pumpe", a, b, foerderdruck: Math.max(1, w("foerderdruck")), maxFluss: w("maxFluss") }); break;
      case "rohr": teile.push({ id: t.id, art: "rohr", a, b, laenge: w("laenge"), durchmesser: w("durchmesser"), turbulent }); break;
      case "ventil": teile.push({ id: t.id, art: "drossel", a, b, widerstand: w("oeffnung") > 0 ? R_VENTIL / w("oeffnung") ** 2 : Infinity }); break;
      case "rueckschlag": teile.push({ id: t.id, art: "rueckschlag", a, b, widerstand: 1e6 }); break;
      case "druckminderer": teile.push({ id: t.id, art: "druckminderer", a, b, druck: w("druck"), widerstand: 1e6 }); break;
      case "durchfluss": teile.push({ id: t.id, art: "drossel", a, b, widerstand: R_LEITUNG }); break;
      case "behaelter": teile.push({ id: t.id, art: "behaelter", a, flaeche: w("flaeche"), hoehe: Math.max(RASTER_M, laengeM), fuellung: w("fuellung") * Math.max(RASTER_M, laengeM) }); break;
      case "kessel": teile.push({ id: t.id, art: "kessel", a, volumen: w("volumen"), druck: w("druck") }); break;
      case "polster": teile.push({ id: t.id, art: "polster", a, volumen: w("volumen"), vordruck: w("vordruck") }); break;
      case "hahn": teile.push({ id: t.id, art: "auslass", a, widerstand: w("oeffnung") > 0 ? R_HAHN / w("oeffnung") : Infinity }); break;
      case "zylinder": teile.push({ id: t.id, art: "zylinder", a, flaeche: Math.PI * w("durchmesser") ** 2 / 4, hub: w("hub"), kraft: w("last"), weg: 0 }); break;
      case "manometer": break;
    }
  }
  return { knoten, teile };
}

export function simulation(bk: Baukasten) {
  return new Stroemung({ medium: bk.medium, ...zumNetz(bk) });
}

/** Überdruck an einem Rasterpunkt. */
export const druckAn = (s: Stroemung, p: Punkt) => s.druck(schl(p));
