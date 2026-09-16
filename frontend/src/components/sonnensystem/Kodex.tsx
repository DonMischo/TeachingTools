"use client";
/**
 * Der Kodex: was im Flug gescannt wurde, geordnet wie das Sonnensystem —
 * jeder Planet mit seinen Monden darunter. Dazu die Erfolge und die
 * Flugstatistik. Noch nicht Gescanntes steht nur mit Namen da, damit man
 * weiß, wonach man suchen kann.
 *
 * Das PDF enthält immer alle Himmelskörper — es ist Lernmaterial, keine Beute.
 */
import { useState } from "react";
import { KM_JE_AE, KOERPER, type Koerper } from "@/lib/sonnensystem/daten";
import { foto } from "@/lib/sonnensystem/bilder";
import { AUFTRAEGE } from "@/lib/sonnensystem/auftraege";
import { KODEX_GRUPPEN, artZeile, datenZeilen } from "@/lib/sonnensystem/kodex";
import { ERFOLGE, erreicht, type Gruppe } from "@/lib/sonnensystem/erfolge";
import { dauer, km, zahl } from "@/lib/sonnensystem/format";
import { Knopfgruppe } from "./Bedienung";
import type { Fortschritt } from "./fortschritt";

export type KodexBereich = "eintraege" | "erfolge" | "statistik";

export function Kodex({ fortschritt, alleZeigen = false, onAlleZeigen, bereich: startBereich = "eintraege", onSteckbrief, onSchliessen }: {
  fortschritt: Fortschritt;
  alleZeigen?: boolean;
  /** Nur für Lehrkräfte: alles aufdecken, ohne zu fliegen */
  onAlleZeigen?: (an: boolean) => void;
  bereich?: KodexBereich;
  onSteckbrief: (id: string) => void;
  onSchliessen?: () => void;
}) {
  const [bereich, setBereich] = useState<KodexBereich>(startBereich);
  const [pdf, setPdf] = useState<number | null>(null);
  const bekannt = (k: Koerper) => alleZeigen || fortschritt.erforscht.includes(k.id);
  const erfolgZahl = ERFOLGE.filter(e => erreicht(e, fortschritt)).length;

  async function ladePdf() {
    setPdf(0);
    try {
      const { kodexAlsPdf } = await import("./kodexPdf");
      await kodexAlsPdf(setPdf);
    } finally {
      setPdf(null);
    }
  }

  return (
    <div className="h-full flex flex-col text-slate-100">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3 border-b border-white/10">
        <h2 className="text-lg font-black mr-2">📓 Kodex</h2>
        <Knopfgruppe
          werte={[
            { wert: "eintraege" as KodexBereich, name: `Einträge ${fortschritt.erforscht.length}/${KOERPER.length}` },
            { wert: "erfolge" as KodexBereich, name: `Erfolge ${erfolgZahl}/${ERFOLGE.length}` },
            { wert: "statistik" as KodexBereich, name: "Statistik" },
          ]}
          aktiv={bereich}
          onWahl={setBereich}
        />
        <div className="flex-1" />
        {onAlleZeigen && (
          <label className="flex items-center gap-1.5 text-xs text-amber-200">
            <input type="checkbox" checked={alleZeigen} onChange={e => onAlleZeigen(e.target.checked)} className="accent-amber-300" />
            Alle zeigen (Lehrkraft)
          </label>
        )}
        <button
          onClick={ladePdf}
          disabled={pdf !== null}
          title="Alle Himmelskörper mit Foto, Zahlen und Besonderheiten — auch die noch nicht gescannten"
          className="rounded-lg bg-sky-400/20 border border-sky-300/40 px-3 py-1.5 text-xs font-bold hover:bg-sky-400/30 disabled:opacity-60"
        >
          {pdf === null ? "📄 Kodex als PDF" : `PDF entsteht … ${Math.round(pdf * 100)} %`}
        </button>
        {onSchliessen && (
          <button onClick={onSchliessen} className="w-9 h-9 rounded-lg hover:bg-white/10 text-lg" aria-label="Kodex schließen">✕</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {bereich === "eintraege" && (
          <div className="flex flex-col gap-6">
            {!alleZeigen && fortschritt.erforscht.length === 0 && (
              <p className="text-sm text-slate-400">
                Noch leer: Jeder Himmelskörper, den du im Flugmodus scannst, bekommt hier seinen Eintrag.
              </p>
            )}
            {KODEX_GRUPPEN.map(g => (
              <section key={g.haupt.id}>
                <Eintrag koerper={g.haupt} bekannt={bekannt(g.haupt)} gross onSteckbrief={onSteckbrief} />
                {g.monde.length > 0 && (
                  <div className="mt-2 ml-4 sm:ml-10 pl-3 border-l border-white/10 grid gap-2 sm:grid-cols-2">
                    {g.monde.map(m => <Eintrag key={m.id} koerper={m} bekannt={bekannt(m)} onSteckbrief={onSteckbrief} />)}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        {bereich === "erfolge" && <Erfolge fortschritt={fortschritt} />}
        {bereich === "statistik" && <Statistik fortschritt={fortschritt} />}
      </div>
    </div>
  );
}

function Eintrag({ koerper: k, bekannt, gross = false, onSteckbrief }: {
  koerper: Koerper; bekannt: boolean; gross?: boolean; onSteckbrief: (id: string) => void;
}) {
  const bild = foto(k.id);
  const kante = gross ? "w-20 h-20 sm:w-24 sm:h-24" : "w-14 h-14";
  if (!bekannt) {
    return (
      <div className={`flex items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3 ${gross ? "" : "text-sm"}`}>
        <div className={`${kante} shrink-0 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 text-xl`}>?</div>
        <div>
          <div className="font-bold text-slate-300">{k.name}</div>
          <div className="text-xs text-slate-500">{artZeile(k)} · noch nicht gescannt</div>
        </div>
      </div>
    );
  }
  return (
    <article className={`rounded-xl border border-white/10 bg-white/5 p-3 ${gross ? "" : "text-sm"}`}>
      <div className="flex gap-3 items-start">
        {bild && <img src={bild.datei} alt="" className={`${kante} shrink-0 rounded-full object-cover bg-black`} />}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">{artZeile(k)}</div>
          <h3 className={`${gross ? "text-xl" : "text-base"} font-black leading-tight`}>{k.name}</h3>
          <p className="text-xs text-slate-300 mt-1 leading-snug">{k.intro}</p>
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {datenZeilen(k, !gross).map(([name, wert]) => (
          <div key={name} className="contents">
            <dt className="text-slate-400">{name}</dt>
            <dd className="text-slate-100">{wert}</dd>
          </div>
        ))}
      </dl>
      {gross && (
        <ul className="mt-2 flex flex-col gap-1">
          {k.fakten.slice(0, 2).map(f => <li key={f} className="text-xs text-slate-300 pl-2 border-l-2 border-sky-400/40">{f}</li>)}
        </ul>
      )}
      <button onClick={() => onSteckbrief(k.id)} className="mt-2 text-xs text-sky-300 hover:text-sky-200">📖 Ganzer Steckbrief</button>
    </article>
  );
}

const GRUPPEN: Gruppe[] = ["Erforschen", "Aufträge", "Reisen", "Pilot", "Missgeschicke"];

function Erfolge({ fortschritt }: { fortschritt: Fortschritt }) {
  return (
    <div className="flex flex-col gap-5">
      {GRUPPEN.map(gruppe => (
        <section key={gruppe}>
          <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-300 mb-2">{gruppe}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {ERFOLGE.filter(e => e.gruppe === gruppe).map(e => {
              const wert = e.wert(fortschritt);
              const ok = wert >= e.ziel;
              const wann = fortschritt.erfolge[e.id];
              return (
                <div key={e.id} className={`flex gap-3 rounded-xl border p-3 ${ok ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-white/5"}`}>
                  <div className={`text-2xl shrink-0 ${ok ? "" : "grayscale opacity-40"}`}>{e.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm">{e.name}</div>
                    <div className="text-xs text-slate-300">{e.text}</div>
                    {ok ? (
                      <div className="text-[11px] text-amber-200 mt-1">✓ erreicht{wann ? ` am ${new Date(wann).toLocaleDateString("de-DE")}` : ""}</div>
                    ) : (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-amber-300/70" style={{ width: `${Math.min(100, (wert / e.ziel) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
                          {e.einheit ? `${e.einheit(wert)} / ${e.einheit(e.ziel)}` : `${zahl(Math.floor(wert))} / ${zahl(e.ziel)}`}
                        </span>
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

function Statistik({ fortschritt: f }: { fortschritt: Fortschritt }) {
  const s = f.statistik;
  const zeilen: [string, string][] = [
    ["Erforscht", `${f.erforscht.length} von ${KOERPER.length} Himmelskörpern`],
    ["Forschungsaufträge", `${f.erledigt.length} von ${AUFTRAEGE.length}`],
    ["Flugzeit", dauer(s.flugzeit)],
    ["Strecke", `${km(s.strecke)} (${zahl(s.strecke / KM_JE_AE, 1)} AE)`],
    ["Höchsttempo", `${zahl(Math.round(s.hoechstC))}-fache Lichtgeschwindigkeit`],
    ["Mit Vollgas geflogen", dauer(s.vollgas)],
    ["Overdrive gezündet", `${s.overdrives}-mal`],
    ["In Umlaufbahnen", dauer(s.orbitzeit)],
    ["Ganz umrundet", s.umrundet.length ? `${s.umrundungen}-mal, ${s.umrundet.length} verschiedene Körper` : "noch nichts"],
    ["Abgestürzt", `${s.abstuerze}-mal`],
    ["In der Sonne verglüht", `${s.verglueht}-mal`],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm max-w-xl">
      {zeilen.map(([name, wert]) => (
        <div key={name} className="contents">
          <dt className="text-slate-400">{name}</dt>
          <dd className="font-bold tabular-nums">{wert}</dd>
        </div>
      ))}
    </dl>
  );
}
