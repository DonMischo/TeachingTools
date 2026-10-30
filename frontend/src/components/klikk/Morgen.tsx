"use client";
/** Der Morgen vor der Schule: Wecker, Bad, Frühstück — und der Bus um 7:35. */
import { TAGE } from "@/lib/klikk/geschichte";
import { BUS, MORGEN_SACHEN, losgehen, morgenSache, zeit } from "@/lib/klikk/motor";
import type { Stand } from "@/lib/klikk/typen";

type Setze = (f: (s: Stand) => Stand) => void;

export function HygieneMeter({ wert }: { wert: number }) {
  const farbe = wert >= 60 ? "bg-ok" : wert >= 35 ? "bg-amber-500" : "bg-bad";
  return (
    <div>
      <div className="flex justify-between text-xs"><span>🧼 Hygiene</span><span>{wert < 25 ? "💨 man riecht's" : wert < 45 ? "naja" : "frisch"}</span></div>
      <div className="h-2 rounded-full bg-surface-hover overflow-hidden"><div className={`h-full ${farbe}`} style={{ width: `${wert}%` }} /></div>
    </div>
  );
}

export default function Morgen({ s, setze }: { s: Stand; setze: Setze }) {
  const spaet = s.uhr > BUS;
  return (
    <div className="flex flex-col gap-3">
      <div className="card p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-black text-lg">⏰ {TAGE[s.tag]}morgen</h2>
          <span className={`text-3xl font-black tabular-nums ${spaet ? "text-bad" : ""}`}>{zeit(s.uhr)}</span>
        </div>
        <p className="text-sm text-muted mt-1">
          {s.uhr <= s.weckzeit + 1 ? "Der Wecker klingelt. Das Handy liegt neben dem Kopfkissen und leuchtet schon." : spaet ? "Der Bus ist weg." : `Der Bus fährt um ${zeit(BUS)}.`}
        </p>
        <div className="mt-3"><HygieneMeter wert={s.hygiene} /></div>
      </div>
      <div className="card p-4 grid grid-cols-2 gap-2">
        {MORGEN_SACHEN.map(m => (
          <button key={m.id} className="btn-secondary text-sm" disabled={s.morgenErledigt.includes(m.id)} onClick={() => setze(st => morgenSache(st, m.id))}>
            {m.emoji} {m.name}<span className="block text-[10px] text-muted">{s.morgenErledigt.includes(m.id) ? "✓ erledigt" : `${m.minuten} Min.`}</span>
          </button>
        ))}
      </div>
      <button className={spaet ? "btn-secondary" : "btn-primary"} onClick={() => setze(losgehen)}>
        🎒 Los zur Schule {spaet ? "(zu spät!)" : ""}
      </button>
      <p className="text-[11px] text-muted">Was du am Handy machst, kostet auch morgens Zeit.</p>
    </div>
  );
}
