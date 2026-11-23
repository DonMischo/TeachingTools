"use client";
/**
 * Spiel »Tarif-Check«: zwei Angebote aus dem Alltag (Handy, Strom, E-Scooter,
 * Fitnessstudio, Taxi) — Grundbetrag plus Preis je Einheit. Erst schätzen bzw.
 * rechnen, ab wann beide gleich teuer sind, dann für eine Menge das günstigere
 * wählen. Danach zeigt der Graph beide Kostengeraden mit dem Schnittpunkt.
 */
import { useState } from "react";
import { gleichstand, kosten, TARIFE, type Tarifvergleich } from "@/lib/lgs";
import { mische } from "@/components/brueche/Wichtige";

const euro = (v: number) => v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const de = (v: number, s = 1) => v.toLocaleString("de-DE", { maximumFractionDigits: s });

function Graph({ v, menge }: { v: Tarifvergleich; menge?: number }) {
  const W = 520, H = 260, [m0, m1] = v.bereich;
  const kmax = Math.max(kosten(v.a, m1), kosten(v.b, m1)) * 1.08;
  const px = (m: number) => 40 + ((m - m0) / (m1 - m0)) * (W - 50), py = (k: number) => H - 30 - (k / kmax) * (H - 45);
  const g = gleichstand(v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" role="img" aria-label="Kostengraph">
      <line x1={40} y1={H - 30} x2={W - 5} y2={H - 30} stroke="var(--color-fg)" />
      <line x1={40} y1={H - 30} x2={40} y2={8} stroke="var(--color-fg)" />
      <text x={W - 8} y={H - 10} textAnchor="end" fontSize={12} fill="var(--color-muted)">{v.einheit}</text>
      <text x={44} y={16} fontSize={12} fill="var(--color-muted)">Kosten in €</text>
      {[0, 0.25, 0.5, 0.75, 1].map(t => <text key={t} x={px(m0 + t * (m1 - m0))} y={H - 14} textAnchor="middle" fontSize={11} fill="var(--color-muted)">{de(m0 + t * (m1 - m0), 0)}</text>)}
      {[v.a, v.b].map((t, i) => (
        <g key={t.name}>
          <line x1={px(m0)} y1={py(kosten(t, m0))} x2={px(m1)} y2={py(kosten(t, m1))} stroke={i ? "#ea580c" : "#2563eb"} strokeWidth={3} />
          <text x={px(m1) - 4} y={py(kosten(t, m1)) - 6} textAnchor="end" fontSize={13} fontWeight={800} fill={i ? "#ea580c" : "#2563eb"}>{t.name}</text>
        </g>
      ))}
      {g !== null && <g>
        <line x1={px(g)} y1={py(kosten(v.a, g))} x2={px(g)} y2={H - 30} stroke="#16a34a" strokeDasharray="4 3" />
        <circle cx={px(g)} cy={py(kosten(v.a, g))} r={6} fill="#16a34a" />
        <text x={px(g) + 8} y={py(kosten(v.a, g)) + 18} fontSize={12} fontWeight={800} fill="#16a34a">gleich teuer: {de(g)} {v.einheit}</text>
      </g>}
      {menge !== undefined && <line x1={px(menge)} y1={8} x2={px(menge)} y2={H - 30} stroke="var(--color-muted)" strokeDasharray="2 3" />}
    </svg>
  );
}

type Runde = { v: Tarifvergleich; menge: number };
const neueRunden = () => mische(TARIFE).map(v => {
  const g = gleichstand(v)!;
  const [m0, m1] = v.bereich;
  // Menge deutlich links oder rechts vom Gleichstand, glatt gerundet
  const seite = Math.random() < 0.5 ? (m0 + g) / 2 : (g + m1) / 2;
  const schritt = m1 - m0 > 100 ? 100 : 1;
  return { v, menge: Math.max(m0 + schritt, Math.round(seite / schritt) * schritt) };
});

export default function Tarife() {
  const [runden, setRunden] = useState<Runde[]>(neueRunden);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"gleich" | "wahl" | "auswertung">("gleich");
  const [eingabe, setEingabe] = useState("");
  const [punkte, setPunkte] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const r = runden[i];
  const fertig = i >= runden.length;
  const g = r ? gleichstand(r.v)! : 0;

  const pruefeGleich = () => {
    const x = Number(eingabe.replace(",", "."));
    if (!Number.isFinite(x) || !eingabe.trim()) return;
    const ok = Math.abs(x - g) <= Math.max(0.051, Math.abs(g) * 0.02);
    setPunkte(p => p + (ok ? 2 : 0));
    setLog([ok ? `✔ Richtig: bei ${de(g)} ${r.v.einheit} sind beide gleich teuer (+2).` : `✘ Gleich teuer erst bei ${de(g)} ${r.v.einheit}.`,
      `Ansatz: ${de(r.v.a.grund, 2)} + ${de(r.v.a.jeEinheit, 2)}·x = ${de(r.v.b.grund, 2)} + ${de(r.v.b.jeEinheit, 2)}·x`]);
    setPhase("wahl");
  };
  const waehle = (welcher: "a" | "b") => {
    const ka = kosten(r.v.a, r.menge), kb = kosten(r.v.b, r.menge);
    const ok = (welcher === "a") === (ka <= kb);
    setPunkte(p => p + (ok ? 1 : 0));
    setLog(l => [...l, `${ok ? "✔" : "✘"} Bei ${de(r.menge)} ${r.v.einheit}: ${r.v.a.name} ${euro(ka)}, ${r.v.b.name} ${euro(kb)}${ok ? " (+1)" : ""}.`]);
    setPhase("auswertung");
  };
  const weiter = () => { setI(i + 1); setPhase("gleich"); setEingabe(""); setLog([]); };

  if (fertig) return (
    <div className="flex flex-col gap-3 items-start">
      <h3 className="font-black text-lg">📱 Tarif-Check geschafft: {punkte} von {runden.length * 3} Punkten</h3>
      <button className="btn-primary" onClick={() => { setRunden(neueRunden()); setI(0); setPunkte(0); setPhase("gleich"); }}>Nochmal</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4 text-sm font-bold"><span>Runde {i + 1} / {runden.length}</span><span>{punkte} Punkte</span></div>
      <h3 className="font-black text-lg">{r.v.titel}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {[r.v.a, r.v.b].map((t, k) => (
          <div key={t.name} className="rounded-xl border-2 p-3" style={{ borderColor: k ? "#ea580c" : "#2563eb" }}>
            <p className="font-black">{t.name}</p>
            <p className="text-sm">{t.grund ? `${euro(t.grund)} fest` : "kein Grundbetrag"} + {euro(t.jeEinheit)} je {r.v.einheit}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Werte gerundet nach typischen Angeboten: {r.v.quelle}.</p>
      {phase === "gleich" && (
        <div className="flex flex-wrap items-center gap-2">
          <span>Bei wie viel {r.v.einheit} ({r.v.menge}) kosten beide gleich viel?</span>
          <input className="input w-28" value={eingabe} onChange={e => setEingabe(e.target.value)} onKeyDown={e => { if (e.key === "Enter") pruefeGleich(); }} aria-label="Gleichstand" />
          <span>{r.v.einheit}</span>
          <button className="btn-primary" onClick={pruefeGleich}>Prüfen</button>
        </div>
      )}
      {log.map(l => <p key={l} className={`text-sm ${l.startsWith("✔") ? "text-ok font-bold" : l.startsWith("✘") ? "text-bad font-bold" : ""}`}>{l}</p>)}
      {phase === "wahl" && (
        <div className="flex flex-wrap items-center gap-2">
          <span>Du brauchst {de(r.menge)} {r.v.einheit}. Welches Angebot nimmst du?</span>
          <button className="btn-secondary" onClick={() => waehle("a")}>{r.v.a.name}</button>
          <button className="btn-secondary" onClick={() => waehle("b")}>{r.v.b.name}</button>
        </div>
      )}
      {phase === "auswertung" && <>
        <Graph v={r.v} menge={r.menge} />
        <button className="btn-primary self-start" onClick={weiter}>Nächstes Angebot →</button>
      </>}
    </div>
  );
}
