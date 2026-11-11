"use client";
/**
 * Die drei Rechen-Blätter: Umformen (SPF ↔ Normalform), Nullstellen (p-q)
 * und Schnittpunkte. Eigene Zahlen eintippen oder würfeln, der Rechenweg
 * deckt sich Zeile für Zeile auf, der Graph zeigt das Ergebnis.
 */
import { useEffect, useState } from "react";
import {
  ausmultiplizieren, eins, ergaenzen, ganz, nfStuecke, nfZuSpf, pqFormel, scheitel, schnitt, spfStuecke, spfZuNf, wert, zahl,
  type NF, type Punkt, type SPF,
} from "@/lib/quadratisch";
import { Chips, Zahlfeld } from "@/components/prozent/ui";
import { F, FARBE, Graph, Kasten, Term } from "./teile";

/** Rechenweg, der sich Zeile für Zeile aufdeckt. Wechselt der Inhalt, beginnt er von vorn. */
export function Rechenweg({ zeilen }: { zeilen: string[] }) {
  const [n, setN] = useState(1);
  const schluessel = zeilen.join("|");
  useEffect(() => { setN(1); }, [schluessel]);
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1">
        {zeilen.slice(0, n).map((z, i) => {
          const [term, grund] = z.split("   | ");
          return (
            <li key={i} className="rounded-lg bg-page border border-line px-3 py-1.5 flex flex-wrap justify-between gap-2">
              <span className="font-serif text-lg" style={{ fontFamily: "Cambria Math, Cambria, serif" }}>{term}</span>
              {grund && <span className="text-xs text-muted self-center">{grund}</span>}
            </li>
          );
        })}
      </ol>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={() => setN(x => Math.min(zeilen.length, x + 1))} disabled={n >= zeilen.length}>▶ Nächster Schritt</button>
        <button className="btn" onClick={() => setN(zeilen.length)} disabled={n >= zeilen.length}>Alle</button>
        <button className="btn" onClick={() => setN(1)}>↺</button>
      </div>
    </div>
  );
}

/** Ausschnitt, der S und gegebene Punkte sicher zeigt. */
function bereichFuer(f: NF, extra: Punkt[] = []) {
  const S = f.a ? scheitel(nfZuSpf(f)) : { x: 0, y: f.c };
  const pts = [S, ...extra, { x: 0, y: f.c }];
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = Math.floor(Math.min(-2, ...xs) - 3), x1 = Math.ceil(Math.max(2, ...xs) + 3);
  const y0 = Math.floor(Math.min(-2, ...ys) - 2), y1 = Math.ceil(Math.max(2, ...ys) + 2);
  return { x0, x1, y0: Math.max(y0, -40), y1: Math.min(y1, 40) };
}

/* ─────────────────────────────────────────────────── Umformen ── */

export function Umformen() {
  const [richtung, setRichtung] = useState<"aus" | "ergaenzen">("aus");
  const [s, setS] = useState<SPF>({ a: 2, d: 1, e: -3 });
  const [f, setF] = useState<NF>({ a: 1, b: -6, c: 5 });
  const wuerfeln = () => {
    const r = Math.random;
    if (richtung === "aus") setS({ a: eins(r, [1, 2, -1, 0.5, -2]), d: ganz(r, -5, 5) || 2, e: ganz(r, -6, 6) });
    else setF(spfZuNf({ a: eins(r, [1, 1, 2, -1]), d: ganz(r, -5, 5) || -3, e: ganz(r, -6, 6) }));
  };
  const nf = richtung === "aus" ? spfZuNf(s) : f;
  const spf = nfZuSpf(nf);
  const S = scheitel(spf);
  return (
    <div className="flex flex-col gap-3">
      <Chips wahl={richtung} setze={setRichtung} optionen={[
        { id: "aus", label: "➡️ Scheitelpunktform → Normalform (ausmultiplizieren)" },
        { id: "ergaenzen", label: "🧩 Normalform → Scheitelpunktform (quadratische Ergänzung)" },
      ]} />
      <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="flex flex-col gap-3">
          <div className="card p-3 flex flex-col gap-3">
            <div className="flex flex-wrap gap-3 items-end">
              {richtung === "aus" ? <>
                <Zahlfeld label={<F r="a">a</F>} wert={s.a} setze={a => a !== 0 && setS({ ...s, a })} min={-10} max={10} breite="w-20" />
                <Zahlfeld label={<F r="d">d</F>} wert={s.d} setze={d => setS({ ...s, d })} min={-20} max={20} breite="w-20" />
                <Zahlfeld label={<F r="e">e</F>} wert={s.e} setze={e => setS({ ...s, e })} min={-50} max={50} breite="w-20" />
              </> : <>
                <Zahlfeld label={<F r="a">a</F>} wert={f.a} setze={a => a !== 0 && setF({ ...f, a })} min={-10} max={10} breite="w-20" />
                <Zahlfeld label={<F r="b">b</F>} wert={f.b} setze={b => setF({ ...f, b })} min={-50} max={50} breite="w-20" />
                <Zahlfeld label={<F r="c">c</F>} wert={f.c} setze={c => setF({ ...f, c })} min={-100} max={100} breite="w-20" />
              </>}
              <button className="btn" onClick={wuerfeln}>🎲 Beispiel</button>
            </div>
            <div className="text-center"><Term st={richtung === "aus" ? spfStuecke(s) : nfStuecke(f)} gross /></div>
            <Rechenweg zeilen={richtung === "aus" ? ausmultiplizieren(s) : ergaenzen(f)} />
          </div>
          {richtung === "aus" ? (
            <Kasten art="so" titel="Ausmultiplizieren in 3 Schritten">
              <p>1. Klammer quadrieren (vier Bögen / binomische Formel). 2. Mit <F r="a">a</F> ausmultiplizieren – jedes Glied! 3. Zahlen ohne x mit <F r="e">e</F> zusammenfassen.</p>
            </Kasten>
          ) : (
            <Kasten art="so" titel="Quadratische Ergänzung">
              <p>1. Bei a ≠ 1: a aus den x-Gliedern ausklammern. 2. <F r="d">d</F> = halbe Zahl vor x (mit Vorzeichen). 3. + d² − d² ergänzen. 4. Binom rückwärts: (x + d)². 5. Zusammenfassen ⟹ S(−d | e).</p>
              <p className="text-xs text-muted">Kontrolle: x_S = −b : (2a).</p>
            </Kasten>
          )}
        </div>
        <div className="card p-3 flex flex-col gap-2">
          <Graph bereich={bereichFuer(nf)} label="Graph zur Umformung" kurven={[{ f: nf }]} punkte={[{ ...S, label: `S(${zahl(S.x)}|${zahl(S.y)})` }]} />
          <div className="text-sm flex flex-col gap-1">
            <div><span className="text-muted">Scheitelpunktform:</span> <Term st={spfStuecke(spf)} /></div>
            <div><span className="text-muted">Normalform:</span> <Term st={nfStuecke(nf)} /></div>
            <p className="text-xs text-muted">Beide Terme beschreiben dieselbe Parabel.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────── Nullstellen ── */

export function Nullstellen() {
  const [f, setF] = useState<NF>({ a: 2, b: -4, c: -6 });
  const r = pqFormel(f);
  const wuerfeln = () => {
    const z = Math.random;
    const a = eins(z, [1, 1, 2, -1, 0.5]);
    const fall = eins(z, [2, 2, 1, 0]);
    if (fall === 2) { const x1 = ganz(z, -5, 3), x2 = ganz(z, x1 + 1, 6); setF({ a, b: -a * (x1 + x2), c: a * x1 * x2 }); }
    else if (fall === 1) { const x0 = ganz(z, -4, 4); setF({ a, b: -2 * a * x0, c: a * x0 * x0 }); }
    else setF(spfZuNf({ a, d: ganz(z, -3, 3), e: (a > 0 ? 1 : -1) * ganz(z, 1, 4) }));
  };
  const D = r.D;
  return (
    <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4 items-start">
      <div className="flex flex-col gap-3">
        <div className="card p-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3 items-end">
            <Zahlfeld label={<F r="a">a</F>} wert={f.a} setze={a => a !== 0 && setF({ ...f, a })} min={-10} max={10} breite="w-20" />
            <Zahlfeld label={<F r="b">b</F>} wert={f.b} setze={b => setF({ ...f, b })} min={-50} max={50} breite="w-20" />
            <Zahlfeld label={<F r="c">c</F>} wert={f.c} setze={c => setF({ ...f, c })} min={-100} max={100} breite="w-20" />
            <button className="btn" onClick={wuerfeln}>🎲 Beispiel</button>
          </div>
          <div className="text-center"><Term st={nfStuecke(f, "f(x) = ")} gross /></div>
          <div className="rounded-xl border-2 border-accent bg-page px-4 py-2 text-center text-xl" style={{ fontFamily: "Cambria Math, Cambria, serif" }}>
            x<sub>1,2</sub> = −<F r="p">p</F>/2 ± √( (<F r="p">p</F>/2)² − <F r="q">q</F> )
          </div>
          <Rechenweg zeilen={r.schritte} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          {[["D > 0", "2 Nullstellen", D > 1e-9], ["D = 0", "1 Nullstelle", Math.abs(D) <= 1e-9], ["D < 0", "keine", D < -1e-9]].map(([k, t, an]) => (
            <div key={k as string} className={`rounded-lg border p-2 ${an ? "border-accent bg-accent/15 font-bold" : "border-line text-muted"}`}>{k as string}<br />{t as string}</div>
          ))}
        </div>
        <Kasten art="achtung" titel="Fehlerfallen">
          <p>• Erst durch a teilen, wenn vor x² keine 1 steht.</p>
          <p>• p und q mit Vorzeichen ablesen: bei −4x ist p = −4, dann ist −p/2 = +2.</p>
          <p>• − (−3) = + 3 unter der Wurzel.</p>
        </Kasten>
      </div>
      <div className="card p-3">
        <Graph bereich={bereichFuer(f, r.xs.map(x => ({ x, y: 0 })))} label="Nullstellen im Graphen" kurven={[{ f }]}
          punkte={r.xs.map((x, i) => ({ x, y: 0, farbe: FARBE.y, label: r.xs.length > 1 ? `x${i ? "₂" : "₁"} = ${zahl(x)}` : `x = ${zahl(x)}` }))} />
        <p className="text-xs text-muted mt-1">Nullstellen: dort schneidet der Graph die x-Achse, also y = 0.</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────── Schnittpunkte ── */

export function Schnittpunkte() {
  const [f, setF] = useState<NF>({ a: 1, b: 0, c: -1 });
  const [g, setG] = useState<NF>({ a: 0, b: 1, c: 1 });
  const r = schnitt(f, g);
  const wuerfeln = () => {
    const z = Math.random;
    const s: SPF = { a: eins(z, [1, -1, 0.5]), d: ganz(z, -3, 3), e: ganz(z, -3, 3) };
    const ff = spfZuNf(s);
    const x1 = ganz(z, -3, 1), x2 = ganz(z, x1 + 1, 4);
    const m = (wert(ff, x2) - wert(ff, x1)) / (x2 - x1);
    setF(ff); setG({ a: 0, b: m, c: wert(ff, x1) - m * x1 });
  };
  return (
    <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4 items-start">
      <div className="flex flex-col gap-3">
        <div className="card p-3 flex flex-col gap-3">
          {([["f", f, setF], ["g", g, setG]] as const).map(([n, h, set]) => (
            <div key={n} className="flex flex-wrap gap-3 items-end">
              <b className="self-center w-6">{n}:</b>
              <Zahlfeld label="a (0 = Gerade)" wert={h.a} setze={a => set({ ...h, a })} min={-10} max={10} breite="w-20" />
              <Zahlfeld label="b" wert={h.b} setze={b => set({ ...h, b })} min={-50} max={50} breite="w-20" />
              <Zahlfeld label="c" wert={h.c} setze={c => set({ ...h, c })} min={-100} max={100} breite="w-20" />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 justify-center">
            <Term st={nfStuecke(f, "f(x) = ")} /><Term st={nfStuecke(g, "g(x) = ")} />
            <button className="btn" onClick={wuerfeln}>🎲 Beispiel</button>
          </div>
          <Rechenweg zeilen={r.schritte} />
        </div>
        <Kasten art="so" titel="So geht's">
          <p>1. Gleichsetzen f(x) = g(x). 2. Alles auf eine Seite, rechts bleibt 0. 3. p-q-Formel (oder bei Geraden: umstellen). 4. y mit einer der Funktionen ausrechnen. 5. Punkte angeben: S(x | y).</p>
        </Kasten>
        <Kasten art="achtung" titel="Fehlerfalle">
          <p>Ein Schnittpunkt braucht <b>x und y</b>. Beim Rüberbringen dreht sich das Vorzeichen.</p>
        </Kasten>
      </div>
      <div className="card p-3">
        <Graph bereich={bereichFuer(f.a ? f : g, r.punkte)} label="Schnittpunkte im Graphen"
          kurven={[{ f }, { f: g, farbe: FARBE.y }]}
          punkte={r.punkte.map((p, i) => ({ ...p, label: `S${r.punkte.length > 1 ? i + 1 : ""}(${zahl(p.x)}|${zahl(p.y)})` }))} />
      </div>
    </div>
  );
}
