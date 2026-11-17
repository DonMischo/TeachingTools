"use client";
/**
 * Auf- und Zuklappen der Einträge einer Pinnwand (Karten, Clippings, Workflows):
 * »normal« = wie gewohnt (feste Höhe, gekürzte Texte), »auf« = ganzer Inhalt,
 * »zu« = nur die Kopfzeile. Die Leiste stellt alle um, ▾/▸ je Eintrag schaltet
 * einzeln. Ids: »f12« für Karten, »r7« für Clippings und Workflows.
 */
import { createContext, useContext, useMemo, useState } from "react";

export type Klappmodus = "normal" | "auf" | "zu";

export const Aufklappen = createContext<{ modus: (id: string) => Klappmodus; umschalten: (id: string) => void }>(
  { modus: () => "normal", umschalten: () => {} });

export function useAufklappen() {
  const [alle, setAlle] = useState<Klappmodus>("normal");
  const [einzeln, setEinzeln] = useState<Record<string, Klappmodus>>({});
  const wert = useMemo(() => {
    const modus = (id: string) => einzeln[id] ?? alle;
    return { modus, umschalten: (id: string) => setEinzeln(e => ({ ...e, [id]: modus(id) === "zu" ? "auf" : "zu" })) };
  }, [alle, einzeln]);
  /** Alle auf bzw. zu; noch einmal derselbe Knopf → zurück zu »normal«. */
  const alleSetzen = (m: Exclude<Klappmodus, "normal">) => { setEinzeln({}); setAlle(a => (a === m ? "normal" : m)); };
  return { wert, alle, alleSetzen };
}

export function useKlappmodus(id: string): Klappmodus {
  return useContext(Aufklappen).modus(id);
}

export function KlappKnopf({ id }: { id: string }) {
  const { modus, umschalten } = useContext(Aufklappen);
  const zu = modus(id) === "zu";
  return (
    <button type="button" className="text-muted hover:text-fg w-4 shrink-0 leading-none" aria-expanded={!zu}
      title={zu ? "Aufklappen" : "Zuklappen"} aria-label={zu ? "Aufklappen" : "Zuklappen"} onClick={() => umschalten(id)}>
      {zu ? "▸" : "▾"}
    </button>
  );
}
