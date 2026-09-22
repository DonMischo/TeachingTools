"use client";
/**
 * Reiter 3: Lernen — wo das »neuronale« an neuronalen Netzen steckt.
 *
 * Die beiden ersten Reiter zeigen fertige Maschinen bei der Arbeit. Hier geht
 * es um die Frage darunter: Was heißt eigentlich »lernen«?
 *
 *   🧠 Das Neuron        Gewichte, Fehler, Nachstellen — die Regel von 1958,
 *                        die bis heute unter jedem Training liegt.
 *   ✏️ Zeichnen & Erkennen  Beispiele geben, vergleichen lassen. Lernen ohne
 *                        eine einzige Formel — und mit allen Tücken, die auch
 *                        große Bilderkenner haben.
 *
 * Beide brauchen keine Sitzung und keinen Server: Sie rechnen im Browser.
 */
import { useState } from "react";
import { Neuron } from "@/components/ki/Neuron";
import { Zeichnen } from "@/components/ki/Zeichnen";

type Teil = "neuron" | "zeichnen";

export function Lernen() {
  const [teil, setTeil] = useState<Teil>("neuron");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {([["neuron", "🧠 Das Neuron"], ["zeichnen", "✏️ Zeichnen & Erkennen"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTeil(id)}
            className={`px-3.5 py-1.5 rounded-xl border font-bold text-sm ${
              teil === id
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]"
                : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Beide bleiben montiert: angelernte Beispiele sollen nicht verschwinden,
          weil jemand kurz zum Neuron schaut. */}
      <div hidden={teil !== "neuron"}><Neuron /></div>
      <div hidden={teil !== "zeichnen"}><Zeichnen /></div>
    </div>
  );
}
