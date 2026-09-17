/**
 * Der Aufbau auf der Werkbank — reine Datenhaltung.
 *
 * Hier rechnet nichts und hier zeichnet nichts: die Szene sagt nur, welche
 * Geräte wo stehen, was womit verbunden ist und wie genau gerechnet werden
 * soll. Dadurch lässt sie sich als JSON speichern, über einen Beitritts-Code
 * teilen und in Tests prüfen, ohne dass ein Solver oder ein Canvas dranhängt.
 *
 * Alle Funktionen geben eine neue Szene zurück und lassen die alte in Ruhe.
 */
import { geraetTyp, portVon, standardWerte } from "./katalog";
import type { Blick, Geraet, Modelltreue, Punkt, PortZeiger, Szene } from "./typen";

export const LEERE_SZENE: Szene = {
  version: 1, titel: "Neuer Aufbau", treue: "ideal", geraete: [], verbindungen: [],
};

export const neueSzene = (): Szene => ({ ...LEERE_SZENE, geraete: [], verbindungen: [] });

/** Fortlaufende Ids — damit gespeicherte Aufbauten lesbar und Tests bestimmt bleiben. */
function naechsteId(vorhandene: string[], praefix: string): string {
  const hoechste = vorhandene.reduce((max, id) => {
    const rest = id.startsWith(praefix) ? Number(id.slice(praefix.length)) : NaN;
    return Number.isInteger(rest) && rest > max ? rest : max;
  }, 0);
  return `${praefix}${hoechste + 1}`;
}

/** Stellt ein Gerät des angegebenen Typs auf die Werkbank. */
export function stelle(szene: Szene, typ: string, pos: Punkt): Szene {
  if (!geraetTyp(typ)) throw new Error(`Unbekannter Gerätetyp: ${typ}`);
  const geraet: Geraet = {
    id: naechsteId(szene.geraete.map(g => g.id), "g"),
    typ, pos, winkel: 0, werte: standardWerte(typ),
  };
  return { ...szene, geraete: [...szene.geraete, geraet] };
}

/** Nimmt ein Gerät weg — samt allem, was daran hing. */
export function entferne(szene: Szene, id: string): Szene {
  return {
    ...szene,
    geraete: szene.geraete.filter(g => g.id !== id),
    verbindungen: szene.verbindungen.filter(v => v.von.geraet !== id && v.nach.geraet !== id),
  };
}

export function bewege(szene: Szene, id: string, pos: Punkt): Szene {
  return { ...szene, geraete: szene.geraete.map(g => (g.id === id ? { ...g, pos } : g)) };
}

/** Ändert Parameterwerte eines Geräts (in SI). */
export function stelleEin(szene: Szene, id: string, werte: Record<string, number>): Szene {
  return { ...szene, geraete: szene.geraete.map(g => (g.id === id ? { ...g, werte: { ...g.werte, ...werte } } : g)) };
}

const gleich = (a: PortZeiger, b: PortZeiger) => a.geraet === b.geraet && a.port === b.port;

/**
 * Verbindet zwei Ports. Zusammen passen nur Ports derselben Art — eine Öse
 * gehört an einen Haken, ein Kabel an eine Buchse, und beides nicht ans andere.
 */
export function verbinde(szene: Szene, a: PortZeiger, b: PortZeiger): Szene {
  for (const z of [a, b]) {
    const g = szene.geraete.find(x => x.id === z.geraet);
    if (!g) throw new Error(`Kein Gerät mit der Id ${z.geraet}`);
    if (!portVon(g.typ, z.port)) throw new Error(`${g.typ} hat keinen Port ${z.port}`);
  }
  if (gleich(a, b)) throw new Error("Ein Port lässt sich nicht mit sich selbst verbinden.");

  const artA = portVon(szene.geraete.find(g => g.id === a.geraet)!.typ, a.port)!.art;
  const artB = portVon(szene.geraete.find(g => g.id === b.geraet)!.typ, b.port)!.art;
  if (artA !== artB) throw new Error(`${artA} passt nicht an ${artB}.`);

  const schonDa = szene.verbindungen.some(v =>
    (gleich(v.von, a) && gleich(v.nach, b)) || (gleich(v.von, b) && gleich(v.nach, a)));
  if (schonDa) throw new Error("Diese beiden Ports sind schon verbunden.");

  const id = naechsteId(szene.verbindungen.map(v => v.id), "v");
  return { ...szene, verbindungen: [...szene.verbindungen, { id, von: a, nach: b }] };
}

export function trenne(szene: Szene, id: string): Szene {
  return { ...szene, verbindungen: szene.verbindungen.filter(v => v.id !== id) };
}

/** Was für dieses Gerät gilt: seine eigene Einstellung schlägt die der Szene. */
export const treueVon = (szene: Szene, geraet: Geraet): Modelltreue => geraet.treue ?? szene.treue;

export const alsJSON = (szene: Szene): string => JSON.stringify(szene);

const zahl = (x: unknown, ersatz = 0) => (typeof x === "number" && Number.isFinite(x) ? x : ersatz);
const punkt = (p: unknown): Punkt => {
  const o = (p ?? {}) as Record<string, unknown>;
  return { x: zahl(o.x), y: zahl(o.y) };
};

/**
 * Liest einen gespeicherten oder geteilten Aufbau.
 *
 * Nachsichtig mit Absicht: die Daten können aus einem alten localStorage oder
 * von einer fremden Sitzung kommen. Was nicht zu retten ist, fällt weg —
 * geworfen wird nie, sonst steht die Klasse vor einer leeren Seite.
 */
export function ausJSON(roh: string): Szene {
  let daten: unknown;
  try {
    daten = JSON.parse(roh);
  } catch {
    return neueSzene();
  }
  if (!daten || typeof daten !== "object") return neueSzene();
  const d = daten as Record<string, unknown>;
  if (d.version !== 1) return neueSzene();

  const geraete: Geraet[] = (Array.isArray(d.geraete) ? d.geraete : [])
    .map(g => (g ?? {}) as Record<string, unknown>)
    .filter(g => typeof g.id === "string" && typeof g.typ === "string" && geraetTyp(g.typ as string))
    .map(g => {
      const werte = { ...standardWerte(g.typ as string) };
      if (g.werte && typeof g.werte === "object") {
        for (const [k, v] of Object.entries(g.werte as Record<string, unknown>)) {
          if (k in werte) werte[k] = zahl(v, werte[k]);
        }
      }
      const geraet: Geraet = {
        id: g.id as string, typ: g.typ as string,
        pos: punkt(g.pos), winkel: zahl(g.winkel), werte,
      };
      if (g.treue === "ideal" || g.treue === "real") geraet.treue = g.treue;
      return geraet;
    });

  const nachId = new Map(geraete.map(g => [g.id, g]));
  const zeigerOk = (z: unknown): z is PortZeiger => {
    const o = (z ?? {}) as Record<string, unknown>;
    const g = typeof o.geraet === "string" ? nachId.get(o.geraet) : undefined;
    return !!g && typeof o.port === "string" && !!portVon(g.typ, o.port);
  };

  const verbindungen = (Array.isArray(d.verbindungen) ? d.verbindungen : [])
    .map(v => (v ?? {}) as Record<string, unknown>)
    .filter(v => typeof v.id === "string" && zeigerOk(v.von) && zeigerOk(v.nach))
    .map(v => ({ id: v.id as string, von: v.von as PortZeiger, nach: v.nach as PortZeiger }));

  return {
    version: 1,
    titel: typeof d.titel === "string" ? d.titel : LEERE_SZENE.titel,
    treue: d.treue === "real" ? "real" : "ideal",
    geraete, verbindungen,
  };
}

// ── Meter und Pixel ───────────────────────────────────────────────────────────
// Die einzigen zwei Funktionen im Labor, die beides gleichzeitig kennen. Kein
// Solver sieht je einen Pixel, keine Zeichenroutine je einen blanken Meter.

/** Weltpunkt (Meter, y nach oben) → Leinwandpunkt (Pixel, y nach unten). */
export function zumBild(p: Punkt, blick: Blick): Punkt {
  return {
    x: blick.breite / 2 + (p.x - blick.mitte.x) * blick.skala,
    y: blick.hoehe / 2 - (p.y - blick.mitte.y) * blick.skala,
  };
}

/** Leinwandpunkt → Weltpunkt. */
export function zurWelt(p: Punkt, blick: Blick): Punkt {
  return {
    x: blick.mitte.x + (p.x - blick.breite / 2) / blick.skala,
    y: blick.mitte.y - (p.y - blick.hoehe / 2) / blick.skala,
  };
}

/**
 * Wo ein Port in der Welt sitzt — der Sitz am Gerät, mitgedreht.
 *
 * Zeichnen und Anfassen brauchen das, und ab Phase 2 auch die Rechenwerke:
 * welcher Draht an welcher Buchse steckt, entscheidet sich an diesem Punkt.
 */
export function portOrt(geraet: Geraet, portId: string): Punkt | undefined {
  const port = portVon(geraet.typ, portId);
  if (!port) return undefined;
  const c = Math.cos(geraet.winkel), s = Math.sin(geraet.winkel);
  return {
    x: geraet.pos.x + port.pos.x * c - port.pos.y * s,
    y: geraet.pos.y + port.pos.x * s + port.pos.y * c,
  };
}

/**
 * Ein freier Platz auf dem Tisch.
 *
 * Neue Geräte sollen nicht aufeinanderfallen: gesucht wird reihenweise von
 * der Mitte aus der erste Rasterplatz, an dem noch nichts steht.
 */
export function freierPlatz(szene: Szene, start: Punkt = { x: 0, y: 0.5 }): Punkt {
  const SCHRITT = 0.3, PRO_REIHE = 5, ABSTAND = 0.2;
  for (let i = 0; i < PRO_REIHE * 8; i++) {
    const platz = {
      x: start.x + ((i % PRO_REIHE) - (PRO_REIHE - 1) / 2) * SCHRITT,
      y: start.y - Math.floor(i / PRO_REIHE) * SCHRITT,
    };
    const besetzt = szene.geraete.some(g => Math.hypot(g.pos.x - platz.x, g.pos.y - platz.y) < ABSTAND);
    if (!besetzt) return platz;
  }
  return start;
}
