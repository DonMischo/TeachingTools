"use client";
/**
 * Schritt 3: der Faktor a. Strecken (|a| > 1), Stauchen (|a| < 1),
 * Spiegeln (a < 0). Die Treppe wird zu a·1, a·3, a·5.
 */
import { useState } from "react";
import { spfStuecke, steckbrief, zahl } from "@/lib/quadratisch";
import { F, FARBE, Graph, Kasten, Pfeil, Regler, Term } from "./teile";

const SCHNELL = [2, 0.5, -1, -2, -0.5, 1];

export default function Strecken() {
  const [a, setA] = useState(2);
  const aa = a === 0 ? 0.25 : a;
  const k = steckbrief(aa);
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 items-start">
      <div className="flex flex-col gap-3">
        <div className="card p-3 flex flex-col gap-3">
          <div className="text-center"><Term st={spfStuecke({ a: aa, d: 0, e: 0 })} gross /></div>
          <Regler name="a" r="a" wert={aa} setze={v => setA(v === 0 ? 0.25 : v)} min={-3} max={3} schritt={0.25} hinweis="Öffnung und Form" />
          <div className="flex flex-wrap gap-1.5">
            {SCHNELL.map(v => <button key={v} className={`chip ${aa === v ? "chip-on" : ""}`} onClick={() => setA(v)}>a = {zahl(v)}</button>)}
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-page p-2"><div className="text-xs text-muted">Öffnung</div><b>nach {k.oeffnung} {k.oeffnung === "oben" ? "∪" : "∩"}</b></div>
            <div className="rounded-lg bg-page p-2"><div className="text-xs text-muted">Form</div><b>{k.form}</b></div>
          </div>
        </div>
        <Kasten art="merk" titel="Was macht a?">
          <p><b>Vorzeichen</b> von <F r="a">a</F>: plus → nach oben offen, minus → nach unten (gespiegelt).</p>
          <p><b>Betrag</b> von <F r="a">a</F>: größer als 1 → <b>schmaler</b> (gestreckt), kleiner als 1 → <b>breiter</b> (gestaucht).</p>
        </Kasten>
        <Kasten art="so" titel="Treppe mit a">
          <p>Vom Scheitel: 1 rechts → <F r="a">a·1</F>, 1 rechts → <F r="a">a·3</F>, 1 rechts → <F r="a">a·5</F>. Hier: {[1, 3, 5].map(n => zahl(aa * n)).join(", ")}.</p>
        </Kasten>
        <Kasten art="achtung" titel="Fehlerfalle">
          <p>»½x² ist kleiner, also ist die Parabel kleiner.« Nein – sie ist <b>breiter</b>! Bei x = 2: ½·4 = 2, die Normalparabel ist schon bei 4.</p>
        </Kasten>
      </div>
      <div className="card p-3">
        <Graph bereich={{ x0: -5, x1: 5, y0: -8, y1: 8 }} label="Parabel mit Faktor a"
          kurven={[{ f: { a: 1, b: 0, c: 0 }, farbe: "var(--text-muted)", gestrichelt: true, breite: 1.8 }, { f: { a: aa, b: 0, c: 0 } }]}
          punkte={[{ x: 0, y: 0, label: "S(0|0)" }]}
          ueber={({ sx, sy }) => (
            <g>
              {[0, 1, 2].map(i => {
                const y0 = aa * i * i, y1 = aa * (i + 1) ** 2;
                return (
                  <g key={i}>
                    <Pfeil x1={sx(i)} y1={sy(y0)} x2={sx(i + 1)} y2={sy(y0)} farbe={FARBE.x} />
                    <Pfeil x1={sx(i + 1)} y1={sy(y0)} x2={sx(i + 1)} y2={sy(y1)} farbe={FARBE.a} text={zahl(aa * (2 * i + 1))} dx={18} dy={4} />
                  </g>
                );
              })}
            </g>
          )} />
      </div>
    </div>
  );
}
