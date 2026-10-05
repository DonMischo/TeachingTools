"use client";
/**
 * Reiter 3: Lernen — wo das »neuronale« an neuronalen Netzen steckt.
 *
 * Die beiden ersten Reiter zeigen fertige Maschinen bei der Arbeit. Hier geht
 * es um die Frage darunter: Was heißt eigentlich »lernen«?
 *
 *   🧠 Das Neuron        Gewichte, Fehler, Nachstellen — die Regel von 1958,
 *                        die bis heute unter jedem Training liegt.
 *   🧠🧠 Zwei Neuronen    Dieselbe Aufgabe, eine Schicht mehr: Was mit einem
 *                        Neuron unmöglich war, geht jetzt. Mit echter
 *                        Backpropagation, nicht nachgespielt.
 *   ✏️ Zeichnen & Erkennen  Beispiele geben, vergleichen lassen. Lernen ohne
 *                        eine einzige Formel — und mit allen Tücken, die auch
 *                        große Bilderkenner haben.
 *
 * Beide brauchen keine Sitzung und keinen Server: Sie rechnen im Browser.
 */
import { useState } from "react";
import { Neuron } from "@/components/ki/Neuron";
import { Neuron2 } from "@/components/ki/Neuron2";
import { Zeichnen } from "@/components/ki/Zeichnen";

type Teil = "neuron" | "neuron2" | "zeichnen";

export function Lernen() {
  const [teil, setTeil] = useState<Teil>("neuron");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {([
          ["neuron", "🧠 Das Neuron"],
          ["neuron2", "🧠🧠 Zwei Neuronen"],
          ["zeichnen", "✏️ Zeichnen & Erkennen"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTeil(id)}
            className={`px-3.5 py-1.5 rounded-xl border font-bold text-sm ${
              teil === id
                ? "border-(--accent) bg-(--accent) text-(--accent-text)"
                : "border-(--border) bg-(--surface) hover:bg-(--surface-hover)"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Beide bleiben montiert: angelernte Beispiele sollen nicht verschwinden,
          weil jemand kurz zum Neuron schaut. */}
      <div hidden={teil !== "neuron"}><Neuron /></div>
      <div hidden={teil !== "neuron2"}><Neuron2 /></div>
      <div hidden={teil !== "zeichnen"}><Zeichnen /></div>
    </div>
  );
}
