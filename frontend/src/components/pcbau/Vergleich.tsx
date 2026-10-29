"use client";
/** Damals & heute: Kennzahlen der vier Geräte auf logarithmischer Skala. */
import { GERAETE } from "@/lib/pcbau/geraete";
import type { Kennzahl } from "@/lib/pcbau/typen";

const ZAHLEN: { id: Kennzahl; name: string; einheit: (v: number) => string; erklaerung: string }[] = [
  { id: "takt", name: "Takt", einheit: v => v >= 1000 ? `${(v / 1000).toLocaleString("de-DE")} GHz` : `${v} MHz`, erklaerung: "Wie oft pro Sekunde der Prozessor einen Arbeitsschritt macht." },
  { id: "kerne", name: "Rechenkerne", einheit: v => `${v}`, erklaerung: "Wie viele Dinge der Prozessor gleichzeitig rechnen kann." },
  { id: "ram", name: "Arbeitsspeicher", einheit: v => v >= 1024 ? `${v / 1024} GB` : `${v} MB`, erklaerung: "Platz für das, woran gerade gearbeitet wird." },
  { id: "speicher", name: "Dauerspeicher", einheit: v => v >= 1_000_000 ? `${v / 1_000_000} TB` : v >= 1000 ? `${v / 1000} GB` : `${v} MB`, erklaerung: "Festplatte, SSD oder Speicherkarte: bleibt auch ohne Strom." },
  { id: "watt", name: "Netzteil", einheit: v => `${v} W`, erklaerung: "Wie viel Leistung das Netzteil oder Ladegerät höchstens liefert." },
];

const FARBEN: Record<string, string> = { pc: "#38bdf8", pc386: "#d6c79a", pi: "#c51a4a", handy: "#a78bfa" };

export default function Vergleich() {
  const alt = GERAETE.find(g => g.id === "pc386")!.kennzahlen;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        {GERAETE.map(g => (
          <div key={g.id} className="card px-3 py-2 flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full" style={{ background: FARBEN[g.id] }} />
            <b>{g.icon} {g.name}</b> <span className="text-muted">{g.kennzahlen.jahr} · {g.kennzahlen.notiz}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(22rem,1fr))]">
        {ZAHLEN.map(z => {
          const werte = GERAETE.map(g => g.kennzahlen[z.id]);
          const max = Math.log10(Math.max(...werte) * 1.2);
          return (
            <div key={z.id} className="card p-4">
              <h3 className="font-black">{z.name}</h3>
              <p className="text-xs text-muted mb-3">{z.erklaerung}</p>
              <div className="grid gap-2">
                {GERAETE.map(g => {
                  const v = g.kennzahlen[z.id];
                  const faktor = Math.round(v / alt[z.id]);
                  return (
                    <div key={g.id} className="grid grid-cols-[6.5rem_1fr] items-center gap-2 text-sm">
                      <span className="truncate font-semibold">{g.icon} {g.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-5 rounded-md" style={{ width: `${Math.max(3, (Math.log10(Math.max(v, 1)) / max) * 100)}%`, background: FARBEN[g.id] }} />
                        <span className="whitespace-nowrap font-bold">{z.einheit(v)}</span>
                        {g.id !== "pc386" && faktor > 1 && <span className="whitespace-nowrap text-xs text-muted">× {faktor.toLocaleString("de-DE")}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        Die Balken wachsen logarithmisch: Jede gleich große Strecke bedeutet »zehnmal so viel«. Sonst wäre der 386er neben dem heutigen PC unsichtbar.
        »× …« vergleicht mit dem 386er von 1990. Mehr Takt allein sagt wenig: Ein heutiger Kern schafft pro Takt auch viel mehr Arbeit.
      </p>
    </div>
  );
}
