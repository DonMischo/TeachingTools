"use client";
/** Steckbriefe der vier Zahlenbereiche, die Erweiterungsleiter und die Tabelle »Welche Rechnung bleibt im Bereich?«. */
import { useState } from "react";
import { ABGESCHLOSSEN, BEREICHE, FARBE, GEGENBEISPIEL, STECKBRIEFE, ZEICHEN, type Bereich } from "@/lib/zahlenbereiche";

const LEITER: { b: Bereich; gleichung: string; loesung: string; text: string }[] = [
  { b: "Z", gleichung: "x + 5 = 3", loesung: "x = −2", text: "In ℕ gibt es keine Zahl, die man zu 5 addiert und 3 erhält. Also erfinden wir die negativen Zahlen." },
  { b: "Q", gleichung: "4 · x = 3", loesung: "x = 3/4", text: "In ℤ geht 3 : 4 nicht auf. Also nehmen wir die Brüche dazu." },
  { b: "R", gleichung: "x · x = 2", loesung: "x = √2 ≈ 1,41421…", text: "Kein Bruch ergibt mit sich selbst malgenommen genau 2. Also kommen die irrationalen Zahlen dazu." },
];
const OPS = ["+", "−", "·", ":"] as const;

export default function Steckbriefe() {
  const [zelle, setZelle] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STECKBRIEFE.map(s => (
          <article key={s.b} className="card p-4 flex flex-col gap-2 border-t-4" style={{ borderTopColor: FARBE[s.b] }}>
            <h3 className="font-black text-lg"><span style={{ color: FARBE[s.b] }}>{ZEICHEN[s.b]}</span> {s.name}</h3>
            <p className="font-mono text-sm">{s.menge}</p>
            <p className="text-sm"><b>Wozu?</b> {s.warum}</p>
            <ul className="text-sm list-disc pl-5">{s.eigenschaften.map(e => <li key={e}>{e}</li>)}</ul>
            <p className="text-sm"><b>Geht immer:</b> {s.geht.join(", ")}</p>
            <p className="text-sm"><b>Geht nicht immer:</b> {s.gehtNicht.join(", ")}</p>
            <div className="flex flex-wrap gap-1.5 mt-auto">
              {s.beispiele.map(x => <span key={x} className="rounded-md px-2 py-0.5 text-sm font-bold" style={{ background: FARBE[s.b] + "22", color: FARBE[s.b] }}>{x}</span>)}
            </div>
          </article>
        ))}
      </div>

      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-black">🪜 Warum immer neue Zahlen? — Gleichungen, die nicht aufgehen</h3>
        <ol className="grid gap-3 md:grid-cols-3">
          {LEITER.map(l => (
            <li key={l.b} className="rounded-xl border border-line p-3 flex flex-col gap-1">
              <span className="font-mono text-lg font-black">{l.gleichung}</span>
              <span className="text-sm">{l.text}</span>
              <span className="font-mono font-bold" style={{ color: FARBE[l.b] }}>{l.loesung} ∈ {ZEICHEN[l.b]}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-black">🧮 Bleibt das Ergebnis im Bereich?</h3>
        <p className="text-sm text-muted">Tippe auf ein ✘, um ein Gegenbeispiel zu sehen. (Teilen durch 0 ist nirgends erlaubt.)</p>
        <table className="text-center border-collapse w-full max-w-lg">
          <thead><tr><th />{OPS.map(o => <th key={o} className="p-2 font-mono text-lg">{o}</th>)}</tr></thead>
          <tbody>
            {BEREICHE.map(b => (
              <tr key={b} className="border-t border-line">
                <th className="p-2 text-lg" style={{ color: FARBE[b] }}>{ZEICHEN[b]}</th>
                {OPS.map(o => {
                  const ok = ABGESCHLOSSEN[b][o];
                  const id = `${b}${o}`;
                  return (
                    <td key={o} className="p-1">
                      <button type="button" disabled={ok} onClick={() => setZelle(id)}
                        className={`w-10 h-10 rounded-lg font-black ${ok ? "text-ok" : "text-bad hover:bg-surface-hover"} ${zelle === id ? "ring-2 ring-bad" : ""}`}
                        aria-label={`${ZEICHEN[b]} ${o}: ${ok ? "bleibt im Bereich" : "nicht immer"}`}>{ok ? "✔" : "✘"}</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {zelle && <p className="text-sm font-bold text-bad">{GEGENBEISPIEL[zelle as keyof typeof GEGENBEISPIEL]}</p>}
      </section>
    </div>
  );
}
