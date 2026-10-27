"use client";
/**
 * Saftbar: Bestellungen mixen. Zapfhahn gedrückt halten gießt ein, +10/+1
 * gießt genau nach. Das Glas zeigt nur die Menge — wie viel Prozent Saft
 * drin sind, verrät es erst beim Servieren. Sechs Gäste je Schicht.
 */
import { useEffect, useRef, useState } from "react";
import { ZUTATEN, bewerte, erzeugeBestellung, mischung, rechenweg, type Bestellung, type Stufe, type Urteil, type ZutatId } from "@/lib/saftbar";
import { euro, z } from "@/lib/prozent";

const GAESTE = 6;
const RATE = 60; // ml pro Sekunde beim Gedrückthalten
const SCHLUESSEL = "hp_prozent_saftbar_best";

const STUFEN: { id: Stufe; label: string; text: string }[] = [
  { id: 1, label: "⭐ Saft + Wasser", text: "Schorle aus Saft und Wasser." },
  { id: 2, label: "⭐⭐ mit Nektar", text: "Nektar ist nur halb Saft." },
  { id: 3, label: "⭐⭐⭐ Nachbessern", text: "Ein Glas steht schon da — verdünnen oder verstärken." },
];

function hex(c: string) { return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); }
/** Farbe der Mischung: Wasser hellblau, sonst von blassem Orange (wenig Saft) bis Saft. */
function farbe(prozent: number) {
  if (prozent <= 0.5) return ZUTATEN.wasser.farbe;
  const a = hex("#fff3e0"), b = hex(ZUTATEN.saft.farbe), t = Math.max(0, Math.min(1, prozent / 100));
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(",")})`;
}

const liesBest = (s: Stufe) => { try { return Number(localStorage.getItem(`${SCHLUESSEL}_${s}`)) || 0; } catch { return 0; } };
const schreibBest = (s: Stufe, n: number) => { try { localStorage.setItem(`${SCHLUESSEL}_${s}`, String(n)); } catch { /* privat */ } };

function GlasBild({ b, teile, giesst }: { b: Bestellung; teile: Partial<Record<ZutatId, number>>; giesst: ZutatId | null }) {
  const m = mischung(b.start, teile);
  const H = 300, W = 170, oben = 40, unten = oben + H, x0 = 40;
  const sy = (ml: number) => unten - (ml / b.kapazitaet) * H;
  const marken = Array.from({ length: Math.floor(b.kapazitaet / 50) }, (_, i) => (i + 1) * 50);
  return (
    <svg viewBox={`0 0 ${x0 + W + 70} ${unten + 20}`} className="w-full h-auto max-h-[48vh]" role="img" aria-label={`Glas mit ${Math.round(m.ml)} ml`}>
      {giesst && <rect x={x0 + W / 2 - 6} y={0} width={12} height={sy(m.ml)} rx={6} fill={ZUTATEN[giesst].farbe} opacity={0.9} />}
      {m.ml > 0 && <rect x={x0 + 3} y={sy(m.ml)} width={W - 6} height={unten - sy(m.ml) - 3} fill={farbe(m.prozent)} opacity={0.85} />}
      <path d={`M ${x0} ${oben - 10} L ${x0} ${unten - 8} Q ${x0} ${unten} ${x0 + 8} ${unten} L ${x0 + W - 8} ${unten} Q ${x0 + W} ${unten} ${x0 + W} ${unten - 8} L ${x0 + W} ${oben - 10}`}
        fill="none" strokeWidth={4} style={{ stroke: "var(--text)" }} />
      {marken.map(ml => (
        <g key={ml}>
          <line x1={x0 + W - (ml % 100 ? 14 : 26)} x2={x0 + W} y1={sy(ml)} y2={sy(ml)} strokeWidth={2} style={{ stroke: "var(--text)" }} />
          {ml % 100 === 0 && <text x={x0 + W + 8} y={sy(ml)} dominantBaseline="central" fontSize={15} fontWeight={700} style={{ fill: "var(--text)" }}>{ml} ml</text>}
        </g>
      ))}
    </svg>
  );
}

export default function Saftbar() {
  const [stufe, setStufe] = useState<Stufe | null>(null);
  const [nr, setNr] = useState(0);
  const [b, setB] = useState<Bestellung | null>(null);
  const [teile, setTeile] = useState<Partial<Record<ZutatId, number>>>({});
  const [giesst, setGiesst] = useState<ZutatId | null>(null);
  const [urteil, setUrteil] = useState<Urteil | null>(null);
  const [tipp, setTipp] = useState(false);
  const [kasse, setKasse] = useState({ geld: 0, sterne: 0 });
  const [best, setBest] = useState(0);
  const [ueber, setUeber] = useState(false);
  const letzte = useRef(0);
  const teileRef = useRef(teile);
  const setzeTeile = (t: Partial<Record<ZutatId, number>>) => { teileRef.current = t; setTeile(t); };

  // Gedrückt halten: alle 40 ms nach vergangener Zeit nachgießen.
  useEffect(() => {
    if (!giesst || !b) return;
    letzte.current = performance.now();
    const id = setInterval(() => {
      const t = performance.now(), dt = (t - letzte.current) / 1000;
      letzte.current = t;
      const alt = teileRef.current;
      const plus = Math.min(RATE * dt, b.kapazitaet - mischung(b.start, alt).ml);
      if (plus <= 0) { setUeber(true); setGiesst(null); return; }
      setzeTeile({ ...alt, [giesst]: (alt[giesst] ?? 0) + plus });
    }, 40);
    return () => clearInterval(id);
  }, [giesst, b]);

  const starte = (s: Stufe) => {
    setStufe(s); setNr(1); setKasse({ geld: 0, sterne: 0 }); setBest(liesBest(s)); neuerGast(s);
  };
  const neuerGast = (s: Stufe) => {
    setB(erzeugeBestellung(s)); setzeTeile({}); setUrteil(null); setTipp(false); setUeber(false);
  };
  const plus = (id: ZutatId, ml: number) => {
    if (!b || urteil) return;
    const alt = teileRef.current;
    const frei = b.kapazitaet - mischung(b.start, alt).ml;
    if (frei <= 0) { setUeber(true); return; }
    setzeTeile({ ...alt, [id]: (alt[id] ?? 0) + Math.min(ml, frei) });
  };
  const servieren = () => {
    if (!b) return;
    setGiesst(null);
    const u = bewerte(b, mischung(b.start, teile));
    const geld = 2.5 + (tipp ? u.trinkgeld / 2 : u.trinkgeld);
    setUrteil(u);
    setKasse(k => ({ geld: k.geld + geld, sterne: k.sterne + u.sterne }));
  };
  const weiter = () => {
    if (nr >= GAESTE) {
      if (stufe && kasse.sterne > liesBest(stufe)) { schreibBest(stufe, kasse.sterne); setBest(kasse.sterne); }
      setNr(GAESTE + 1);
      return;
    }
    setNr(n => n + 1); neuerGast(stufe!);
  };

  if (!stufe) {
    return (
      <div className="flex flex-col gap-4 items-center text-center">
        <h2 className="text-3xl font-black">🧃 Saftbar</h2>
        <p className="max-w-xl text-muted">
          Du stehst hinter der Theke. Jeder Gast will eine Schorle mit genau so viel Prozent Saft. Rechne aus, wie viel von
          was ins Glas muss, und gieß ein — Zapfhahn gedrückt halten, mit +10 und +1 genau nachgießen. Je genauer, desto mehr Trinkgeld.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {STUFEN.map(s => (
            <button key={s.id} className="btn flex flex-col items-start text-left max-w-56 py-3" onClick={() => starte(s.id)}>
              <span className="font-black">{s.label}</span>
              <span className="text-xs text-muted">{s.text}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (nr > GAESTE) {
    return (
      <div className="flex flex-col gap-3 items-center text-center">
        <h2 className="text-3xl font-black">🌙 Feierabend!</h2>
        <p className="text-4xl font-black">{euro(kasse.geld)}</p>
        <p className="text-muted">{kasse.sterne} von {GAESTE * 3} Sternen{kasse.sterne >= best && kasse.sterne > 0 ? " · 🏆 neuer Bestwert!" : ` · Bestwert ${best} ⭐`}</p>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => starte(stufe)}>↺ Neue Schicht</button>
          <button className="btn" onClick={() => setStufe(null)}>Stufe wechseln</button>
        </div>
      </div>
    );
  }

  if (!b) return null;
  const m = mischung(b.start, teile);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-black">Gast {nr} von {GAESTE}</span>
        <span>💶 {euro(kasse.geld)}</span>
        <span>⭐ {kasse.sterne}</span>
        <span className="flex-1" />
        <button className="btn text-xs" onClick={() => setStufe(null)}>Schicht beenden</button>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_minmax(220px,320px)] items-start">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="text-5xl" aria-hidden>{b.kunde}</span>
            <p className="rounded-2xl rounded-tl-none border border-line bg-page px-4 py-3 text-lg font-bold" data-testid="bestellung">{b.text}</p>
          </div>
          {b.start && <p className="text-sm text-muted">Im Glas sind schon {z(b.start.ml)} ml mit {z(b.start.prozent)} % Saft.</p>}

          {!urteil && (
            <>
              <div className="flex flex-col gap-2">
                {b.zutaten.map(id => (
                  <div key={id} className="flex flex-wrap items-center gap-2">
                    <button
                      className="btn-primary select-none touch-none min-w-52 text-left"
                      style={{ background: ZUTATEN[id].farbe, color: "#111" }}
                      onPointerDown={e => { e.preventDefault(); setGiesst(id); }}
                      onPointerUp={() => setGiesst(null)} onPointerLeave={() => setGiesst(null)} onPointerCancel={() => setGiesst(null)}
                    >
                      {ZUTATEN[id].emoji} {ZUTATEN[id].name} — halten
                    </button>
                    <button className="btn" onClick={() => plus(id, 10)}>+10 ml</button>
                    <button className="btn" onClick={() => plus(id, 1)}>+1 ml</button>
                    <span className="text-sm text-muted tabular-nums">{Math.round(teile[id] ?? 0)} ml eingegossen</span>
                  </div>
                ))}
              </div>
              <p className="text-lg">Im Glas: <strong className="tabular-nums">{Math.round(m.ml)} ml</strong>{ueber && <span className="text-bad font-bold"> — Glas voll!</span>}</p>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" onClick={servieren} disabled={m.ml === 0}>🛎️ Servieren</button>
                <button className="btn" onClick={() => { setzeTeile({}); setUeber(false); }}>🗑️ Wegkippen</button>
                <button className="btn" onClick={() => setTipp(true)} disabled={tipp}>💡 Tipp (halbes Trinkgeld)</button>
              </div>
              {tipp && <p className="text-sm rounded-lg bg-page border border-line px-3 py-2">{rechenweg(b)[0]}</p>}
            </>
          )}

          {urteil && (
            <div className="rounded-xl border border-line p-4 bg-page flex flex-col gap-2">
              <p className="text-2xl">{"⭐".repeat(urteil.sterne)}{"☆".repeat(3 - urteil.sterne)} <span className="font-black">{urteil.satz}</span></p>
              <p className="text-sm">
                Bestellt: {z(b.ziel.ml)} ml mit {z(b.ziel.prozent)} % · Bekommen: {z(m.ml, 0)} ml mit <strong>{z(m.prozent, 1)} %</strong>
                {" "}({urteil.dP >= 0 ? "+" : "−"}{z(Math.abs(urteil.dP), 1)} Prozentpunkte)
              </p>
              <p className="text-xs uppercase tracking-wide text-muted font-bold mt-1">So geht’s</p>
              <ol className="list-decimal pl-6 text-sm flex flex-col gap-0.5">
                {rechenweg(b).map((s, i) => <li key={i}>{s}</li>)}
              </ol>
              <button className="btn-primary self-start mt-1" onClick={weiter}>{nr >= GAESTE ? "Feierabend 🌙" : "Nächster Gast ▶"}</button>
            </div>
          )}
        </div>
        <GlasBild b={b} teile={teile} giesst={giesst} />
      </div>
    </div>
  );
}
