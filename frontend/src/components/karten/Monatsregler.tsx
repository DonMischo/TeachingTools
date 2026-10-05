"use client";
/**
 * Monat für Wind und Meeresströmungen: Regler 1–12 und ▶ zum Abspielen des Jahres.
 * Gespeichert im Kartensatz als filter[ebene] = ["7"] (lib/karten/stil.ts::monatVon).
 */
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { MONATE, monatVon, type Ebene } from "@/lib/karten/stil";
import type { SatzInhalt } from "@/lib/karten/satz";

const TAKT_MS = 1500;

export default function Monatsregler({ ebenen, inhalt, setInhalt, partikel, setPartikel }: {
  ebenen: Ebene[];
  inhalt: SatzInhalt;
  setInhalt: Dispatch<SetStateAction<SatzInhalt>>;
  /** Partikelfluss an/aus (nur Ansicht, wird nicht gespeichert) */
  partikel?: boolean;
  setPartikel?: (an: boolean) => void;
}) {
  const ids = ebenen.filter((e) => e.monate && inhalt.ebenen.includes(e.id)).map((e) => e.id);
  const schluessel = ids.join(",");
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    if (!laeuft || !schluessel) return;
    const liste = schluessel.split(",");
    const uhr = setInterval(() => setInhalt((v) => {
      const naechster = String((Number(monatVon(v.filter, liste[0])) % 12) + 1);
      return { ...v, filter: { ...(v.filter ?? {}), ...Object.fromEntries(liste.map((id) => [id, [naechster]])) } };
    }), TAKT_MS);
    return () => clearInterval(uhr);
  }, [laeuft, schluessel, setInhalt]);

  if (!ids.length) return null;
  const monat = Number(monatVon(inhalt.filter, ids[0]));
  const setze = (m: number) => setInhalt((v) => ({ ...v, filter: { ...(v.filter ?? {}), ...Object.fromEntries(ids.map((id) => [id, [String(m)]])) } }));
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-black uppercase tracking-wide text-(--text-muted)">Jahresverlauf</h3>
      <div className="flex items-center gap-2">
        <button onClick={() => setLaeuft((x) => !x)} aria-label={laeuft ? "Anhalten" : "Jahr abspielen"}
          className="w-8 h-8 rounded-lg border border-(--border) font-bold hover:bg-(--surface-hover)">{laeuft ? "⏸" : "▶"}</button>
        <input type="range" min={1} max={12} value={monat} aria-label="Monat" className="flex-1"
          onChange={(e) => { setLaeuft(false); setze(Number(e.target.value)); }} />
        <span className="w-20 text-right font-bold text-xs">{MONATE[monat - 1]}</span>
      </div>
      {setPartikel && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={!!partikel} onChange={() => setPartikel(!partikel)} /> Partikelfluss
        </label>
      )}
      <p className="text-[10px] text-(--text-muted)">Windgürtel und ITC wandern mit dem Sonnenstand; Monsun und Somalistrom wechseln die Richtung.</p>
    </div>
  );
}
