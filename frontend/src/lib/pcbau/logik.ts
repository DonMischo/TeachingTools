/**
 * PC-Werkstatt: Einbauen, Ausbauen, Kabel stecken, Einschalten — reine
 * Funktionen über einem Bau-Stand, damit Test und Oberfläche dasselbe rechnen.
 */
import type { Bau, Bedingung, Geraet, Kabel, Port, Pruefung, Teil } from "./typen";

export const teil = (g: Geraet, id: string) => g.teile.find(t => t.id === id);
export const kabel = (g: Geraet, id: string) => g.kabel.find(k => k.id === id);

/** Port samt Teil und absoluter Lage. */
export function port(g: Geraet, id: string): { teil: Teil; port: Port; x: number; y: number } | undefined {
  for (const t of g.teile) {
    const p = t.ports?.find(q => q.id === id);
    if (p) return { teil: t, port: p, x: t.rect.x + p.x, y: t.rect.y + p.y };
  }
  return undefined;
}

export function teilDrin(g: Geraet, bau: Bau, id: string): boolean {
  const t = teil(g, id);
  if (!t) return false;
  if (t.auf && !teilDrin(g, bau, t.auf)) return false;
  return !!t.fest || bau.drin.includes(id);
}

export const kabelDrin = (bau: Bau, id: string) => (bau.stecker[id]?.length ?? 0) === 2;

/** Teil oder Kabel vollständig drin. */
export const istDrin = (g: Geraet, bau: Bau, id: string) =>
  kabel(g, id) ? kabelDrin(bau, id) : teilDrin(g, bau, id);

/** Was in der Teilekiste liegt. */
export const kisteTeile = (g: Geraet) => g.teile.filter(t => !t.fest);

/** Warum ein Teil (noch) nicht hinein kann — oder null. */
export function hindernis(g: Geraet, bau: Bau, id: string): string | null {
  const t = teil(g, id);
  if (!t || t.fest) return "Das Teil ist schon fest eingebaut.";
  if (bau.drin.includes(id)) return `${t.name} ist schon eingebaut.`;
  const fehlt = (t.braucht ?? []).filter(b => !teilDrin(g, bau, b));
  if (fehlt.length) return `Erst ${fehlt.map(f => teil(g, f)?.name ?? f).join(" und ")} einbauen.`;
  return null;
}

export function einbauen(g: Geraet, bau: Bau, id: string, antwort?: number): Bau {
  if (hindernis(g, bau, id)) return bau;
  const antworten = antwort === undefined ? bau.antworten : { ...bau.antworten, [id]: antwort };
  return { ...bau, drin: [...bau.drin, id], antworten };
}

/** Baut das Teil aus, dazu alles, was darauf aufbaut, und die Kabel an seinen Anschlüssen. */
export function ausbauen(g: Geraet, bau: Bau, id: string): Bau {
  const weg = new Set([id]);
  let mehr = true;
  while (mehr) {
    mehr = false;
    for (const t of g.teile) {
      if (weg.has(t.id)) continue;
      if ((t.braucht ?? []).some(b => weg.has(b)) || (t.auf && weg.has(t.auf))) { weg.add(t.id); mehr = true; }
    }
  }
  const stecker: Bau["stecker"] = {};
  for (const [k, ps] of Object.entries(bau.stecker)) {
    const bleibt = ps.filter(p => !weg.has(port(g, p)?.teil.id ?? ""));
    if (bleibt.length) stecker[k] = bleibt;
  }
  const antworten = { ...bau.antworten };
  for (const w of weg) delete antworten[w];
  for (const k of Object.keys(antworten)) if (kabel(g, k) && !kabelDrin({ ...bau, stecker }, k)) delete antworten[k];
  return { drin: bau.drin.filter(d => !weg.has(d)), stecker, antworten };
}

export function kabelAbziehen(bau: Bau, id: string): Bau {
  const stecker = { ...bau.stecker };
  delete stecker[id];
  const antworten = { ...bau.antworten };
  delete antworten[id];
  return { ...bau, stecker, antworten };
}

/** Ports, an denen gerade etwas steckt. */
export function belegt(bau: Bau): Map<string, string> {
  const m = new Map<string, string>();
  for (const [k, ps] of Object.entries(bau.stecker)) for (const p of ps) m.set(p, k);
  return m;
}

export type Steckergebnis = { bau: Bau; ok: boolean; meldung: string; fertig: boolean };

/** Steckt ein Ende des Kabels in den Port — oder sagt, warum nicht. */
export function stecken(g: Geraet, bau: Bau, kabelId: string, portId: string): Steckergebnis {
  const k = kabel(g, kabelId);
  const p = port(g, portId);
  const nein = (meldung: string): Steckergebnis => ({ bau, ok: false, meldung, fertig: false });
  if (!k || !p) return nein("Unbekannter Anschluss.");
  if (!teilDrin(g, bau, p.teil.id)) return nein(`Erst ${p.teil.name} einbauen.`);
  const schon = bau.stecker[kabelId] ?? [];
  if (schon.includes(portId)) return nein("Da steckt das Kabel schon.");
  const andres = belegt(bau).get(portId);
  if (andres) return nein(`Da steckt schon: ${kabel(g, andres)?.name}.`);
  const offen = k.enden.filter(e => !e.some(x => schon.includes(x)));
  if (!offen.some(e => e.includes(portId))) {
    if (k.enden.some(e => e.includes(portId))) return nein(`Dieses Ende steckt schon — jetzt fehlt das andere Ende von: ${k.name}.`);
    return nein(`Passt nicht: Das ist ${p.port.name}.`);
  }
  const stecker = { ...bau.stecker, [kabelId]: [...schon, portId] };
  const fertig = stecker[kabelId].length === 2;
  return { bau: { ...bau, stecker }, ok: true, meldung: fertig ? `${k.name} sitzt.` : `${k.name}: ein Ende steckt.`, fertig };
}

/** Die beiden Kästen, die ein Kabel im Schaltplan verbindet. */
export const kabelKnoten = (g: Geraet, k: Kabel): [string, string] =>
  k.schema ?? [port(g, k.enden[0][0])?.teil.id ?? "", port(g, k.enden[1][0])?.teil.id ?? ""];

/** Im Schaltplan: Kabel an einen Kasten stecken — der passende freie Port wird gewählt. */
export function steckenAnKnoten(g: Geraet, bau: Bau, kabelId: string, teilId: string): Steckergebnis {
  const k = kabel(g, kabelId)!;
  const knoten = kabelKnoten(g, k);
  let letztes: Steckergebnis | null = null;
  for (let i = 0; i < 2; i++) {
    if (knoten[i] !== teilId) continue;
    for (const p of k.enden[i]) {
      const r = stecken(g, bau, kabelId, p);
      if (r.ok) return r;
      letztes = r;
    }
  }
  return letztes ?? { bau, ok: false, meldung: `${k.name} gehört nicht an: ${teil(g, teilId)?.name}.`, fertig: false };
}

export function antwortRichtig(g: Geraet, bau: Bau, id: string): boolean {
  const f = (teil(g, id) ?? kabel(g, id))?.frage;
  if (!f) return true;
  const a = bau.antworten[id];
  return a !== undefined && !!f.optionen[a]?.richtig;
}

export function trifftZu(g: Geraet, bau: Bau, b: Bedingung): boolean {
  if ("fehlt" in b) return !istDrin(g, bau, b.fehlt);
  if ("drin" in b) return istDrin(g, bau, b.drin);
  if ("falsch" in b) return istDrin(g, bau, b.falsch) && !antwortRichtig(g, bau, b.falsch);
  if ("teilweise" in b) {
    const n = b.teilweise.filter(id => istDrin(g, bau, id)).length;
    return n > 0 && n < b.teilweise.length;
  }
  return b.keins.every(id => !istDrin(g, bau, id));
}

export type Startergebnis =
  | { stufe: "ok"; warnungen: Pruefung[] }
  | { stufe: Exclude<Pruefung["stufe"], "warnung">; pruefung: Pruefung };

/** Einschalten: die erste zutreffende Störung gewinnt, Warnungen sammeln sich. */
export function einschalten(g: Geraet, bau: Bau): Startergebnis {
  const warnungen: Pruefung[] = [];
  for (const p of g.pruefungen) {
    if (!p.wenn.every(b => trifftZu(g, bau, b))) continue;
    if (p.stufe === "warnung") warnungen.push(p);
    else return { stufe: p.stufe, pruefung: p };
  }
  return { stufe: "ok", warnungen };
}

/** Alles Nötige drin und richtig beantwortet. */
export function vollstaendig(g: Geraet, bau: Bau): boolean {
  return kisteTeile(g).every(t => t.optional || (teilDrin(g, bau, t.id) && antwortRichtig(g, bau, t.id)))
    && g.kabel.every(k => k.optional || (kabelDrin(bau, k.id) && antwortRichtig(g, bau, k.id)));
}

/** Der nächste sinnvolle Schritt — für den Tipp-Knopf. */
export function tipp(g: Geraet, bau: Bau): { art: "teil" | "kabel"; id: string } | null {
  for (const t of kisteTeile(g)) if (!t.optional && !bau.drin.includes(t.id) && !hindernis(g, bau, t.id)) return { art: "teil", id: t.id };
  for (const k of g.kabel) {
    if (k.optional || kabelDrin(bau, k.id)) continue;
    const bereit = k.enden.every(e => e.some(p => { const q = port(g, p); return q && teilDrin(g, bau, q.teil.id); }));
    if (bereit) return { art: "kabel", id: k.id };
  }
  return null;
}

/** Ein fertiger, richtiger Bau — für »Erkennen« und Tests. */
export function komplett(g: Geraet, mitOptional = true): Bau {
  const bau: Bau = { drin: [], stecker: {}, antworten: {} };
  const richtig = (f: Kabel["frage"]) => f ? f.optionen.findIndex(o => o.richtig) : undefined;
  for (const t of kisteTeile(g)) {
    if (!mitOptional && t.optional) continue;
    bau.drin.push(t.id);
    const r = richtig(t.frage);
    if (r !== undefined) bau.antworten[t.id] = r;
  }
  const besetzt = new Set<string>();
  for (const k of g.kabel) {
    if (!mitOptional && k.optional) continue;
    const ps = k.enden.map(e => e.find(p => !besetzt.has(p) && teilDrin(g, bau, port(g, p)?.teil.id ?? "")));
    if (ps.some(p => !p)) continue;
    for (const p of ps) besetzt.add(p!);
    bau.stecker[k.id] = ps as string[];
    const r = richtig(k.frage);
    if (r !== undefined) bau.antworten[k.id] = r;
  }
  return bau;
}
