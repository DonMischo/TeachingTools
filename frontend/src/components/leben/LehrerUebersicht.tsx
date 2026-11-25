"use client";
/**
 * Klassenübersicht für die Lehrkraft: das gemeinsame Dashboard (Spalten aus
 * lib/leben/sitzung.ts), dazu Protokoll je Person und CSV-Download — beides
 * gibt es nur hier, das Protokoll bleibt in LebenStand.
 */
import { useEffect, useMemo, useState } from "react";
import { api, type LebenLogZeile } from "@/lib/api";
import SitzungDashboard, { useSitzungZeilen } from "@/components/sitzung/SitzungDashboard";
import { lebenAnsicht } from "@/lib/leben/sitzung";
import { euro, Fenster, Knopf } from "./ui";

export function LehrerUebersicht({ code, onZu }: { code: string; onZu: () => void }) {
  const ansicht = useMemo(() => lebenAnsicht(), []);
  const { data } = useSitzungZeilen(code, 10000);
  const zeilen = data?.zeilen ?? [];
  const [person, setPerson] = useState<string | null>(null);
  const [protokoll, setProtokoll] = useState<LebenLogZeile[] | null>(null);

  useEffect(() => {
    if (!person) { setProtokoll(null); return; }
    api.leben.protokoll(code, person).then((r) => setProtokoll(r[0]?.protokoll ?? [])).catch(() => setProtokoll([]));
  }, [code, person]);

  return (
    <Fenster titel={`Klassenübersicht — Code ${code}`} icon="👩‍🏫" onZu={onZu} breit
      fuss={<div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-400">Aktualisiert sich alle 10 Sekunden. Schüler:innen melden sich über »Zum Mitmachen« (QR/Code).</span>
        <a href={api.leben.csvPfad(code)} className="ml-auto rounded-xl bg-amber-500 px-3 py-2 font-bold text-black" download>⬇️ Protokoll als CSV</a>
      </div>}>
      <SitzungDashboard code={code} ansicht={ansicht} takt={10000} />
      {zeilen.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {zeilen.map((z, i) => (
            <Knopf key={`${z.name}-${i}`} klein art="leise" onClick={() => setPerson(person === z.name ? null : z.name)}>
              Protokoll {z.name} ({String(z.daten.protokoll_zeilen ?? 0)})
            </Knopf>
          ))}
        </div>
      )}
      {person && (
        <div className="mt-3 rounded-xl bg-white/5 p-2">
          <div className="mb-1 font-bold">Protokoll: {person}</div>
          {!protokoll && <p className="text-slate-400">Lädt …</p>}
          <div className="max-h-80 overflow-y-auto text-xs">
            {protokoll && [...protokoll].reverse().map((l, i) => (
              <div key={i} className="flex gap-2 border-b border-white/5 py-0.5">
                <span className="w-20 shrink-0 text-slate-400">{l.datum}</span><span className="w-16 shrink-0 text-slate-500">{l.art}</span>
                <span className="flex-1">{l.text}</span>{l.betrag != null && <span className="tabular-nums">{euro(l.betrag, true)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </Fenster>
  );
}
