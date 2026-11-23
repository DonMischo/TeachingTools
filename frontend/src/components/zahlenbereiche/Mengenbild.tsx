"use client";
/**
 * Mengendiagramm ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ: ineinander liegende Felder, jede Zahl steht im
 * innersten Feld, zu dem sie gehört. Eigene Zahlen eintippen oder würfeln;
 * »Einsortieren« stellt eine Zahl hin, die man selbst ins richtige Feld tippt.
 */
import { useMemo, useState, type MouseEvent } from "react";
import {
  BEREICHE, begruendung, FARBE, kleinsterBereich, leseZahl, schluessel, STECKBRIEFE, wuerfleZahl, ZEICHEN, type Bereich, type Zahl,
} from "@/lib/zahlenbereiche";
import { BereichZeichen, ZahlAnzeige } from "./teile";

const B = 800, H = 470;
/** Felder als Rechtecke, außen → innen; »frei« = der Streifen, der nur diesem Bereich gehört */
const FELD: Record<Bereich, { x: number; y: number; w: number; h: number; frei: [number, number] }> = {
  R: { x: 8, y: 8, w: 784, h: 454, frei: [600, 790] },
  Q: { x: 28, y: 52, w: 570, h: 398, frei: [420, 596] },
  Z: { x: 48, y: 96, w: 370, h: 342, frei: [262, 416] },
  N: { x: 68, y: 140, w: 192, h: 286, frei: [70, 258] },
};
const INNEN_NACH_AUSSEN: Bereich[] = ["N", "Z", "Q", "R"];

const START: Zahl[] = [
  { art: "ganz", n: 0 }, { art: "ganz", n: 7 }, { art: "ganz", n: 42 }, { art: "wurzel", minus: false, r: 16 },
  { art: "ganz", n: -3 }, { art: "ganz", n: -100 }, { art: "bruch", z: -12, n: 4 },
  { art: "bruch", z: 3, n: 4 }, { art: "dez", minus: true, ganz: 2, vor: "5", periode: "" }, { art: "dez", minus: false, ganz: 0, vor: "", periode: "3" },
  { art: "wurzel", minus: false, r: 2 }, { art: "konst", name: "π" }, { art: "konst", name: "e" },
];

/** Platz im freien Streifen: zwei Spalten, von oben nach unten */
function platz(b: Bereich, k: number) {
  const f = FELD[b];
  const [x0, x1] = f.frei;
  const spalten = 2, zeilen = Math.max(1, Math.floor((f.h - 70) / 44));
  const s = k % spalten, z = Math.floor(k / spalten) % zeilen;
  return { x: x0 + ((s + 0.5) * (x1 - x0)) / spalten, y: f.y + 62 + z * 44 };
}

export default function Mengenbild() {
  const [zahlen, setZahlen] = useState<Zahl[]>(START);
  const [gewaehlt, setGewaehlt] = useState<Bereich | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState("");
  const [sortieren, setSortieren] = useState<Zahl | null>(null);
  const [rueck, setRueck] = useState<{ ok: boolean; text: string } | null>(null);
  const [punkte, setPunkte] = useState({ richtig: 0, gesamt: 0 });

  const plaetze = useMemo(() => {
    const zaehler: Record<Bereich, number> = { N: 0, Z: 0, Q: 0, R: 0 };
    return zahlen.map(x => { const b = kleinsterBereich(x); return { zahl: x, b, ...platz(b, zaehler[b]++) }; });
  }, [zahlen]);

  const dazu = (x: Zahl) => setZahlen(zs => (zs.some(z => schluessel(z) === schluessel(x)) ? zs : [...zs, x].slice(-40)));

  const eintragen = () => {
    const x = leseZahl(eingabe);
    if (!x) { setFehler("Nicht verstanden. Beispiele: 7, −3, 3/4, 2,5, 0,(3), √2, pi"); return; }
    setFehler(""); setEingabe(""); dazu(x); setGewaehlt(kleinsterBereich(x));
    setRueck({ ok: true, text: begruendung(x) });
  };

  const neueAufgabe = () => { setSortieren(wuerfleZahl(Math.random, 2)); setRueck(null); };

  const klick = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * B, py = ((e.clientY - r.top) / r.height) * H;
    const b = INNEN_NACH_AUSSEN.find(k => { const f = FELD[k]; return px >= f.x && px <= f.x + f.w && py >= f.y && py <= f.y + f.h; });
    if (!b) return;
    if (!sortieren) { setGewaehlt(b); return; }
    const soll = kleinsterBereich(sortieren);
    const ok = b === soll;
    setPunkte(p => ({ richtig: p.richtig + (ok ? 1 : 0), gesamt: p.gesamt + 1 }));
    setRueck({ ok, text: ok ? begruendung(sortieren) : `Nicht ganz: Die Zahl gehört ins innerste Feld ${ZEICHEN[soll]}. ${begruendung(sortieren)}` });
    dazu(sortieren);
    setGewaehlt(soll);
    setSortieren(null);
  };

  const brief = STECKBRIEFE.find(s => s.b === gewaehlt);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="card p-3 flex flex-col gap-3">
        <div className="relative w-full" style={{ aspectRatio: `${B} / ${H}` }}>
          <svg viewBox={`0 0 ${B} ${H}`} className="absolute inset-0 w-full h-full cursor-pointer select-none" onClick={klick}
            role="img" aria-label="Mengendiagramm der Zahlenbereiche">
            {[...BEREICHE].reverse().map(b => {
              const f = FELD[b];
              const an = gewaehlt === b;
              return (
                <g key={b}>
                  <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={28} fill={FARBE[b]} fillOpacity={an ? 0.22 : 0.08}
                    stroke={FARBE[b]} strokeWidth={an ? 5 : 3} />
                  <text x={f.x + 16} y={f.y + 38} fontSize={30} fontWeight={900} fill={FARBE[b]}>{ZEICHEN[b]}</text>
                </g>
              );
            })}
          </svg>
          {plaetze.map(p => (
            <div key={schluessel(p.zahl)} className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-lg bg-surface/90 px-1.5 shadow-sm"
              style={{ left: `${(p.x / B) * 100}%`, top: `${(p.y / H) * 100}%`, color: FARBE[p.b] }}>
              <ZahlAnzeige x={p.zahl} />
            </div>
          ))}
          {sortieren && (
            <div className="absolute left-1/2 bottom-2 -translate-x-1/2 rounded-xl border-2 border-accent bg-surface px-4 py-2 shadow-lg pointer-events-none animate-pulse">
              <ZahlAnzeige x={sortieren} gross />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Eigene Zahl (7, −3, 3/4, 2,5, 0,(3), √2, pi)</span>
            <input className="input w-48" value={eingabe} onChange={e => setEingabe(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") eintragen(); }} aria-label="Eigene Zahl" />
          </label>
          <button className="btn-primary" onClick={eintragen}>Eintragen</button>
          <button className="btn-secondary" onClick={() => dazu(wuerfleZahl(Math.random, 3))}>🎲 Zufallszahl</button>
          <button className="btn-secondary" onClick={() => { setZahlen([]); setRueck(null); }}>Leeren</button>
          <button className="btn-secondary" onClick={neueAufgabe}>🎯 Einsortieren</button>
          {punkte.gesamt > 0 && <span className="text-sm font-bold">{punkte.richtig} / {punkte.gesamt} richtig</span>}
        </div>
        {fehler && <p className="text-sm text-bad">{fehler}</p>}
        {sortieren && <p className="text-sm font-bold">Tippe ins <em>innerste</em> Feld, zu dem die Zahl gehört.</p>}
        {rueck && <p className={`text-sm ${rueck.ok ? "text-ok" : "text-bad"}`}>{rueck.ok ? "✔ " : "✘ "}{rueck.text}</p>}
      </div>

      <aside className="card p-4 flex flex-col gap-2">
        {brief ? (
          <>
            <h3 className="font-black text-lg"><BereichZeichen b={brief.b} /> — {brief.name}</h3>
            <p className="font-mono text-sm">{brief.menge}</p>
            <p className="text-sm">{brief.warum}</p>
            <ul className="text-sm list-disc pl-5">{brief.eigenschaften.map(e => <li key={e}>{e}</li>)}</ul>
            <p className="text-sm"><b>Beispiele:</b> {brief.beispiele.join("; ")}</p>
          </>
        ) : (
          <p className="text-sm text-muted">Tippe auf ein Feld, um zu sehen, welche Zahlen dazugehören. Jede Zahl steht im innersten Feld — sie gehört aber auch zu allen Feldern, die drumherum liegen: 7 ist natürlich, ganz, rational und reell.</p>
        )}
        <p className="text-xs text-muted mt-auto">ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ — jeder Bereich steckt im nächsten, wie Matroschka-Puppen.</p>
      </aside>
    </div>
  );
}
