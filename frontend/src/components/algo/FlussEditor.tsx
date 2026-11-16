"use client";
/**
 * Flussdiagramm-Zeichenfläche (SVG). Modi:
 *   bearbeiten — Formen hinzufügen, ziehen, beschriften, Pfeile setzen
 *   verbinden  — nur Pfeile setzen/ändern (Knoten stehen fest)
 *   lesen      — nur ansehen; Klicks auf Knoten/Pfeile gehen an den Aufrufer
 *
 * Pfeile werden rechtwinklig in »Flussrichtung« geführt: vorwärts gerade,
 * Rücksprünge außen links (waagerecht: oben), Sprünge über andere Kästen auf
 * der anderen Seite. Die waagerechte Ansicht ist nur eine Anzeige: gespeichert
 * wird immer die senkrechte Lage (`kippe` / `zurueckKippen`).
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { alsD2 } from "@/lib/algo/flussD2";
import { THEMEN as D2_THEMEN } from "@/lib/diagramm/vorlagen";
import { useD2Zeichner } from "./D2Kontext";
import { BREITE, LUECKE, TYP_NAME, hoehe, kippe, zurueckKippen, type Diagramm, type Kante, type Knoten, type KnotenTyp } from "@/lib/algo/fluss";

export type Modus = "bearbeiten" | "verbinden" | "lesen";
type Punkt = [number, number];

const W = BREITE / 2;

/**
 * Rechtwinkliger Weg einer Kante. Gerechnet wird in Flusskoordinaten
 * (a = entlang des Ablaufs, c = quer dazu) und am Ende in x/y übersetzt.
 * `nr` verteilt mehrere Umwege nebeneinander.
 */
export function weg(s: Knoten, t: Knoten, alle: Knoten[], nr: number, quer = false): Punkt[] {
  const A = (k: Knoten) => (quer ? k.x : k.y), C = (k: Knoten) => (quer ? k.y : k.x);
  const hA = (k: Knoten) => (quer ? W : hoehe(k) / 2), hC = (k: Knoten) => (quer ? hoehe(k) / 2 : W);
  const P = (c: number, a: number): Punkt => (quer ? [a, c] : [c, a]);
  const ank = (k: Knoten, seite: "vor" | "nach" | "links" | "rechts"): Punkt =>
    seite === "vor" ? P(C(k), A(k) - hA(k)) : seite === "nach" ? P(C(k), A(k) + hA(k)) : seite === "links" ? P(C(k) - hC(k), A(k)) : P(C(k) + hC(k), A(k));

  if (A(t) <= A(s) + 4) {
    const c0 = Math.min(C(s) - hC(s), C(t) - hC(t)) - 22 - nr * 14;
    return [ank(s, "links"), P(c0, A(s)), P(c0, A(t)), ank(t, "links")];
  }
  if (Math.abs(C(t) - C(s)) < 5) {
    const dazwischen = alle.some(k => k !== s && k !== t && Math.abs(C(k) - C(s)) < hC(k) && A(k) > A(s) && A(k) < A(t));
    if (!dazwischen) return [ank(s, "nach"), ank(t, "vor")];
    const c1 = C(s) + hC(s) + 22 + nr * 14, av = A(t) - hA(t) - 16;
    return [ank(s, "rechts"), P(c1, A(s)), P(c1, av), P(C(t), av), ank(t, "vor")];
  }
  if (C(t) > C(s)) return [ank(s, "rechts"), P(C(t), A(s)), ank(t, "vor")];
  const av = A(t) - hA(t) - 16;
  return [ank(s, "nach"), P(C(s), av), P(C(t), av), ank(t, "vor")];
}

function mitte(p: Punkt[]): Punkt {
  const laengen = p.slice(1).map((q, i) => Math.hypot(q[0] - p[i][0], q[1] - p[i][1]));
  let rest = laengen.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < laengen.length; i++) {
    if (rest <= laengen[i]) {
      const f = laengen[i] ? rest / laengen[i] : 0;
      return [p[i][0] + (p[i + 1][0] - p[i][0]) * f, p[i][1] + (p[i + 1][1] - p[i][1]) * f];
    }
    rest -= laengen[i];
  }
  return p[0];
}

function zeilen(text: string, max = 20, anzahl = 3): string[] {
  const aus: string[] = [];
  let z = "";
  for (const w of text.split(/\s+/)) {
    if ((z + " " + w).trim().length > max && z) { aus.push(z); z = w; } else z = (z + " " + w).trim();
  }
  if (z) aus.push(z);
  return aus.slice(0, anzahl);
}

export function Form({ typ, x, y, h, stil, unbekannt, b = BREITE }: { typ: KnotenTyp; x: number; y: number; h: number; stil: CSSProperties; unbekannt?: boolean; b?: number }) {
  const w = b / 2;
  if (unbekannt) return <rect x={x - w} y={y - h / 2} width={b} height={h} rx={6} style={{ ...stil, strokeDasharray: "6 4" }} />;
  if (typ === "start" || typ === "ende") return <rect x={x - w} y={y - h / 2} width={b} height={h} rx={h / 2} style={stil} />;
  if (typ === "aktion") return <rect x={x - w} y={y - h / 2} width={b} height={h} rx={3} style={stil} />;
  if (typ === "io") return <polygon points={`${x - w + 14},${y - h / 2} ${x + w},${y - h / 2} ${x + w - 14},${y + h / 2} ${x - w},${y + h / 2}`} style={stil} />;
  return <polygon points={`${x},${y - h / 2} ${x + w},${y} ${x},${y + h / 2} ${x - w},${y}`} style={stil} />;
}

export const FUELLUNG: Record<KnotenTyp, string> = {
  start: "#fde68a", ende: "#fde68a", aktion: "#bfdbfe", io: "#bbf7d0", entscheidung: "#fecaca",
};

/** Knopf, der die Form selbst zeigt — der Name steht in der Figur (z. B. »Start« im Oval). */
export function FormKnopf({ typ, text, onClick, an }: { typ: KnotenTyp; text: string; onClick: () => void; an?: boolean }) {
  const h = typ === "entscheidung" ? 50 : 36;
  return (
    <button type="button" onClick={onClick} title={TYP_NAME[typ]}
      className={`rounded-lg p-0.5 transition-transform active:scale-95 ${an ? "ring-2 ring-accent" : "hover:bg-surface-hover"}`}>
      <svg viewBox={`0 0 132 ${h + 4}`} width={132} height={h + 4} aria-hidden>
        <Form typ={typ} x={66} y={h / 2 + 2} h={h} b={128} stil={{ fill: FUELLUNG[typ], stroke: "#334155", strokeWidth: 2 }} />
        <text x={66} y={h / 2 + 6} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: "#0f172a" }}>{text}</text>
      </svg>
      <span className="sr-only">{text}</span>
    </button>
  );
}

const RICHTUNG_KEY = "hp_algo_fluss_waagerecht";
const D2_KEY = "hp_algo_fluss_d2";

interface D2Wahl { an: boolean; theme: number; skizze: boolean }

/** Die D2-Ansicht: dasselbe Diagramm, gesetzt und gezeichnet von D2 (Themen, Skizzenstil). Nur zum Ansehen. */
function D2Ansicht({ d, wahl, quer, aktiv, markiert }: { d: Diagramm; wahl: D2Wahl; quer: boolean; aktiv?: string; markiert?: string[] }) {
  const zeichne = useD2Zeichner();
  const code = useMemo(() => alsD2(d, { theme: wahl.theme, skizze: wahl.skizze, quer, aktiv, markiert }), [d, wahl.theme, wahl.skizze, quer, aktiv, markiert]);
  const [svg, setSvg] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const lauf = useRef(0);
  useEffect(() => {
    if (!zeichne) return;
    const nr = ++lauf.current;
    const t = setTimeout(() => {
      zeichne(code)
        .then(r => { if (nr === lauf.current) { setSvg(r.svg); setFehler(null); } })
        .catch(e => { if (nr === lauf.current) setFehler(e instanceof Error ? e.message : String(e)); });
    }, 150);
    return () => clearTimeout(t);
  }, [code, zeichne]);
  const dunkel = D2_THEMEN.find(t => t.id === wahl.theme)?.dunkel;
  return (
    <div className={`overflow-auto rounded-xl border border-line p-3 ${dunkel ? "bg-[#1e1e2e]" : "bg-white"}`} style={{ maxHeight: "70vh" }} data-testid="fluss-d2">
      {fehler && <p className="text-sm text-bad">D2 konnte nicht zeichnen: {fehler}</p>}
      {!svg && !fehler && <p className="text-sm text-slate-500 p-6 text-center">D2 wird geladen …</p>}
      {/* entschärftes SVG aus lib/diagramm/d2laufzeit */}
      {svg && <div className="[&>svg]:max-w-full [&>svg]:h-auto [&>svg]:mx-auto" dangerouslySetInnerHTML={{ __html: svg }} />}
    </div>
  );
}

export default function FlussEditor({
  d, onChange, modus, aktiv, formen, markiertKante, markiertKnoten, onKnotenKlick, onKanteKlick, kommentare: kommentareStart = false, pfeilStart = false,
}: {
  d: Diagramm;
  onChange?: (d: Diagramm) => void;
  modus: Modus;
  /** Knoten, an dem der Ablauf gerade steht */
  aktiv?: string;
  /** Formen-Aufgabe: gewählte Form je Knoten (null = noch offen) — überdeckt den echten Typ */
  formen?: Record<string, KnotenTyp | null>;
  markiertKante?: { i: number; ok: boolean } | null;
  markiertKnoten?: string[];
  onKnotenKlick?: (id: string) => void;
  onKanteKlick?: (i: number) => void;
  /** Erklärungen als Randnotizen zeigen (sonst nur beim Darüberfahren) */
  kommentare?: boolean;
  /** Pfeil-Modus von Anfang an eingeschaltet */
  pfeilStart?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const [wahl, setWahl] = useState<{ knoten?: string; kante?: number }>({});
  const [verbindeVon, setVerbindeVon] = useState<string | null>(null);
  const [pfeilModus, setPfeilModus] = useState(pfeilStart);
  const [ueber, setUeber] = useState<number | null>(null);
  const [quer, setQuer] = useState(false);
  const [kommentare, setKommentare] = useState(kommentareStart);
  useEffect(() => { try { setQuer(localStorage.getItem(RICHTUNG_KEY) === "1"); } catch { /* senkrecht */ } }, []);
  const zug = useRef<{ id: string; dx: number; dy: number; bewegt: boolean } | null>(null);
  // Ein neuer Kasten wird in den sichtbaren Bereich gerollt
  const [zeigen, setZeigen] = useState<string | null>(null);
  useEffect(() => {
    if (!zeigen) return;
    svg.current?.querySelector(`[data-testid="knoten-${zeigen}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    setZeigen(null);
  }, [zeigen, d]);
  const darfVerbinden = modus !== "lesen";
  const darfZiehen = modus !== "lesen" && !pfeilModus;
  // D2-Ansicht: nur, wenn die Seite D2 mitbringt und keine Klick-Aufgabe läuft (die braucht die eigene Zeichnung)
  const zeichner = useD2Zeichner();
  const d2Moeglich = !!zeichner && !formen && !onKnotenKlick && !onKanteKlick;
  const [d2, setD2] = useState<D2Wahl>({ an: false, theme: 0, skizze: false });
  useEffect(() => { try { const w = JSON.parse(localStorage.getItem(D2_KEY) ?? "null"); if (w && typeof w.theme === "number") setD2({ an: !!w.an, theme: w.theme, skizze: !!w.skizze }); } catch { /* aus */ } }, []);
  const setzeD2 = (w: D2Wahl) => { setD2(w); try { localStorage.setItem(D2_KEY, JSON.stringify(w)); } catch { /* egal */ } };
  const d2An = d2Moeglich && d2.an;
  const hatErklaerung = d.knoten.some(k => k.erklaerung);

  // Angezeigt wird ggf. gekippt; Änderungen gehen in senkrechter Lage hinaus.
  const anzeige = useMemo(() => (quer ? kippe(d) : d), [d, quer]);
  const aendere = (neu: Diagramm) => onChange?.(quer ? zurueckKippen(neu) : neu);

  const wege = useMemo(() => {
    const knoten = new Map(anzeige.knoten.map(k => [k.id, k]));
    const A = (k: Knoten) => (quer ? k.x : k.y);
    const spanne = anzeige.kanten.map((e, i) => ({ i, s: Math.abs(A(knoten.get(e.nach) ?? anzeige.knoten[0]) - A(knoten.get(e.von) ?? anzeige.knoten[0])) }))
      .sort((a, b) => a.s - b.s);
    const nr = new Map<number, number>();
    let rueck = 0, umweg = 0;
    for (const { i } of spanne) {
      const s = knoten.get(anzeige.kanten[i].von), t = knoten.get(anzeige.kanten[i].nach);
      if (s && t) nr.set(i, A(t) <= A(s) + 4 ? rueck++ : umweg++);
    }
    return anzeige.kanten.map((e, i) => {
      const s = knoten.get(e.von), t = knoten.get(e.nach);
      return s && t ? weg(s, t, anzeige.knoten, nr.get(i) ?? 0, quer) : null;
    });
  }, [anzeige, quer]);

  // Randnotizen: rechts neben dem Diagramm (waagerecht: darunter), je Knoten mit Erklärung
  const notizen = useMemo(() => {
    if (!kommentare) return [];
    const mitErkl = anzeige.knoten.filter(k => k.erklaerung);
    if (quer) {
      const unten = Math.max(...anzeige.knoten.map(k => k.y + hoehe(k) / 2)) + 50;
      return mitErkl.map(k => ({ k, x: k.x - W, y: unten, b: BREITE + 40, zeilen: zeilen(k.erklaerung!, 30, 7) }));
    }
    const rechts = Math.max(...anzeige.knoten.map(k => k.x + W)) + 70;
    return mitErkl.map(k => ({ k, x: rechts, y: k.y - 30, b: 290, zeilen: zeilen(k.erklaerung!, 44, 5) }));
  }, [kommentare, anzeige, quer]);

  // Rahmen: alles, was gezeichnet wird, plus Rand — so wird nichts abgeschnitten.
  const rahmen = useMemo(() => {
    const xs: number[] = [], ys: number[] = [];
    for (const k of anzeige.knoten) { xs.push(k.x - W, k.x + W); ys.push(k.y - hoehe(k) / 2, k.y + hoehe(k) / 2); }
    for (const p of wege) for (const [x, y] of p ?? []) { xs.push(x); ys.push(y); }
    for (const n of notizen) { xs.push(n.x, n.x + n.b); ys.push(n.y, n.y + 16 + n.zeilen.length * 15); }
    if (!xs.length) return { x: 0, y: 0, b: 640, h: 380 };
    const x0 = Math.min(...xs) - 40, y0 = Math.min(...ys) - 30;
    return { x: x0, y: y0, b: Math.max(640, Math.max(...xs) + 90 - x0), h: Math.max(380, Math.max(...ys) + 60 - y0) };
  }, [anzeige, wege, notizen]);

  const punkt = (e: RPointerEvent): Punkt => {
    const m = svg.current?.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };

  const verbinde = (vonId: string, nachId: string) => {
    const von = anzeige.knoten.find(k => k.id === vonId)!;
    const vorhanden = anzeige.kanten.filter(e => e.von === vonId);
    let kanten: Kante[];
    if (von.typ === "entscheidung") {
      const marke: "ja" | "nein" = vorhanden.some(e => e.marke === "ja") ? "nein" : "ja";
      kanten = [...anzeige.kanten.filter(e => !(e.von === vonId && e.marke === marke)), { von: vonId, nach: nachId, marke }];
    } else {
      // Ein Pfeil je Kasten: der neue ersetzt den alten
      kanten = [...anzeige.kanten.filter(e => e.von !== vonId), { von: vonId, nach: nachId }];
    }
    aendere({ ...anzeige, kanten });
  };

  const knotenKlick = (id: string) => {
    const k = anzeige.knoten.find(x => x.id === id)!;
    if (verbindeVon) {
      if (verbindeVon !== id) verbinde(verbindeVon, id);
      setVerbindeVon(null);
      return;
    }
    if (pfeilModus && darfVerbinden) {
      if (k.typ !== "ende") setVerbindeVon(id);
      return;
    }
    setWahl({ knoten: id });
    onKnotenKlick?.(id);
  };

  /** ja ⇄ nein an einer Raute: der andere Pfeil derselben Raute tauscht mit, damit beide eindeutig bleiben */
  const tauscheMarke = (i: number) => {
    const e = anzeige.kanten[i];
    if (!e?.marke) return;
    const neu = e.marke === "ja" ? "nein" : "ja";
    aendere({ ...anzeige, kanten: anzeige.kanten.map((x, j) => (j === i ? { ...x, marke: neu } : x.von === e.von && x.marke === neu ? { ...x, marke: e.marke } : x)) });
  };

  const kanteKlick = (i: number) => {
    if (pfeilModus && darfVerbinden) {
      aendere({ ...anzeige, kanten: anzeige.kanten.filter((_, j) => j !== i) });
      setUeber(null);
      return;
    }
    setWahl({ kante: i });
    onKanteKlick?.(i);
  };

  const gewaehlt = anzeige.knoten.find(k => k.id === wahl.knoten);
  const kante: Kante | undefined = wahl.kante !== undefined ? anzeige.kanten[wahl.kante] : undefined;

  const neuerKnoten = (typ: KnotenTyp) => {
    const id = `n${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const text = typ === "start" ? "Start" : typ === "ende" ? "Ende" : typ === "entscheidung" ? "Frage?" : typ === "io" ? "Ein-/Ausgabe" : "Anweisung";
    // In senkrechter Lage unter dem letzten Kasten vor dem Ende einfügen; das Ende rückt nach unten (die Anzeige kippt mit)
    const ohneEnde = d.knoten.filter(k => k.typ !== "ende" || typ === "ende");
    const y = Math.max(-52, ...ohneEnde.map(k => k.y)) + 92;
    const knoten = d.knoten.map(k => (typ !== "ende" && k.typ === "ende" && k.y < y + 92 ? { ...k, y: y + 92 } : k));
    onChange?.({ ...d, knoten: [...knoten, { id, typ, text, x: 110, y }] });
    setWahl({ knoten: id });
    setZeigen(id);
  };

  const loeschen = () => {
    if (gewaehlt) aendere({ knoten: anzeige.knoten.filter(k => k.id !== gewaehlt.id), kanten: anzeige.kanten.filter(e => e.von !== gewaehlt.id && e.nach !== gewaehlt.id) });
    else if (wahl.kante !== undefined) aendere({ ...anzeige, kanten: anzeige.kanten.filter((_, i) => i !== wahl.kante) });
    setWahl({});
  };

  const setzeKnoten = (patch: Partial<Knoten>) =>
    gewaehlt && aendere({ ...anzeige, knoten: anzeige.knoten.map(k => (k.id === gewaehlt.id ? { ...k, ...patch } : k)) });

  const schalter = (an: boolean) => `text-xs px-2.5 py-1.5 rounded-lg border font-bold ${an ? "bg-accent text-accent-fg border-transparent" : "border-line text-muted hover:text-fg"}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 items-center">
        {modus === "bearbeiten" && !d2An && (["start", "aktion", "io", "entscheidung", "ende"] as KnotenTyp[]).map(t => (
          <FormKnopf key={t} typ={t} text={t === "start" ? "Start" : t === "ende" ? "Ende" : TYP_NAME[t]} onClick={() => neuerKnoten(t)} />
        ))}
        <span className="ml-auto flex flex-wrap gap-1.5">
          {darfVerbinden && !d2An && (
            <button type="button" className={schalter(pfeilModus)} onClick={() => { setPfeilModus(!pfeilModus); setVerbindeVon(null); }}
              title="Pfeil-Modus: erst Startkasten, dann Zielkasten anklicken; ein Klick auf einen Pfeil löscht ihn">
              ➜ Pfeil-Modus {pfeilModus ? "an" : "aus"}
            </button>
          )}
          {hatErklaerung && <button type="button" className={schalter(kommentare)} onClick={() => setKommentare(!kommentare)}>💬 Notizen</button>}
          <button type="button" className={schalter(quer)} title="Ablauf von oben nach unten oder von links nach rechts"
            onClick={() => { const neu = !quer; setQuer(neu); try { localStorage.setItem(RICHTUNG_KEY, neu ? "1" : "0"); } catch { /* egal */ } }}>
            {quer ? "↔ waagerecht" : "↕ senkrecht"}
          </button>
          {d2Moeglich && (
            <button type="button" className={schalter(d2.an)} title="Das Diagramm von D2 setzen und zeichnen lassen — mit Farbthemen und Skizzenstil (nur zum Ansehen)"
              onClick={() => setzeD2({ ...d2, an: !d2.an })}>🎨 D2-Ansicht</button>
          )}
        </span>
      </div>
      {verbindeVon
        ? <p className="text-sm text-accent font-bold">➜ Jetzt den Kasten anklicken, zu dem der Pfeil zeigen soll. (Esc oder Klick ins Leere bricht ab.)</p>
        : pfeilModus && darfVerbinden && <p className="text-xs text-muted">Pfeil-Modus: Kasten anklicken, dann den Zielkasten. Am Pfeil: 🗑 löscht ihn, ⇄ tauscht »ja« und »nein«. Bei einer Raute wird der erste Pfeil »ja«, der zweite »nein«.</p>}
      {d2An && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5">Thema
            <select className="input !py-1 text-xs" value={d2.theme} onChange={e => setzeD2({ ...d2, theme: Number(e.target.value) })}>
              {D2_THEMEN.map(t => <option key={t.id} value={t.id}>{t.name}{t.dunkel ? " (dunkel)" : ""}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={d2.skizze} onChange={e => setzeD2({ ...d2, skizze: e.target.checked })} /> ✏️ Handgezeichnet</label>
          {modus !== "lesen" && <span className="text-muted">Zum Bearbeiten die D2-Ansicht ausschalten.</span>}
        </div>
      )}
      {d2An && <D2Ansicht d={d} wahl={d2} quer={quer} aktiv={aktiv} markiert={markiertKnoten} />}
      <div className={`overflow-auto rounded-xl border border-line bg-white ${d2An ? "hidden" : ""}`} style={{ maxHeight: "70vh" }}
        onKeyDown={e => { if (e.key === "Escape") setVerbindeVon(null); if (e.key === "Delete" && (modus === "bearbeiten" || (modus === "verbinden" && kante))) loeschen(); }} tabIndex={0}>
        <svg ref={svg} viewBox={`${rahmen.x} ${rahmen.y} ${rahmen.b} ${rahmen.h}`} width={rahmen.b} height={rahmen.h}
          className="block select-none touch-none" data-testid="fluss-flaeche"
          onPointerDown={() => { setWahl({}); setVerbindeVon(null); }}
          onPointerMove={e => {
            const z = zug.current;
            if (!z || !darfZiehen) return;
            const [px, py] = punkt(e);
            const x = Math.round((px - z.dx) / 10) * 10, y = Math.round((py - z.dy) / 10) * 10;
            z.bewegt = true;
            aendere({ ...anzeige, knoten: anzeige.knoten.map(k => (k.id === z.id ? { ...k, x, y } : k)) });
          }}
          onPointerUp={() => { zug.current = null; }}>
          <defs>
            <marker id={`pf${uid}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: "#334155" }} />
            </marker>
          </defs>
          {notizen.map(n => {
            const k = n.k, h = 16 + n.zeilen.length * 15;
            const [ax, ay] = quer ? [k.x, k.y + hoehe(k) / 2] : [k.x + W, k.y];
            const [bx, by] = quer ? [k.x, n.y] : [n.x, n.y + h / 2];
            return (
              <g key={`n${k.id}`} style={{ pointerEvents: "none" }}>
                <line x1={ax} y1={ay} x2={bx} y2={by} style={{ stroke: "#ca8a04", strokeWidth: 1.5, strokeDasharray: "4 4" }} />
                <rect x={n.x} y={n.y} width={n.b} height={h} rx={8} style={{ fill: k.id === aktiv ? "#fde68a" : "#fef9c3", stroke: "#ca8a04", strokeWidth: 1 }} />
                {n.zeilen.map((z, j) => (
                  <text key={j} x={n.x + 10} y={n.y + 20 + j * 15} style={{ fontSize: 11.5, fill: "#422006" }}>{z}</text>
                ))}
              </g>
            );
          })}
          {wege.map((p, i) => {
            if (!p) return null;
            const e = anzeige.kanten[i];
            const pfad = p.map(([x, y], j) => `${j ? "L" : "M"}${x},${y}`).join(" ");
            const an = wahl.kante === i || markiertKante?.i === i;
            const loeschbar = pfeilModus && darfVerbinden && ueber === i;
            const raus = () => setUeber(u => (u === i ? null : u));
            const farbe = markiertKante?.i === i ? (markiertKante.ok ? "#16a34a" : "#dc2626") : loeschbar ? "#dc2626" : an ? "#2563eb" : "#334155";
            const [lx, ly] = p[0], [nx, ny] = p[1];
            const rx = lx + (nx > lx ? 10 : nx < lx ? -28 : 6), ry = ly + (ny > ly ? 14 : ny < ly ? -5 : -6);
            const [mx, my] = mitte(p);
            return (
              <g key={`e${i}`}>
                <path d={pfad} style={{ fill: "none", stroke: farbe, strokeWidth: an || loeschbar ? 3 : 2 }} markerEnd={`url(#pf${uid})`} />
                <path d={pfad} style={{ fill: "none", stroke: "transparent", strokeWidth: 18, cursor: loeschbar ? "pointer" : "pointer" }}
                  onPointerEnter={() => setUeber(i)} onPointerLeave={raus}
                  onPointerDown={ev => { ev.stopPropagation(); kanteKlick(i); }} />
                {e.marke && (
                  <text x={rx} y={ry} style={{ fontSize: 12, fontWeight: 700, fill: e.marke === "ja" ? "#15803d" : "#b91c1c", cursor: "pointer", pointerEvents: darfVerbinden ? undefined : "none" }}
                    onPointerDown={ev => { ev.stopPropagation(); tauscheMarke(i); }}>
                    {darfVerbinden && <title>Klick: »ja« und »nein« tauschen</title>}{e.marke}
                  </text>
                )}
                {loeschbar && (
                  <g onPointerEnter={() => setUeber(i)} onPointerLeave={raus} style={{ cursor: "pointer" }}>
                    <g onPointerDown={ev => { ev.stopPropagation(); kanteKlick(i); }}>
                      <title>Pfeil löschen</title>
                      <circle cx={mx} cy={my} r={13} style={{ fill: "#fee2e2", stroke: "#dc2626", strokeWidth: 1.5 }} />
                      <text x={mx} y={my + 5} textAnchor="middle" style={{ fontSize: 14, pointerEvents: "none" }}>🗑</text>
                    </g>
                    {e.marke && (
                      <g onPointerDown={ev => { ev.stopPropagation(); tauscheMarke(i); }}>
                        <title>»ja« und »nein« tauschen</title>
                        <circle cx={mx + 30} cy={my} r={13} style={{ fill: "#dbeafe", stroke: "#2563eb", strokeWidth: 1.5 }} />
                        <text x={mx + 30} y={my + 5} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: "#1d4ed8", pointerEvents: "none" }}>⇄</text>
                      </g>
                    )}
                  </g>
                )}
              </g>
            );
          })}
          {anzeige.knoten.map(k => {
            const h = hoehe(k);
            const form = formen ? formen[k.id] : k.typ;
            const markiert = markiertKnoten?.includes(k.id);
            const quelle = verbindeVon === k.id;
            const stil = {
              fill: form ? FUELLUNG[form] : "#f1f5f9",
              stroke: k.id === aktiv ? "#f59e0b" : markiert ? "#dc2626" : quelle || wahl.knoten === k.id ? "#2563eb" : "#334155",
              strokeWidth: k.id === aktiv || markiert || quelle || wahl.knoten === k.id ? 4 : 2,
              cursor: pfeilModus && darfVerbinden ? "crosshair" : darfZiehen || onKnotenKlick ? "pointer" : "default",
              ...(k.text === LUECKE ? { strokeDasharray: "6 4", fill: "#f8fafc" } : {}),
            };
            const z = zeilen(k.text);
            return (
              <g key={k.id} data-testid={`knoten-${k.id}`}
                onPointerDown={ev => {
                  ev.stopPropagation();
                  if (darfZiehen && !verbindeVon) {
                    const [px, py] = punkt(ev);
                    zug.current = { id: k.id, dx: px - k.x, dy: py - k.y, bewegt: false };
                  }
                }}
                onPointerUp={ev => { ev.stopPropagation(); const z = zug.current; zug.current = null; if (!z?.bewegt) knotenKlick(k.id); }}>
                {k.erklaerung && <title>{k.erklaerung}</title>}
                <Form typ={form ?? "aktion"} x={k.x} y={k.y} h={h} stil={stil} unbekannt={formen !== undefined && !form} />
                {z.map((zeile, j) => (
                  <text key={j} x={k.x} y={k.y + (j - (z.length - 1) / 2) * 14 + 4} textAnchor="middle"
                    style={{ fontSize: 12, fill: "#0f172a", pointerEvents: "none" }}>{zeile}</text>
                ))}
                {k.erklaerung && !kommentare && (
                  <text x={k.x + W - 10} y={k.y - h / 2 + 12} textAnchor="middle" style={{ fontSize: 11, pointerEvents: "none" }}>💬</text>
                )}
                {darfVerbinden && !pfeilModus && wahl.knoten === k.id && k.typ !== "ende" && (
                  <g onPointerDown={ev => { ev.stopPropagation(); }} onPointerUp={ev => { ev.stopPropagation(); setVerbindeVon(k.id); }} style={{ cursor: "crosshair" }}>
                    <circle cx={k.x + W - 4} cy={k.y + h / 2} r={11} style={{ fill: "#2563eb" }} />
                    <text x={k.x + W - 4} y={k.y + h / 2 + 4} textAnchor="middle" style={{ fontSize: 12, fill: "white", pointerEvents: "none" }}>➜</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {modus !== "lesen" && !pfeilModus && !d2An && (gewaehlt || kante) && (
        <div className="card p-3 flex flex-wrap items-end gap-3 text-sm">
          {gewaehlt && modus === "bearbeiten" && (
            <>
              <label className="flex flex-col gap-1 flex-1 min-w-48">
                <span className="label">Text</span>
                <input className="input" value={gewaehlt.text === LUECKE ? "" : gewaehlt.text} placeholder={gewaehlt.text === LUECKE ? "Lücke ausfüllen …" : undefined}
                  autoFocus={gewaehlt.text === LUECKE} onChange={e => setzeKnoten({ text: e.target.value })} />
              </label>
              <div className="flex flex-col gap-1">
                <span className="label">Form</span>
                <div className="flex flex-wrap gap-0.5">
                  {(["start", "ende", "aktion", "io", "entscheidung"] as KnotenTyp[]).map(t => (
                    <FormKnopf key={t} typ={t} text={t === "start" ? "Start" : t === "ende" ? "Ende" : TYP_NAME[t]} an={gewaehlt.typ === t} onClick={() => setzeKnoten({ typ: t })} />
                  ))}
                </div>
              </div>
              {gewaehlt.typ !== "start" && gewaehlt.typ !== "ende" && (
                <label className="flex flex-col gap-1 min-w-40">
                  <span className="label">Rechnung (freiwillig)</span>
                  <input className="input font-mono" placeholder={gewaehlt.typ === "entscheidung" ? "x > 7" : gewaehlt.typ === "io" ? "eingabe T / ausgabe r" : "x = 3*T + M"}
                    value={gewaehlt.code ?? ""} onChange={e => setzeKnoten({ code: e.target.value || undefined })} />
                </label>
              )}
            </>
          )}
          {gewaehlt && gewaehlt.typ !== "ende" && (
            <button type="button" className="btn-secondary" onClick={() => setVerbindeVon(gewaehlt.id)}>➜ Pfeil von hier</button>
          )}
          {kante && anzeige.knoten.find(k => k.id === kante.von)?.typ === "entscheidung" && (
            <label className="flex flex-col gap-1">
              <span className="label">Pfeil heißt</span>
              <select className="input" value={kante.marke ?? ""}
                onChange={e => aendere({ ...anzeige, kanten: anzeige.kanten.map((x, i) => (i === wahl.kante ? { ...x, marke: e.target.value as "ja" | "nein" } : x)) })}>
                <option value="ja">ja</option><option value="nein">nein</option>
              </select>
            </label>
          )}
          {(modus === "bearbeiten" || kante) && <button type="button" className="btn-danger" onClick={loeschen}>🗑 {kante ? "Pfeil" : "Kasten"} löschen</button>}
        </div>
      )}
    </div>
  );
}
