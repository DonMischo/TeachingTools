"use client";
/**
 * Ähnliche Figuren erklärt: was »ähnlich« heißt, die Ähnlichkeitssätze für
 * Dreiecke und ein Dreieck zum Selberbauen, das mit einem festen verglichen wird.
 */
import { useState } from "react";
import { aehnlichkeitsFaktor, seiten, winkel, type Figur } from "@/lib/aehnlichkeit";
import { Blatt, FigurZeichnung } from "./Blatt";

const de = (x: number, s = 2) => x.toLocaleString("de-DE", { maximumFractionDigits: s });

/** Dreieck aus drei Seiten bauen (A im Ursprung, B auf der x-Achse); null, wenn die Dreiecksungleichung nicht gilt */
export function dreieckAusSeiten(a: number, b: number, c: number, ursprung = { x: 0, y: 0 }): Figur | null {
  if (a + b <= c || a + c <= b || b + c <= a) return null;
  // c = AB, b = AC, a = BC
  const x = (b * b + c * c - a * a) / (2 * c), y = Math.sqrt(Math.max(0, b * b - x * x));
  return [{ x: ursprung.x, y: ursprung.y }, { x: ursprung.x + c, y: ursprung.y }, { x: ursprung.x + x, y: ursprung.y - y }];
}

const SAETZE = [
  { name: "WW", text: "Zwei Dreiecke sind ähnlich, wenn sie in zwei Winkeln übereinstimmen (der dritte ist dann automatisch gleich)." },
  { name: "SSS", text: "… wenn alle drei Seitenverhältnisse gleich sind: a' : a = b' : b = c' : c." },
  { name: "SWS", text: "… wenn zwei Seitenverhältnisse und der eingeschlossene Winkel übereinstimmen." },
  { name: "SsW", text: "… wenn zwei Seitenverhältnisse und der Winkel gegenüber der längeren Seite übereinstimmen." },
];

export default function Aehnlich() {
  const fest = dreieckAusSeiten(3, 4, 5, { x: -8, y: 5 })!;
  const [s, setS] = useState({ a: 4.5, b: 6, c: 7.5 });
  const neu = dreieckAusSeiten(s.a, s.b, s.c, { x: 0, y: 5 });
  const k = neu ? aehnlichkeitsFaktor(fest, neu) : null;
  return (
    <div className="flex flex-col gap-4">
      <section className="card p-4 flex flex-col gap-2">
        <h3 className="font-black">Was heißt ähnlich?</h3>
        <p className="text-sm max-w-3xl">Zwei Figuren sind <b>ähnlich</b>, wenn die eine eine maßstäbliche Vergrößerung oder Verkleinerung der anderen ist (vielleicht noch gedreht oder gespiegelt). Dann gilt: <b>entsprechende Winkel sind gleich groß</b> und <b>alle Längen stehen im selben Verhältnis k</b>. Deckungsgleiche (kongruente) Figuren sind ähnlich mit k = 1. Alle Kreise sind ähnlich, alle Quadrate auch — Rechtecke aber nicht immer.</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {SAETZE.map(x => <div key={x.name} className="rounded-xl border border-line p-3 text-sm"><b className="text-accent">{x.name}</b> {x.text}</div>)}
        </div>
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="card p-3">
          <Blatt label="Zwei Dreiecke vergleichen">
            <FigurZeichnung f={fest} farbe="#2563eb" beschriftung="" />
            {neu && <FigurZeichnung f={neu} farbe={k ? "#16a34a" : "#dc2626"} beschriftung="'" />}
          </Blatt>
        </div>
        <div className="card p-4 flex flex-col gap-3">
          <p className="text-sm">Blau: Seiten 3, 4, 5. Baue das zweite Dreieck so, dass es <b>ähnlich</b> ist.</p>
          {(["a", "b", "c"] as const).map(n => (
            <label key={n} className="flex flex-col text-xs text-muted">Seite {n}&apos; = <b className="text-fg text-sm">{de(s[n])}</b>
              <input type="range" min={1} max={10} step={0.5} value={s[n]} onChange={e => setS({ ...s, [n]: Number(e.target.value) })} aria-label={`Seite ${n}'`} />
            </label>
          ))}
          {!neu ? <p className="text-sm text-bad">Kein Dreieck: zwei Seiten zusammen müssen länger sein als die dritte.</p> : <>
            <p className="text-sm">Verhältnisse: {(["a", "b", "c"] as const).map((n, i) => `${n}'/${n} = ${de(s[n] / [3, 4, 5][i])}`).join(", ")}</p>
            <p className="text-sm">Winkel: {winkel(fest).map(w => de(w, 0) + "°").join(", ")} ↔ {winkel(neu).map(w => de(w, 0) + "°").join(", ")}</p>
            <p className={`font-bold ${k ? "text-ok" : "text-bad"}`}>{k ? `Ähnlich mit k = ${de(k)}` : "Nicht ähnlich — die Verhältnisse sind verschieden."}</p>
            <p className="text-xs text-muted">Seiten des grünen Dreiecks: {seiten(neu).map(x => de(x)).join(", ")}</p>
          </>}
        </div>
      </section>
    </div>
  );
}
