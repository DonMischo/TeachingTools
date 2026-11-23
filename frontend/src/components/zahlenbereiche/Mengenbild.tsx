"use client";
/**
 * Mengendiagramm ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ: ineinander liegende Ellipsen, Hover-Karten mit Beispielen, jede Zahl steht im
 * innersten Feld, zu dem sie gehört. Eigene Zahlen eintippen oder würfeln;
 * »Einsortieren« stellt eine Zahl hin, die man selbst ins richtige Feld tippt.
 */
import { useMemo, useState, type MouseEvent } from "react";
import {
  BEREICHE, begruendung, bereicheVon, FARBE, kleinsterBereich, leseZahl, schluessel, STECKBRIEFE, text, wuerfleZahl, ZEICHEN, type Bereich, type Zahl,
} from "@/lib/zahlenbereiche";
import { BereichZeichen, ZahlAnzeige } from "./teile";

const B = 800, H = 470;
/** Ellipsen, außen → innen, nach links verschoben, damit jeder Ring rechts Platz für seine Zahlen hat */
const FELD: Record<Bereich, { cx: number; cy: number; rx: number; ry: number }> = {
  R: { cx: 400, cy: 235, rx: 392, ry: 228 },
  Q: { cx: 322, cy: 248, rx: 298, ry: 192 },
  Z: { cx: 245, cy: 262, rx: 205, ry: 150 },
  N: { cx: 168, cy: 276, rx: 112, ry: 104 },
};
const INNEN_NACH_AUSSEN: Bereich[] = ["N", "Z", "Q", "R"];
/** Wie weit (0 = Mitte, 1 = Rand) liegt ein Punkt in der Ellipse? */
const lage = (b: Bereich, x: number, y: number) => { const f = FELD[b]; return ((x - f.cx) / f.rx) ** 2 + ((y - f.cy) / f.ry) ** 2; };
export const innerstesFeld = (x: number, y: number): Bereich | null => INNEN_NACH_AUSSEN.find(b => lage(b, x, y) <= 1) ?? null;

/** Freie Plätze je Ring: Rasterpunkte, die sicher im Ring liegen (Abstand zu beiden Rändern) */
export const PLAETZE: Record<Bereich, { x: number; y: number }[]> = (() => {
  const aus: Record<Bereich, { x: number; y: number }[]> = { N: [], Z: [], Q: [], R: [] };
  for (let y = 40; y <= H - 30; y += 46) for (let x = 40; x <= B - 30; x += 62) {
    const b = innerstesFeld(x, y);
    if (!b) continue;
    const innen = INNEN_NACH_AUSSEN[INNEN_NACH_AUSSEN.indexOf(b) - 1];
    // nicht zu nah am eigenen Rand, nicht zu nah am inneren Feld, nicht auf dem Beschriftungsplatz
    const f = FELD[b];
    const randAbstand = ((x - f.cx) / (f.rx - 34)) ** 2 + ((y - f.cy) / (f.ry - 26)) ** 2 <= 1;
    const vomInneren = !innen || ((x - FELD[innen].cx) / (FELD[innen].rx + 34)) ** 2 + ((y - FELD[innen].cy) / (FELD[innen].ry + 26)) ** 2 > 1;
    const beschriftung = Math.hypot(x - (f.cx - f.rx * 0.62), y - (f.cy - f.ry * 0.62)) < 40;
    if (randAbstand && vomInneren && !beschriftung) aus[b].push({ x, y });
  }
  // rechts zuerst füllen (dort ist jeder Ring am breitesten), dann von oben nach unten
  for (const b of BEREICHE) aus[b].sort((p, q) => q.x - p.x || p.y - q.y);
  return aus;
})();

const START: Zahl[] = [
  { art: "ganz", n: 0 }, { art: "ganz", n: 7 }, { art: "ganz", n: 42 }, { art: "wurzel", minus: false, r: 16 },
  { art: "ganz", n: -3 }, { art: "ganz", n: -100 }, { art: "bruch", z: -12, n: 4 },
  { art: "bruch", z: 3, n: 4 }, { art: "dez", minus: true, ganz: 2, vor: "5", periode: "" }, { art: "dez", minus: false, ganz: 0, vor: "", periode: "3" },
  { art: "wurzel", minus: false, r: 2 }, { art: "konst", name: "π" }, { art: "konst", name: "e" },
];

function platz(b: Bereich, k: number) {
  const ps = PLAETZE[b];
  return ps.length ? ps[k % ps.length] : { x: FELD[b].cx, y: FELD[b].cy };
}

/** Die gestaltete Hover-Karte */
type Schwebe = { art: "bereich"; b: Bereich; x: number; y: number } | { art: "zahl"; zahl: Zahl; b: Bereich; x: number; y: number };

function SchwebeKarte({ s, zahlen }: { s: Schwebe; zahlen: Zahl[] }) {
  const brief = STECKBRIEFE.find(x => x.b === s.b)!;
  const links = s.x > B * 0.55, oben = s.y > H * 0.5;
  return (
    <div role="tooltip" className="absolute z-20 w-72 max-w-[80%] pointer-events-none rounded-2xl border-2 bg-surface p-4 shadow-2xl flex flex-col gap-2"
      style={{
        left: `${(s.x / B) * 100}%`, top: `${(s.y / H) * 100}%`, borderColor: FARBE[s.b],
        transform: `translate(${links ? "calc(-100% - 18px)" : "18px"}, ${oben ? "calc(-100% - 12px)" : "12px"})`,
      }}>
      {s.art === "zahl" ? (
        <>
          <div className="flex items-center gap-3">
            <span className="rounded-xl px-3 py-1" style={{ background: FARBE[s.b] + "22", color: FARBE[s.b] }}><ZahlAnzeige x={s.zahl} gross /></span>
            <span className="text-sm">liegt in {bereicheVon(s.zahl).map(b => <BereichZeichen key={b} b={b} className="text-lg mx-0.5" />)}</span>
          </div>
          <p className="text-sm">{begruendung(s.zahl)}</p>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <BereichZeichen b={s.b} className="text-3xl" />
            <span className="font-black text-lg">{brief.name}</span>
          </div>
          <p className="font-mono text-sm">{brief.menge}</p>
          <p className="text-sm text-muted">{brief.warum}</p>
          <div className="flex flex-wrap gap-1.5">
            {brief.beispiele.map(x => <span key={x} className="rounded-lg px-2 py-0.5 text-sm font-bold" style={{ background: FARBE[s.b] + "22", color: FARBE[s.b] }}>{x}</span>)}
          </div>
          {zahlen.length > 0 && <p className="text-xs text-muted">Hier im Bild: {zahlen.map(text).join("; ")}</p>}
          <p className="text-xs text-muted">Antippen zeigt den ganzen Steckbrief.</p>
        </>
      )}
    </div>
  );
}

export default function Mengenbild() {
  const [zahlen, setZahlen] = useState<Zahl[]>(START);
  const [gewaehlt, setGewaehlt] = useState<Bereich | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState("");
  const [sortieren, setSortieren] = useState<Zahl | null>(null);
  const [rueck, setRueck] = useState<{ ok: boolean; text: string } | null>(null);
  const [punkte, setPunkte] = useState({ richtig: 0, gesamt: 0 });
  const [schwebe, setSchwebe] = useState<Schwebe | null>(null);

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
    const b = innerstesFeld(px, py);
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
            onPointerMove={e => {
              const r = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * B, py = ((e.clientY - r.top) / r.height) * H;
              const b = innerstesFeld(px, py);
              setSchwebe(b ? { art: "bereich", b, x: px, y: py } : null);
            }}
            onPointerLeave={() => setSchwebe(null)}
            role="img" aria-label="Mengendiagramm der Zahlenbereiche">
            {[...BEREICHE].reverse().map(b => {
              const f = FELD[b];
              const an = gewaehlt === b || (schwebe?.art === "bereich" && schwebe.b === b);
              return (
                <g key={b}>
                  <ellipse cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} fill={FARBE[b]} fillOpacity={an ? 0.2 : 0.07}
                    stroke={FARBE[b]} strokeWidth={an ? 5 : 3} style={{ transition: "fill-opacity 200ms, stroke-width 200ms" }} />
                  <text x={f.cx - f.rx * 0.62} y={f.cy - f.ry * 0.62 + 10} fontSize={32} fontWeight={900} fill={FARBE[b]} textAnchor="middle">{ZEICHEN[b]}</text>
                </g>
              );
            })}
          </svg>
          {plaetze.map(p => (
            <div key={schluessel(p.zahl)} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface/90 px-1.5 shadow-sm cursor-help transition-transform hover:scale-125 hover:z-10"
              style={{ left: `${(p.x / B) * 100}%`, top: `${(p.y / H) * 100}%`, color: FARBE[p.b] }}
              onPointerEnter={() => setSchwebe({ art: "zahl", zahl: p.zahl, b: p.b, x: p.x, y: p.y })}
              onPointerLeave={() => setSchwebe(null)}>
              <ZahlAnzeige x={p.zahl} />
            </div>
          ))}
          {schwebe && !sortieren && <SchwebeKarte s={schwebe} zahlen={plaetze.filter(p => schwebe.art === "bereich" && p.b === schwebe.b).map(p => p.zahl)} />}
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
