/**
 * Programm ⇄ Blockly-Serialisierung (das JSON von `Blockly.serialization.workspaces`).
 *
 * Ohne Blockly selbst: so lässt sich der Wechsel zwischen Kachel- und
 * Blockly-Editor ohne Browser testen. Das Hauptprogramm hängt unter dem
 * Hut »algo_start«, das Unterprogramm unter »algo_fn«; lose Blöcke zählen nicht.
 */
import type { Bedingung, BedingungArt, Befehl, Programm, Richtung } from "./spiel";

export interface BJ {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, string | number>;
  inputs?: Record<string, { block?: BJ }>;
  next?: { block?: BJ };
}

export const bedingungZuWert = (b: Bedingung) => (b.nicht ? `nicht:${b.art}` : b.art);
export function wertZuBedingung(w: string): Bedingung {
  return w.startsWith("nicht:") ? { art: w.slice(6) as BedingungArt, nicht: true } : { art: w as BedingungArt };
}

function kette(liste: Befehl[]): BJ | undefined {
  let erster: BJ | undefined;
  for (let i = liste.length - 1; i >= 0; i--) {
    const b = blockVon(liste[i]);
    if (erster) b.next = { block: erster };
    erster = b;
  }
  return erster;
}

function stmt(liste: Befehl[]) {
  const b = kette(liste);
  return b ? { block: b } : {};
}

function blockVon(b: Befehl): BJ {
  const id = b.id ? { id: b.id } : {};
  switch (b.t) {
    case "geh": return { type: "algo_geh", ...id, fields: { R: String(b.r) } };
    case "wiederhole": return { type: "algo_wiederhole", ...id, fields: { N: b.n }, inputs: { DO: stmt(b.k) } };
    case "bis": return { type: "algo_bis", ...id, fields: { B: bedingungZuWert(b.b) }, inputs: { DO: stmt(b.k) } };
    case "wenn":
      return b.sonst
        ? { type: "algo_wenn_sonst", ...id, fields: { B: bedingungZuWert(b.b) }, inputs: { DO: stmt(b.k), SONST: stmt(b.sonst) } }
        : { type: "algo_wenn", ...id, fields: { B: bedingungZuWert(b.b) }, inputs: { DO: stmt(b.k) } };
    default: return { type: `algo_${b.t}`, ...id };
  }
}

export function zuJson(p: Programm, mitFn: boolean) {
  const start: BJ = { type: "algo_start", x: 20, y: 20, ...(p.haupt.length ? { next: { block: kette(p.haupt)! } } : {}) };
  const bloecke: BJ[] = [start];
  if (mitFn) bloecke.push({ type: "algo_fn", x: 480, y: 20, ...(p.fn.length ? { next: { block: kette(p.fn)! } } : {}) });
  return { blocks: { languageVersion: 0, blocks: bloecke } };
}

function liste(b: BJ | undefined): Befehl[] {
  const aus: Befehl[] = [];
  for (let x = b; x; x = x.next?.block) {
    const e = befehlVon(x);
    if (e) aus.push(e);
  }
  return aus;
}

function befehlVon(b: BJ): Befehl | null {
  const id = b.id ? { id: b.id } : {};
  const innen = (k: string) => liste(b.inputs?.[k]?.block);
  const bed = () => wertZuBedingung(String(b.fields?.B ?? "frei"));
  switch (b.type) {
    case "algo_geh": return { t: "geh", r: (Number(b.fields?.R ?? 1) % 4) as Richtung, ...id };
    case "algo_vor": return { t: "vor", ...id };
    case "algo_links": return { t: "links", ...id };
    case "algo_rechts": return { t: "rechts", ...id };
    case "algo_nimm": return { t: "nimm", ...id };
    case "algo_warte": return { t: "warte", ...id };
    case "algo_rufe": return { t: "rufe", ...id };
    case "algo_wiederhole": return { t: "wiederhole", n: Math.max(1, Math.min(99, Math.round(Number(b.fields?.N ?? 2)))), k: innen("DO"), ...id };
    case "algo_bis": return { t: "bis", b: bed(), k: innen("DO"), ...id };
    case "algo_wenn": return { t: "wenn", b: bed(), k: innen("DO"), ...id };
    case "algo_wenn_sonst": return { t: "wenn", b: bed(), k: innen("DO"), sonst: innen("SONST"), ...id };
    default: return null;
  }
}

export function ausJson(json: unknown): Programm {
  const oben = ((json as { blocks?: { blocks?: BJ[] } })?.blocks?.blocks ?? []);
  const start = oben.find(b => b.type === "algo_start");
  const fn = oben.find(b => b.type === "algo_fn");
  return { haupt: liste(start?.next?.block), fn: liste(fn?.next?.block) };
}
