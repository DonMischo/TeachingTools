"use client";
/** Reiter »Erfolge«: alle Erfolge der Sim nach Gruppen, mit Fortschritt. */
import { ERFOLGE, type MedienErfolg } from "@/lib/medien/erfolge";
import type { Fortschritt } from "@/lib/medien/fortschritt";

const GRUPPEN: { id: MedienErfolg["gruppe"]; text: string }[] = [
  { id: "Zeitreise", text: "Für geschaffte Stationen der Zeitreise." },
  { id: "Epochen", text: "Für jede Epoche, deren Stationen du alle geschafft hast." },
  { id: "Ausprobiert", text: "Für gelöste Mitmach-Demos an den Stationen (»Probier's aus«)." },
  { id: "Spiele", text: "Für die Spiele »Eilbote« und »Wer war zuerst?«." },
];

export default function Erfolge({ f }: { f: Fortschritt }) {
  const anzahl = ERFOLGE.filter(e => e.wert(f) >= e.ziel).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex items-center gap-4">
        <div className="text-4xl">🏆</div>
        <div>
          <div className="text-2xl font-black">{anzahl} von {ERFOLGE.length} Erfolgen</div>
          <p className="text-sm text-muted">Sie stehen auch in der Übersicht aller Erfolge (Menü »Erfolge«).</p>
        </div>
      </div>
      {GRUPPEN.map(g => (
        <section key={g.id} className="flex flex-col gap-2">
          <div><h3 className="font-black">{g.id}</h3><p className="text-xs text-muted">{g.text}</p></div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-2">
            {ERFOLGE.filter(e => e.gruppe === g.id).map(e => {
              const wert = Math.min(e.wert(f), e.ziel), da = wert >= e.ziel;
              return (
                <div key={e.id} className={`card p-3 flex gap-3 items-start ${da ? "border-2 border-ok" : "opacity-80"}`}>
                  <span className={`text-2xl ${da ? "" : "grayscale opacity-50"}`} aria-hidden>{e.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{da ? "✅ " : ""}{e.name}</div>
                    <div className="text-xs text-muted">{e.text}</div>
                    {e.ziel > 1 && !da && (
                      <div className="mt-1 h-1.5 rounded-full bg-surface-hover overflow-hidden" title={`${wert} / ${e.ziel}`}>
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(wert / e.ziel) * 100}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
