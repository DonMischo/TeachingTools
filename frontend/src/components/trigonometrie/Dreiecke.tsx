"use client";
/**
 * Dreiecke berechnen — zwei Wege:
 *   ✍️ Aufgaben     gewürfelt nach Fall (rechtwinklig, SSS, SWS, WSW/WWS, SsW),
 *                   Tipps Schritt für Schritt, beim SsW erst »wie viele Dreiecke?«
 *   🧮 Selbst rechnen  drei beliebige Angaben eintippen, Rechenweg und Bild
 * Die Zeichnung stellt beim SsW-Fall den Kreis um die feste Ecke dar: wo er
 * die Gerade schneidet, liegt die dritte Ecke — zweimal, einmal oder gar nicht.
 */
import { useEffect, useState } from "react";
import {
  AUFGABEN_ARTEN, ECKE, FAELLE, GEGENUEBER, GROESSEN, SEITEN, WINKEL, ZEICHEN, cosG, ecken, erzeugeAufgabe, istSeite, loese, loeseRechtwinklig,
  passt, sinG, wert, type AufgabenArt, type Dreieck, type DreieckAufgabe, type Gegeben, type Groesse, type Loesung, type Punkt, type Winkel,
} from "@/lib/trigonometrie";
import { leseZahl } from "@/lib/prozent";
import { Chips, LEER, zaehle } from "@/components/prozent/ui";

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
    return (
      <g key={nr} opacity={haupt ? 1 : 0.75}>
        <path d={`M ${p.A.x} ${p.A.y} L ${p.B.x} ${p.B.y} L ${p.C.x} ${p.C.y} Z`} fill={haupt ? "var(--accent)" : "#a855f7"} fillOpacity={0.08}
          stroke={haupt ? "var(--text)" : "#a855f7"} strokeWidth={2.5} strokeDasharray={haupt ? undefined : "8 5"} />
        {seiten.map(([g, u, v]) => {
          if (!haupt && gegeben[g] !== undefined) return null;
          const mx = (u.x + v.x) / 2, my = (u.y + v.y) / 2, dx = mx - sp.x, dy = my - sp.y, n = Math.hypot(dx, dy) || 1;
          return (
            <text key={g} x={mx + (dx / n) * 20} y={my + (dy / n) * 20} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={gegeben[g] !== undefined ? 800 : 600}
              fill={gegeben[g] !== undefined ? "#f59e0b" : haupt ? "var(--text)" : "#a855f7"}>{beschrift(g, d)}</text>
          );
        })}
        {WINKEL.map(w => {
          if (!haupt && gegeben[w] !== undefined) return null;
          const q = p[ECKE[w]], dx = sp.x - q.x, dy = sp.y - q.y, n = Math.hypot(dx, dy) || 1;
          const weit = Math.min(48, n * 0.55);
          return (
            <g key={w}>
              {(haupt || Math.hypot(q.x - P(alle[0][ECKE[w]]).x, q.y - P(alle[0][ECKE[w]]).y) > 1) && <text x={q.x - (dx / n) * 16} y={q.y - (dy / n) * 16} textAnchor="middle" dominantBaseline="central" fontSize={17} fontWeight={900} fill={haupt ? "var(--text)" : "#a855f7"}>{ECKE[w]}{haupt ? "" : "₂"}</text>}
              <text x={q.x + (dx / n) * weit} y={q.y + (dy / n) * weit} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={gegeben[w] !== undefined ? 800 : 600}
                fill={gegeben[w] !== undefined ? "#f59e0b" : haupt ? "var(--text-muted)" : "#a855f7"}>{beschrift(w, d)}</text>
            </g>
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

function Rechenweg({ loesung, bis }: { loesung: Loesung; bis: number }) {
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

function Aufgaben() {
  const [arten, setArten] = useState<AufgabenArt[]>(["rechtwinklig", "SSS", "SWS", "WSW", "SSW"]);
  const [a, setA] = useState<DreieckAufgabe | null>(null);
  const [anzahl, setAnzahl] = useState<number | null>(null);
  const [ein, setEin] = useState<Record<string, string>>({});
  const [urteil, setUrteil] = useState<Record<string, boolean> | null>(null);
  const [tipp, setTipp] = useState(0);
  const [gezaehlt, setGezaehlt] = useState(false);
  const [punkte, setPunkte] = useState(LEER);

  const neu = (xs = arten) => {
    setA(erzeugeAufgabe(xs[Math.floor(Math.random() * xs.length)]));
    setAnzahl(null); setEin({}); setUrteil(null); setTipp(0); setGezaehlt(false);
  };
  useEffect(() => { neu(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!a) return null;

  const l = a.loesung, ssw = a.art === "SSW", n = l.dreiecke.length;
  const spalten = ssw ? (anzahl ?? 0) : 1;
  const maxSchritte = Math.max(0, ...l.schritte.map(x => x.length));
  const fertig = tipp > maxSchritte;

  const pruefen = () => {
    const u: Record<string, boolean> = {};
    let alles = true;
    if (ssw) {
      u.anzahl = anzahl === n;
      alles = u.anzahl;
      if (u.anzahl && n) {
        // Reihenfolge der beiden Lösungen egal
        const versuch = (perm: number[]) => {
          const v: Record<string, boolean> = {};
          perm.forEach((j, i) => a.gesucht.forEach(g => { const x = leseZahl(ein[`${i}:${g}`] ?? ""); v[`${i}:${g}`] = x !== null && passt(g, x, l.dreiecke[j][g]); }));
          return v;
        };
        const v1 = versuch(n === 2 ? [0, 1] : [0]), v2 = n === 2 ? versuch([1, 0]) : v1;
        const best = Object.values(v2).filter(Boolean).length > Object.values(v1).filter(Boolean).length ? v2 : v1;
        Object.assign(u, best);
        alles = Object.values(best).every(Boolean);
      }
    } else {
      for (const g of a.gesucht) {
        const x = leseZahl(ein[`0:${g}`] ?? "");
        u[`0:${g}`] = x !== null && passt(g, x, l.dreiecke[0][g]);
        alles &&= u[`0:${g}`];
      }
    }
    setUrteil(u);
    if (!gezaehlt && tipp === 0) { setPunkte(p => zaehle(p, alles)); setGezaehlt(true); }
  };
  const gegebenText = GROESSEN.filter(g => a.gegeben[g] !== undefined).map(g => `${ZEICHEN[g]} = ${wert(g, a.gegeben[g]!)}`).join(";  ");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5 items-center" role="group" aria-label="Aufgabenarten">
        {AUFGABEN_ARTEN.map(x => (
          <button key={x.id} className={`chip ${arten.includes(x.id) ? "chip-on" : ""}`} aria-pressed={arten.includes(x.id)}
            onClick={() => {
              const nx = arten.includes(x.id) ? arten.filter(y => y !== x.id) : [...arten, x.id];
              if (nx.length) { setArten(nx); neu(nx); }
            }}>{x.label}</button>
        ))}
        <span className="flex-1" />
        {punkte.gesamt > 0 && <span className="text-sm font-black">✔ {punkte.richtig} von {punkte.gesamt} · Serie {punkte.serie}</span>}
        <button className="btn" onClick={() => neu()}>🎲 Neue Aufgabe</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-line p-3">
            <div className="text-xs text-muted">{a.art === "rechtwinklig" ? "Rechtwinkliges Dreieck, γ = 90°" : "Dreieck"} — gegeben:</div>
            <div className="text-lg font-black">{gegebenText}</div>
            <div className="text-sm text-muted mt-1">Berechne {a.gesucht.map(g => ZEICHEN[g]).join(", ")}. Seiten auf zwei, Winkel auf eine Nachkommastelle.</div>
          </div>
          {ssw && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">Wie viele Dreiecke passen?</span>
              {[0, 1, 2].map(k => (
                <button key={k} className={`chip ${anzahl === k ? "chip-on" : ""}`} onClick={() => { setAnzahl(k); setUrteil(null); }}>{k}</button>
              ))}
              {urteil && <span className={urteil.anzahl ? "text-ok font-bold" : "text-bad font-bold"}>{urteil.anzahl ? "✔" : "✘"}</span>}
            </div>
          )}
          {spalten > 0 && (
            <div className={`grid gap-3 ${spalten === 2 ? "sm:grid-cols-2" : ""}`}>
              {Array.from({ length: spalten }, (_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  {spalten === 2 && <div className="text-xs font-black text-muted">Dreieck {i + 1}</div>}
                  {a.gesucht.map(g => {
                    const k = `${i}:${g}`, u = urteil?.[k];
                    return (
                      <label key={k} className="flex items-center gap-2">
                        <span className="w-8 font-black text-right">{ZEICHEN[g]} =</span>
                        <input className={`input w-28 ${u === false ? "border-bad" : u ? "border-ok" : ""}`} inputMode="decimal" value={ein[k] ?? ""}
                          aria-label={`${ZEICHEN[g]} ${i + 1}`}
                          onChange={e => { setEin({ ...ein, [k]: e.target.value }); setUrteil(null); }}
                          onKeyDown={e => { if (e.key === "Enter") pruefen(); }} />
                        <span className="text-muted">{istSeite(g) ? "" : "°"}</span>
                        {u !== undefined && <span className={u ? "text-ok" : "text-bad"}>{u ? "✔" : "✘"}</span>}
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={pruefen} disabled={ssw && anzahl === null}>✔ Prüfen</button>
            <button className="btn" onClick={() => setTipp(t => t + 1)} disabled={fertig}>💡 {tipp === 0 ? "Tipp" : "Nächster Schritt"}</button>
            <button className="btn" onClick={() => setTipp(maxSchritte + 1)} disabled={fertig}>📖 Lösung</button>
          </div>
          {tipp > 0 && l.fall && (
            <div className="rounded-xl border border-line p-3 text-sm">
              <strong>{FAELLE[l.fall].name}</strong> → {FAELLE[l.fall].satz}.
              {fertig && l.hinweis && <p className="mt-1">{l.hinweis}</p>}
            </div>
          )}
          {tipp > 1 && <Rechenweg loesung={l} bis={tipp - 1} />}
          {tipp > 0 && !gezaehlt && <p className="text-xs text-muted">Mit Tipp zählt die Aufgabe nicht für den Punktestand.</p>}
        </div>
        <DreieckBild loesung={l} gegeben={a.gegeben} zeigen={fertig} />
      </div>
    </div>
  );
}

function SelbstRechnen() {
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
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
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
            <Rechenweg loesung={l} bis={99} />
          </>
        )}
      </div>
      {!l.fehler && <DreieckBild loesung={l} gegeben={gezeigt} zeigen />}
    </div>
  );
}

export default function Dreiecke() {
  const [modus, setModus] = useState<"aufgaben" | "selbst">("aufgaben");
  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <Chips wahl={modus} setze={setModus} optionen={[{ id: "aufgaben", label: "✍️ Aufgaben" }, { id: "selbst", label: "🧮 Selbst rechnen" }] as const} />
      {modus === "aufgaben" ? <Aufgaben /> : <SelbstRechnen />}
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
