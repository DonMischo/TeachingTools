"use client";
/**
 * Schritt 2: verschieben. Erst nur nach oben/unten (y = x² + e), dann nur
 * nach links/rechts (y = (x + d)²) — dort verschiebt d »andersherum« —, dann
 * beides. Die gestrichelte Normalparabel bleibt stehen, Pfeile zeigen den Weg
 * des Scheitelpunkts.
 */
import { useState } from "react";
import { scheitel, spfStuecke, spfWert, zahl, type SPF } from "@/lib/quadratisch";
import { Chips } from "@/components/prozent/ui";
import { F, FARBE, Graph, Kasten, Pfeil, Regler, Term } from "./teile";

type Stufe = "e" | "d" | "de";
const STUFEN = [
  { id: "e" as const, label: "1 · nach oben/unten  (+ e)" },
  { id: "d" as const, label: "2 · nach links/rechts  (x + d)²" },
  { id: "de" as const, label: "3 · beides" },
];
const XS = [-3, -2, -1, 0, 1, 2, 3];

export default function Verschieben() {
  const [stufe, setStufe] = useState<Stufe>("e");
  const [d, setD] = useState(2);
  const [e, setE] = useState(3);
  const s: SPF = { a: 1, d: stufe === "e" ? 0 : d, e: stufe === "d" ? 0 : e };
  const S = scheitel(s);
  return (
    <div className="flex flex-col gap-3">
      <Chips wahl={stufe} setze={setStufe} optionen={STUFEN} />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 items-start">
        <div className="flex flex-col gap-3">
          <div className="card p-3 flex flex-col gap-3">
            <div className="text-center"><Term st={spfStuecke(s)} gross /></div>
            {stufe !== "e" && <Regler name="d" r="d" wert={d} setze={setD} min={-5} max={5} schritt={0.5} hinweis="links/rechts" />}
            {stufe !== "d" && <Regler name="e" r="e" wert={e} setze={setE} min={-5} max={5} schritt={0.5} hinweis="oben/unten" />}
            <p className="text-center font-bold">Scheitelpunkt S(<F r="d">{zahl(S.x)}</F> | <F r="e">{zahl(S.y)}</F>)</p>
            <Vergleich s={s} stufe={stufe} />
          </div>
          {stufe === "e" && (
            <Kasten art="merk" titel="Was macht e?">
              <p>Jeder y-Wert der Normalparabel bekommt <F r="e">e</F> dazu. Die ganze Kurve rutscht um <F r="e">e</F> nach <b>oben</b> (e negativ: nach unten). Die Form bleibt gleich.</p>
              <p>Scheitelpunkt: <b>S(0 | <F r="e">e</F>)</b>.</p>
            </Kasten>
          )}
          {stufe === "d" && (
            <>
              <Kasten art="merk" titel="Was macht d? – andersherum!">
                <p><F r="d">d</F> positiv → nach <b>links</b>, <F r="d">d</F> negativ → nach <b>rechts</b>. Der Scheitelpunkt liegt bei <b>x = −<F r="d">d</F></b>.</p>
                <p>Warum? Der tiefste Wert ist 0, wenn die Klammer 0 ist: x + d = 0 ⟹ x = −d.</p>
              </Kasten>
              <Kasten art="tipp" titel="Trick">
                <p>Frag dich: Welche Zahl für x macht die Klammer zu 0? Genau dort liegt S. Bei (x + 3)² ist das x = −3.</p>
              </Kasten>
            </>
          )}
          {stufe === "de" && (
            <Kasten art="so" titel="Scheitelpunkt ablesen">
              <p>y = (x + <F r="d">d</F>)² + <F r="e">e</F> &nbsp;⟹&nbsp; <b>S(−<F r="d">d</F> | <F r="e">e</F>)</b>. Erst links/rechts (Gegenteil von d), dann hoch/runter (wie e).</p>
            </Kasten>
          )}
        </div>
        <div className="card p-3">
          <Graph bereich={{ x0: -7, x1: 7, y0: -6, y1: 10 }} label="Verschobene Parabel"
            kurven={[{ f: { a: 1, b: 0, c: 0 }, farbe: "var(--text-muted)", gestrichelt: true, breite: 1.8 }, { f: x => spfWert(s, x) }]}
            punkte={[{ ...S, label: `S(${zahl(S.x)}|${zahl(S.y)})` }]}
            ueber={({ sx, sy }) => (
              <g>
                <Pfeil x1={sx(0)} y1={sy(0)} x2={sx(S.x)} y2={sy(0)} farbe={FARBE.d} text={S.x ? `${zahl(Math.abs(S.x))} ${S.x < 0 ? "links" : "rechts"}` : undefined} />
                <Pfeil x1={sx(S.x)} y1={sy(0)} x2={sx(S.x)} y2={sy(S.y)} farbe={FARBE.e} text={S.y ? `${zahl(Math.abs(S.y))} ${S.y > 0 ? "hoch" : "runter"}` : undefined} dx={S.x <= 0 ? -34 : 34} dy={4} />
              </g>
            )} />
        </div>
      </div>
    </div>
  );
}

/** Kleine Tabelle: Normalparabel gegen verschobene — zeigt, warum es so ist. */
function Vergleich({ s, stufe }: { s: SPF; stufe: Stufe }) {
  const xs = stufe === "d" || stufe === "de" ? XS.map(x => x - s.d) : XS;
  return (
    <div className="overflow-x-auto text-sm">
      <table className="border-collapse" style={{ fontVariantNumeric: "tabular-nums" }}>
        <tbody>
          <tr><th className="pr-2 text-left" style={{ color: FARBE.x }}>x</th>{xs.map(x => <td key={x} className="px-2 border-l border-line text-center">{zahl(x)}</td>)}</tr>
          <tr><th className="pr-2 text-left text-muted whitespace-nowrap">{stufe === "e" ? "x²" : "(x + d)²"}</th>{xs.map(x => <td key={x} className="px-2 border-l border-line text-center text-muted">{zahl((x + s.d) ** 2)}</td>)}</tr>
          <tr><th className="pr-2 text-left" style={{ color: FARBE.y }}>y</th>{xs.map(x => <td key={x} className="px-2 border-l border-line text-center font-bold">{zahl(spfWert(s, x))}</td>)}</tr>
        </tbody>
      </table>
      <p className="text-xs text-muted mt-1">
        {stufe === "e" ? "Jeder y-Wert ist um e größer als x² – die Kurve rutscht hoch bzw. runter." :
          stufe === "d" ? "Die Klammer (x + d)² durchläuft dieselben Zahlen 9, 4, 1, 0, 1, 4, 9 wie x² – nur bei x-Werten, die um −d verschoben sind." :
            "Die Klammer liefert 9, 4, 1, 0, 1, 4, 9 an den um −d verschobenen Stellen – dazu kommt überall e."}
      </p>
    </div>
  );
}
