"use client";
/**
 * Die Simulation »Atommodelle« als eigene Werkstatt — ohne das große
 * Periodensystem daneben. Vier Reiter:
 *  - Atommodelle: die fünf Modelle an einem Element, gewählt im Mini-Raster.
 *  - Verbindungen: das Bindungslabor (Schalenbild, Übertragung, Valenzstriche).
 *  - Lewis-Labor: Symbole zusammenschieben, die Elektronen binden von selbst.
 *  - Teilchenmodell: Temperatur, Aggregatzustände, Mischen, Reaktionen.
 *
 * Die ersten beiden Reiter sind dieselben Bauteile wie im Reiter
 * »Atommodelle« des Periodensystems; dort bleibt alles, wie es war.
 */
import { useState, type ReactNode } from "react";
import { KATEGORIEN, PSE, pseNummer, suche, type PseElement } from "@/lib/pse/elemente";
import Atommodelle from "@/components/pse/Atommodelle";
import LewisLabor from "./LewisLabor";
import Teilchenmodell from "./Teilchenmodell";

type Reiter = "atom" | "bindung" | "lewis" | "teilchen";

const REITER: [Reiter, string, string][] = [
  ["atom", "⚛️ Atommodelle", "Fünf Modelle nacheinander — jedes erklärt mehr als das vorige. Element im kleinen Raster wählen."],
  ["bindung", "🔗 Verbindungen", "Bis zu acht Atome zusammenstecken: die gemeinsamen Elektronenpaare laufen um beide Kerne."],
  ["lewis", "🧲 Lewis-Labor", "Elementsymbole mit ihren Außenelektronen zusammenschieben — die einzelnen Elektronen ziehen sich an wie Magnete und werden zu Bindungen."],
  ["teilchen", "🧊 Teilchenmodell", "Temperatur einstellen und zusehen: fest, flüssig, gasförmig — dazu Mischen, Lösen und Reaktionen."],
];

/** Ein kleines Periodensystem nur zum Auswählen. */
function MiniRaster({ e, onWahl }: { e: PseElement; onWahl: (e: PseElement) => void }) {
  const [text, setText] = useState("");
  const treffer = text ? new Set(suche(text).map(x => x.z)) : null;
  return (
    <div className="card p-3 flex flex-col gap-2">
      <input value={text} onChange={ev => setText(ev.target.value)} placeholder="Suchen: Eisen, Fe, 26 …"
        className="px-3 py-1 rounded-xl border border-line bg-surface text-sm w-48" />
      <div className="grid gap-[2px] w-full"
        style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))", gridTemplateRows: "repeat(10, auto)" }}>
        {PSE.map(x => (
          <button key={x.z} onClick={() => onWahl(x)} title={`${x.z} ${x.name}`}
            style={{
              gridColumn: x.spalte, gridRow: x.zeile,
              background: `${KATEGORIEN[x.kategorie].farbe}${e.z === x.z ? "cc" : "33"}`,
              opacity: treffer && !treffer.has(x.z) ? 0.2 : 1,
            }}
            className={`aspect-square rounded-[3px] text-[clamp(7px,1.1vw,12px)] font-bold leading-none flex items-center justify-center ${
              e.z === x.z ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-line"}`}>
            {x.symbol}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Atomwerkstatt({ action }: { action?: ReactNode }) {
  const [reiter, setReiter] = useState<Reiter>("atom");
  // Bor ist der rote Faden der Atommodelle.
  const [e, setE] = useState<PseElement>(pseNummer(5)!);
  const info = REITER.find(r => r[0] === reiter)!;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">⚛️ Atommodelle</h1>
          <p className="text-muted text-sm mt-1 max-w-2xl">{info[2]}</p>
        </div>
        {action}
      </div>

      <div className="inline-flex self-start flex-wrap rounded-xl border border-line p-1 bg-surface">
        {REITER.map(([id, label]) => (
          <button key={id} onClick={() => setReiter(id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              reiter === id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
            {label}
          </button>
        ))}
      </div>

      {reiter === "atom" && (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="w-full lg:flex-1 min-w-0"><MiniRaster e={e} onWahl={setE} /></div>
          <div className="w-full lg:w-[500px] shrink-0"><Atommodelle e={e} onWahl={setE} blickFest="atom" /></div>
        </div>
      )}
      {reiter === "bindung" && (
        <div className="w-full max-w-[640px]"><Atommodelle e={e} onWahl={setE} blickFest="bindung" /></div>
      )}
      {reiter === "lewis" && <LewisLabor />}
      {reiter === "teilchen" && <Teilchenmodell />}
    </div>
  );
}
