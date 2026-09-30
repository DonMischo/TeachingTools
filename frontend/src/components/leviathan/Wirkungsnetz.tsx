"use client";
/**
 * Das Wirkungsnetz als Kreis: jeder Bereich ein Knoten, jede Regel ein Pfeil.
 *
 * Live-Ansicht: Dicke und Farbe zeigen, wie stark und in welche Richtung ein
 * Pfeil gerade drückt. Regel-Ansicht: was passiert, wenn die Quelle steigt.
 * Ein Klick auf einen Knoten hebt seine Pfeile hervor; verteilte
 * Aktionspunkte (`hervorheben`) leuchten mit ihren Folgen erster und zweiter
 * Ordnung auf; eine Schleife (`schleife`) zeigt ihren Kreislauf.
 */
import { useMemo, useState } from "react";
import { QUELLEN } from "@/lib/leviathan/quellen";
import {
  druck, gutFuerZiel, KANTEN, KNOTEN_INFO, KREIS, knotenWert, MITTE, SCHLEIFEN_KANTEN, type Kante, type Knoten,
} from "@/lib/leviathan/netz";
import { HEBEL, HOCH_SCHLECHT, type Groesse, type Hebel, type Zustand } from "@/lib/leviathan/typen";
import { QuelleLink } from "./ui";

const B = 820;
const M = B / 2;
const R = 330;
const RK = 34; // Knotenradius
const RM = 40;

const FARBE = { gut: "var(--green)", schlecht: "var(--red)", neutral: "#60a5fa", aus: "var(--text-muted)", du: "var(--accent)" } as const;
type Ton = keyof typeof FARBE;

function lage(k: Knoten): { x: number; y: number; r: number } {
  const i = KREIS.indexOf(k);
  if (i >= 0) {
    const a = (i / KREIS.length) * 2 * Math.PI - Math.PI / 2;
    return { x: M + R * Math.cos(a), y: M + R * Math.sin(a), r: RK };
  }
  return k === "lq" ? { x: M, y: M - 60, r: RM } : { x: M, y: M + 60, r: RM };
}

/** Gebogener Pfeil von Knoten zu Knoten; Hin- und Rückweg liegen nebeneinander. */
function bahn(von: Knoten, nach: Knoten) {
  const a = lage(von), b = lage(nach);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  // Zur Mitte ziehen, dazu seitlich versetzen, damit A→B und B→A nicht aufeinanderliegen.
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const seite = 14;
  let cx = mx + (M - mx) * 0.3 + (-dy / len) * seite;
  let cy = my + (M - my) * 0.3 + (dx / len) * seite;
  if (MITTE.includes(nach) || MITTE.includes(von)) { cx = mx + (-dy / len) * seite; cy = my + (dx / len) * seite; }
  const ein = (p: { x: number; y: number; r: number }, zu: { x: number; y: number }, extra: number) => {
    const ux = zu.x - p.x, uy = zu.y - p.y, l = Math.hypot(ux, uy) || 1;
    return { x: p.x + (ux / l) * (p.r + extra), y: p.y + (uy / l) * (p.r + extra) };
  };
  const s = ein(a, { x: cx, y: cy }, 2);
  const e = ein(b, { x: cx, y: cy }, 6);
  return {
    d: `M ${s.x} ${s.y} Q ${cx} ${cy} ${e.x} ${e.y}`,
    mitte: { x: 0.25 * s.x + 0.5 * cx + 0.25 * e.x, y: 0.25 * s.y + 0.5 * cy + 0.25 * e.y },
  };
}

const schluessel = (k: Kante) => `${k.von}>${k.nach}`;

export default function Wirkungsnetz({ z, hervorheben = [], schleife = null, markiert, einsatz, onPlus, onMinus, werte, fliessen = 0, frei }: {
  z: Zustand;
  /** Bereiche, in die gerade Punkte fließen. */
  hervorheben?: Knoten[];
  /** Id einer Rückkopplungsschleife (R1 …), deren Pfeile leuchten sollen. */
  schleife?: string | null;
  /** Pfeile, die leuchten sollen (Rechenweg: wer in diesem Schritt gewirkt hat). */
  markiert?: [Knoten, Knoten][];
  /** Verteilte Punkte je Hebel, für die Dicke der Entscheidungs-Pfeile. */
  einsatz?: Partial<Record<Groesse, number>>;
  /** Punkte direkt im Netz verteilen: + und − an den Hebeln. */
  onPlus?: (h: Hebel) => void;
  onMinus?: (h: Hebel) => void;
  /** Werte, die statt des Spielstands gezeigt werden (Zeitlupe). */
  werte?: Partial<Record<Groesse, number>>;
  /** Markierte Pfeile »fließen« (Sekunden je Durchlauf, 0 = still). */
  fliessen?: number;
  /** Beim Verteilen: noch freie und insgesamt verfügbare Aktionspunkte. */
  frei?: { rest: number; von: number };
}) {
  const [fokus, setFokus] = useState<Knoten | null>(null);
  const [hover, setHover] = useState<Knoten | null>(null);
  const [live, setLive] = useState(true);
  const [ergebnisse, setErgebnisse] = useState(false);
  const aktiv = hover ?? fokus;

  const pfad = useMemo(() => new Set([...(schleife ? SCHLEIFEN_KANTEN[schleife] ?? [] : []), ...(markiert ?? [])]
    .map(([a, b]) => `${a}>${b}`)), [schleife, markiert]);
  const erste = useMemo(() => new Set(hervorheben), [hervorheben]);
  const zweite = useMemo(() => {
    const s = new Set<Knoten>();
    for (const k of KANTEN) if (erste.has(k.von) && k.art !== "ergebnis") s.add(k.nach);
    return s;
  }, [erste]);

  const gezeigt = KANTEN.filter((k) => ergebnisse || k.art !== "ergebnis" || aktiv === k.nach || aktiv === k.von);
  const irgendwas = aktiv !== null || erste.size > 0 || pfad.size > 0;

  function stil(k: Kante): { ton: Ton; breite: number; deck: number; beschriften: boolean } {
    // Wo gerade Punkte hineinfließen, zählt, was *mehr* davon bewirkt – nicht der heutige Druck.
    const d = live && !erste.has(k.von) ? druck(z, k) : k.staerke;
    let ton: Ton;
    if (k.art === "entscheidung") ton = "du";
    else if (k.art === "ergebnis" && k.nach === "lq") ton = "aus";
    else {
      const g = gutFuerZiel(k, d);
      ton = g === null ? "neutral" : live && Math.abs(d) < 0.15 ? "aus" : g ? "gut" : "schlecht";
    }
    let breite = k.art === "entscheidung"
      ? 1 + (einsatz?.[k.nach as Groesse] ?? 0) * 1.2
      : 0.8 + Math.min(4, Math.abs(d) * (live ? 1.6 : 0.9));
    let deck = irgendwas ? 0.07 : 0.4;
    let beschriften = false;
    if (aktiv && (k.von === aktiv || k.nach === aktiv)) { deck = 0.95; beschriften = true; }
    if (pfad.has(schluessel(k))) { deck = 1; beschriften = true; breite += 1.5; }
    if (!aktiv && erste.size) {
      if (k.art === "entscheidung" && erste.has(k.nach)) deck = 1;
      else if (erste.has(k.von)) { deck = 0.95; beschriften = true; }
      else if (zweite.has(k.von) && k.art !== "entscheidung") deck = Math.max(deck, 0.35);
    }
    if (k.art === "entscheidung" && !erste.has(k.nach) && !(aktiv && (k.nach === aktiv || k.von === aktiv))) deck = Math.min(deck, 0.15);
    return { ton, breite, deck, beschriften };
  }

  const reihenfolge = [...gezeigt].map((k) => ({ k, s: stil(k) })).sort((a, b) => a.s.deck - b.s.deck);

  const knotenListe: Knoten[] = [...KREIS, ...MITTE];
  const info = aktiv ? {
    raus: KANTEN.filter((k) => k.von === aktiv && k.art !== "ergebnis"),
    rein: KANTEN.filter((k) => k.nach === aktiv && k.art !== "entscheidung"),
  } : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="inline-flex rounded-xl border border-[var(--border)] p-1 bg-[var(--surface)]">
          {([[true, "⚡ Jetzt"], [false, "📘 Regeln"]] as const).map(([w, t]) => (
            <button key={t} onClick={() => setLive(w)} aria-pressed={live === w}
              className={`px-3 py-1 rounded-lg font-bold ${live === w ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)]"}`}>{t}</button>
          ))}
        </div>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={ergebnisse} onChange={(e) => setErgebnisse(e.target.checked)} />
          Pfeile zu Lebensqualität und Leviathan
        </label>
        {fokus && <button onClick={() => setFokus(null)} className="underline text-[var(--text-muted)]">Auswahl aufheben</button>}
      </div>

      <svg viewBox={`0 0 ${B} ${B}`} className="w-full max-h-[80vh]" role="img"
        aria-label="Wirkungsnetz: Kreis aus allen Bereichen, Pfeile zeigen, wer wen beeinflusst">
        <defs>
          <style>{"@keyframes lvFluss { to { stroke-dashoffset: -36; } }"}</style>
          {(Object.keys(FARBE) as Ton[]).map((t) => (
            <marker key={t} id={`lv-pfeil-${t}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: FARBE[t] }} />
            </marker>
          ))}
        </defs>

        {reihenfolge.map(({ k, s }, i) => {
          const b = bahn(k.von, k.nach);
          return (
            <g key={i} style={{ opacity: s.deck, transition: "opacity 200ms" }}>
              <path d={b.d} markerEnd={`url(#lv-pfeil-${s.ton})`}
                style={fliessen > 0 && pfad.has(schluessel(k))
                  ? { fill: "none", stroke: FARBE[s.ton], strokeWidth: s.breite + 1, strokeDasharray: "10 8", animation: `lvFluss ${fliessen}s linear infinite` }
                  : { fill: "none", stroke: FARBE[s.ton], strokeWidth: s.breite, strokeDasharray: k.verzoegerung > 0 ? "7 5" : undefined }} />
              {s.beschriften && k.art !== "entscheidung" && (
                <g>
                  <circle cx={b.mitte.x} cy={b.mitte.y} r={k.verzoegerung ? 15 : 10} style={{ fill: "var(--surface)", stroke: FARBE[s.ton], strokeWidth: 1.5 }} />
                  <text x={b.mitte.x} y={b.mitte.y + (k.verzoegerung ? -1 : 4)} textAnchor="middle"
                    style={{ fill: "var(--text)", fontSize: 13, fontWeight: 900 }}>{k.staerke > 0 ? "+" : "−"}</text>
                  {k.verzoegerung > 0 && (
                    <text x={b.mitte.x} y={b.mitte.y + 10} textAnchor="middle" style={{ fill: "var(--text-muted)", fontSize: 8 }}>{k.verzoegerung * 2} J.</text>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {knotenListe.map((k) => {
          const p = lage(k);
          const ersatz = werte?.[k as Groesse];
          const w = ersatz !== undefined ? { ring: ersatz, text: String(Math.round(ersatz)) }
            : k === "aktionspunkte" && frei ? { ring: (Math.max(0, frei.rest) / Math.max(1, frei.von)) * 100, text: `${frei.rest}/${frei.von}` }
            : knotenWert(z, k);
          const istHebel = (HEBEL as Knoten[]).includes(k);
          const gewaehlt = aktiv === k || erste.has(k);
          const gut = HOCH_SCHLECHT.has(k as Groesse) ? 100 - w.ring : w.ring;
          const ringFarbe = k === "bevoelkerung" || k === "leviathan" ? "#60a5fa" : gut >= 60 ? "var(--green)" : gut >= 35 ? "var(--accent)" : "var(--red)";
          const umfang = 2 * Math.PI * (p.r - 3);
          const blass = irgendwas && !gewaehlt && !(aktiv && KANTEN.some((x) => (x.von === aktiv && x.nach === k) || (x.nach === aktiv && x.von === k)))
            && !zweite.has(k) && ![...pfad].some((s) => s.split(">").includes(k));
          const info = KNOTEN_INFO[k];
          return (
            <g key={k} role="button" tabIndex={0} aria-pressed={fokus === k} aria-label={`${info.name}: ${w.text}`}
              onClick={() => setFokus((f) => (f === k ? null : k))}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFokus((f) => (f === k ? null : k)); } }}
              onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(k); }}
              onPointerLeave={() => setHover(null)}
              style={{ cursor: "pointer", opacity: blass ? 0.45 : 1, transition: "opacity 200ms" }}>
              {istHebel
                ? <rect x={p.x - p.r} y={p.y - p.r} width={2 * p.r} height={2 * p.r} rx={14}
                    style={{ fill: "var(--surface)", stroke: gewaehlt ? "var(--accent)" : "var(--border)", strokeWidth: gewaehlt ? 3.5 : 2 }} />
                : <circle cx={p.x} cy={p.y} r={p.r}
                    style={{ fill: MITTE.includes(k) ? "var(--surface-hover)" : "var(--surface)", stroke: gewaehlt ? "var(--accent)" : "var(--border)", strokeWidth: gewaehlt ? 3.5 : 2 }} />}
              <circle cx={p.x} cy={p.y} r={p.r - 3} transform={`rotate(-90 ${p.x} ${p.y})`}
                style={{ fill: "none", stroke: ringFarbe, strokeWidth: 4, strokeDasharray: `${(Math.max(0, Math.min(100, w.ring)) / 100) * umfang} ${umfang}`, opacity: 0.85 }} />
              <text x={p.x} y={p.y - 3} textAnchor="middle" style={{ fontSize: 22 }}>{info.icon}</text>
              <text x={p.x} y={p.y + 17} textAnchor="middle" style={{ fill: "var(--text)", fontSize: 12, fontWeight: 900 }}>{w.text}</text>
              <text x={p.x} y={p.y + p.r + 15} textAnchor="middle" style={{ fill: "var(--text)", fontSize: 12, fontWeight: 700 }}>{kurzName(info.name)}</text>
              {istHebel && (einsatz?.[k as Groesse] ?? 0) > 0 && (
                <g>
                  <circle cx={p.x - p.r + 2} cy={p.y - p.r + 2} r={11} style={{ fill: "var(--accent)" }} />
                  <text x={p.x - p.r + 2} y={p.y - p.r + 6} textAnchor="middle" style={{ fill: "var(--accent-text,#111)", fontSize: 12, fontWeight: 900 }}>{einsatz?.[k as Groesse]}</text>
                </g>
              )}
              {istHebel && onPlus && onMinus && !(z.gesperrt[k as Hebel] ?? 0) && (
                <>
                  <KnopfSvg x={p.x + p.r + 13} y={p.y - 12} zeichen="+" label={`${info.name}: ein Punkt dazu`} onClick={() => onPlus(k as Hebel)} />
                  <KnopfSvg x={p.x + p.r + 13} y={p.y + 14} zeichen="−" label={`${info.name}: ein Punkt weniger`} onClick={() => onMinus(k as Hebel)} />
                </>
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
        <span><Strich ton="gut" /> {live ? "drückt gerade in die gute Richtung" : "steigt die Quelle, wird das Ziel besser"}</span>
        <span><Strich ton="schlecht" /> {live ? "drückt gerade in die schlechte Richtung" : "steigt die Quelle, wird das Ziel schlechter"}</span>
        <span><Strich ton="neutral" /> weder gut noch schlecht</span>
        <span><Strich ton="du" /> deine Aktionspunkte</span>
        <span><Strich ton="aus" gestrichelt /> wirkt erst nach Jahren</span>
        <span>▢ Hebel (du steuerst) · ◯ Folgen · Dicke = {live ? "Stärke gerade jetzt" : "Stärke der Regel"}</span>
      </div>

      {info && aktiv && (
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <Liste titel={`${KNOTEN_INFO[aktiv].icon} ${KNOTEN_INFO[aktiv].name} wirkt auf …`} kanten={info.raus} z={z} richtung="nach" live={live} />
          <Liste titel={`… und wird beeinflusst von`} kanten={info.rein} z={z} richtung="von" live={live} />
        </div>
      )}
      {!aktiv && (
        <p className="text-xs text-[var(--text-muted)]">
          Tippe auf einen Bereich, um seine Pfeile zu sehen. {hervorheben.length > 0 && "Die Bereiche, in die du gerade Punkte steckst, leuchten mit ihren Folgen auf – blasser die Folgen der Folgen."}
        </p>
      )}
    </div>
  );
}

function KnopfSvg({ x, y, zeichen, label, onClick }: { x: number; y: number; zeichen: string; label: string; onClick: () => void }) {
  return (
    <g role="button" tabIndex={0} aria-label={label} style={{ cursor: "pointer" }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onClick(); } }}>
      <circle cx={x} cy={y} r={11} style={{ fill: "var(--surface)", stroke: "var(--accent)", strokeWidth: 2 }} />
      <text x={x} y={y + 5} textAnchor="middle" style={{ fill: "var(--text)", fontSize: 16, fontWeight: 900 }}>{zeichen}</text>
    </g>
  );
}

function kurzName(s: string): string {
  return s.replace(" & Medienkompetenz", "").replace(" & Gesundheit", "").replace(" & Transparenz", "")
    .replace(" & Integration", "").replace("Klima- & Umweltlast", "Klimalast");
}

function Strich({ ton, gestrichelt = false }: { ton: Ton; gestrichelt?: boolean }) {
  return (
    <svg width="22" height="8" className="inline align-middle" aria-hidden>
      <line x1="1" y1="4" x2="21" y2="4" style={{ stroke: FARBE[ton], strokeWidth: 3, strokeDasharray: gestrichelt ? "5 3" : undefined }} />
    </svg>
  );
}

function Liste({ titel, kanten, z, richtung, live }: {
  titel: string; kanten: Kante[]; z: Zustand; richtung: "von" | "nach"; live: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-3">
      <div className="font-bold mb-1">{titel}</div>
      {kanten.length === 0 && <div className="text-[var(--text-muted)]">nichts direkt</div>}
      <ul className="space-y-1.5">
        {kanten.map((k, i) => {
          const d = druck(z, k);
          const g = gutFuerZiel(k, live ? d : k.staerke);
          const andere = KNOTEN_INFO[k[richtung]];
          return (
            <li key={i}>
              <span className="font-bold">{andere.icon} {andere.name}</span>{" "}
              <span style={{ color: g === null ? FARBE.neutral : g ? FARBE.gut : FARBE.schlecht }}>{k.staerke > 0 ? "(+)" : "(−)"}</span>
              {k.verzoegerung > 0 && <span className="text-[var(--text-muted)]"> nach {k.verzoegerung * 2} J.</span>}
              {live && k.art !== "entscheidung" && k.art !== "ergebnis" && Math.abs(d) >= 0.15 && (
                <span className="text-[var(--text-muted)]"> · drückt gerade {d > 0 ? "hoch" : "runter"}</span>
              )}
              <div className="text-xs text-[var(--text-muted)]">{k.text ?? QUELLEN[k.quelle]?.befund}</div>
              {k.quelle !== "annahme" && <QuelleLink id={k.quelle} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
