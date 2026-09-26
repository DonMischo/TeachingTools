"use client";
/** Klassenübersicht für die Lehrkraft: Stand aller Teilnehmenden, Protokoll je Person, CSV-Download. */
import { useEffect, useState } from "react";
import { api, type LebenLogZeile, type LebenUebersichtZeile } from "@/lib/api";
import { euro, Fenster, Knopf } from "./ui";

export function LehrerUebersicht({ code, onZu }: { code: string; onZu: () => void }) {
  const [zeilen, setZeilen] = useState<LebenUebersichtZeile[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [protokoll, setProtokoll] = useState<LebenLogZeile[] | null>(null);

  useEffect(() => {
    let aktiv = true;
    const holen = () => api.leben.uebersicht(code).then((z) => { if (aktiv) { setZeilen(z); setFehler(null); } }).catch((e) => aktiv && setFehler(String(e.message ?? e)));
    holen();
    const t = setInterval(holen, 10000);
    return () => { aktiv = false; clearInterval(t); };
  }, [code]);

  useEffect(() => {
    if (!person) { setProtokoll(null); return; }
    api.leben.protokoll(code, person).then((r) => setProtokoll(r[0]?.protokoll ?? [])).catch(() => setProtokoll([]));
  }, [code, person]);

  const n = (z: LebenUebersichtZeile, k: string) => Number(z.zusammenfassung[k] ?? 0);
  return (
    <Fenster titel={`Klassenübersicht — Code ${code}`} icon="👩‍🏫" onZu={onZu} breit
      fuss={<div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-400">Aktualisiert sich alle 10 Sekunden. Schüler:innen melden sich über »Zum Mitmachen« (QR/Code).</span>
        <a href={api.leben.csvPfad(code)} className="ml-auto rounded-xl bg-amber-500 px-3 py-2 font-bold text-black" download>⬇️ Protokoll als CSV</a>
      </div>}>
      {fehler && <p className="text-rose-300">{fehler}</p>}
      {!zeilen && !fehler && <p className="text-slate-400">Lädt …</p>}
      {zeilen && zeilen.length === 0 && <p className="text-slate-400">Noch niemand dabei.</p>}
      {zeilen && zeilen.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr><th className="p-1">Name</th><th className="p-1">Spieldatum</th><th className="p-1">Job</th><th className="p-1">Wohnen</th>
                <th className="p-1 text-right">Konto</th><th className="p-1 text-right">Sparen</th><th className="p-1 text-right">Schulden</th>
                <th className="p-1 text-right">Steuern + SV</th><th className="p-1">Befinden</th><th className="p-1" /></tr>
            </thead>
            <tbody>
              {zeilen.map((z) => {
                const bed = (z.zusammenfassung.beduerfnisse ?? {}) as Record<string, number>;
                const tief = Object.entries(bed).sort((a, b) => a[1] - b[1])[0];
                return (
                  <tr key={z.name} className="border-t border-white/5">
                    <td className="p-1"><b>{z.name}</b>{z.gast ? " (Gast)" : ""}{z.klasse ? ` · ${z.klasse}` : ""}<br /><span className="text-slate-400">Figur: {z.figur}</span></td>
                    <td className="p-1">{String(z.zusammenfassung.datum ?? "–")}<br /><span className="text-slate-400">Monat {n(z, "monat")}/60{z.zusammenfassung.beendet ? " ✅" : ""}</span></td>
                    <td className="p-1">{String(z.zusammenfassung.job ?? "")}</td>
                    <td className="p-1">{String(z.zusammenfassung.wohnung ?? "")}</td>
                    <td className={`p-1 text-right tabular-nums ${n(z, "konto") < 0 ? "text-rose-300" : ""}`}>{euro(n(z, "konto"))}</td>
                    <td className="p-1 text-right tabular-nums">{euro(n(z, "sparkonto"))}</td>
                    <td className={`p-1 text-right tabular-nums ${n(z, "schulden") > 0 ? "text-amber-300" : ""}`}>{euro(n(z, "schulden"))}{z.zusammenfassung.schufa ? " ⚠️" : ""}</td>
                    <td className="p-1 text-right tabular-nums">{euro(n(z, "steuern_gesamt") + n(z, "sv_gesamt"))}</td>
                    <td className="p-1">{tief ? `${tief[0]} ${tief[1]}` : ""}</td>
                    <td className="p-1"><Knopf klein art="leise" onClick={() => setPerson(person === z.name ? null : z.name)}>Protokoll ({z.protokoll_zeilen})</Knopf></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
