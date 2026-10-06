"use client";
import { ERFOLGE, type Erfolg, type ErfolgsStand } from "@/lib/schichten/wertung";

const zahl = (n: number) => n.toLocaleString("de-DE");

export default function ErfolgeTafel({ stand, neu = [] }: { stand: ErfolgsStand; neu?: Erfolg[] }) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold">🏅 Erfolge · {stand.freigeschaltet.length} von {ERFOLGE.length}</h3>
        <span className="text-sm text-muted tabular-nums">
          {zahl(stand.missionen)} Mission{stand.missionen === 1 ? "" : "en"} · {zahl(stand.punkte)} Punkte gesamt · Bestwert {zahl(stand.bestePunkte)}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
        {ERFOLGE.map(e => {
          const hat = stand.freigeschaltet.includes(e.id);
          const frisch = neu.some(n => n.id === e.id);
          return (
            <div key={e.id} title={e.text}
              className={`rounded-xl border p-2 flex items-center gap-2 transition ${hat ? "border-line bg-surface" : "border-dashed border-line opacity-45"} ${frisch ? "ring-2 ring-accent animate-pulse" : ""}`}>
              <span className={`text-2xl ${hat ? "" : "grayscale"}`}>{hat ? e.icon : "🔒"}</span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-semibold">{e.name}</span>
                <span className="text-[11px] text-muted">{e.text}</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted">Erfolge merkt sich dieser Browser — auf einem anderen Gerät fängst du neu an.</p>
    </div>
  );
}
