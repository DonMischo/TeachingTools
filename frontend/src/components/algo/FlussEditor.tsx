"use client";
/**
 * Flussdiagramm-Zeichenfläche (SVG). Modi:
 *   bearbeiten — Formen hinzufügen, ziehen, beschriften, Pfeile setzen
 *   verbinden  — nur Pfeile setzen/ändern (Knoten stehen fest)
 *   lesen      — nur ansehen; Klicks auf Knoten/Pfeile gehen an den Aufrufer
 * Pfeile werden rechtwinklig geführt: abwärts gerade, Rücksprünge links außen,
 * Sprünge über andere Kästen rechts außen herum.
 */
import { useId, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { BREITE, TYP_NAME, hoehe, type Diagramm, type Kante, type Knoten, type KnotenTyp } from "@/lib/algo/fluss";

export type Modus = "bearbeiten" | "verbinden" | "lesen";
type Punkt = [number, number];

const W = BREITE / 2;

function anker(k: Knoten, seite: "o" | "u" | "l" | "r"): Punkt {
  const h = hoehe(k) / 2;
  return seite === "o" ? [k.x, k.y - h] : seite === "u" ? [k.x, k.y + h] : seite === "l" ? [k.x - W, k.y] : [k.x + W, k.y];
}

/** Rechtwinkliger Weg einer Kante. `nr` verteilt mehrere Umwege nebeneinander. */
export function weg(s: Knoten, t: Knoten, alle: Knoten[], nr: number): Punkt[] {
  const th = hoehe(t) / 2;
  if (t.y <= s.y + 4) {
    const x0 = Math.min(s.x, t.x) - W - 22 - nr * 14;
    return [anker(s, "l"), [x0, s.y], [x0, t.y], anker(t, "l")];
  }
  if (Math.abs(t.x - s.x) < 5) {
    const dazwischen = alle.some(k => k !== s && k !== t && Math.abs(k.x - s.x) < W && k.y > s.y && k.y < t.y);
    if (!dazwischen) return [anker(s, "u"), anker(t, "o")];
    const x1 = s.x + W + 22 + nr * 14, yv = t.y - th - 16;
    return [anker(s, "r"), [x1, s.y], [x1, yv], [t.x, yv], anker(t, "o")];
  }
  if (t.x > s.x) {
    const [ax, ay] = anker(s, "r");
    return [[ax, ay], [t.x, ay], anker(t, "o")];
  }
  const yv = t.y - th - 16;
  const [ux, uy] = anker(s, "u");
  return [[ux, uy], [ux, yv], [t.x, yv], anker(t, "o")];
}

function zeilen(text: string, max = 20): string[] {
  const woerter = text.split(/\s+/);
  const aus: string[] = [];
  let z = "";
  for (const w of woerter) {
    if ((z + " " + w).trim().length > max && z) { aus.push(z); z = w; } else z = (z + " " + w).trim();
  }
  if (z) aus.push(z);
  return aus.slice(0, 3);
}

export function Form({ typ, x, y, h, stil, unbekannt }: { typ: KnotenTyp; x: number; y: number; h: number; stil: React.CSSProperties; unbekannt?: boolean }) {
  if (unbekannt) return <rect x={x - W} y={y - h / 2} width={BREITE} height={h} rx={6} style={{ ...stil, strokeDasharray: "6 4" }} />;
  if (typ === "start" || typ === "ende") return <rect x={x - W} y={y - h / 2} width={BREITE} height={h} rx={h / 2} style={stil} />;
  if (typ === "aktion") return <rect x={x - W} y={y - h / 2} width={BREITE} height={h} rx={3} style={stil} />;
  if (typ === "io") return <polygon points={`${x - W + 14},${y - h / 2} ${x + W},${y - h / 2} ${x + W - 14},${y + h / 2} ${x - W},${y + h / 2}`} style={stil} />;
  return <polygon points={`${x},${y - h / 2} ${x + W},${y} ${x},${y + h / 2} ${x - W},${y}`} style={stil} />;
}

const FUELLUNG: Record<KnotenTyp, string> = {
  start: "#fde68a", ende: "#fde68a", aktion: "#bfdbfe", io: "#bbf7d0", entscheidung: "#fecaca",
};

export default function FlussEditor({
  d, onChange, modus, aktiv, formen, markiertKante, markiertKnoten, onKnotenKlick, onKanteKlick,
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
}) {
  const uid = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const [wahl, setWahl] = useState<{ knoten?: string; kante?: number }>({});
  const [verbindeVon, setVerbindeVon] = useState<string | null>(null);
  const zug = useRef<{ id: string; dx: number; dy: number; bewegt: boolean } | null>(null);
  const darfZiehen = modus !== "lesen";
  const darfVerbinden = modus !== "lesen";

  const breite = Math.max(640, ...d.knoten.map(k => k.x + W + 90));
  const hoeheSvg = Math.max(380, ...d.knoten.map(k => k.y + hoehe(k) / 2 + 40));

  const wege = useMemo(() => {
    const knoten = new Map(d.knoten.map(k => [k.id, k]));
    // Umwege nach Spannweite verteilen: kurze innen, lange außen
    const spanne = d.kanten.map((e, i) => ({ i, s: Math.abs((knoten.get(e.nach)?.y ?? 0) - (knoten.get(e.von)?.y ?? 0)) }))
      .sort((a, b) => a.s - b.s);
    const nr = new Map<number, number>();
    let links = 0, rechts = 0;
    for (const { i } of spanne) {
      const s = knoten.get(d.kanten[i].von), t = knoten.get(d.kanten[i].nach);
      if (!s || !t) continue;
      nr.set(i, t.y <= s.y + 4 ? links++ : rechts++);
    }
    return d.kanten.map((e, i) => {
      const s = knoten.get(e.von), t = knoten.get(e.nach);
      return s && t ? weg(s, t, d.knoten, nr.get(i) ?? 0) : null;
    });
  }, [d]);

  const punkt = (e: RPointerEvent): Punkt => {
    const m = svg.current?.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };

  const aendere = (neu: Diagramm) => onChange?.(neu);
  const knotenKlick = (id: string) => {
    if (verbindeVon && verbindeVon !== id) {
      const von = d.knoten.find(k => k.id === verbindeVon)!;
      const vorhanden = d.kanten.filter(e => e.von === von.id);
      if (von.typ !== "entscheidung" && vorhanden.length) {
        // Ein Pfeil je Kasten: der neue ersetzt den alten
        aendere({ ...d, kanten: [...d.kanten.filter(e => e.von !== von.id), { von: von.id, nach: id }] });
      } else if (von.typ === "entscheidung") {
        const marke: "ja" | "nein" = vorhanden.some(e => e.marke === "ja") ? "nein" : "ja";
        aendere({ ...d, kanten: [...d.kanten.filter(e => !(e.von === von.id && e.marke === marke)), { von: von.id, nach: id, marke }] });
      } else {
        aendere({ ...d, kanten: [...d.kanten, { von: von.id, nach: id }] });
      }
      setVerbindeVon(null);
      return;
    }
    setWahl({ knoten: id });
    onKnotenKlick?.(id);
  };

  const gewaehlt = d.knoten.find(k => k.id === wahl.knoten);
  const kante: Kante | undefined = wahl.kante !== undefined ? d.kanten[wahl.kante] : undefined;

  const neuerKnoten = (typ: KnotenTyp) => {
    const tiefste = Math.max(-52, ...d.knoten.map(k => k.y));
    const id = `n${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const text = typ === "start" ? "Start" : typ === "ende" ? "Ende" : typ === "entscheidung" ? "Frage?" : typ === "io" ? "Ein-/Ausgabe" : "Anweisung";
    aendere({ ...d, knoten: [...d.knoten, { id, typ, text, x: 110, y: tiefste + 92 }] });
    setWahl({ knoten: id });
  };

  const loeschen = () => {
    if (gewaehlt) aendere({ knoten: d.knoten.filter(k => k.id !== gewaehlt.id), kanten: d.kanten.filter(e => e.von !== gewaehlt.id && e.nach !== gewaehlt.id) });
    else if (wahl.kante !== undefined) aendere({ ...d, kanten: d.kanten.filter((_, i) => i !== wahl.kante) });
    setWahl({});
  };

  const setzeKnoten = (patch: Partial<Knoten>) => gewaehlt && aendere({ ...d, knoten: d.knoten.map(k => (k.id === gewaehlt.id ? { ...k, ...patch } : k)) });

  return (
    <div className="flex flex-col gap-2">
      {modus === "bearbeiten" && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted mr-1">Hinzufügen:</span>
          {(["start", "aktion", "io", "entscheidung", "ende"] as KnotenTyp[]).map(t => (
            <button key={t} type="button" onClick={() => neuerKnoten(t)} className="btn-secondary !px-2 !py-1 text-xs inline-flex items-center gap-1">
              <svg viewBox="0 0 180 80" width={30} height={14} aria-hidden><Form typ={t} x={90} y={40} h={t === "entscheidung" ? 78 : 52} stil={{ fill: FUELLUNG[t], stroke: "#334155", strokeWidth: 5 }} /></svg>
              {t === "start" ? "Start" : t === "ende" ? "Ende" : TYP_NAME[t]}
            </button>
          ))}
        </div>
      )}
      {verbindeVon && <p className="text-sm text-accent font-bold">➜ Jetzt den Kasten anklicken, zu dem der Pfeil zeigen soll. (Esc oder Klick ins Leere bricht ab.)</p>}
      <div className="overflow-auto rounded-xl border border-line bg-white" style={{ maxHeight: "70vh" }}
        onKeyDown={e => { if (e.key === "Escape") setVerbindeVon(null); if (e.key === "Delete" && (modus === "bearbeiten" || (modus === "verbinden" && kante))) loeschen(); }} tabIndex={0}>
        <svg ref={svg} viewBox={`0 0 ${breite} ${hoeheSvg}`} width={breite} height={hoeheSvg} className="block select-none touch-none" data-testid="fluss-flaeche"
          onPointerDown={() => { setWahl({}); setVerbindeVon(null); }}
          onPointerMove={e => {
            const z = zug.current;
            if (!z || !darfZiehen) return;
            const [px, py] = punkt(e);
            const x = Math.round((px - z.dx) / 10) * 10, y = Math.round((py - z.dy) / 10) * 10;
            z.bewegt = true;
            aendere({ ...d, knoten: d.knoten.map(k => (k.id === z.id ? { ...k, x: Math.max(W + 10, x), y: Math.max(40, y) } : k)) });
          }}
          onPointerUp={() => { zug.current = null; }}>
          <defs>
            <marker id={`pf${uid}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: "#334155" }} />
            </marker>
          </defs>
          {wege.map((p, i) => {
            if (!p) return null;
            const e = d.kanten[i];
            const pfad = p.map(([x, y], j) => `${j ? "L" : "M"}${x},${y}`).join(" ");
            const an = wahl.kante === i || markiertKante?.i === i;
            const farbe = markiertKante?.i === i ? (markiertKante.ok ? "#16a34a" : "#dc2626") : an ? "#2563eb" : "#334155";
            const [lx, ly] = p[0], [nx, ny] = p[1];
            const rx = lx + (nx > lx ? 10 : nx < lx ? -28 : 6), ry = ly + (ny > ly ? 14 : -5);
            return (
              <g key={`e${i}`}>
                <path d={pfad} style={{ fill: "none", stroke: farbe, strokeWidth: an ? 3 : 2 }} markerEnd={`url(#pf${uid})`} />
                {e.marke && <text x={rx} y={ry} style={{ fontSize: 12, fontWeight: 700, fill: e.marke === "ja" ? "#15803d" : "#b91c1c" }}>{e.marke}</text>}
                <path d={pfad} style={{ fill: "none", stroke: "transparent", strokeWidth: 14, cursor: "pointer" }}
                  onPointerDown={ev => { ev.stopPropagation(); setWahl({ kante: i }); onKanteKlick?.(i); }} />
              </g>
            );
          })}
          {d.knoten.map(k => {
            const h = hoehe(k);
            const form = formen ? formen[k.id] : k.typ;
            const markiert = markiertKnoten?.includes(k.id);
            const stil = {
              fill: form ? FUELLUNG[form] : "#f1f5f9",
              stroke: k.id === aktiv ? "#f59e0b" : markiert ? "#dc2626" : wahl.knoten === k.id ? "#2563eb" : "#334155",
              strokeWidth: k.id === aktiv || markiert || wahl.knoten === k.id ? 4 : 2,
              cursor: darfZiehen || onKnotenKlick ? "pointer" : "default",
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
                <Form typ={form ?? "aktion"} x={k.x} y={k.y} h={h} stil={stil} unbekannt={formen !== undefined && !form} />
                {z.map((zeile, j) => (
                  <text key={j} x={k.x} y={k.y + (j - (z.length - 1) / 2) * 14 + 4} textAnchor="middle"
                    style={{ fontSize: 12, fill: "#0f172a", pointerEvents: "none" }}>{zeile}</text>
                ))}
                {darfVerbinden && wahl.knoten === k.id && k.typ !== "ende" && (
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
      {modus !== "lesen" && (gewaehlt || kante) && (
        <div className="card p-3 flex flex-wrap items-end gap-3 text-sm">
          {gewaehlt && modus === "bearbeiten" && (
            <>
              <label className="flex flex-col gap-1 flex-1 min-w-48">
                <span className="label">Text</span>
                <input className="input" value={gewaehlt.text} onChange={e => setzeKnoten({ text: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="label">Form</span>
                <select className="input" value={gewaehlt.typ} onChange={e => setzeKnoten({ typ: e.target.value as KnotenTyp })}>
                  <option value="start">Start</option><option value="ende">Ende</option>
                  <option value="aktion">Anweisung</option><option value="io">Ein-/Ausgabe</option><option value="entscheidung">Entscheidung</option>
                </select>
              </label>
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
          {kante && d.knoten.find(k => k.id === kante.von)?.typ === "entscheidung" && (
            <label className="flex flex-col gap-1">
              <span className="label">Pfeil heißt</span>
              <select className="input" value={kante.marke ?? ""}
                onChange={e => aendere({ ...d, kanten: d.kanten.map((x, i) => (i === wahl.kante ? { ...x, marke: e.target.value as "ja" | "nein" } : x)) })}>
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
