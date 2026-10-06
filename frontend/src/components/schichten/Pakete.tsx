"use client";
/**
 * Reiter »Pakete«: TCP bei Paketverlust als Ablaufdiagramm. Links Lena,
 * rechts Tokio, die Zeit läuft nach unten.
 */
import { useMemo, useState } from "react";
import { tcpLauf } from "@/lib/schichten/tcp";
import type { Niveau } from "./Bausteine";

const LINKS = 110, RECHTS = 520, PRO_T = 46;

export default function Pakete({ niveau = "fortgeschritten" }: { niveau?: Niveau }) {
  const [verlust, setVerlust] = useState(0.15);
  const [fenster, setFenster] = useState(4);
  const [anzahl, setAnzahl] = useState(16);
  const [seed, setSeed] = useState(3);
  const lauf = useMemo(() => tcpLauf(anzahl, verlust, fenster, seed), [anzahl, verlust, fenster, seed]);
  const ohne = useMemo(() => tcpLauf(anzahl, 0, fenster, seed), [anzahl, fenster, seed]);
  const h = lauf.ende * PRO_T + 50;
  const y = (t: number) => 34 + t * PRO_T;

  return (
    <div className="flex flex-col gap-4">
    {niveau === "einsteiger" && (
      <p className="text-base max-w-3xl leading-relaxed">
        Manchmal gehen unterwegs Puzzleteile verloren — eine Leitung ist überfüllt, ein Bit kippt. Kein Problem: Tokio antwortet nach jedem Teil
        »Ich warte jetzt auf Nr. …«. Sagt Tokio das dreimal hintereinander, weiß Lena: Das Teil fehlt — und schickt es <b>noch einmal</b> (orange).
        Schieb den Regler »Paketverlust« hoch und schau zu!
      </p>
    )}
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      <div className="rounded-xl bg-[#060a14] overflow-auto max-h-[75vh]">
        <svg viewBox={`0 0 630 ${h}`} className="w-full min-w-[520px]" role="img" aria-label="Ablaufdiagramm TCP">
          <defs>
            <marker id="pfeil-d" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="#a855f7" /></marker>
            <marker id="pfeil-w" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="#f59e0b" /></marker>
            <marker id="pfeil-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="#64748b" /></marker>
          </defs>
          <text x={LINKS} y={20} textAnchor="middle" fill="#e2e8f0" fontWeight={700} fontSize={13}>📱 Lena</text>
          <text x={RECHTS} y={20} textAnchor="middle" fill="#e2e8f0" fontWeight={700} fontSize={13}>🖥️ Tokio</text>
          <line x1={LINKS} y1={28} x2={LINKS} y2={h} stroke="#334155" strokeWidth={2} />
          <line x1={RECHTS} y1={28} x2={RECHTS} y2={h} stroke="#334155" strokeWidth={2} />
          {lauf.pfeile.map((p, i) => {
            // Eine Laufzeit = ganz hinüber; Verlorenes endet auf halber Strecke
            const x1 = p.art === "daten" ? LINKS : RECHTS;
            const x2 = x1 + (p.bis - p.von) * ((p.art === "daten" ? RECHTS : LINKS) - x1);
            const farbe = p.art === "ack" ? "#64748b" : p.wiederholt ? "#f59e0b" : "#a855f7";
            return (
              <g key={i}>
                <line x1={x1} y1={y(p.von)} x2={x2} y2={y(p.bis)} stroke={farbe} strokeWidth={p.art === "ack" ? 1 : 2}
                  strokeDasharray={p.wiederholt ? "5 3" : undefined} markerEnd={p.verloren ? undefined : `url(#pfeil-${p.art === "ack" ? "a" : p.wiederholt ? "w" : "d"})`} />
                {p.art === "daten" && (
                  <text x={x1 - 8} y={y(p.von) + 4} textAnchor="end" fill={farbe} fontSize={11} fontWeight={700}>#{p.nr}</text>
                )}
                {p.art === "ack" && <text x={RECHTS + 8} y={y(p.von) + 4} fill="#64748b" fontSize={10}>ACK {p.nr}</text>}
                {p.verloren && <text x={x2} y={y(p.bis) + 5} textAnchor="middle" fill="#ef4444" fontSize={16} fontWeight={900}>✗</text>}
                {p.wiederholt && <text x={x1 - 34} y={y(p.von) + 4} textAnchor="end" fill="#f59e0b" fontSize={10}>{p.wiederholt === "dreifach" ? "3 × gleiche ACK" : "Zeit um"}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-col gap-4">
        <div className="card p-3 flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="label">Paketverlust: {Math.round(verlust * 100)} %</span>
            <input type="range" min={0} max={0.4} step={0.01} value={verlust} onChange={e => setVerlust(+e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Fenster: {fenster} Segmente unterwegs</span>
            <input type="range" min={1} max={8} value={fenster} onChange={e => setFenster(+e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Segmente: {anzahl}</span>
            <input type="range" min={6} max={30} value={anzahl} onChange={e => setAnzahl(+e.target.value)} />
          </label>
          <button className="btn btn-secondary" onClick={() => setSeed(s => s + 1)}>🎲 Anderer Zufall</button>
        </div>
        <div className="card p-3 text-sm flex flex-col gap-1 tabular-nums">
          <div>Verloren: <b>{lauf.verloren}</b> · wiederholt: <b>{lauf.wiederholungen}</b></div>
          <div>Dauer: <b>{lauf.ende.toFixed(1).replace(".", ",")}</b> Laufzeiten (ohne Verlust {ohne.ende.toFixed(1).replace(".", ",")})</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {lauf.geliefert.map(g => <span key={g.nr} className="chip chip-on text-xs">#{g.nr}</span>)}
          </div>
          <span className="text-xs text-muted">In dieser Reihenfolge gibt TCP die Stücke an die App weiter — immer lückenlos.</span>
        </div>
        <div className="card p-3 text-xs text-muted leading-relaxed">
          <p><b className="text-fg">Lila</b>: Segment. <b className="text-fg">Grau</b>: Bestätigung »ich erwarte als Nächstes #…«. <b className="text-fg">✗</b>: unterwegs verloren.</p>
          <p className="mt-1">Fehlt ein Stück, bestätigt Tokio immer wieder dieselbe Nummer. Nach drei gleichen Bestätigungen schickt Lena es sofort neu (<b className="text-fg">orange</b>); kommt gar nichts mehr, nach Ablauf einer Wartezeit.</p>
          <p className="mt-1">Vereinfacht: feste Fenstergröße, Bestätigungen gehen nie verloren.</p>
        </div>
      </div>
    </div>
    </div>
  );
}
