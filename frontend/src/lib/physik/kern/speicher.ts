/**
 * Wo ein Aufbau liegt — im Browser, je Konto bzw. je Sitzungscode.
 *
 * Eigener Schlüssel für das neue Format: alte Aufbauten (Geräte statt Teile)
 * lassen sich nicht sinnvoll übersetzen, und der Zweig war nie veröffentlicht.
 *
 * Nachsichtig mit Absicht: die Daten können aus einem alten Speicher oder von
 * einer fremden Sitzung kommen. Was nicht zu retten ist, fällt weg —
 * geworfen wird nie, sonst steht die Klasse vor einer leeren Seite.
 */
import type { Bauplan } from "./bauplan";
import { neuerAufbau, type Aufbau, type Ende, type Teil, type Verbinder } from "./modell";
import { standardWerteTeil, teilTyp } from "./teile";
import { standardWerteVerbinder, verbinderTyp } from "./verbinder";
import type { Punkt } from "../typen";

const name = (schluessel: string) => `physik-baukasten-v1:${schluessel}`;

const zahl = (x: unknown, ersatz = 0) => (typeof x === "number" && Number.isFinite(x) ? x : ersatz);
const punkt = (p: unknown): Punkt => {
  const o = (p ?? {}) as Record<string, unknown>;
  return { x: zahl(o.x), y: zahl(o.y) };
};
const werte = (roh: unknown, standard: Record<string, number>) => {
  const aus = { ...standard };
  if (roh && typeof roh === "object") {
    for (const [k, v] of Object.entries(roh as Record<string, unknown>)) if (k in aus) aus[k] = zahl(v, aus[k]);
  }
  return aus;
};

export function aufbauAusJSON(roh: string): Aufbau {
  let d: Record<string, unknown>;
  try {
    const x = JSON.parse(roh);
    if (!x || typeof x !== "object" || x.version !== 2) return neuerAufbau();
    d = x;
  } catch {
    return neuerAufbau();
  }

  const teile: Teil[] = (Array.isArray(d.teile) ? d.teile : [])
    .map(t => (t ?? {}) as Record<string, unknown>)
    .filter(t => typeof t.id === "string" && typeof t.art === "string" && teilTyp(t.art as string))
    .map(t => ({
      id: t.id as string,
      art: t.art as Teil["art"],
      pos: punkt(t.pos),
      winkel: zahl(t.winkel),
      werte: werte(t.werte, standardWerteTeil(t.art as Teil["art"])),
      // Die Lage im Schaltplan ist keine Pflicht: fehlt sie, gilt die an der Wand.
      ...(t.plan ? { plan: punkt(t.plan) } : {}),
    }));

  const ids = new Set(teile.map(t => t.id));
  const ende = (e: unknown): Ende | null => {
    const o = (e ?? {}) as Record<string, unknown>;
    if (o.teil !== null && !(typeof o.teil === "string" && ids.has(o.teil))) return null;
    return { teil: o.teil as string | null, punkt: punkt(o.punkt) };
  };

  const verbinder: Verbinder[] = [];
  for (const roh of Array.isArray(d.verbinder) ? d.verbinder : []) {
    const v = (roh ?? {}) as Record<string, unknown>;
    const a = ende(v.a), b = ende(v.b);
    if (typeof v.id !== "string" || typeof v.art !== "string" || !verbinderTyp(v.art) || !a || !b) continue;
    if (a.teil === null && b.teil === null) continue;
    verbinder.push({
      id: v.id, art: v.art as Verbinder["art"], a, b,
      werte: werte(v.werte, standardWerteVerbinder(v.art as Verbinder["art"])),
    });
  }

  return {
    version: 2,
    titel: typeof d.titel === "string" ? d.titel : "Neuer Aufbau",
    treue: d.treue === "ideal" ? "ideal" : "real",
    teile, verbinder,
  };
}

export function ladeAufbau(schluessel: string): Aufbau {
  try {
    const roh = localStorage.getItem(name(schluessel));
    return roh ? aufbauAusJSON(roh) : neuerAufbau();
  } catch {
    return neuerAufbau();
  }
}

export function speichereAufbau(schluessel: string, aufbau: Aufbau) {
  try {
    localStorage.setItem(name(schluessel), JSON.stringify(aufbau));
  } catch { /* privater Modus: dann eben nur für diese Sitzung */ }
}

// ── Eigene Baupläne ──────────────────────────────────────────────────────────

const planName = (schluessel: string) => `physik-bauplaene-v1:${schluessel}`;

/**
 * Was jemand selbst als Bauplan gesichert hat.
 *
 * Wie beim Aufbau nachsichtig gelesen: ein Plan, dessen Teile nicht mehr zum
 * Katalog passen, fällt weg, statt die ganze Liste unbrauchbar zu machen.
 */
export function ladeBauplaene(schluessel: string): Bauplan[] {
  try {
    const roh = localStorage.getItem(planName(schluessel));
    if (!roh) return [];
    const liste = JSON.parse(roh);
    if (!Array.isArray(liste)) return [];
    return liste
      .map(p => (p ?? {}) as Record<string, unknown>)
      .filter(p => typeof p.id === "string" && typeof p.name === "string")
      .map(p => ({
        id: p.id as string,
        name: p.name as string,
        icon: typeof p.icon === "string" ? p.icon : "📐",
        beschreibung: typeof p.beschreibung === "string" ? p.beschreibung : "",
        aufbau: aufbauAusJSON(JSON.stringify(p.aufbau ?? {})),
      }))
      .filter(p => p.aufbau.teile.length > 0);
  } catch {
    return [];
  }
}

export function speichereBauplaene(schluessel: string, plaene: Bauplan[]) {
  try {
    localStorage.setItem(planName(schluessel), JSON.stringify(plaene));
  } catch { /* privater Modus: dann eben nur für diese Sitzung */ }
}
