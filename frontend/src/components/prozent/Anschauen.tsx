"use client";
/**
 * Anschauen: ein Prozentsatz, vier Bilder — Kreis, Prozentstreifen,
 * Hunderterfeld, gezählte Dinge. Dazu dieselbe Zahl als Bruch und Dezimalzahl.
 */
import { useState } from "react";
import { Regler } from "@/components/groessen/bausteine";
import { alsBruch, z } from "@/lib/prozent";
import { DingeBild, Gleichung, HunderterBild, KreisBild, StreifenBild } from "./bilder";
import { Chips, Erklaerung, Zahlfeld } from "./ui";

type Bild = "kreis" | "streifen" | "feld" | "dinge";
const BILDER = [
  { id: "kreis", label: "🥧 Kreis" },
  { id: "streifen", label: "📏 Prozentstreifen" },
  { id: "feld", label: "💯 Hunderterfeld" },
  { id: "dinge", label: "🧒 Dinge zählen" },
] as const;

const EMOJIS = ["🧒", "🍎", "🚲", "⚽", "🐟"];
/** Prozentstellen auf Kreis und Streifen */
const MARKEN = [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];

export default function Anschauen() {
  const [bild, setBild] = useState<Bild>("kreis");
  const [p, setP] = useState(25);
  const [G, setG] = useState(40);
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const W = (G * p) / 100;
  const b = alsBruch(p);

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <Chips wahl={bild} setze={setBild} optionen={BILDER} />
      <div className="flex flex-wrap gap-4 items-end">
        <Regler label="Prozentsatz p (in %)" wert={p} setze={setP} min={0} max={200} breit />
        <Zahlfeld label="p genau" wert={p} setze={setP} min={0} max={400} einheit="%" breite="w-24" />
        <Zahlfeld label="Grundwert G (das Ganze)" wert={G} setze={setG} min={1} max={1e7} />
        {bild === "dinge" && (
          <div className="flex gap-1" role="group" aria-label="Was wird gezählt?">
            {EMOJIS.map(e => (
              <button key={e} className={`chip ${e === emoji ? "chip-on" : ""}`} onClick={() => setEmoji(e)}>{e}</button>
            ))}
          </div>
        )}
      </div>

      {bild === "kreis" && <KreisBild p={p} marken={MARKEN} />}
      {bild === "streifen" && <StreifenBild p={p} G={G} marken={MARKEN} />}
      {bild === "feld" && <HunderterBild p={p} />}
      {bild === "dinge" && (G > 60 || !Number.isInteger(G) ? (
        <p className="text-sm text-muted">Zum Zählen bitte einen ganzen Grundwert bis 60 wählen.</p>
      ) : p > 100 ? (
        <p className="text-sm text-muted">Mehr als 100 % von {z(G)} Dingen gibt es nicht zu zählen — das Ganze ist schon alles. Schau dir das im Kreis oder Streifen an.</p>
      ) : (
        <DingeBild G={G} p={p} emoji={emoji} />
      ))}

      <Gleichung>{z(p)} % von {z(G)} = {z(W, 4)}</Gleichung>
      <div className="flex flex-wrap justify-center gap-3 text-lg">
        <span className="chip">{z(p)} % = {z(p)}/100{b && b.nenner !== 100 ? ` = ${b.zaehler}/${b.nenner}` : ""}</span>
        <span className="chip">= {z(p / 100, 6)} als Dezimalzahl</span>
        <span className="chip">Rest: {z(Math.max(0, 100 - p))} % = {z(Math.max(0, G - W), 4)}</span>
      </div>
      <Erklaerung>
        {bild === "kreis" && <>Der ganze Kreis ist immer <strong>100 %</strong> — egal, wie groß das Ganze ist. Die gestrichelten Linien teilen ihn in Viertel: 25 %, 50 %, 75 %; die Striche am Rand stehen alle 10 % — wie eine Uhr, bei der eine Runde 100 % ist. Über 100 % braucht man einen zweiten Kreis.</>}
        {bild === "streifen" && <>Oben die Prozent, unten die Werte: was übereinander steht, gehört zusammen (100 % ≙ {z(G)}). Halbiert man oben, halbiert man unten — genau das macht der Dreisatz.</>}
        {bild === "feld" && <>Hundert Kästchen, jedes ist <strong>1 %</strong>. »Prozent« heißt »von Hundert«: {z(p)} % sind {z(p)} von 100 Kästchen — egal, ob das Ganze 100, {z(G)} oder eine Million ist.</>}
        {bild === "dinge" && <>Von {z(G)} sind {z(p)} % markiert. Bei 100 Dingen wäre jedes eins 1 %; hier ist jedes {z(100 / G, 3)} %.</>}
      </Erklaerung>
    </div>
  );
}
