/**
 * Vorfahrt an Kreuzungen (StVO § 8): Wer hat an welcher Einmündung Vorrang?
 * Aus der Karte abgeleitet — Ampel, Stopp- und Vorfahrt-achten-Schilder aus
 * OSM, sonst nach der Straßenart: Die größere Straße ist Vorfahrtstraße (306),
 * die kleinere wartet (205). Sind alle Straßen gleich, gilt rechts vor links.
 * Aus Einfahrten und verkehrsberuhigten Bereichen wartet man immer (§ 10).
 * Dazu der Wächter, der Radfahrer an der Kreuzung prüft. Kein Pixi.
 */
import type { P } from "./geometrie";
import type { Anlage } from "./ampeln";
import type { RegelId } from "./regeln";
import type { Stadt, StrassenArt, Strasse } from "./stadt";

export type Regel = "ampel" | "vorfahrt" | "warten" | "stopp" | "rechtsVorLinks";
/** Ein Arm der Kreuzung: Richtung von der Mitte weg; `schild`: kommt aus OSM oder ist abgeleitet. */
export type Arm = { winkel: number; strasse: Strasse; regel: Regel; schild?: "osm" | "abgeleitet" };
export type Kreuzung = { id: number; p: P; arme: Arm[]; kern: number };

const RANG: Record<StrassenArt, number> = { primary: 4, secondary: 3, tertiary: 2, unclassified: 1, residential: 1, living_street: 0, service: 0 };
export const rangVon = (s: Strasse) => RANG[s.art] ?? 1;

/** Ein Punkt `d` Meter die Linie entlang, ab Stützpunkt i in Richtung `schritt` (±1). */
function entlang(linie: P[], i: number, schritt: 1 | -1, d: number): P {
  let rest = d, j = i;
  while (j + schritt >= 0 && j + schritt < linie.length) {
    const a = linie[j], b = linie[j + schritt], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l >= rest) return [a[0] + ((b[0] - a[0]) * rest) / l, a[1] + ((b[1] - a[1]) * rest) / l];
    rest -= l; j += schritt;
  }
  return linie[j];
}

const wdiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

export function baueKreuzungen(stadt: Stadt, anlagen: Anlage[]): Kreuzung[] {
  const knoten = new Map<string, { p: P; arme: { winkel: number; strasse: Strasse }[] }>();
  for (const s of stadt.strassen) {
    s.linie.forEach((p, i) => {
      const key = `${Math.round(p[0] * 2)},${Math.round(p[1] * 2)}`;
      let k = knoten.get(key);
      if (!k) { k = { p, arme: [] }; knoten.set(key, k); }
      for (const schritt of [-1, 1] as const) {
        if (i + schritt < 0 || i + schritt >= s.linie.length) continue;
        const q = entlang(s.linie, i, schritt, 8);
        const winkel = Math.atan2(q[1] - p[1], q[0] - p[0]);
        // Doppelte Arme (zwei Linien übereinander) nur einmal
        if (!k.arme.some((a) => wdiff(a.winkel, winkel) < 0.2)) k.arme.push({ winkel, strasse: s });
      }
    });
  }
  // Knoten, die dicht beieinander liegen (OSM zeichnet Kreuzungen oft als zwei, drei Punkte), sind eine Kreuzung
  const roh = [...knoten.values()].filter((k) => k.arme.length >= 3);
  const vergeben = new Set<number>();
  const kreuzungen: Kreuzung[] = [];
  roh.forEach((k, i) => {
    if (vergeben.has(i)) return;
    const gruppe = [k];
    vergeben.add(i);
    for (let j = i + 1; j < roh.length; j++)
      if (!vergeben.has(j) && gruppe.some((g) => Math.hypot(g.p[0] - roh[j].p[0], g.p[1] - roh[j].p[1]) < 6)) { gruppe.push(roh[j]); vergeben.add(j); }
    const p: P = [gruppe.reduce((s, g) => s + g.p[0], 0) / gruppe.length, gruppe.reduce((s, g) => s + g.p[1], 0) / gruppe.length];
    const arme: { winkel: number; strasse: Strasse }[] = [];
    for (const g of gruppe) for (const a of g.arme) {
      // Das kurze Stück zwischen zwei Punkten derselben Kreuzung ist kein Arm
      if (gruppe.some((h) => h !== g && wdiff(a.winkel, Math.atan2(h.p[1] - g.p[1], h.p[0] - g.p[0])) < 0.5)) continue;
      if (!arme.some((b) => wdiff(b.winkel, a.winkel) < 0.35)) arme.push(a);
    }
    if (arme.length < 3) return;
    const kern = Math.max(...arme.map((a) => a.strasse.breite)) / 2 + 1 + Math.max(...gruppe.map((g) => Math.hypot(g.p[0] - p[0], g.p[1] - p[1])));
    kreuzungen.push({ id: kreuzungen.length, p, kern, arme: arme.map((a) => ({ ...a, regel: "rechtsVorLinks" as Regel })) });
  });

  // Schilder aus OSM gehören zur nächsten Kreuzung, an den Arm, an dem sie stehen
  const schilder = new Map<Kreuzung, { arm: Arm; art: "stopp" | "warten" }[]>();
  for (const q of stadt.karte.punkte) {
    if (q.art !== "stopp" && q.art !== "vorfahrtAchten") continue;
    let best: Kreuzung | null = null, bd = 25;
    for (const k of kreuzungen) { const d = Math.hypot(k.p[0] - q.p[0], k.p[1] - q.p[1]); if (d < bd) { bd = d; best = k; } }
    if (!best) continue;
    const w = Math.atan2(q.p[1] - best.p[1], q.p[0] - best.p[0]);
    const arm = best.arme.reduce((a, b) => (wdiff(b.winkel, w) < wdiff(a.winkel, w) ? b : a));
    schilder.set(best, [...(schilder.get(best) ?? []), { arm, art: q.art === "stopp" ? "stopp" : "warten" }]);
  }

  for (const k of kreuzungen) {
    if (anlagen.some((a) => Math.hypot(a.mitte[0] - k.p[0], a.mitte[1] - k.p[1]) < 15)) {
      for (const a of k.arme) a.regel = "ampel";
      continue;
    }
    const osm = schilder.get(k);
    if (osm) {
      for (const a of k.arme) {
        const s = osm.find((x) => x.arm === a);
        a.regel = s ? (s.art === "stopp" ? "stopp" : "warten") : "vorfahrt";
        a.schild = "osm";
      }
      continue;
    }
    const raenge = k.arme.map((a) => rangVon(a.strasse));
    const max = Math.max(...raenge), min = Math.min(...raenge);
    if (max === min) continue; // rechts vor links
    k.arme.forEach((a, i) => {
      a.regel = raenge[i] === max ? "vorfahrt" : "warten";
      // Schilder nur zwischen richtigen Straßen — an Einfahrten steht keins (§ 10)
      if (raenge[i] >= 1 && min >= 1) a.schild = "abgeleitet";
    });
  }
  return kreuzungen;
}

export const REGEL_TEXT: Record<Regel, string> = {
  ampel: "Ampel: Es gilt, was die Ampel zeigt.",
  vorfahrt: "Du bist auf der Vorfahrtstraße — trotzdem auf Abbieger achten.",
  warten: "Vorfahrt gewähren! Die Autos auf der anderen Straße haben Vorrang — langsam heran, schauen (Leertaste), warten.",
  stopp: "Stoppschild: ganz anhalten, schauen (Leertaste), erst fahren, wenn frei ist.",
  rechtsVorLinks: "Kein Schild: rechts vor links! Wer von rechts kommt, hat Vorfahrt — schau nach rechts (Leertaste).",
};

export type AutoLage = { x: number; y: number; winkel: number; tempo: number };
export type KreuzungsLage = { x: number; y: number; winkel: number; tempo: number; t: number; /** Hat sich gerade umgeschaut. */ schaut: boolean };

/**
 * Prüft den Radfahrer an Kreuzungen: nähert er sich über einen Arm, zählt,
 * ob er angehalten und geschaut hat; beim Hineinfahren, ob ein Auto mit
 * Vorfahrt kam.
 */
export class VorfahrtWaechter {
  private an: { k: Kreuzung; arm: Arm; gestanden: boolean; geschaut: boolean; autoGesehen: boolean; drin: boolean } | null = null;
  private zuletzt = new Map<RegelId, number>();

  constructor(private kreuzungen: Kreuzung[]) {}

  /** Autos, die gerade Vorrang vor jemandem auf `arm` haben (auf die Kreuzung zu, in 3,5 s da). */
  vorrang(k: Kreuzung, arm: Arm, winkel: number, autos: AutoLage[]): AutoLage[] {
    if (arm.regel === "ampel" || arm.regel === "vorfahrt") return [];
    return autos.filter((f) => {
      if (f.tempo < 1) return false;
      const dx = k.p[0] - f.x, dy = k.p[1] - f.y, d = Math.hypot(dx, dy);
      if (d > 40 || Math.cos(f.winkel - Math.atan2(dy, dx)) < 0.7) return false;
      if ((d - k.kern) / f.tempo > 3.5) return false;
      const von = Math.atan2(-dy, -dx);
      const farm = k.arme.reduce((a, b) => (wdiff(b.winkel, von) < wdiff(a.winkel, von) ? b : a));
      if (farm === arm) return false;
      // Rechts vor links: nur wer von rechts kommt (rechts = Blickrichtung + 90°, y zeigt nach Süden)
      if (arm.regel === "rechtsVorLinks") return wdiff(farm.winkel, winkel + Math.PI / 2) < Math.PI / 4;
      return farm.regel === "vorfahrt";
    });
  }

  private einmal(aus: RegelId[], id: RegelId, t: number, pause: number) {
    if (t - (this.zuletzt.get(id) ?? -Infinity) < pause) return;
    this.zuletzt.set(id, t);
    aus.push(id);
  }

  pruefe(l: KreuzungsLage, autos: AutoLage[]): { meldungen: RegelId[]; hinweis: string | null; regel: Regel | null } {
    const aus: RegelId[] = [];
    let hinweis: string | null = null;
    if (!this.an) {
      // Nähert sich über einen Arm einer Kreuzung? Die nächste zählt.
      let bd = 22;
      for (const k of this.kreuzungen) {
        const dx = k.p[0] - l.x, dy = k.p[1] - l.y, d = Math.hypot(dx, dy);
        if (d > bd || d <= k.kern) continue;
        if (Math.cos(l.winkel - Math.atan2(dy, dx)) < 0.6) continue;
        const von = Math.atan2(-dy, -dx);
        const arm = k.arme.reduce((a, b) => (wdiff(b.winkel, von) < wdiff(a.winkel, von) ? b : a));
        if (wdiff(arm.winkel, von) > 0.5) continue;
        bd = d;
        this.an = { k, arm, gestanden: false, geschaut: false, autoGesehen: false, drin: false };
      }
      if (this.an) hinweis = REGEL_TEXT[this.an.arm.regel];
      if (!this.an) return { meldungen: aus, hinweis, regel: null };
    }
    const a = this.an;
    const d = Math.hypot(a.k.p[0] - l.x, a.k.p[1] - l.y);
    if (d > 28 || (a.drin && d > a.k.kern + 3)) { this.an = null; return { meldungen: aus, hinweis, regel: null }; }
    if (d < 14 && l.tempo < 0.4) a.gestanden = true;
    if (d < 22 && l.schaut) a.geschaut = true;
    const jetzt = this.vorrang(a.k, a.arm, l.winkel, autos);
    if (jetzt.length && d < 22) a.autoGesehen = true;
    if (!a.drin && d <= a.k.kern) {
      a.drin = true;
      const r = a.arm.regel;
      if (r !== "ampel" && r !== "vorfahrt") {
        if (jetzt.length) this.einmal(aus, "radVorfahrt", l.t, 5);
        else if (r === "stopp" && !a.gestanden) this.einmal(aus, "radStopp", l.t, 5);
        else if (!a.geschaut) this.einmal(aus, "radNichtGeschaut", l.t, 30);
        else if (a.autoGesehen) this.einmal(aus, "radVorfahrtGut", l.t, 45);
      }
    }
    return { meldungen: aus, hinweis, regel: a.arm.regel };
  }
}
