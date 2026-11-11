"use client";
/**
 * Schritt 1: die Normalparabel y = x². Wertetabelle und Graph hängen
 * zusammen (über eine Spalte fahren zeigt den Punkt), die Treppe 1-3-5 zeigt,
 * wie man ohne Tabelle zeichnet.
 */
import { useState } from "react";
import { zahl } from "@/lib/quadratisch";
import { F, FARBE, Graph, Kasten, Pfeil, Wertetabelle } from "./teile";

const XS = [-3, -2, -1, 0, 1, 2, 3];

export default function Normalparabel() {
  const [hover, setHover] = useState<number | null>(null);
  const [treppe, setTreppe] = useState(true);
  const P = hover === null ? null : { x: XS[hover], y: XS[hover] ** 2 };
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 items-start">
      <div className="flex flex-col gap-3">
        <div className="card p-3 flex flex-col gap-2">
          <div className="text-2xl font-serif text-center" style={{ fontFamily: "Cambria Math, Cambria, serif" }}>
            y = <F r="x">x</F>²
          </div>
          <Wertetabelle xs={XS} ys={XS.map(x => x * x)} markiert={hover} onZeile={setHover} />
          <p className="text-xs text-muted">Über eine Spalte fahren zeigt den Punkt im Graphen.</p>
        </div>
        <Kasten art="merk" titel="Die Normalparabel">
          <p>• Form wie ein <b>U</b>, nach oben offen.</p>
          <p>• Tiefster Punkt: <b>Scheitelpunkt S(0 | 0)</b>.</p>
          <p>• <b>Symmetrisch</b> zur y-Achse: 2² = 4 und (−2)² = 4.</p>
          <p>• y ist nie negativ – ein Quadrat ist nie negativ.</p>
        </Kasten>
        <Kasten art="so" titel="Treppen-Trick: zeichnen ohne Tabelle">
          <p>Vom Scheitel aus: 1 nach rechts → <F r="a">1 hoch</F>, 1 nach rechts → <F r="a">3 hoch</F>, 1 nach rechts → <F r="a">5 hoch</F> (ungerade Zahlen). Nach links genauso.</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={treppe} onChange={e => setTreppe(e.target.checked)} /> Treppe im Graphen zeigen</label>
        </Kasten>
        <Kasten art="achtung" titel="Fehlerfalle">
          <p>Negative Zahlen einsetzen: (−3)² = <b>9</b>, aber −3² = −9. Immer Klammer drum! Und: unten rund zeichnen, keine Spitze.</p>
        </Kasten>
      </div>
      <div className="card p-3">
        <Graph bereich={{ x0: -4, x1: 4, y0: -1, y1: 10 }} label="Normalparabel"
          kurven={[{ f: { a: 1, b: 0, c: 0 } }]}
          punkte={[{ x: 0, y: 0, label: "S(0|0)" }, ...XS.map(x => ({ x, y: x * x, farbe: "var(--accent)" })), ...(P ? [{ ...P, label: `(${zahl(P.x)} | ${zahl(P.y)})` }] : [])]}
          ueber={({ sx, sy }) => treppe && (
            <g>
              {[1, -1].map(sg => [0, 1, 2].map(i => {
                const x0 = sg * i, x1 = sg * (i + 1);
                return (
                  <g key={`${sg}${i}`}>
                    <Pfeil x1={sx(x0)} y1={sy(x0 * x0)} x2={sx(x1)} y2={sy(x0 * x0)} farbe={FARBE.x} />
                    <Pfeil x1={sx(x1)} y1={sy(x0 * x0)} x2={sx(x1)} y2={sy(x1 * x1)} farbe={FARBE.a} text={sg > 0 ? `${2 * i + 1}` : undefined} dx={12} dy={4} />
                  </g>
                );
              }))}
            </g>
          )} />
      </div>
    </div>
  );
}
