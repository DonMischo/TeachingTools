"use client";
/**
 * Kartenfrage in Caputh/TaskCrawler: ein gespeicherter Kartensatz plus Modus.
 * Gespeichert wird ein Verweis {satz, modus, wortbank, mindestens}; der Server baut
 * daraus beim Speichern den Schnappschuss (api/routers/karten_quiz.py::loese_einbettungen).
 * Exportierte Spiele tragen schon den Schnappschuss — dann steht hier »Stand beim Hochladen«.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Feld } from "./felder";

export type KarteVerweis = {
  satz?: number;
  satz_id?: number;
  titel?: string;
  modus?: "benennen" | "finden";
  wortbank?: boolean;
  mindestens?: number;
  aufgaben?: unknown[];
  [weitere: string]: unknown;
};

export const LEERE_KARTE: KarteVerweis = { modus: "benennen", wortbank: false };

export function KarteFrageForm({ karte, onChange, mitMindestens = false }: {
  karte: KarteVerweis;
  onChange: (k: KarteVerweis) => void;
  /** TaskCrawler: Anteil richtig, ab dem die Aufgabe als gelöst gilt */
  mitMindestens?: boolean;
}) {
  const { data: saetze = [] } = useQuery({ queryKey: ["karten", "saetze"], queryFn: api.karten.saetze });
  const satzId = karte.satz ?? karte.satz_id;
  const schnappschuss = Array.isArray(karte.aufgaben);
  const waehle = (id: number) => onChange({ satz: id, modus: karte.modus ?? "benennen", wortbank: !!karte.wortbank,
    ...(mitMindestens ? { mindestens: karte.mindestens ?? 1 } : {}) });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-3">
      <Feld label="Kartensatz" hint={schnappschuss ? `Stand beim Hochladen: »${karte.titel ?? satzId}«, ${karte.aufgaben!.length} Objekte — neu wählen übernimmt den aktuellen Stand.`
        : "Eigene und fürs Kollegium geteilte Kartensätze (Karten → Kartensatz speichern)."}>
        <select className="input" value={satzId ?? ""} onChange={(e) => e.target.value && waehle(Number(e.target.value))}>
          <option value="">— Kartensatz wählen —</option>
          {saetze.map((s) => <option key={s.id} value={s.id}>{s.titel}{s.eigen ? "" : ` (${s.autor})`}</option>)}
        </select>
      </Feld>
      <div className="flex flex-wrap gap-4">
        {([["benennen", "Nummern benennen"], ["finden", "Orte finden (anklicken)"]] as const).map(([wert, text]) => (
          <label key={wert} className="flex items-center gap-1.5">
            <input type="radio" checked={(karte.modus ?? "benennen") === wert} onChange={() => onChange({ ...karte, modus: wert })} /> {text}
          </label>
        ))}
        {(karte.modus ?? "benennen") === "benennen" && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={!!karte.wortbank} onChange={() => onChange({ ...karte, wortbank: !karte.wortbank })} /> Wortbank
          </label>
        )}
        {mitMindestens && (
          <label className="flex items-center gap-1.5">
            gelöst ab
            <select className="input w-24" value={karte.mindestens ?? 1} onChange={(e) => onChange({ ...karte, mindestens: Number(e.target.value) })}>
              {[[0.5, "50 %"], [0.75, "75 %"], [1, "100 %"]].map(([w, t]) => <option key={w} value={w}>{t}</option>)}
            </select>
            richtig
          </label>
        )}
      </div>
    </div>
  );
}
