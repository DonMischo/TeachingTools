"use client";
/**
 * Die zwei Blicke auf dasselbe Gerät: Realansicht (Zeichnung mit Kabeln)
 * und Schaltplan (Kästen mit Strom-, Daten- und Wärmeleitungen).
 */
import type { ReactNode } from "react";
import { belegt, inSchicht, istDrin, kabelDrin, kabelKnoten, port, teil, teilDrin } from "@/lib/pcbau/logik";
import type { Bau, Geraet, Kabel, KabelStil, Kategorie } from "@/lib/pcbau/typen";
import { Zeichnung } from "./zeichnungen";

export const KATEGORIEN: Record<Kategorie, { icon: string; farbe: string; name: string }> = {
  rechnen: { icon: "🧠", farbe: "#f472b6", name: "Rechnen" },
  speicher: { icon: "📦", farbe: "#a78bfa", name: "Speicher" },
  laufwerk: { icon: "💽", farbe: "#818cf8", name: "Laufwerk" },
  strom: { icon: "⚡", farbe: "#f87171", name: "Strom" },
  platine: { icon: "🟩", farbe: "#34d399", name: "Platine" },
  anschluss: { icon: "🔌", farbe: "#38bdf8", name: "Anschluss" },
  gehaeuse: { icon: "🗄️", farbe: "#94a3b8", name: "Gehäuse" },
  kuehlung: { icon: "❄️", farbe: "#22d3ee", name: "Kühlung" },
  grafik: { icon: "🖼️", farbe: "#fbbf24", name: "Grafik" },
  funk: { icon: "📡", farbe: "#fb923c", name: "Funk" },
  sinne: { icon: "👁️", farbe: "#e879f9", name: "Ein-/Ausgabe" },
  extern: { icon: "🔗", farbe: "#cbd5e1", name: "Gerät außen" },
};

export type Auswahl = { art: "teil" | "kabel"; id: string } | null;

export type AnsichtProps = {
  g: Geraet;
  bau: Bau;
  /** Läuft das Gerät? (Lüfter drehen, LEDs leuchten) */
  an?: boolean;
  auswahl?: Auswahl;
  markiert?: string | null;
  namen?: boolean;
  /** Zerlege-Schicht (nur Geräte mit `schichten`). */
  schicht?: number;
  /** Kurzes Aufleuchten nach einer Quiz-Antwort. */
  blitz?: { id: string; ok: boolean } | null;
  onTeil?: (id: string) => void;
  onZiel?: (id: string) => void;
  onPort?: (id: string) => void;
  onKnoten?: (id: string) => void;
};

/** Glatte Kurve durch alle Punkte (Catmull-Rom als Bézier). */
function kurve(p: [number, number][]): string {
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const [a, b, c, e] = [p[i - 1] ?? p[i], p[i], p[i + 1], p[i + 2] ?? p[i + 1]];
    const c1 = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
    const c2 = [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6];
    d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${c[0]} ${c[1]}`;
  }
  return d;
}

const STIL: Record<KabelStil, { farbe: string; breite: number; stecker: string }> = {
  strom: { farbe: "#0b0b0d", breite: 8, stecker: "#1f2937" },
  sata: { farbe: "#dc2626", breite: 4, stecker: "#111" },
  flach: { farbe: "#a8a29e", breite: 13, stecker: "#1c1917" },
  "dünn": { farbe: "#111827", breite: 3, stecker: "#111" },
  hdmi: { farbe: "#111318", breite: 6, stecker: "#374151" },
  usb: { farbe: "#e5e7eb", breite: 4.5, stecker: "#9ca3af" },
  usbc: { farbe: "#f8fafc", breite: 4, stecker: "#cbd5e1" },
  lan: { farbe: "#3b82f6", breite: 5, stecker: "#bfdbfe" },
};

function KabelBild({ g, k, ports, aktiv }: { g: Geraet; k: Kabel; ports: string[]; aktiv: boolean }) {
  const s = STIL[k.stil];
  // Stützpunkte laufen von enden[0] nach enden[1], egal in welcher Reihenfolge gesteckt wurde.
  const sortiert = [...ports].sort((a, b) => (k.enden[0].includes(a) ? 0 : 1) - (k.enden[0].includes(b) ? 0 : 1));
  const pts = sortiert.map(p => port(g, p)!).map(p => [p.x, p.y] as [number, number]);
  const stecker = pts.map(([x, y], i) => <rect key={i} x={x - 7} y={y - 5} width={14} height={10} rx={2} fill={s.stecker} stroke="#e5e7eb" strokeOpacity=".4" />);
  if (pts.length < 2) {
    const [x, y] = pts[0];
    return <g>{<path d={`M${x} ${y} q 10 30 -10 45`} stroke={s.farbe} strokeWidth={s.breite} fill="none" strokeLinecap="round" opacity=".9" />}{stecker}</g>;
  }
  const d = kurve([pts[0], ...(k.ueber ?? []), pts[1]]);
  return (
    <g pointerEvents="none">
      {aktiv && <path d={d} stroke="#facc15" strokeWidth={s.breite + 8} fill="none" opacity=".35" strokeLinecap="round" />}
      <path d={d} stroke="#000" strokeOpacity=".35" strokeWidth={s.breite + 2} fill="none" strokeLinecap="round" transform="translate(2 3)" />
      <path d={d} stroke={s.farbe} strokeWidth={s.breite} fill="none" strokeLinecap="round" />
      {k.stil === "strom" && <path d={d} stroke="#4b5563" strokeWidth={s.breite - 3} strokeDasharray="1.5 2.5" fill="none" />}
      {k.stil === "flach" && <path d={d} stroke="#78716c" strokeWidth={s.breite - 2} strokeDasharray="0.6 1.4" fill="none" />}
      {k.stil === "flach" && <path d={d} stroke="#dc2626" strokeWidth={1.6} fill="none" transform="translate(-4 -4)" />}
      {k.stil === "dünn" && ["#ef4444", "#22c55e", "#3b82f6"].map((c, i) => <path key={c} d={d} stroke={c} strokeWidth={1} fill="none" transform={`translate(${i - 1} ${i - 1})`} />)}
      {stecker}
    </g>
  );
}

export function Realansicht({ g, bau, an = false, auswahl, markiert, namen, schicht, blitz, onTeil, onZiel, onPort }: AnsichtProps) {
  const besetzt = belegt(bau);
  const gewaehlt = auswahl?.art === "teil" ? teil(g, auswahl.id) : undefined;
  const kabelWahl = auswahl?.art === "kabel" ? auswahl.id : null;
  const sichtbar = g.teile.filter(t => teilDrin(g, bau, t.id) && inSchicht(t, schicht));

  return (
    <svg viewBox="0 0 800 600" className="w-full h-auto rounded-2xl select-none" style={{ background: g.buehne }} role="img" aria-label={`${g.name}, Realansicht`}>
      <defs>
        <radialGradient id={`pcb-licht-${g.id}`} cx=".5" cy=".3" r=".8"><stop offset="0" stopColor="#fff" stopOpacity=".07" /><stop offset="1" stopColor="#000" stopOpacity=".3" /></radialGradient>
      </defs>
      <rect width={800} height={600} fill={`url(#pcb-licht-${g.id})`} />
      {g.teile.map(t => {
        const drin = sichtbar.includes(t);
        const ziel = gewaehlt?.id === t.id && !drin;
        if (!drin && !ziel) return null;
        const { x, y, w, h } = t.rect;
        const hervor = markiert === t.id || (blitz?.id === t.id);
        const blitzFarbe = blitz?.id === t.id ? (blitz.ok ? "#22c55e" : "#ef4444") : "#facc15";
        return (
          <g key={t.id} transform={`translate(${x} ${y})`}>
            <g opacity={ziel ? .35 : 1}><Zeichnung name={t.zeichnung} w={w} h={h} an={an} /></g>
            {ziel && (
              <rect x={-4} y={-4} width={w + 8} height={h + 8} rx={8} fill="#facc15" fillOpacity=".12" stroke="#facc15" strokeWidth={3}
                strokeDasharray="10 6" className="cursor-pointer animate-pulse" role="button" aria-label={`${t.name} hier einsetzen`}
                onClick={() => onZiel?.(t.id)} />
            )}
            {drin && (
              <rect width={w} height={h} rx={6} fill="transparent" className={onTeil ? "cursor-pointer" : ""}
                stroke={hervor ? blitzFarbe : "transparent"} strokeWidth={hervor ? 3 : 0}
                role={onTeil ? "button" : undefined} aria-label={onTeil ? t.name : undefined}
                onClick={() => onTeil?.(t.id)}>
                <title>{t.name}</title>
              </rect>
            )}
          </g>
        );
      })}

      {g.kabel.map(k => bau.stecker[k.id]?.length ? <KabelBild key={k.id} g={g} k={k} ports={bau.stecker[k.id]} aktiv={markiert === k.id} /> : null)}

      {namen && sichtbar.filter(t => !t.nichtAbfragen).map(t => {
        const cx = t.rect.x + t.rect.w / 2, cy = t.rect.y + t.rect.h / 2;
        const breite = t.name.length * 5.6 + 12;
        return (
          <g key={`n-${t.id}`} pointerEvents="none">
            <rect x={cx - breite / 2} y={cy - 9} width={breite} height={18} rx={9} fill="#0f172a" fillOpacity=".82" stroke={KATEGORIEN[t.kategorie].farbe} />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fill="#f8fafc" fontWeight={700} fontFamily="ui-sans-serif, system-ui">{t.name}</text>
          </g>
        );
      })}

      {kabelWahl && sichtbar.flatMap(t => (t.ports ?? []).map(p => {
        const x = t.rect.x + p.x, y = t.rect.y + p.y;
        const hier = besetzt.get(p.id);
        const eigen = hier === kabelWahl;
        return (
          <g key={p.id} className={hier ? "" : "cursor-pointer"} role={hier ? undefined : "button"} aria-label={hier ? undefined : "Anschluss"}
            onClick={() => !hier && onPort?.(p.id)}>
            <circle cx={x} cy={y} r={hier ? 5 : 11} fill={eigen ? "#22c55e" : hier ? "#475569" : "#facc15"} fillOpacity={hier ? .9 : .25}
              stroke={eigen ? "#22c55e" : hier ? "#475569" : "#facc15"} strokeWidth={2} className={hier ? "" : "animate-pulse"} />
            {!hier && <circle cx={x} cy={y} r={3} fill="#facc15" />}
          </g>
        );
      }))}
    </svg>
  );
}

const KNOTEN_W = 124, KNOTEN_H = 40;
const LEITUNG = { strom: "#f87171", daten: "#60a5fa", waerme: "#fb923c" };

export function Schaltplan({ g, bau, an = false, auswahl, markiert, schicht, blitz, onKnoten }: AnsichtProps) {
  const knoten = g.teile.filter(t => t.schema);
  const pos = (id: string) => teil(g, id)?.schema;
  const kanten: { key: string; a: string; b: string; name: string; art: keyof typeof LEITUNG; drin: boolean; halb?: boolean; kabelId?: string }[] = [
    ...g.verbindungen.map((v, i) => ({ key: `v${i}`, a: v.von, b: v.nach, name: v.name, art: v.art, drin: istDrin(g, bau, v.von) && istDrin(g, bau, v.nach) })),
    ...g.kabel.map(k => {
      const [a, b] = kabelKnoten(g, k);
      return { key: k.id, a, b, name: k.name, art: k.art, drin: kabelDrin(bau, k.id), halb: (bau.stecker[k.id]?.length ?? 0) === 1, kabelId: k.id };
    }),
  ];
  const zielTeil = auswahl?.art === "teil" ? auswahl.id : null;
  const kabelWahl = auswahl?.art === "kabel" ? g.kabel.find(k => k.id === auswahl.id) : undefined;

  return (
    <svg viewBox="0 0 800 520" className="w-full h-auto rounded-2xl select-none" style={{ background: "#0b2440" }} role="img" aria-label={`${g.name}, Schaltplan`}>
      <defs>
        <pattern id={`pcb-raster-${g.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#60a5fa" strokeOpacity=".12" />
        </pattern>
      </defs>
      <rect width={800} height={520} fill={`url(#pcb-raster-${g.id})`} />
      <text x={16} y={506} fontSize={10} fill="#93c5fd" fillOpacity=".7" fontFamily="monospace">
        SCHALTPLAN · {g.name.toUpperCase()} · <tspan fill={LEITUNG.strom}>━ Strom</tspan> <tspan fill={LEITUNG.daten}>━ Daten</tspan> <tspan fill={LEITUNG.waerme}>┅ Wärme</tspan>
      </text>

      {kanten.map(k => {
        const p = pos(k.a), q = pos(k.b);
        if (!p || !q) return null;
        const farbe = LEITUNG[k.art];
        const hell = k.drin || k.halb;
        const aktiv = k.kabelId && (markiert === k.kabelId || kabelWahl?.id === k.kabelId);
        const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
        return (
          <g key={k.key} pointerEvents="none">
            {aktiv && <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#facc15" strokeWidth={10} opacity=".3" strokeLinecap="round" />}
            <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={farbe} strokeOpacity={hell ? 1 : .25}
              strokeWidth={k.kabelId ? 3 : 2} strokeDasharray={k.art === "waerme" ? "6 4" : k.drin ? undefined : "4 5"} />
            {an && k.drin && k.art !== "waerme" && (
              <circle r={3.5} fill={farbe}>
                <animateMotion dur={k.art === "strom" ? "1.4s" : ".9s"} repeatCount="indefinite" path={`M${p.x} ${p.y} L${q.x} ${q.y}`} />
              </circle>
            )}
            {hell && (
              <g>
                <rect x={mx - k.name.length * 2.6 - 5} y={my - 8} width={k.name.length * 5.2 + 10} height={15} rx={7} fill="#0b2440" stroke={farbe} strokeOpacity=".6" />
                <text x={mx} y={my + 3} textAnchor="middle" fontSize={9} fill={farbe} fontFamily="ui-sans-serif, system-ui" fontWeight={600}>{k.name}</text>
              </g>
            )}
          </g>
        );
      })}

      {knoten.map(t => {
        const { x, y } = t.schema!;
        const drin = teilDrin(g, bau, t.id);
        const kat = KATEGORIEN[t.kategorie];
        const istZiel = zielTeil === t.id && !drin;
        const hervor = markiert === t.id || blitz?.id === t.id;
        const rand = blitz?.id === t.id ? (blitz.ok ? "#22c55e" : "#ef4444") : istZiel || hervor ? "#facc15" : kat.farbe;
        return (
          <g key={t.id} transform={`translate(${x - KNOTEN_W / 2} ${y - KNOTEN_H / 2})`} className={onKnoten ? "cursor-pointer" : ""}
            opacity={inSchicht(t, schicht) ? 1 : .35}
            role={onKnoten ? "button" : undefined} aria-label={onKnoten ? t.name : undefined} onClick={() => onKnoten?.(t.id)}>
            <rect width={KNOTEN_W} height={KNOTEN_H} rx={10} fill={drin ? kat.farbe : "#0b2440"} fillOpacity={drin ? .2 : 1}
              stroke={rand} strokeWidth={istZiel || hervor ? 3 : 1.5} strokeDasharray={drin ? undefined : "5 4"}
              className={istZiel ? "animate-pulse" : ""} />
            <text x={10} y={25} fontSize={15}>{kat.icon}</text>
            <foreignObject x={30} y={2} width={KNOTEN_W - 34} height={KNOTEN_H - 4}>
              <div style={{ height: "100%", display: "flex", alignItems: "center", fontSize: 10.5, lineHeight: 1.1, fontWeight: 700, color: drin ? "#f8fafc" : "#93c5fd", opacity: drin ? 1 : .75, fontFamily: "ui-sans-serif, system-ui" }}>
                {t.name}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}

/** Realansicht, Schaltplan oder beide nebeneinander. */
export type Blick = "real" | "schema" | "beide";

export function Ansicht({ blick, ...p }: AnsichtProps & { blick: Blick }) {
  const real = <Realansicht {...p} />;
  const schema = <Schaltplan {...p} />;
  if (blick === "real") return real;
  if (blick === "schema") return schema;
  return <div className="grid gap-3 xl:grid-cols-2 items-start">{real}{schema}</div>;
}

export function BlickWahl({ blick, setBlick }: { blick: Blick; setBlick: (b: Blick) => void }): ReactNode {
  const OPT: [Blick, string][] = [["real", "📷 Realistisch"], ["schema", "📐 Schaltplan"], ["beide", "◫ Beides"]];
  return (
    <div className="inline-flex rounded-xl border border-line p-1 bg-surface">
      {OPT.map(([b, l]) => (
        <button key={b} onClick={() => setBlick(b)}
          className={`px-3 py-1 rounded-lg text-sm font-bold transition-colors ${blick === b ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}
