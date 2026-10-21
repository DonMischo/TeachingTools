/**
 * D2 im Browser: `@d2lang/d2` bringt WASM und Worker in einer Datei (≈ 11 MB)
 * mit. Sie wird erst geladen, wenn jemand die Diagramm-Werkstatt öffnet, und
 * danach für alle Diagramme der Seite weiterbenutzt.
 *
 * Thema, Skizzenstil und Layout stehen im Code (`vars.d2-config`), D2 liest sie
 * selbst — deshalb braucht `zeichne` keine Optionen, und eine heruntergeladene
 * `.d2`-Datei sieht anderswo genauso aus.
 */
import type { D2 } from "@d2lang/d2";

export interface Verbindung { id: string; src: string; dst: string }

export interface Ergebnis {
  svg: string;
  formen: { id: string; label: string }[];
  verbindungen: Verbindung[];
}

export interface D2Fehler { zeile?: number; text: string }

let instanz: Promise<D2> | null = null;

function d2(): Promise<D2> {
  instanz ??= import("@d2lang/d2").then(m => new m.D2());
  return instanz;
}

/** D2 meldet Fehler als JSON-Liste `[{range, errmsg: "index:3:5: …"}]`. */
export function fehlerLesen(e: unknown): D2Fehler[] {
  const text = e instanceof Error ? e.message : String(e);
  try {
    const liste = JSON.parse(text) as { errmsg?: string }[];
    if (Array.isArray(liste)) {
      return liste.map(f => {
        const m = /^[^:]*:(\d+):\d+:\s*(.*)$/.exec(f.errmsg ?? "");
        return m ? { zeile: Number(m[1]), text: m[2] } : { text: f.errmsg ?? text };
      });
    }
  } catch { /* kein JSON */ }
  return [{ text }];
}

/** Entfernt Skripte, Ereignis-Attribute und javascript:-Links aus dem SVG. */
export function entschaerfen(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  doc.querySelectorAll("script, iframe, object, embed").forEach(n => n.remove());
  doc.querySelectorAll("*").forEach(el => {
    for (const a of [...el.attributes]) {
      if (/^on/i.test(a.name)) el.removeAttribute(a.name);
      else if (/href$/i.test(a.name) && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    }
  });
  return new XMLSerializer().serializeToString(doc.documentElement);
}

export async function zeichne(code: string): Promise<Ergebnis> {
  const d = await d2();
  const r = await d.compile(code);
  const roh = await d.render(r.diagram, { ...r.renderOptions, noXMLTag: true });
  return {
    svg: entschaerfen(roh),
    formen: r.diagram.shapes.map(s => ({ id: s.id, label: (s as { label?: string }).label ?? s.id })),
    verbindungen: r.diagram.connections.map(c => ({ id: c.id, src: c.src, dst: c.dst })),
  };
}
