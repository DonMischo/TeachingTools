/**
 * Vorrat, Essen und Verbrauch.
 *
 * Essen nimmt aus dem Vorrat, was zuerst abläuft — je Mahlzeit höchstens eine
 * Portion pro Produkt, bis das kcal-Ziel der Mahlzeit erreicht ist. Rohes
 * (Nudeln, Fleisch, TK) braucht eine Kochgelegenheit, Gekühltes ohne
 * Kühlschrank verdirbt am nächsten Tag.
 *
 * Am Tagesende wird bewertet: kcal gegen Bedarf, Obst/Gemüse-Portionen
 * (DGE: 5 am Tag), Eiweiß, Zucker. Daraus folgen Hunger, Energie und
 * langsam die Gesundheit.
 */
import { effekt, log, r2 } from "./kern";
import { PRODUKT, type Produkt, type VerbrauchsArt } from "./laden";
import type { Spielstand, VorratPosten } from "./typen";

export type Mahlzeit = "fruehstueck" | "mittag" | "abend" | "snack";
const ANTEIL: Record<Mahlzeit, number> = { fruehstueck: 0.25, mittag: 0.35, abend: 0.35, snack: 0.1 };

export function istEssbar(p: Produkt): boolean {
  return p.kcal > 0 && p.verbrauch == null && p.kategorie !== "gewuerze" && p.kategorie !== "backen";
}

/** Legt gekaufte Ware in den Vorrat. */
export function einraeumen(s: Spielstand, produkt: string, variante: VorratPosten["variante"], anzahl = 1): void {
  const p = PRODUKT.get(produkt);
  if (!p) return;
  const kuehl = effekt(s, "kuehlen") > 0;
  const tk = effekt(s, "tiefkuehlen") > 0;
  let haltbar = p.haltbarTage;
  if (p.kuehlen && !kuehl) haltbar = Math.min(haltbar, 1);
  if (p.tk && !tk) haltbar = Math.min(haltbar, kuehl ? 2 : 1);
  for (let i = 0; i < anzahl; i++) {
    s.vorrat.push({ produkt, variante, rest: 1, gekauft: s.tag, haltbarBis: s.tag + haltbar });
  }
}

export type Gegessen = { kcal: number; produkte: string[]; fehlt: number };

/** Eine Mahlzeit aus dem Vorrat. `kochen` = ob gekocht werden kann und darf (Zeit). */
export function essen(s: Spielstand, mahlzeit: Mahlzeit, kochen: boolean): Gegessen {
  const ziel = s.kcalBedarf * ANTEIL[mahlzeit];
  const koennen = kochen && effekt(s, "kochen") >= 2;
  const kandidaten = s.vorrat
    .filter((v) => {
      const p = PRODUKT.get(v.produkt);
      return p && istEssbar(p) && v.rest > 0.001 && (!p.kochen || koennen);
    })
    .sort((a, b) => a.haltbarBis - b.haltbarBis);
  let kcal = 0;
  const namen: string[] = [];
  // Mehrere Runden: erst von jedem eine Portion, dann nachlegen.
  for (let runde = 0; runde < 3 && kcal < ziel; runde++) {
    for (const v of kandidaten) {
      if (kcal >= ziel) break;
      const p = PRODUKT.get(v.produkt)!;
      if (v.rest <= 0.001) continue;
      // Alkohol isst man nicht zum Frühstück, Getränke nur nebenbei
      if (p.kategorie === "alkohol") continue;
      if (mahlzeit === "fruehstueck" && (p.kategorie === "fleisch" || p.kategorie === "fisch" || p.kategorie === "tk")) continue;
      const portion = Math.min(v.rest, 1 / Math.max(1, p.portionen));
      v.rest = r2(v.rest - portion);
      kcal += p.kcal * portion;
      s.heute.protein += p.protein * portion;
      s.heute.zucker += p.zucker * portion;
      s.heute.obstGemuese += p.obstGemuese * portion;
      if (!namen.includes(p.name)) namen.push(p.name);
    }
  }
  s.vorrat = s.vorrat.filter((v) => v.rest > 0.001);
  s.heute.kcal += kcal;
  return { kcal: Math.round(kcal), produkte: namen, fehlt: Math.max(0, Math.round(ziel - kcal)) };
}

/** Auswärts essen (Kantine, Bäcker, Döner …) — zählt als Mahlzeit. */
export function auswaerts(s: Spielstand, kcal: number, protein: number, obstGemuese: number, zucker: number): void {
  s.heute.kcal += kcal;
  s.heute.protein += protein;
  s.heute.obstGemuese += obstGemuese;
  s.heute.zucker += zucker;
  s.heute.auswaerts += 1;
}

/** Wie viel ist von einer Verbrauchs-Art noch da (in Tagen)? */
export function reichweite(s: Spielstand, art: VerbrauchsArt): number {
  let tage = 0;
  for (const v of s.vorrat) {
    const p = PRODUKT.get(v.produkt);
    if (p?.verbrauch?.art === art) tage += v.rest * p.verbrauch.tage;
  }
  return Math.floor(tage);
}

/** Einen Tag Verbrauch abziehen; gibt zurück, was gefehlt hat. */
export function verbrauchen(s: Spielstand, art: VerbrauchsArt, tage = 1): boolean {
  let bedarf = tage;
  for (const v of s.vorrat) {
    if (bedarf <= 0) break;
    const p = PRODUKT.get(v.produkt);
    if (p?.verbrauch?.art !== art) continue;
    const verfuegbar = v.rest * p.verbrauch.tage;
    const nimm = Math.min(verfuegbar, bedarf);
    v.rest = r2(v.rest - nimm / p.verbrauch.tage);
    bedarf -= nimm;
  }
  s.vorrat = s.vorrat.filter((v) => v.rest > 0.001);
  return bedarf <= 0.001;
}

/** Abgelaufenes wegwerfen; gibt den Warenwert zurück (Lebensmittelverschwendung). */
export function verderben(s: Spielstand): { wert: number; namen: string[] } {
  let wert = 0;
  const namen: string[] = [];
  s.vorrat = s.vorrat.filter((v) => {
    if (v.haltbarBis >= s.tag) return true;
    const p = PRODUKT.get(v.produkt);
    if (!p || p.verbrauch) return true;
    wert += p.eigen * v.rest;
    if (!namen.includes(p.name)) namen.push(p.name);
    return false;
  });
  if (namen.length) {
    s.flags.weggeworfen = r2(Number(s.flags.weggeworfen ?? 0) + wert);
    log(s, "gesundheit", `Weggeworfen (abgelaufen): ${namen.join(", ")}`, -wert);
  }
  return { wert: r2(wert), namen };
}

/** Kurztext für die Anzeige »Wie habe ich mich die letzte Woche ernährt?«. */
export function wochenfazit(s: Spielstand): string[] {
  const tage = s.ernaehrung.slice(-7);
  if (tage.length === 0) return ["Noch keine Daten."];
  const mittel = (f: (t: typeof tage[number]) => number) => tage.reduce((a, t) => a + f(t), 0) / tage.length;
  const kcal = mittel((t) => t.kcal);
  const og = mittel((t) => t.obstGemuese);
  const prot = mittel((t) => t.protein);
  const zucker = mittel((t) => t.zucker);
  const aus: string[] = [];
  aus.push(kcal < s.kcalBedarf * 0.8 ? `Zu wenig gegessen: Ø ${Math.round(kcal)} kcal (Bedarf ${s.kcalBedarf}).`
    : kcal > s.kcalBedarf * 1.2 ? `Mehr gegessen als gebraucht: Ø ${Math.round(kcal)} kcal.` : `Satt: Ø ${Math.round(kcal)} kcal.`);
  aus.push(og < 2 ? `Kaum Obst und Gemüse (Ø ${og.toFixed(1)} Portionen, empfohlen 5).`
    : og < 4 ? `Obst/Gemüse: Ø ${og.toFixed(1)} Portionen — geht noch mehr.` : `Obst/Gemüse: Ø ${og.toFixed(1)} Portionen. 👍`);
  aus.push(prot < 45 ? `Wenig Eiweiß (Ø ${Math.round(prot)} g) — Milchprodukte, Eier, Hülsenfrüchte helfen.` : `Eiweiß: Ø ${Math.round(prot)} g.`);
  if (zucker > 90) aus.push(`Viel Zucker: Ø ${Math.round(zucker)} g am Tag (WHO: unter 50 g).`);
  return aus;
}
