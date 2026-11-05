"use client";
/**
 * Spiel »Füllen«: fünf Behälter — Pools zum Hineinspringen, Ballon und
 * Luftmatratze zum Aufpumpen. Je Behälter drei Stufen:
 *   ① Schätzen: Wie viel passt ungefähr hinein? (Auswahl, Größenordnung)
 *   ② Genau: das Volumen in Litern ausrechnen.
 *   ③ Härtetest: so viel Wasser einlassen, dass der Kopfsprung gelingt
 *      (zu wenig — Flachköpper, zu viel — Land unter), bzw. so oft pumpen,
 *      dass es prall wird, aber nicht knallt.
 * Bis zu 100 Punkte je Behälter, Rekord im Browser.
 */
import { useEffect, useState } from "react";
import { leseZahl, z } from "@/lib/prozent";
import { BEHAELTER_REIHE, behaelter, hoeheBei, pumpe, schaetzOptionen, springe, zielRechnung, type Behaelter } from "@/lib/koerper-fuellen";
import { SkizzenBild } from "@/components/geometrie/Skizze";

const RUNDEN = 5, SCHLUESSEL = "hp_koerper_fuellen_best";
const liesBest = () => { try { return Number(localStorage.getItem(SCHLUESSEL)) || 0; } catch { return 0; } };
const schreibBest = (n: number) => { try { localStorage.setItem(SCHLUESSEL, String(n)); } catch { /* privat */ } };

type Stufe = "schaetzen" | "rechnen" | "test" | "zeigen" | "ergebnis";

/** Seitenansicht des Beckens mit steigendem Wasser und dem Springer. `t`: 0–1 füllen, 1–2 springen. */
function Becken({ b, liter, t }: { b: Behaelter; liter: number; t: number }) {
  const W = 520, Hp = 300;
  // links Platz fürs Sprungbrett, rechts für die Beschriftung
  const L = b.laenge ?? 10, k = Math.min((W - 180) / L, (Hp - 110) / b.H);
  const x0 = 70, y0 = Hp - 30; // Beckengrund (tiefste Stelle) bei y0
  const X = (u: number) => x0 + u * L * k, Y = (h: number) => y0 - h * k;
  const hEnde = hoeheBei(b, liter), ueber = hEnde > b.H + 1e-9;
  const h = Math.min(b.H, hEnde) * Math.min(1, t);
  const boden = (u: number) => b.boden?.(u) ?? 0;
  const N = 24;
  const bodenPts = Array.from({ length: N + 1 }, (_, i) => [X(i / N), Y(boden(i / N))] as const);
  // Wasser: über dem Boden bis zur Höhe h
  const wasser = h > 0 ? [
    ...bodenPts.filter(([, y]) => y >= Y(h)).map(([x, y]) => `${x},${y}`),
    ...bodenPts.filter(([, y]) => y >= Y(h)).reverse().map(([x]) => `${x},${Y(h)}`),
  ].join(" ") : "";
  // Springer: vom Brett links oben im Bogen ins Becken, Eintauchen nahe der tiefen Seite
  const s = Math.max(0, Math.min(1, t - 1));
  const sx = X(-0.06) + (X(0.18) - X(-0.06)) * s;
  const ziel = Y(boden(0.18)) - 14;
  const sy = Y(b.H + 0.9) + (ziel - Y(b.H + 0.9)) * s * s - Math.sin(s * Math.PI) * 50;
  const flach = t >= 2 && hEnde < b.T;
  return (
    <svg viewBox={`0 0 ${W} ${Hp}`} className="w-full h-auto rounded-xl border border-line bg-surface" role="img" aria-label={`${b.name} von der Seite`}>
      {/* Rasen und Sprungbrett */}
      <rect x={0} y={Y(b.H)} width={x0} height={Hp - Y(b.H)} className="fill-ok" fillOpacity={0.25} />
      <rect x={X(1)} y={Y(b.H)} width={W - X(1)} height={Hp - Y(b.H)} className="fill-ok" fillOpacity={0.25} />
      <rect x={X(-0.12)} y={Y(b.H + 0.35)} width={X(0.02) - X(-0.12)} height={6} className="fill-muted" />
      {/* Becken */}
      <polygon points={[`${X(0)},${Y(b.H)}`, ...bodenPts.map(([x, y]) => `${x},${y}`), `${X(1)},${Y(b.H)}`].join(" ")} className="fill-surface-hover stroke-fg" strokeWidth={3} strokeLinejoin="round" />
      {wasser && <polygon points={wasser} fill="#38bdf8" fillOpacity={0.6} />}
      {ueber && t >= 1 && <>
        <rect x={X(-0.08)} y={Y(b.H) - 4} width={X(0) - X(-0.08)} height={8} rx={4} fill="#38bdf8" fillOpacity={0.6} />
        <rect x={X(1)} y={Y(b.H) - 4} width={X(1.08) - X(1)} height={8} rx={4} fill="#38bdf8" fillOpacity={0.6} />
      </>}
      {/* Mindesttiefe */}
      <line x1={X(0)} x2={X(1)} y1={Y(b.T)} y2={Y(b.T)} stroke="#dc2626" strokeDasharray="6 5" strokeWidth={1.5} />
      <text x={X(1) + 6} y={Y(b.T)} fontSize={12} fill="#dc2626" dominantBaseline="central">min. {z(b.T)} m</text>
      <text x={X(1) + 6} y={Y(b.H) - 10} fontSize={12} className="fill-muted">Rand {z(b.H)} m</text>
      {t > 0 && <text x={W / 2} y={18} textAnchor="middle" fontSize={14} fontWeight={800} className="fill-fg">Wasserstand {z(Math.min(b.H, hEnde) * Math.min(1, t))} m</text>}
      {t >= 1 && <text x={sx} y={sy} fontSize={30} textAnchor="middle" dominantBaseline="central">{flach ? "😵" : t >= 2 ? "🫧" : "🤸"}</text>}
      {flach && <text x={sx + 22} y={sy - 18} fontSize={28}>💥</text>}
    </svg>
  );
}

function Pumpe({ b, anteil, t }: { b: Behaelter; anteil: number; t: number }) {
  const W = 520, Hp = 260;
  const a = anteil * Math.min(1, t);
  const peng = t >= 1 && anteil > 1 + 1e-9;
  return (
    <svg viewBox={`0 0 ${W} ${Hp}`} className="w-full h-auto rounded-xl border border-line bg-surface" role="img" aria-label={`${b.name} aufpumpen`}>
      {b.art === "ballon" ? (
        peng ? <text x={W / 2} y={Hp / 2} fontSize={90} textAnchor="middle" dominantBaseline="central">💥</text> : <>
          <ellipse cx={W / 2} cy={Hp / 2 - 10 + (1 - Math.min(1, a)) * 30} rx={95 * Math.cbrt(Math.min(1.05, a)) + 4} ry={(95 + (a < 0.9 ? -25 : 10)) * Math.cbrt(Math.min(1.05, a)) + 4}
            fill="#f43f5e" fillOpacity={0.8} stroke="#9f1239" strokeWidth={2} />
          <line x1={W / 2} y1={Hp / 2 + 90} x2={W / 2} y2={Hp - 6} className="stroke-muted" strokeWidth={2} />
        </>
      ) : (
        peng ? <text x={W / 2} y={Hp / 2} fontSize={90} textAnchor="middle" dominantBaseline="central">💥</text>
          : <rect x={70} y={Hp - 40 - 90 * Math.min(1.05, a)} width={W - 140} height={6 + 90 * Math.min(1.05, a)} rx={18}
            fill="#22c55e" fillOpacity={0.75} stroke="#166534" strokeWidth={2} />
      )}
      <text x={W / 2} y={20} textAnchor="middle" fontSize={14} fontWeight={800} className="fill-fg">{z(Math.min(1.5, a) * 100, 0)} % voll</text>
    </svg>
  );
}

export default function Fuellen() {
  const [runde, setRunde] = useState(0);
  const [b, setB] = useState<Behaelter | null>(null);
  const [schaetz, setSchaetz] = useState<{ optionen: number[]; richtig: number }>({ optionen: [], richtig: 0 });
  const [stufe, setStufe] = useState<Stufe | "start" | "ende">("start");
  const [wahl, setWahl] = useState<number | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [versuche, setVersuche] = useState(0);
  const [loesung, setLoesung] = useState(false);
  const [tipps, setTipps] = useState(0);
  const [menge, setMenge] = useState(0);
  const [t, setT] = useState(0);
  const [pkt, setPkt] = useState({ schaetzen: 0, rechnen: 0, test: 0 });
  const [summe, setSumme] = useState(0);
  const [best, setBest] = useState(0);
  const [reihe, setReihe] = useState(BEHAELTER_REIHE);
  useEffect(() => { setBest(liesBest()); }, []);

  const neu = (n: number, folge = reihe) => {
    const x = behaelter(folge[n % folge.length]);
    setB(x); setSchaetz(schaetzOptionen(x.V)); setRunde(n); setStufe("schaetzen"); setWahl(null); setEingabe(""); setVersuche(0);
    setLoesung(false); setTipps(0); setMenge(0); setT(0); setPkt({ schaetzen: 0, rechnen: 0, test: 0 });
  };
  const start = () => {
    const folge = [...BEHAELTER_REIHE].sort(() => Math.random() - 0.5);
    setReihe(folge); setSumme(0); neu(0, folge);
  };

  // Härtetest abspielen: füllen (1,2 s), dann springen (0,9 s)
  useEffect(() => {
    if (stufe !== "zeigen" || !b) return;
    const dauer = b.stoff === "wasser" ? 2100 : 1400, ende = b.stoff === "wasser" ? 2 : 1;
    const los = performance.now();
    let id = 0;
    const schritt = (jetzt: number) => {
      const x = Math.min(1, (jetzt - los) / dauer) * ende;
      setT(x);
      if (x < ende) id = requestAnimationFrame(schritt);
      else setStufe("ergebnis");
    };
    id = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(id);
  }, [stufe, b]);

  if (stufe === "start" || stufe === "ende" || !b) {
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <div className="text-4xl">💧</div>
        <h3 className="text-xl font-black">Füllen</h3>
        <p className="max-w-xl text-muted">
          {RUNDEN} Behälter mit Wasser oder Luft. Erst schätzen, wie viel hineinpasst, dann genau rechnen — und dann der Härtetest:
          Beim Becken springt jemand kopfüber hinein (zu wenig Wasser tut weh, zu viel läuft über), Ballon und Luftmatratze werden
          aufgepumpt, bis sie prall sind. Oder bis es knallt.
        </p>
        {stufe === "ende" && <p className="text-lg font-black">Ergebnis: {summe} von {RUNDEN * 100} Punkten {summe >= best && summe > 0 ? "🏆 neuer Rekord!" : ""}</p>}
        {best > 0 && <p className="text-sm text-muted">Dein Rekord: {best}</p>}
        <button className="btn btn-primary" onClick={start}>{stufe === "ende" ? "Nochmal" : "Los geht's"}</button>
      </div>
    );
  }

  const wasser = b.stoff === "wasser";
  const runden = pkt.schaetzen + pkt.rechnen + pkt.test;
  const pruefe = () => {
    const x = leseZahl(eingabe);
    const ok = x !== null && Math.abs(x - b.V) <= b.V * 0.02;
    setVersuche(v => v + 1);
    if (ok) { setPkt(p => ({ ...p, rechnen: loesung ? 0 : tipps ? 15 : versuche === 0 ? 30 : 20 })); setEingabe(""); setStufe("test"); }
  };
  const testen = () => {
    const x = leseZahl(eingabe);
    if (x === null || x < 0) return;
    setMenge(x);
    const gut = wasser ? springe(b, x).stufe === "gut" : pumpe(b, x).stufe === "prall";
    setPkt(p => ({ ...p, test: gut ? 40 : 0 }));
    setT(0); setStufe("zeigen");
  };
  const weiter = () => {
    const s = summe + runden;
    setSumme(s);
    if (runde + 1 >= RUNDEN) {
      if (s > best) { setBest(s); schreibBest(s); }
      setStufe("ende");
    } else neu(runde + 1);
  };
  const ausgang = wasser ? springe(b, menge, runde) : pumpe(b, menge, runde);

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <div className="flex flex-col gap-2">
        {stufe === "zeigen" || stufe === "ergebnis"
          ? (wasser ? <Becken b={b} liter={menge} t={t} /> : <Pumpe b={b} anteil={menge * (b.hub ?? 1) / b.V} t={t} />)
          : <SkizzenBild s={b.skizze} label={b.name} />}
      </div>
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex justify-between font-black"><span>Behälter {runde + 1} von {RUNDEN} · {b.icon} {b.name}</span><span>⭐ {summe + runden}</span></div>
        <p className="card p-3">{b.text}</p>

        {stufe === "schaetzen" && (
          <div className="card p-3 flex flex-col gap-2">
            <strong>① Schätze: Wie viel {wasser ? "Wasser" : "Luft"} passt ungefähr hinein?</strong>
            <div className="flex flex-wrap gap-1.5">
              {schaetz.optionen.map((o, i) => {
                const farbe = wahl === null ? "" : i === schaetz.richtig ? "border-ok" : i === wahl ? "border-bad" : "";
                return (
                  <button key={o} className={`chip ${farbe} ${wahl === i ? "chip-on" : ""}`} disabled={wahl !== null}
                    onClick={() => { setWahl(i); if (i === schaetz.richtig) setPkt(p => ({ ...p, schaetzen: 30 })); }}>
                    ≈ {z(o, 2)} l
                  </button>
                );
              })}
            </div>
            {wahl !== null && <>
              <span className={wahl === schaetz.richtig ? "text-ok font-bold" : "text-bad font-bold"}>
                {wahl === schaetz.richtig ? "✔ Gutes Gefühl für Größen!" : `✘ Daneben — es sind etwa ${z(schaetz.optionen[schaetz.richtig], 2)} l.`}
              </span>
              <span className="text-muted">{wasser ? "Zum Vergleich: Eine volle Badewanne fasst etwa 150 l." : "Zum Vergleich: Ein tiefer Atemzug sind etwa 3 l."}</span>
              <button className="btn btn-primary self-start" onClick={() => setStufe("rechnen")}>② Jetzt genau rechnen</button>
            </>}
          </div>
        )}

        {stufe === "rechnen" && (
          <div className="card p-3 flex flex-col gap-2">
            <strong>② Wie viele Liter fasst {b.name === "Luftballon" ? "der Ballon" : b.name === "Luftmatratze" ? "die Matratze" : "das Becken"} genau?</strong>
            <div className="flex items-center gap-2">
              <input className="input w-32" inputMode="decimal" aria-label="Volumen in Litern" value={eingabe} onChange={e => setEingabe(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") pruefe(); }} />
              <span className="text-muted">l</span>
              <button className="btn btn-primary" onClick={pruefe}>✔ Prüfen</button>
            </div>
            {versuche > 0 && <span className="text-bad">✘ Noch nicht — auf 2 % genau.</span>}
            <div className="flex gap-2">
              <button className="btn" onClick={() => setTipps(x => x + 1)} disabled={tipps >= b.hinweise.length}>💡 Tipp</button>
              <button className="btn" onClick={() => setLoesung(true)} disabled={loesung}>📖 Lösungsweg</button>
            </div>
            {tipps > 0 && <ul className="list-disc pl-5">{b.hinweise.slice(0, tipps).map(h => <li key={h}>{h}</li>)}</ul>}
            {loesung && <>{b.rechnung.map(x => <code key={x} className="text-xs">{x}</code>)}<span className="text-xs text-muted">Mit Lösungsweg gibt es für diese Stufe keine Punkte.</span></>}
          </div>
        )}

        {stufe === "test" && (
          <div className="card p-3 flex flex-col gap-2">
            <span className="text-ok font-bold">✔ Genau: {z(b.V)} l.</span>
            {wasser ? (
              <strong>③ Gleich springt jemand vom Brett. Das Wasser muss mindestens {z(b.T)} m tief sein, darf aber nicht über den Rand ({z(b.H)} m). Wie viele Liter lässt du ein?</strong>
            ) : (
              <strong>③ Pump auf! Ab 90 % ist es prall, über 100 % knallt es. Wie viele {b.art === "ballon" ? "Pumpstöße" : "Tritte"} zu je {z(b.hub!)} l?</strong>
            )}
            {b.art === "sprungbecken" && <span className="text-xs text-muted">Achtung, der Boden ist schräg: Unten im tiefen Teil ist das Becken nur ein Dreieck im Querschnitt.</span>}
            <div className="flex items-center gap-2">
              <input className="input w-32" inputMode="decimal" aria-label={wasser ? "Liter einlassen" : "Anzahl Pumpstöße"} value={eingabe} onChange={e => setEingabe(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") testen(); }} />
              <span className="text-muted">{wasser ? "l" : "Stöße"}</span>
              <button className="btn btn-primary" onClick={testen}>{wasser ? "🚿 Wasser marsch!" : "💨 Pumpen!"}</button>
            </div>
          </div>
        )}

        {stufe === "zeigen" && <p className="card p-3 font-bold">{wasser ? (t < 1 ? "🚿 Das Wasser läuft ein …" : "🤸 Und — Absprung!") : "💨 Pump, pump, pump …"}</p>}

        {stufe === "ergebnis" && (
          <div className="card p-3 flex flex-col gap-1">
            <strong className={pkt.test ? "text-ok text-base" : "text-bad text-base"}>{ausgang.text}</strong>
            {wasser && "h" in ausgang && <span>Wasserstand: {ausgang.h > b.H ? `übergelaufen (${z(menge - b.V)} l zu viel)` : `${z(ausgang.h)} m`}</span>}
            {zielRechnung(b).map(x => <code key={x} className="text-xs">{x}</code>)}
            <span className="font-black mt-1">Punkte: Schätzen {pkt.schaetzen} + Rechnen {pkt.rechnen} + Härtetest {pkt.test} = {runden}</span>
            <button className="btn btn-primary self-start" onClick={weiter}>{runde + 1 >= RUNDEN ? "🏁 Auswertung" : "➡ Nächster Behälter"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
