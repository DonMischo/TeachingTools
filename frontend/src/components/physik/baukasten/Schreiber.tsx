"use client";
/**
 * Der Messschreiber: was der Versuch aufgezeichnet hat, als Kurve.
 *
 * Jede Größe bekommt ihr eigenes Feld, untereinander, mit *einer* gemeinsamen
 * Zeitachse — wie auf dem Papierstreifen eines Schreibers. Zwei Größen mit
 * verschiedenen Einheiten übereinanderzulegen und jeder ihre eigene senkrechte
 * Achse zu geben, sähe aufgeräumter aus und wäre eine Lüge: Kurven, die sich
 * nur deshalb kreuzen, weil man die Maßstäbe so gewählt hat, laden dazu ein,
 * einen Zusammenhang zu sehen, den es nicht gibt.
 *
 * Aufgezeichnet wird immer alles (siehe `kern/messen.ts`); hier wird nur
 * ausgewählt, was man davon sehen will. Deshalb darf man auch *nach* dem
 * Versuch noch umentscheiden, ohne ihn zu wiederholen.
 */
import { useMemo, useRef, useState } from "react";
import { formatiere } from "@/lib/physik/einheiten";
import type { Messgroesse } from "@/lib/physik/kern/messen";
import { alsCsv } from "@/lib/physik/kern/messen";
import type { Messbus } from "@/lib/physik/messbus";

/**
 * Höchstens drei Kurven auf einmal.
 *
 * Die drei Farben sind gegen die Fläche der Tafel geprüft (Helligkeitsband,
 * Buntheit, Abstand auch bei Farbsehschwäche, Kontrast). Eine vierte hielte
 * diese Abstände nicht mehr — und drei Größen nebeneinander sind für einen
 * Schulversuch ohnehin die Grenze des Ablesbaren.
 */
const HOECHSTENS = 3;
const FLAECHE = "#1c2535";
const FARBEN = ["#3987e5", "#d95926", "#199e70"];

const BREITE = 800;
const GASSE = 88;
const FELD = 78;
const KOPF = 6;
const ACHSE = 22;

interface Reihe {
  groesse: Messgroesse;
  t: number[];
  v: number[];
  min: number;
  max: number;
}

/**
 * Der Wert, wie er dasteht.
 *
 * Gerechnet und gezeichnet wird durchweg in SI; erst die Beschriftung macht
 * daraus Grad, Millinewton oder Kilojoule. Die Kurve sieht dadurch nicht
 * anders aus — eine Umrechnung ist nur ein anderer Maßstab.
 */
const zeige = (m: Messgroesse, v: number) => formatiere(v, m.einheit, m.anzeige);

export default function Schreiber({ groessen, bus, gewaehlt, onGewaehlt, takt }: {
  groessen: Messgroesse[];
  bus: Messbus | null;
  gewaehlt: string[];
  onGewaehlt: (ids: string[]) => void;
  /** Zählt im laufenden Versuch hoch und zieht die Kurve nach. */
  takt: number;
}) {
  const [zeiger, setZeiger] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);

  const reihen = useMemo<Reihe[]>(() => {
    if (!bus) return [];
    const aus: Reihe[] = [];
    for (const id of gewaehlt) {
      const m = groessen.find(g => g.id === id);
      const verlauf = m && bus.verlauf(id);
      if (!m || !verlauf || verlauf.t.length < 2) continue;
      // Auf Bildpunkte eindampfen: 4096 Werte auf 800 Punkte zu zeichnen kostet
      // nur Zeit, sichtbar wird davon keiner.
      const schritt = Math.max(1, Math.ceil(verlauf.t.length / BREITE));
      const t: number[] = [], v: number[] = [];
      for (let i = 0; i < verlauf.t.length; i += schritt) {
        t.push(verlauf.t[i]);
        v.push(verlauf.v[i]);
      }
      aus.push({ groesse: m, t, v, min: Math.min(...v), max: Math.max(...v) });
    }
    return aus;
    // `takt` zieht die Kurve im laufenden Versuch nach; der Bus selbst bleibt derselbe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus, gewaehlt, groessen, takt]);

  const spanne = useMemo(() => {
    let von = Infinity, bis = -Infinity;
    for (const r of reihen) { von = Math.min(von, r.t[0]); bis = Math.max(bis, r.t[r.t.length - 1]); }
    return von < bis ? { von, bis } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reihen]);

  const hoehe = KOPF + reihen.length * FELD + ACHSE;
  const zumX = (t: number) => spanne ? GASSE + ((t - spanne.von) / (spanne.bis - spanne.von)) * (BREITE - GASSE - 12) : GASSE;

  function beiBewegung(e: React.PointerEvent<SVGSVGElement>) {
    if (!spanne || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * BREITE;
    const anteil = (x - GASSE) / (BREITE - GASSE - 12);
    setZeiger(anteil < 0 || anteil > 1 ? null : spanne.von + anteil * (spanne.bis - spanne.von));
  }

  function waehle(id: string) {
    if (gewaehlt.includes(id)) onGewaehlt(gewaehlt.filter(x => x !== id));
    else if (gewaehlt.length < HOECHSTENS) onGewaehlt([...gewaehlt, id]);
  }

  function ladeCsv() {
    if (!bus) return;
    const gewaehlteGroessen = gewaehlt.map(id => groessen.find(g => g.id === id)!).filter(Boolean);
    const blob = new Blob([alsCsv(bus, gewaehlteGroessen)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "messung.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const nachQuelle = useMemo(() => {
    const m = new Map<string, Messgroesse[]>();
    for (const g of groessen) m.set(g.quelle, [...(m.get(g.quelle) ?? []), g]);
    return [...m];
  }, [groessen]);

  return (
    <section
      className="rounded-2xl border border-[var(--border)] p-3 flex flex-col gap-3 sm:flex-row"
      style={{ background: FLAECHE, color: "#e2e8f0" }}
      aria-label="Messschreiber"
    >
      <div className="sm:w-56 shrink-0 flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-bold text-sm">📈 Messschreiber</h2>
          <span className="text-xs" style={{ color: "#94a3b8" }}>{gewaehlt.length}/{HOECHSTENS}</span>
        </div>
        {nachQuelle.map(([quelle, liste]) => (
          <div key={quelle}>
            <div className="text-xs font-bold" style={{ color: "#94a3b8" }}>{quelle}</div>
            {liste.map(g => {
              const an = gewaehlt.includes(g.id);
              return (
                <label key={g.id}
                  className={`flex items-center gap-2 text-xs py-0.5 ${an || gewaehlt.length < HOECHSTENS ? "cursor-pointer" : "opacity-40"}`}>
                  <input type="checkbox" checked={an}
                    disabled={!an && gewaehlt.length >= HOECHSTENS}
                    onChange={() => waehle(g.id)}
                    style={{ accentColor: FARBEN[Math.max(0, gewaehlt.indexOf(g.id))] }} />
                  <span>{g.name}</span>
                </label>
              );
            })}
          </div>
        ))}
      </div>

      <div className="grow min-w-0 flex flex-col gap-2">
        {reihen.length === 0 ? (
          <p className="text-xs py-6 text-center" style={{ color: "#94a3b8" }}>
            {gewaehlt.length === 0
              ? "Links ankreuzen, was zu sehen sein soll — aufgezeichnet wird ohnehin alles."
              : "Noch nichts aufgezeichnet. Den Versuch laufen lassen."}
          </p>
        ) : (
          <svg
            ref={svg}
            viewBox={`0 0 ${BREITE} ${hoehe}`}
            className="w-full"
            style={{ maxHeight: 340 }}
            role="img"
            aria-label={`Aufzeichnung von ${reihen.map(r => `${r.groesse.quelle} ${r.groesse.name}`).join(", ")}`}
            onPointerMove={beiBewegung}
            onPointerLeave={() => setZeiger(null)}
          >
            {reihen.map((r, i) => (
              <Feld key={r.groesse.id} reihe={r} oben={KOPF + i * FELD} farbe={FARBEN[i]} zumX={zumX} zeiger={zeiger} />
            ))}
            <Zeitachse spanne={spanne} oben={KOPF + reihen.length * FELD} zumX={zumX} />
            {zeiger !== null && spanne && (
              <line x1={zumX(zeiger)} y1={KOPF} x2={zumX(zeiger)} y2={KOPF + reihen.length * FELD}
                stroke="#e2e8f0" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
            )}
          </svg>
        )}
        {reihen.length > 0 && (
          <div className="flex justify-end">
            <button onClick={ladeCsv} className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-white/5">
              ⬇️ Als CSV
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/** Ein Feld des Schreibers: eine Größe, eine Kurve, eine eigene Skala. */
function Feld({ reihe, oben, farbe, zumX, zeiger }: {
  reihe: Reihe; oben: number; farbe: string; zumX: (t: number) => number; zeiger: number | null;
}) {
  const { groesse: m, t, v } = reihe;
  const bandOben = oben + 16, bandUnten = oben + FELD - 8;
  // Eine waagerechte Linie hätte sonst keine Höhe: dann liegt sie in der Mitte.
  const luft = (reihe.max - reihe.min) * 0.08 || Math.max(Math.abs(reihe.max) * 0.1, 0.5);
  const min = reihe.min - luft, max = reihe.max + luft;
  const zumY = (w: number) => bandUnten - ((w - min) / (max - min)) * (bandUnten - bandOben);

  const pfad = t.map((zeit, i) => `${i === 0 ? "M" : "L"}${zumX(zeit).toFixed(1)},${zumY(v[i]).toFixed(1)}`).join("");
  const beiZeiger = zeiger === null ? null : naechster(t, zeiger);
  const nullLinie = min < 0 && max > 0 ? zumY(0) : null;

  return (
    <g>
      <text x={0} y={oben + 12} fontSize={11} fill="#94a3b8">
        <tspan fontWeight="bold" fill="#e2e8f0">{m.name}</tspan>
      </text>
      <text x={0} y={oben + 24} fontSize={10} fill="#94a3b8">{m.quelle}</text>
      {/* Die Spanne steht am Rand, damit man die Kurve einordnen kann. */}
      <text x={GASSE - 6} y={bandOben + 4} fontSize={9} fill="#94a3b8" textAnchor="end">{zeige(m, reihe.max)}</text>
      <text x={GASSE - 6} y={bandUnten} fontSize={9} fill="#94a3b8" textAnchor="end">{zeige(m, reihe.min)}</text>
      {nullLinie !== null && (
        <line x1={GASSE} y1={nullLinie} x2={BREITE - 12} y2={nullLinie} stroke="#e2e8f0" strokeWidth={1} opacity={0.15} />
      )}
      <path d={pfad} fill="none" stroke={farbe} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {beiZeiger !== null && (
        <>
          <circle cx={zumX(t[beiZeiger])} cy={zumY(v[beiZeiger])} r={3.5} fill={farbe}
            stroke={FLAECHE} strokeWidth={2} />
          <text x={BREITE - 12} y={oben + 12} fontSize={11} fill="#e2e8f0" textAnchor="end" fontWeight="bold">
            {zeige(m, v[beiZeiger])}
          </text>
        </>
      )}
    </g>
  );
}

function Zeitachse({ spanne, oben, zumX }: {
  spanne: { von: number; bis: number } | null; oben: number; zumX: (t: number) => number;
}) {
  if (!spanne) return null;
  const marken = [0, 0.25, 0.5, 0.75, 1].map(a => spanne.von + a * (spanne.bis - spanne.von));
  return (
    <g>
      <line x1={GASSE} y1={oben} x2={BREITE - 12} y2={oben} stroke="#e2e8f0" strokeWidth={1} opacity={0.25} />
      {marken.map((t, i) => (
        <text key={t} x={zumX(t)} y={oben + 14} fontSize={10} fill="#94a3b8"
          textAnchor={i === 0 ? "start" : i === marken.length - 1 ? "end" : "middle"}>
          {t.toFixed(1)} s
        </text>
      ))}
    </g>
  );
}

/** Der Punkt der Aufzeichnung, der einer Zeit am nächsten liegt. */
function naechster(t: number[], gesucht: number): number {
  let lo = 0, hi = t.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (t[m] < gesucht) lo = m + 1; else hi = m;
  }
  return lo > 0 && Math.abs(t[lo - 1] - gesucht) < Math.abs(t[lo] - gesucht) ? lo - 1 : lo;
}
