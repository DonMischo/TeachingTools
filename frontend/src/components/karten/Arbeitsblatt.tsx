"use client";
/**
 * Die Tabelle zur Karte: je nummerierter Ebene die Marken mit Platz zum
 * Ausfüllen — oder, mit »Lösung zeigen«, die Namen. Lehrkräfte exportieren
 * sie als Arbeitsblatt (Seite 1 Karte + Aufgabe, dann Tabelle; PDF/DOCX/ODT/LaTeX).
 */
import { useState } from "react";
import type { FeatureCollection } from "geojson";
import { api } from "@/lib/api";
import type { Katalog } from "@/lib/karten/stil";
import type { SatzInhalt } from "@/lib/karten/satz";

const FORMATE = [
  { id: "pdf", name: "PDF" },
  { id: "docx", name: "Word (.docx)" },
  { id: "odt", name: "LibreOffice (.odt)" },
  { id: "tex", name: "LaTeX (.zip)" },
] as const;

const AUFGABE = "Finde und benenne die nummerierten Objekte auf der Karte. Trage die Namen in die Tabelle ein.";

export default function Arbeitsblatt({ katalog, inhalt, nummern, daten, titel, holeBild }: {
  katalog: Katalog;
  inhalt: SatzInhalt;
  nummern: Record<string, Record<string, string>>;
  daten: Record<string, FeatureCollection | undefined>;
  titel: string;
  /** Nur für Lehrkräfte: Kartenbild ohne Namen holen (startet den Export) */
  holeBild?: () => Promise<string>;
}) {
  const [loesung, setLoesung] = useState(false);
  const [aufgabe, setAufgabe] = useState(AUFGABE);
  const [variante, setVariante] = useState<"aufgabe" | "loesung" | "beide">("beide");
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState("");
  const gruppen = katalog.ebenen.filter((e) => nummern[e.id] && inhalt.ebenen.includes(e.id));
  if (!gruppen.length) return null;

  const namenVon = (ebene: string) =>
    new Map((daten[ebene]?.features ?? []).map((f) => [String(f.properties?.id), String(f.properties?.name ?? "")]));

  const exportiere = async (format: (typeof FORMATE)[number]["id"]) => {
    if (!holeBild) return;
    setLaeuft(format);
    setFehler("");
    try {
      const karte = await holeBild();
      const { datei, name } = await api.karten.export({
        format, variante, titel, aufgabe, karte,
        gruppen: gruppen.map((e) => {
          const namen = namenVon(e.id);
          return { name: e.name, eintraege: inhalt.auswahl[e.id].objekte.map((id) => ({ marke: nummern[e.id][id], name: namen.get(id) ?? "" })) };
        }),
      });
      const url = URL.createObjectURL(datei);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setFehler(`Export ging nicht: ${(e as Error).message}`);
    } finally {
      setLaeuft(null);
    }
  };

  return (
    <section className="rounded-2xl border border-(--border) bg-(--surface) p-4 flex flex-col gap-3" aria-label="Arbeitsblatt">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-black text-base">📝 {titel} — Tabelle</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={loesung} onChange={() => setLoesung((l) => !l)} /> Lösung zeigen
        </label>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-4">
        {gruppen.map((e) => {
          const namen = namenVon(e.id);
          return (
            <table key={e.id} className="text-sm w-full border-collapse">
              <thead>
                <tr><th colSpan={2} className="text-left font-black pb-1 border-b border-(--border)">{e.name}</th></tr>
              </thead>
              <tbody>
                {inhalt.auswahl[e.id].objekte.map((id) => (
                  <tr key={id} className="border-b border-(--border)">
                    <td className="w-10 py-1.5 font-black text-(--red)">{nummern[e.id][id]}</td>
                    <td className="py-1.5">{loesung ? namen.get(id) ?? "…" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })}
      </div>

      {holeBild && (
        <div className="flex flex-col gap-2 pt-3 border-t border-(--border) text-sm">
          <h3 className="font-black">⬇️ Als Arbeitsblatt exportieren</h3>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-(--text-muted)">Aufgabe (steht auf Seite 1 über der Karte)</span>
            <textarea value={aufgabe} onChange={(e) => setAufgabe(e.target.value)} rows={2} maxLength={1000}
              className="px-2 py-1.5 rounded-lg border border-(--border) bg-(--bg)" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select value={variante} onChange={(e) => setVariante(e.target.value as typeof variante)} aria-label="Variante"
              className="px-2 py-1.5 rounded-lg border border-(--border) bg-(--bg)">
              <option value="beide">Arbeitsblatt + Lösung</option>
              <option value="aufgabe">nur Arbeitsblatt</option>
              <option value="loesung">nur Lösung</option>
            </select>
            {FORMATE.map((f) => (
              <button key={f.id} onClick={() => exportiere(f.id)} disabled={laeuft !== null}
                className="px-3 py-1.5 rounded-lg font-bold border border-(--border) hover:bg-(--surface-hover) disabled:opacity-40">
                {laeuft === f.id ? "⏳" : ""} {f.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-(--text-muted)">Die Karte kommt so aufs Blatt, wie sie gerade zu sehen ist — nur mit Nummern, ohne Namen.</p>
          {fehler && <p className="text-(--red)">{fehler}</p>}
        </div>
      )}
    </section>
  );
}
