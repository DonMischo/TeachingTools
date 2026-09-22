/**
 * Bauen am Aufbau: treffen, setzen, verschieben, rückgängig machen.
 *
 * Reine Funktionen auf dem Aufbau — kein Zeichnen, kein Löser. Dieselbe
 * Trefferprüfung dient dem Bauen (Lage aus dem Aufbau) und dem Versuch (Lage
 * aus der Welt); dafür wird die Lage eines Teils als Funktion hereingereicht.
 */
import type { Blick, Punkt } from "../typen";
import {
  amTeil, endeInWelt, entferneTeil, lokalpunkt, verbinde, wand, weltpunkt,
  type Aufbau, type Teil, type Verbinder, type VerbinderArt,
} from "./modell";
import { istElektrisch, pole, teilTyp, type Form } from "./teile";
import { standardWerteVerbinder } from "./verbinder";

// ── Meter und Pixel ──────────────────────────────────────────────────────────

/** Weltpunkt (Meter, y nach oben) → Bildpunkt (Pixel, y nach unten). */
export function zumBild(p: Punkt, blick: Blick): Punkt {
  return {
    x: blick.breite / 2 + (p.x - blick.mitte.x) * blick.skala,
    y: blick.hoehe / 2 - (p.y - blick.mitte.y) * blick.skala,
  };
}

export function zurWelt(p: Punkt, blick: Blick): Punkt {
  return {
    x: blick.mitte.x + (p.x - blick.breite / 2) / blick.skala,
    y: blick.mitte.y - (p.y - blick.hoehe / 2) / blick.skala,
  };
}

// ── Lage und Treffer ─────────────────────────────────────────────────────────

/** Wo ein Teil gerade ist — im Bauen aus dem Aufbau, im Versuch aus der Welt. */
export type Lage = (t: Teil) => { pos: Punkt; winkel: number };
export const lageImAufbau: Lage = t => ({ pos: t.pos, winkel: t.winkel });
/**
 * Die Lage im Schaltplan: dort liegt alles waagerecht und dort, wo man es
 * hingeschoben hat — nicht dort, wo es an der Wand hängt.
 */
export const lageImPlan: Lage = t => ({ pos: t.plan ?? t.pos, winkel: 0 });

/** Schiebt ein Teil im Schaltplan, ohne den Aufbau anzufassen. */
export function setzePlanlage(aufbau: Aufbau, id: string, pos: Punkt): Aufbau {
  return { ...aufbau, teile: aufbau.teile.map(t => (t.id === id ? { ...t, plan: pos } : t)) };
}

function inForm(f: Form, p: Punkt, toleranz: number): boolean {
  if (f.art === "kasten") {
    return Math.abs(p.x - f.mitte.x) <= f.b / 2 + toleranz && Math.abs(p.y - f.mitte.y) <= f.h / 2 + toleranz;
  }
  if (f.art === "kreis") return Math.hypot(p.x - f.mitte.x, p.y - f.mitte.y) <= f.r + toleranz;
  return abstandZurStrecke(p, f.a, f.b) <= f.r + toleranz;
}

export function abstandZurStrecke(p: Punkt, a: Punkt, b: Punkt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Alle Teile unter einem Weltpunkt — das oberste zuerst.
 *
 * Oben ist, was später hingestellt wurde; so wird es auch gezeichnet.
 */
export function teileUnter(aufbau: Aufbau, p: Punkt, lage: Lage = lageImAufbau, toleranz = 0): Teil[] {
  const treffer: Teil[] = [];
  for (let i = aufbau.teile.length - 1; i >= 0; i--) {
    const t = aufbau.teile[i];
    const typ = teilTyp(t.art);
    if (!typ) continue;
    const l = lage(t);
    const lokal = lokalpunkt({ ...t, pos: l.pos, winkel: l.winkel }, p);
    if (typ.formen(t).some(f => inForm(f, lokal, toleranz))) treffer.push(t);
  }
  return treffer;
}

/**
 * Die ganze Bahn eines Verbinders in der Welt, nach der gegebenen Lage.
 *
 * Bei Achse, Schraube und Feder sind das zwei Punkte; ein Seil über Rollen
 * hat dazwischen noch einen je Rolle.
 */
export function verbinderWeg(aufbau: Aufbau, v: Verbinder, lage: Lage = lageImAufbau): Punkt[] {
  const ende = (e: Verbinder["a"]) => {
    if (e.teil === null) return e.punkt;
    const t = aufbau.teile.find(x => x.id === e.teil);
    if (!t) return e.punkt;
    const l = lage(t);
    return endeInWelt({ ...aufbau, teile: [{ ...t, pos: l.pos, winkel: l.winkel }] }, e);
  };
  return [v.a, ...(v.ueber ?? []), v.b].map(ende);
}

/** Die beiden Enden eines Verbinders in der Welt, nach der gegebenen Lage. */
export function verbinderEnden(aufbau: Aufbau, v: Verbinder, lage: Lage = lageImAufbau): [Punkt, Punkt] {
  const weg = verbinderWeg(aufbau, v, lage);
  return [weg[0], weg[weg.length - 1]];
}

/** Der Verbinder unter einem Weltpunkt, oder null — auf Wunsch nur bestimmte Arten. */
export function verbinderUnter(
  aufbau: Aufbau, p: Punkt, toleranz: number, lage: Lage = lageImAufbau,
  nur: (v: Verbinder) => boolean = () => true,
): Verbinder | null {
  let bester: Verbinder | null = null;
  let beste = toleranz;
  for (const v of aufbau.verbinder) {
    if (!nur(v)) continue;
    const weg = verbinderWeg(aufbau, v, lage);
    // Achse und Schraube sitzen an einem Punkt, alles andere ist eine Leitung:
    // die trifft man auf ihrer ganzen Länge, nicht nur am Ende.
    let d = Math.hypot(p.x - weg[0].x, p.y - weg[0].y);
    if (v.art !== "achse" && v.art !== "schraube") {
      d = Infinity;
      for (let i = 0; i + 1 < weg.length; i++) d = Math.min(d, abstandZurStrecke(p, weg[i], weg[i + 1]));
    }
    if (d <= beste) { beste = d; bester = v; }
  }
  return bester;
}

// ── Setzen ───────────────────────────────────────────────────────────────────

/**
 * Setzt Achse oder Schraube an einer Stelle.
 *
 * Wie man es an einer Lochwand tut: man steckt den Stift durch, was dort
 * liegt. Liegen zwei Teile übereinander, verbindet er diese; liegt nur eines
 * dort, verbindet er es mit der Wand. Ohne Teil gibt es nichts zu verbinden.
 */
export function setzeGelenk(
  aufbau: Aufbau, art: Extract<VerbinderArt, "achse" | "schraube">, p: Punkt,
): { aufbau: Aufbau; id: string } | { fehler: string } {
  const unter = teileUnter(aufbau, p);
  if (unter.length === 0) return { fehler: "Hier liegt nichts, das sich befestigen ließe." };
  const [oben, darunter] = unter;
  // Sitzt an dieser Stelle schon ein Gelenk zwischen denselben beiden, wäre
  // ein zweites nur ein unsichtbares Doppel — man sähe eines und hätte zwei.
  const zweiter = darunter?.id ?? null;
  const doppelt = aufbau.verbinder.find(v =>
    (v.art === "achse" || v.art === "schraube")
    && ((v.a.teil === oben.id && v.b.teil === zweiter) || (v.b.teil === oben.id && v.a.teil === zweiter))
    && Math.hypot(endeInWelt(aufbau, v.a).x - p.x, endeInWelt(aufbau, v.a).y - p.y) < NAH);
  if (doppelt) {
    return { fehler: doppelt.art === "achse" ? "Hier sitzt schon eine Achse." : "Hier sitzt schon eine Schraube." };
  }
  const a = amTeil(oben.id, lokalpunkt(oben, p));
  const b = darunter ? amTeil(darunter.id, lokalpunkt(darunter, p)) : wand(p);
  return verbinde(aufbau, art, a, b, standardWerteVerbinder(art));
}

/** Näher als das zählt als »dieselbe Stelle« — ein halber Zentimeter. */
const NAH = 0.005;

/** Ob ein Verbinder ein Teil an der Wand hält — an welcher Stelle auch immer. */
function haeltAnDerWand(v: Verbinder, teil: string): boolean {
  if (v.art !== "achse" && v.art !== "schraube") return false;
  const [amTeilEnde, andere] = v.a.teil === teil ? [v.a, v.b] : v.b.teil === teil ? [v.b, v.a] : [null, null];
  return !!amTeilEnde && andere!.teil === null;
}

/**
 * Wo die Aufhängung eines Teils sitzt, als Anteil seiner halben Länge.
 *
 * −1 ist das eine Ende, 0 die Mitte, +1 das andere. Ein Brett hängt eben nicht
 * immer in der Mitte — ein Hebel lebt davon, dass der Drehpunkt woanders
 * sitzt, und ein Ausleger hängt am Ende.
 */
export function aufhaengung(aufbau: Aufbau, teil: string): { art: "schraube" | "achse" | null; stelle: number } {
  const v = aufbau.verbinder.find(x => haeltAnDerWand(x, teil));
  const t = aufbau.teile.find(x => x.id === teil);
  if (!v || !t) return { art: null, stelle: 0 };
  const ende = v.a.teil === teil ? v.a : v.b;
  const halb = halbeLaenge(t);
  return { art: v.art as "schraube" | "achse", stelle: halb > 0 ? Math.max(-1, Math.min(1, ende.punkt.x / halb)) : 0 };
}

/** Die halbe Länge eines Teils entlang seiner eigenen x-Achse. */
function halbeLaenge(t: Teil): number {
  const f = teilTyp(t.art)?.formen(t)[0];
  if (f?.art === "kasten") return f.b / 2;
  if (f?.art === "kapsel") return Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y) / 2;
  if (f?.art === "kreis") return f.r;
  return 0;
}

/**
 * Setzt, wie und wo ein Teil an der Wand sitzt — oder löst es davon.
 *
 * Ein Schalter, kein Hinzufügen: ein vorher sitzender Stift wird ersetzt,
 * nicht ergänzt. Sonst sammelte jeder Klick einen weiteren an.
 */
export function setzeAufhaengung(
  aufbau: Aufbau, teil: string, art: "schraube" | "achse" | null, stelle = 0,
): Aufbau {
  const t = aufbau.teile.find(x => x.id === teil);
  if (!t) return aufbau;
  const ohne = { ...aufbau, verbinder: aufbau.verbinder.filter(v => !haeltAnDerWand(v, teil)) };
  if (!art) return ohne;
  const lokal = { x: halbeLaenge(t) * Math.max(-1, Math.min(1, stelle)), y: 0 };
  return verbinde(ohne, art, amTeil(teil, lokal), wand(weltpunkt(t, lokal)), standardWerteVerbinder(art)).aufbau;
}

/**
 * Die Stellen, an die sich ein Verbinder heften lässt.
 *
 * Ein echtes Gerät hat Ösen, Klemmen und Bohrungen — man hängt das Seil nicht
 * irgendwo ans Brett, sondern ins Loch am Ende. Diese Punkte sind das; sie
 * werden beim Ziehen als Ringe angezeigt und ziehen den Zeiger an, damit zwei
 * Kabel am selben Pol auch wirklich am selben Pol sitzen.
 */
export function anschluesse(aufbau: Aufbau, lage: Lage = lageImAufbau): { teil: string; lokal: Punkt; welt: Punkt }[] {
  const aus: { teil: string; lokal: Punkt; welt: Punkt }[] = [];
  for (const t of aufbau.teile) {
    const l = lage(t);
    const gedreht = { ...t, pos: l.pos, winkel: l.winkel };
    for (const lokal of anschlussstellen(t)) {
      aus.push({ teil: t.id, lokal, welt: weltpunkt(gedreht, lokal) });
    }
  }
  return aus;
}

/** Die Anschlussstellen eines Teils in seinen eigenen Koordinaten. */
function anschlussstellen(t: Teil): Punkt[] {
  const mitte = { x: 0, y: 0 };
  if (istElektrisch(t.art)) return pole(t);
  const form = teilTyp(t.art)?.formen(t)[0];
  if (t.art === "brett" || t.art === "linse" || t.art === "spiegel") {
    if (form?.art !== "kasten") return [mitte];
    const halb = t.art === "brett" ? form.b / 2 : form.h / 2;
    return t.art === "brett"
      ? [{ x: -halb, y: 0 }, mitte, { x: halb, y: 0 }]
      : [{ x: 0, y: -halb }, mitte, { x: 0, y: halb }];
  }
  if (t.art === "stange" && form?.art === "kapsel") return [form.a, mitte, form.b];
  if (t.art === "scheibe" || t.art === "zahnrad") {
    const r = (t.werte.durchmesser ?? 0.2) / 2;
    return [mitte, { x: r, y: 0 }, { x: 0, y: r }, { x: -r, y: 0 }, { x: 0, y: -r }];
  }
  return [mitte];
}

/** Der Anschluss in der Nähe eines Punktes, oder nichts. */
export function schnappe(aufbau: Aufbau, p: Punkt, toleranz: number, lage: Lage = lageImAufbau) {
  let bester: { teil: string; lokal: Punkt; welt: Punkt } | null = null;
  let beste = toleranz;
  for (const a of anschluesse(aufbau, lage)) {
    const d = Math.hypot(a.welt.x - p.x, a.welt.y - p.y);
    if (d <= beste) { beste = d; bester = a; }
  }
  return bester;
}

/**
 * Ein Ende für Seil, Feder oder Kabel: der nächste Anschluss, sonst das
 * oberste Teil an der Stelle, sonst die Wand.
 */
export function endeAn(aufbau: Aufbau, p: Punkt, toleranz = 0): Verbinder["a"] {
  const nah = toleranz > 0 ? schnappe(aufbau, p, toleranz) : null;
  if (nah) return amTeil(nah.teil, nah.lokal);
  const [oben] = teileUnter(aufbau, p);
  return oben ? amTeil(oben.id, lokalpunkt(oben, p)) : wand(p);
}

/**
 * Eine Scheibe, über die ein Seil laufen kann — getroffen nahe ihrer Mitte.
 *
 * Die Mitte ist die Stelle, an der das Seil nur umgelenkt wird; am Rand
 * getroffen bindet man es an, wie bei der Winde. So braucht es keinen zweiten
 * Knopf: wo man hintippt, sagt schon, was gemeint ist.
 */
export function rolleUnter(aufbau: Aufbau, p: Punkt): Teil | undefined {
  return teileUnter(aufbau, p).find(t => {
    if (t.art !== "scheibe") return false;
    const l = lokalpunkt(t, p);
    return Math.hypot(l.x, l.y) <= 0.5 * ((t.werte.durchmesser ?? 0.2) / 2);
  });
}

/**
 * Baut ein Bauteil in ein Kabel ein: das Kabel wird getrennt, das Teil sitzt
 * dazwischen.
 *
 * So verdrahtet man auch in Wirklichkeit — man schneidet die Leitung auf und
 * klemmt das Gerät dazwischen. Wer ein Lämpchen auf ein Kabel schiebt, meint
 * genau das und nicht »leg es obendrauf«.
 */
export function baueEin(aufbau: Aufbau, teil: string, kabel: string): Aufbau {
  const v = aufbau.verbinder.find(x => x.id === kabel);
  const t = aufbau.teile.find(x => x.id === teil);
  if (!v || !t || v.art !== "kabel" || v.a.teil === teil || v.b.teil === teil || !istElektrisch(t.art)) return aufbau;
  const [links, rechts] = pole(t);
  let s: Aufbau = { ...aufbau, verbinder: aufbau.verbinder.filter(x => x.id !== kabel) };
  s = verbinde(s, "kabel", v.a, amTeil(teil, links), standardWerteVerbinder("kabel")).aufbau;
  s = verbinde(s, "kabel", amTeil(teil, rechts), v.b, standardWerteVerbinder("kabel")).aufbau;
  return s;
}

/**
 * Nimmt ein Teil heraus und schließt die Leitung wieder.
 *
 * Hing es mit genau zwei Kabeln in einem Strang, werden daraus wieder eines —
 * sonst bliebe nach jedem Ausbau eine Lücke, die man von Hand überbrücken
 * müsste.
 */
export function baueAus(aufbau: Aufbau, teil: string): Aufbau {
  const kabel = aufbau.verbinder.filter(v => v.art === "kabel" && (v.a.teil === teil || v.b.teil === teil));
  const ohne = entferneTeil(aufbau, teil);
  if (kabel.length !== 2) return ohne;
  const fremd = (v: Verbinder) => (v.a.teil === teil ? v.b : v.a);
  const [a, b] = [fremd(kabel[0]), fremd(kabel[1])];
  if (a.teil === null && b.teil === null) return ohne;
  return verbinde(ohne, "kabel", a, b, standardWerteVerbinder("kabel")).aufbau;
}

export function spanne(
  aufbau: Aufbau, art: Extract<VerbinderArt, "seil" | "feder" | "kabel">, von: Punkt, bis: Punkt,
  ueber: Punkt[] = [], toleranz = 0,
): { aufbau: Aufbau; id: string } | { fehler: string } {
  const a = endeAn(aufbau, von, toleranz), b = endeAn(aufbau, bis, toleranz);
  const rollen = art === "seil" ? ueber.map(p => rolleUnter(aufbau, p)) : [];
  if (rollen.some(r => !r)) return { fehler: "Ein Seil läuft nur über die Mitte einer Scheibe." };
  // Über eine Rolle darf das Seil zurück zur Wand oder zum selben Teil — ohne
  // Umweg wäre es ein Punkt.
  if (rollen.length === 0) {
    if (a.teil === null && b.teil === null) return { fehler: "Mindestens ein Ende muss an einem Teil sitzen." };
    if (a.teil !== null && a.teil === b.teil) return { fehler: "Beide Enden sitzen am selben Teil." };
  }
  return verbinde(aufbau, art, a, b, standardWerteVerbinder(art), rollen.map(r => amTeil(r!.id)));
}

// ── Verschieben und Drehen ───────────────────────────────────────────────────

/**
 * Setzt ein Teil an eine neue Lage.
 *
 * Achsen und Schrauben zur Wand wandern mit: wer ein angeschraubtes Brett
 * verschiebt, meint das Brett samt Schraube, nicht ein Brett, das sich von
 * seiner Schraube losreißt. Seile und Federn zur Wand bleiben dagegen an
 * ihrem Wandpunkt — sie werden länger oder kürzer.
 */
export function setzeLage(aufbau: Aufbau, id: string, pos: Punkt, winkel?: number): Aufbau {
  const alt = aufbau.teile.find(t => t.id === id);
  if (!alt) return aufbau;
  const neu: Teil = { ...alt, pos, winkel: winkel ?? alt.winkel };
  return {
    ...aufbau,
    teile: aufbau.teile.map(t => (t.id === id ? neu : t)),
    verbinder: aufbau.verbinder.map(v => {
      if (v.art !== "achse" && v.art !== "schraube") return v;
      if (v.a.teil === id && v.b.teil === null) return { ...v, b: wand(endeInWelt({ ...aufbau, teile: [neu] }, v.a)) };
      if (v.b.teil === id && v.a.teil === null) return { ...v, a: wand(endeInWelt({ ...aufbau, teile: [neu] }, v.b)) };
      return v;
    }),
  };
}

export function setzeTeilWerte(aufbau: Aufbau, id: string, werte: Record<string, number>): Aufbau {
  return { ...aufbau, teile: aufbau.teile.map(t => (t.id === id ? { ...t, werte: { ...t.werte, ...werte } } : t)) };
}

export function setzeVerbinderWerte(aufbau: Aufbau, id: string, werte: Record<string, number>): Aufbau {
  return {
    ...aufbau,
    verbinder: aufbau.verbinder.map(v => (v.id === id ? { ...v, werte: { ...v.werte, ...werte } } : v)),
  };
}

// ── Rückgängig ───────────────────────────────────────────────────────────────

/**
 * Der Verlauf fürs Rückgängigmachen.
 *
 * Weil der Aufbau unveränderliche Daten sind, genügt es, die Stände zu
 * merken. Ein Zug beim Ziehen (hunderte Bewegungen) wird zu einem Schritt
 * zusammengefasst: `merke()` beim Anfassen, `setze()` währenddessen.
 */
export interface Verlauf {
  vorher: Aufbau[];
  jetzt: Aufbau;
  nachher: Aufbau[];
}

const GRENZE = 200;

export const neuerVerlauf = (jetzt: Aufbau): Verlauf => ({ vorher: [], jetzt, nachher: [] });

/** Ein neuer Stand, der sich rückgängig machen lässt. */
export function tue(v: Verlauf, neu: Aufbau): Verlauf {
  if (neu === v.jetzt) return v;
  return { vorher: [...v.vorher, v.jetzt].slice(-GRENZE), jetzt: neu, nachher: [] };
}

/** Ein Zwischenstand ohne eigenen Schritt — etwa beim Ziehen. */
export const setze = (v: Verlauf, neu: Aufbau): Verlauf => ({ ...v, jetzt: neu });

/** Merkt den jetzigen Stand als Schritt, bevor eine Serie von `setze` beginnt. */
export const merke = (v: Verlauf): Verlauf => ({ vorher: [...v.vorher, v.jetzt].slice(-GRENZE), jetzt: v.jetzt, nachher: [] });

export function zurueck(v: Verlauf): Verlauf {
  if (!v.vorher.length) return v;
  return { vorher: v.vorher.slice(0, -1), jetzt: v.vorher[v.vorher.length - 1], nachher: [v.jetzt, ...v.nachher] };
}

export function vor(v: Verlauf): Verlauf {
  if (!v.nachher.length) return v;
  return { vorher: [...v.vorher, v.jetzt], jetzt: v.nachher[0], nachher: v.nachher.slice(1) };
}
