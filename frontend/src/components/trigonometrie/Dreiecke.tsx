"use client";
/**
 * Dreiecksrechner: drei beliebige Angaben eintippen (rechtwinklig: zwei),
 * heraus kommen alle sechs Größen, der Rechenweg und das Bild. Die Aufgaben
 * liegen in Aufgaben.tsx und nutzen Bild und Rechenweg von hier.
 * Die Zeichnung stellt beim SsW-Fall den Kreis um die feste Ecke dar: wo er
 * die Gerade schneidet, liegt die dritte Ecke — zweimal, einmal oder gar nicht.
 */
import { useState } from "react";
import {
  ECKE, FAELLE, GEGENUEBER, GROESSEN, SEITEN, WINKEL, ZEICHEN, cosG, ecken, istSeite, loese, loeseRechtwinklig,
  sinG, wert, type Dreieck, type Gegeben, type Groesse, type Loesung, type Punkt, type Winkel,
} from "@/lib/trigonometrie";
import { leseZahl } from "@/lib/prozent";

const BW = 620, BH = 360, RAND = 50;
type Ecken = Record<"A" | "B" | "C", Punkt>;

/** SsW: welcher Winkel ist gegeben, welche Seite liegt an, welche gegenüber? */
function sswTeile(g: Gegeben) {
  const w = WINKEL.find(x => g[x] !== undefined)!, s2 = GEGENUEBER[w];
  const s1 = SEITEN.find(k => k !== s2 && g[k] !== undefined)!, w1 = GEGENUEBER[s1];
  const rest = WINKEL.find(x => x !== w && x !== w1)!;
  return { w, s1, s2, w1, rest };
}

export function DreieckBild({ loesung, gegeben, zeigen }: { loesung: Loesung; gegeben: Gegeben; zeigen: boolean }) {
  const ssw = loesung.fall === "SSW";
  const t = ssw ? sswTeile(gegeben) : null;
  const reihe: Winkel[] = t ? [t.w, t.w1, t.rest] : ["alpha", "beta", "gamma"];
  const alle: Ecken[] = loesung.dreiecke.map(d => ecken(d, reihe));
  // beim SsW ohne Lösung trotzdem den Ansatz zeichnen: Winkel, anliegende Seite, Kreis
  let kreis: { m: Punkt; r: number } | null = null;
  if (t) {
    const l = gegeben[t.s1]!, m = { x: l * cosG(gegeben[t.w]!), y: l * sinG(gegeben[t.w]!) };
    kreis = { m, r: gegeben[t.s2]! };
  }
  const pkte: Punkt[] = alle.flatMap(e => [e.A, e.B, e.C]);
  if (kreis) pkte.push({ x: 0, y: 0 }, kreis.m, { x: kreis.m.x - kreis.r, y: kreis.m.y - kreis.r }, { x: kreis.m.x + kreis.r, y: Math.max(0, kreis.m.y - kreis.r) });
  if (!pkte.length) return null;
  const minX = Math.min(...pkte.map(p => p.x)), maxX = Math.max(...pkte.map(p => p.x));
  const minY = Math.min(...pkte.map(p => p.y)), maxY = Math.max(...pkte.map(p => p.y));
  const s = Math.min((BW - 2 * RAND) / (maxX - minX || 1), (BH - 2 * RAND) / (maxY - minY || 1));
  const ox = (BW - (maxX - minX) * s) / 2, oy = (BH - (maxY - minY) * s) / 2;
  const P = (p: Punkt) => ({ x: ox + (p.x - minX) * s, y: BH - oy - (p.y - minY) * s });
  const beschrift = (g: Groesse, d: Dreieck | null) => {
    const gg = gegeben[g];
    if (gg !== undefined) return `${ZEICHEN[g]} = ${wert(g, gg)}`;
    if (zeigen && d) return `${ZEICHEN[g]} = ${wert(g, d[g])}`;
    return `${ZEICHEN[g]} = ?`;
  };

  const zeichne = (e: Ecken, d: Dreieck, haupt: boolean, nr: number) => {
    const p = { A: P(e.A), B: P(e.B), C: P(e.C) };
    const sp = { x: (p.A.x + p.B.x + p.C.x) / 3, y: (p.A.y + p.B.y + p.C.y) / 3 };
    const seiten: [Groesse, Punkt, Punkt][] = [["a", p.B, p.C], ["b", p.A, p.C], ["c", p.A, p.B]];
    const farbe = (g: Groesse) => (gegeben[g] !== undefined ? "#f59e0b" : haupt ? "var(--text)" : "#a855f7");
    const richtung = (u: Punkt, v: Punkt) => { const l = Math.hypot(v.x - u.x, v.y - u.y) || 1; return { x: (v.x - u.x) / l, y: (v.y - u.y) / l, l }; };
    return (
      <g key={nr} opacity={haupt ? 1 : 0.8}>
        <path d={`M ${p.A.x} ${p.A.y} L ${p.B.x} ${p.B.y} L ${p.C.x} ${p.C.y} Z`} fill={haupt ? "var(--accent)" : "#a855f7"} fillOpacity={0.08}
          stroke={haupt ? "var(--text)" : "#a855f7"} strokeWidth={2.5} strokeDasharray={haupt ? undefined : "8 5"} strokeLinejoin="round" />
        {WINKEL.map(w => {
          if (!haupt && gegeben[w] !== undefined) return null;
          const q = p[ECKE[w]];
          const [n1, n2] = (["A", "B", "C"] as const).filter(k => k !== ECKE[w]).map(k => richtung(q, p[k]));
          const hl = Math.hypot(n1.x + n2.x, n1.y + n2.y) || 1, h = { x: (n1.x + n2.x) / hl, y: (n1.y + n2.y) / hl };
          const recht = Math.abs(d[w] - 90) < 0.05;
          const kreuz = n1.x * n2.y - n1.y * n2.x;
          const f = gegeben[w] !== undefined ? "#f59e0b" : haupt ? "var(--text-muted)" : "#a855f7";
          // Im Bogen steht nur der Wert — oder, solange er unbekannt ist, der Name.
          const v = gegeben[w] ?? (zeigen ? d[w] : undefined);
          const text = v !== undefined ? wert(w, v) : ZEICHEN[w];
          // Bogen so groß, dass die Schrift hineinpasst: Breite und Höhe gegen den halben Öffnungswinkel
          const halb = (d[w] / 2) * Math.PI / 180, breite = text.length * 7.2 + 4;
          const t = Math.max(16, (breite / 2) / Math.tan(halb), 9 / Math.sin(halb));
          const r = Math.min(Math.max(28, t + breite / 2 + 6), 0.5 * Math.min(n1.l, n2.l));
          const k = Math.min(18, r * 0.6);
          const bogen = recht
            ? `M ${q.x + n1.x * k} ${q.y + n1.y * k} L ${q.x + (n1.x + n2.x) * k} ${q.y + (n1.y + n2.y) * k} L ${q.x + n2.x * k} ${q.y + n2.y * k}`
            : `M ${q.x} ${q.y} L ${q.x + n1.x * r} ${q.y + n1.y * r} A ${r} ${r} 0 0 ${kreuz > 0 ? 1 : 0} ${q.x + n2.x * r} ${q.y + n2.y * r} Z`;
          const eckeNeu = haupt || Math.hypot(q.x - P(alle[0][ECKE[w]]).x, q.y - P(alle[0][ECKE[w]]).y) > 1;
          return (
            <g key={w}>
              <path d={bogen} fill={recht ? "none" : f} fillOpacity={0.22} stroke={f} strokeWidth={1.5} />
              {recht && <circle cx={q.x + h.x * k * 0.7} cy={q.y + h.y * k * 0.7} r={2} fill={f} />}
              {eckeNeu && <text x={q.x - h.x * 18} y={q.y - h.y * 18} textAnchor="middle" dominantBaseline="central" fontSize={17} fontWeight={900}
                fill={haupt ? "var(--text)" : "#a855f7"}>{ECKE[w]}{haupt ? "" : "₂"}</text>}
              {!recht && (
                <text x={q.x + h.x * Math.min(t, r - breite / 2 - 2)} y={q.y + h.y * Math.min(t, r - breite / 2 - 2)} textAnchor="middle" dominantBaseline="central"
                  fontSize={12} fontWeight={v !== undefined ? 800 : 700} fill={f === "var(--text-muted)" ? "var(--text)" : f}>{text}</text>
              )}
            </g>
          );
        })}
        {seiten.map(([g, u, v]) => {
          if (!haupt && gegeben[g] !== undefined) return null;
          const mx = (u.x + v.x) / 2, my = (u.y + v.y) / 2, t = richtung(u, v);
          // Normale nach außen (weg vom Schwerpunkt); die Schrift beginnt dort, wo die Linie aufhört
          let n = { x: -t.y, y: t.x };
          if (n.x * (mx - sp.x) + n.y * (my - sp.y) < 0) n = { x: -n.x, y: -n.y };
          const anker = n.x > 0.35 ? "start" : n.x < -0.35 ? "end" : "middle";
          const grund = n.y > 0.35 ? "hanging" : n.y < -0.35 ? "auto" : "central";
          return (
            <text key={g} x={mx + n.x * 10} y={my + n.y * 10} textAnchor={anker} dominantBaseline={grund} fontSize={15}
              fontWeight={gegeben[g] !== undefined ? 800 : 600} fill={farbe(g)}>{beschrift(g, d)}</text>
          );
        })}
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${BW} ${BH}`} className="w-full h-auto max-h-[46vh]" role="img" aria-label="Dreieck">
      {kreis && (() => {
        const m = P(kreis.m), o = P({ x: 0, y: 0 });
        const fern = P({ x: maxX + 1, y: 0 }), str = P({ x: (maxX + 1) * cosG(gegeben[t!.w]!), y: (maxX + 1) * sinG(gegeben[t!.w]!) });
        return (
          <g>
            <line x1={o.x} y1={o.y} x2={fern.x} y2={fern.y} stroke="var(--text-muted)" strokeDasharray="4 5" />
            <line x1={o.x} y1={o.y} x2={str.x} y2={str.y} stroke="var(--text-muted)" strokeDasharray="4 5" />
            <circle cx={m.x} cy={m.y} r={kreis.r * s} fill="none" stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="6 4" />
            <circle cx={m.x} cy={m.y} r={3} fill="#06b6d4" />
            {!alle.length && (
              <>
                <line x1={o.x} y1={o.y} x2={m.x} y2={m.y} stroke="var(--text)" strokeWidth={2.5} />
                <text x={m.x} y={m.y - kreis.r * s - 8} textAnchor="middle" fontSize={13} fill="#06b6d4">Kreis mit Radius {ZEICHEN[t!.s2]} erreicht die Gerade nicht</text>
              </>
            )}
          </g>
        );
      })()}
      {alle.map((e, i) => zeichne(e, loesung.dreiecke[i], i === 0, i)).reverse()}
    </svg>
  );
}

export function Rechenweg({ loesung, bis }: { loesung: Loesung; bis: number }) {
  const zwei = loesung.schritte.length === 2;
  return (
    <div className={`grid gap-3 ${zwei ? "md:grid-cols-2" : ""}`}>
      {loesung.schritte.map((sch, i) => (
        <ol key={i} className="flex flex-col gap-1.5 text-sm">
          {zwei && <li className="font-black" style={{ color: i ? "#a855f7" : undefined }}>{i ? "Zweites Dreieck (gestrichelt)" : "Erstes Dreieck"}</li>}
          {sch.slice(0, bis).map((x, k) => (
            <li key={k} className="rounded-lg bg-surface-hover px-3 py-2">
              <div className="text-muted text-xs">{k + 1}. {x.text}</div>
              <div className="font-mono font-bold break-words">{x.rechnung}</div>
            </li>
          ))}
        </ol>
      ))}
    </div>
  );
}


export default function Dreiecke() {
  const [recht, setRecht] = useState(false);
  const [ein, setEin] = useState<Record<string, string>>({ a: "6", b: "8", alpha: "35" });
  const g: Gegeben = {};
  for (const k of GROESSEN) {
    if (recht && k === "gamma") continue;
    const x = leseZahl(ein[k] ?? "");
    if (x !== null) g[k] = x;
  }
  const l = recht ? loeseRechtwinklig(g) : loese(g);
  const gezeigt = recht ? { ...g, gamma: 90 } : g;
  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2 items-start">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Trag ein, was gegeben ist — drei Größen, mindestens eine Seite (rechtwinklig: zwei). Der Rechner erkennt den Fall,
          rechnet alles aus und zeigt jeden Schritt. Gegebenes steht orange.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={recht} onChange={e => setRecht(e.target.checked)} /> rechtwinklig (γ = 90°, dann reichen zwei Angaben)
        </label>
        <div className="grid grid-cols-3 gap-2 max-w-md">
          {GROESSEN.map(k => (
            <label key={k} className="flex items-center gap-1.5">
              <span className="w-5 font-black text-right">{ZEICHEN[k]}</span>
              <input className="input w-full" inputMode="decimal" aria-label={ZEICHEN[k]} disabled={recht && k === "gamma"}
                value={recht && k === "gamma" ? "90" : ein[k] ?? ""} onChange={e => setEin({ ...ein, [k]: e.target.value })} placeholder={istSeite(k) ? "" : "°"} />
            </label>
          ))}
        </div>
        <button className="btn self-start" onClick={() => setEin({})}>Alle leeren</button>
        {l.fehler ? <p className="text-bad font-bold text-sm">{l.fehler}</p> : (
          <>
            {l.fall && <p className="text-sm"><strong>{FAELLE[l.fall].name}</strong> → {FAELLE[l.fall].satz}.</p>}
            {l.hinweis && <p className="text-sm rounded-xl border border-line p-3">{l.hinweis}</p>}
            {l.dreiecke.length > 0 && (
              <table className="text-sm w-full max-w-xl">
                <thead>
                  <tr className="text-muted text-xs">
                    <th />
                    {GROESSEN.map(k => <th key={k} className="text-right font-bold px-1">{ZEICHEN[k]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {l.dreiecke.map((d, i) => (
                    <tr key={i} style={{ color: i ? "#a855f7" : undefined }}>
                      <td className="text-xs text-muted pr-2">{l.dreiecke.length > 1 ? `Dreieck ${i + 1}` : "Ergebnis"}</td>
                      {GROESSEN.map(k => (
                        <td key={k} className="text-right px-1 tabular-nums font-bold" style={gezeigt[k] !== undefined ? { color: "#f59e0b" } : undefined}>
                          {wert(k, d[k])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Rechenweg loesung={l} bis={99} />
          </>
        )}
      </div>
      {!l.fehler && <div className="lg:sticky lg:top-4"><DreieckBild loesung={l} gegeben={gezeigt} zeigen /></div>}
      </div>
      <details className="text-sm text-muted">
        <summary className="cursor-pointer font-bold">Die Sätze auf einen Blick</summary>
        <ul className="mt-2 flex flex-col gap-1">
          <li><strong>Winkelsumme:</strong> α + β + γ = 180°</li>
          <li><strong>Sinussatz:</strong> a / sin α = b / sin β = c / sin γ — eine Seite mit ihrem Gegenwinkel kennen, dann geht jede andere Paarung.</li>
          <li><strong>Kosinussatz:</strong> c² = a² + b² − 2ab · cos γ — für SWS (dritte Seite) und SSS (Winkel). Bei γ = 90° wird daraus Pythagoras.</li>
          <li><strong>Vorsicht beim Sinussatz für Winkel:</strong> sin x = sin(180° − x). Liegt der gegebene Winkel der kürzeren Seite gegenüber (SsW), kann es zwei Dreiecke geben.</li>
        </ul>
      </details>
    </div>
  );
}

