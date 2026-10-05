"use client";
/** Einstellungen der Lehrkraft für ihre Sitzung: Krisenstufe, Runden, heikle Ereignisse, Drehbuch. */
import { useState } from "react";
import { EREIGNISSE, GRUPPEN } from "@/lib/leviathan/ereignisse";
import type { Einstellungen, Krisenstufe } from "@/lib/leviathan/typen";
import { KRISE_TEXT } from "./Start";
import { Karte } from "./ui";

export default function LehrkraftPanel({ einst, onSpeichern }: {
  einst: Einstellungen;
  onSpeichern: (e: Einstellungen) => Promise<void>;
}) {
  const [e, setE] = useState<Einstellungen>(einst);
  const [offen, setOffen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const heikel = EREIGNISSE.filter((x) => x.heikel);
  const waehlbar = EREIGNISSE.filter((x) => !x.nurDrehbuch || x.id === "autokrat");

  async function speichern() {
    setStatus("Speichere …");
    try {
      await onSpeichern(e);
      setStatus("Gespeichert. Gilt für alle, die ab jetzt mit dem Code ein Spiel beginnen.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  return (
    <Karte titel="🧑‍🏫 Einstellungen für die Klasse" rechts={
      <button onClick={() => setOffen((o) => !o)} className="text-sm underline text-muted">
        {offen ? "zuklappen" : `${KRISE_TEXT[e.krise].icon} ${KRISE_TEXT[e.krise].name} · ${e.runden} Runden – ändern`}
      </button>}>
      {offen && (
        <div className="flex flex-col gap-4 text-sm">
          <fieldset>
            <legend className="font-bold mb-1">Krisenstufe</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(KRISE_TEXT) as Krisenstufe[]).map((k) => (
                <button key={k} onClick={() => setE({ ...e, krise: k })} aria-pressed={e.krise === k}
                  className={`px-3 py-1.5 rounded-lg font-bold border ${
                    e.krise === k ? "bg-accent text-accent-fg border-transparent" : "border-line"}`}>
                  {KRISE_TEXT[k].icon} {KRISE_TEXT[k].name}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-1">{KRISE_TEXT[e.krise].text}</p>
          </fieldset>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2">
              Runden (je 2 Jahre)
              <select value={e.runden} onChange={(x) => setE({ ...e, runden: Number(x.target.value) })}
                className="rounded-lg border border-line bg-page px-2 py-1">
                {[8, 10, 12, 15].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={e.sichtbar} onChange={(x) => setE({ ...e, sichtbar: x.target.checked })} />
              Schüler:innen sehen die Krisenstufe
            </label>
          </div>

          <fieldset>
            <legend className="font-bold mb-1">Heikle Ereignisse abschalten</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {heikel.map((x) => (
                <label key={x.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={e.aus.includes(x.id)}
                    onChange={(ev) => setE({ ...e, aus: ev.target.checked ? [...e.aus, x.id] : e.aus.filter((a) => a !== x.id) })} />
                  {x.icon} {x.titel}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-bold mb-1">Drehbuch: feste Ereignisse für alle</legend>
            <div className="flex flex-col gap-2">
              {e.drehbuch.map((d, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  Runde
                  <select value={d.runde} onChange={(x) => setE({ ...e, drehbuch: e.drehbuch.map((y, j) => j === i ? { ...y, runde: Number(x.target.value) } : y) })}
                    className="rounded-lg border border-line bg-page px-2 py-1">
                    {Array.from({ length: e.runden }, (_, r) => r + 1).map((r) => <option key={r} value={r}>{r} ({2026 + 2 * r})</option>)}
                  </select>
                  <select value={d.ereignis} onChange={(x) => setE({ ...e, drehbuch: e.drehbuch.map((y, j) => j === i ? { ...y, ereignis: x.target.value } : y) })}
                    className="rounded-lg border border-line bg-page px-2 py-1 max-w-[16rem]">
                    {(Object.keys(GRUPPEN) as (keyof typeof GRUPPEN)[]).map((g) => (
                      <optgroup key={g} label={GRUPPEN[g]}>
                        {waehlbar.filter((x) => x.gruppe === g).map((x) => <option key={x.id} value={x.id}>{x.icon} {x.titel}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <button onClick={() => setE({ ...e, drehbuch: e.drehbuch.filter((_, j) => j !== i) })}
                    aria-label="Eintrag löschen" className="px-2">🗑</button>
                </div>
              ))}
              {e.drehbuch.length < 12 && (
                <button onClick={() => setE({ ...e, drehbuch: [...e.drehbuch, { runde: 4, ereignis: "pandemie" }] })}
                  className="self-start text-sm underline">+ Ereignis hinzufügen</button>
              )}
            </div>
            <p className="text-xs text-muted mt-1">Alle Gruppen erleben diese Ereignisse in derselben Runde – gut zum Vergleichen.</p>
          </fieldset>

          <div className="flex items-center gap-3">
            <button onClick={speichern} className="btn-primary px-4 py-2">Speichern</button>
            {status && <span className="text-muted">{status}</span>}
          </div>
        </div>
      )}
    </Karte>
  );
}
