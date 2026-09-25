"use client";
/**
 * Die Figur einkleiden: Oberteil (Art, Farbe), Mütze (Art, Farbe), Rucksack
 * und Handy. Änderungen gelten sofort — auch für die anderen im Raum.
 */
import { ausHex, HANDYS, hexFarbe, MUETZEN, SHIRTS, type Aussehen } from "@/lib/verkehr/aussehen";

const knopf = (an: boolean) =>
  `flex flex-col items-center rounded-lg px-2 py-1 text-[11px] font-bold ${an ? "bg-sky-500 text-black" : "bg-slate-700 hover:bg-slate-600"}`;

function Farbe({ wert, onWert, label }: { wert: number; onWert: (n: number) => void; label: string }) {
  return (
    <label className="flex items-center gap-2">
      <input type="color" value={hexFarbe(wert)} aria-label={label} onChange={(e) => onWert(ausHex(e.target.value))}
        className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
      <span className="opacity-70">{label}</span>
    </label>
  );
}

export function AussehenTafel({ a, onA, onZu }: { a: Aussehen; onA: (a: Aussehen) => void; onZu: () => void }) {
  const setze = (neu: Partial<Aussehen>) => onA({ ...a, ...neu });
  return (
    <div className="absolute left-2 top-14 z-30 w-80 rounded-xl bg-slate-900/92 px-4 py-3 text-xs text-white shadow-xl ring-1 ring-white/15 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-black">👕 Aussehen</span>
        <button type="button" className="underline opacity-80" onClick={onZu}>schließen</button>
      </div>

      <div className="font-bold">Oberteil</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {SHIRTS.map((s) => (
          <button key={s.id} type="button" className={knopf(a.shirt === s.id)} onClick={() => setze({ shirt: s.id })}>
            <span className="text-lg">{s.icon}</span>{s.name}
          </button>
        ))}
      </div>
      <div className="mt-1.5"><Farbe wert={a.shirtFarbe} onWert={(n) => setze({ shirtFarbe: n })} label="Farbe des Oberteils" /></div>

      <div className="mt-3 font-bold">Mütze</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {MUETZEN.map((m) => (
          <button key={m.id} type="button" className={knopf(a.muetze === m.id)} onClick={() => setze({ muetze: m.id })}>
            <span className="text-lg">{m.icon}</span>{m.name}
          </button>
        ))}
      </div>
      {a.muetze !== "keine" && <div className="mt-1.5"><Farbe wert={a.muetzeFarbe} onWert={(n) => setze({ muetzeFarbe: n })} label="Farbe der Mütze" /></div>}

      <div className="mt-3 font-bold">Rucksack</div>
      <div className="mt-1"><Farbe wert={a.rucksackFarbe} onWert={(n) => setze({ rucksackFarbe: n })} label="Farbe des Rucksacks" /></div>

      <div className="mt-3 font-bold">Handy</div>
      <div className="mt-1 flex gap-1.5">
        {HANDYS.map((h) => (
          <button key={h.id} type="button" className={`${knopf(a.handy === h.id)} flex-1`} onClick={() => setze({ handy: h.id })}>
            <span className="text-lg">{h.icon}</span>{h.name}
            <span className={a.handy === h.id ? "" : h.karma > 0 ? "text-emerald-300" : "text-rose-300"}>{h.karma > 0 ? "+" : "−"}{Math.abs(h.karma)} Karma</span>
          </button>
        ))}
      </div>
    </div>
  );
}
