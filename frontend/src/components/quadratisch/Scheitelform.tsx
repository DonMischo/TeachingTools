"use client";
/**
 * Schritt 4: alles zusammen in der Scheitelpunktform y = a(x + d)² + e
 * (Schreibweise wie im Tafelwerk, S(−d | e)). Drei Regler, Steckbrief,
 * Verschiebe-Pfeile — und »Parabel treffen«: eine Zielparabel nachstellen.
 */
import { useEffect, useState } from "react";
import { eins, ganz, scheitel, spfStuecke, spfText, spfWert, steckbrief, zahl, type SPF } from "@/lib/quadratisch";
import { F, FARBE, Graph, Kasten, Pfeil, Regler, Term } from "./teile";

const zielWuerfeln = (): SPF => ({ a: eins(Math.random, [1, -1, 2, -2, 0.5, -0.5]), d: ganz(Math.random, -4, 4), e: ganz(Math.random, -4, 4) });

export default function Scheitelform() {
  const [s, setS] = useState<SPF>({ a: 1, d: -2, e: -1 });
  const [spiel, setSpiel] = useState(false);
  const [ziel, setZiel] = useState<SPF | null>(null);
  const [treffer, setTreffer] = useState(0);
  useEffect(() => { if (spiel && !ziel) setZiel(zielWuerfeln()); }, [spiel, ziel]);
  const S = scheitel(s);
  const k = steckbrief(s.a);
  const passt = !!ziel && ziel.a === s.a && ziel.d === s.d && ziel.e === s.e;
  const setze = (teil: Partial<SPF>) => setS(v => ({ ...v, ...teil, a: (teil.a ?? v.a) === 0 ? 0.25 : (teil.a ?? v.a) }));

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 items-start">
      <div className="flex flex-col gap-3">
        <div className="card p-3 flex flex-col gap-3">
          <div className="text-center text-sm text-muted">y = <F r="a">a</F>(x + <F r="d">d</F>)² + <F r="e">e</F> &nbsp;⟹&nbsp; S(−<F r="d">d</F> | <F r="e">e</F>)</div>
          <div className="text-center"><Term st={spfStuecke(s)} gross /></div>
          <Regler name="a" r="a" wert={s.a} setze={a => setze({ a })} min={-3} max={3} schritt={0.25} hinweis="Öffnung, Form" />
          <Regler name="d" r="d" wert={s.d} setze={d => setze({ d })} min={-5} max={5} schritt={0.5} hinweis="links/rechts – andersherum" />
          <Regler name="e" r="e" wert={s.e} setze={e => setze({ e })} min={-5} max={5} schritt={0.5} hinweis="oben/unten" />
        </div>
        <div className="card p-3 text-sm">
          <div className="font-black mb-1">📋 Steckbrief</div>
          <p>Scheitelpunkt <b>S(<F r="d">{zahl(S.x)}</F> | <F r="e">{zahl(S.y)}</F>)</b> – {s.a > 0 ? "tiefster" : "höchster"} Punkt</p>
          <p>Öffnung nach <b>{k.oeffnung}</b>, Form <b>{k.form}</b></p>
          <p>Symmetrieachse x = {zahl(S.x)}</p>
        </div>
        <div className="card p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <b>🎯 Parabel treffen</b>
            <button className={`btn ${spiel ? "btn-primary" : ""}`} onClick={() => { setSpiel(x => !x); setZiel(null); }}>{spiel ? "Beenden" : "Starten"}</button>
          </div>
          {spiel && ziel && (
            <>
              <p className="text-sm text-muted">Stell die Regler so ein, dass deine Parabel genau auf der gestrichelten Zielparabel liegt.</p>
              {passt ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-ok font-black">✔ Getroffen: {spfText(ziel)}</span>
                  <button className="btn btn-primary" onClick={() => { setTreffer(t => t + 1); setZiel(zielWuerfeln()); }}>➡ Nächste</button>
                </div>
              ) : <p className="text-sm">Tipp: erst S ablesen (d, e), dann mit der Treppe a bestimmen.</p>}
              <p className="text-sm font-bold">Getroffen: {treffer}</p>
            </>
          )}
        </div>
        <Kasten art="achtung" titel="Fehlerfalle Vorzeichen">
          <p>(x <b>+</b> 3)² → d = 3 → S bei x = <b>−3</b> (links). &nbsp;(x <b>−</b> 2)² → d = −2 → S bei x = <b>+2</b> (rechts).</p>
        </Kasten>
      </div>
      <div className="card p-3">
        <Graph bereich={{ x0: -7, x1: 7, y0: -8, y1: 8 }} label="Parabel in Scheitelpunktform"
          kurven={[
            { f: { a: 1, b: 0, c: 0 }, farbe: "var(--text-muted)", gestrichelt: true, breite: 1.4 },
            ...(spiel && ziel ? [{ f: (x: number) => spfWert(ziel, x), farbe: "#64748b", gestrichelt: true, breite: 3 }] : []),
            { f: (x: number) => spfWert(s, x) },
          ]}
          punkte={[{ ...S, label: `S(${zahl(S.x)}|${zahl(S.y)})` }]}
          ueber={({ sx, sy }) => (
            <g>
              <Pfeil x1={sx(0)} y1={sy(0)} x2={sx(S.x)} y2={sy(0)} farbe={FARBE.d} />
              <Pfeil x1={sx(S.x)} y1={sy(0)} x2={sx(S.x)} y2={sy(S.y)} farbe={FARBE.e} />
              <line x1={sx(S.x)} y1={sy(-8)} x2={sx(S.x)} y2={sy(8)} stroke={FARBE.s} strokeDasharray="3 5" strokeWidth={1.2} />
            </g>
          )} />
      </div>
    </div>
  );
}
