"use client";
/**
 * Auf- und Zuklappen der Einträge einer Pinnwand (Karten, Clippings, Workflows):
 * »normal« = wie gewohnt (feste Höhe, gekürzte Texte), »auf« = ganzer Inhalt,
 * »zu« = nur die Kopfzeile. Die Leiste stellt alle um, ▾/▸ je Eintrag schaltet
 * einzeln. Ids: »f12« für Karten, »r7« für Clippings und Workflows.
 */
import { createContext, useContext, useMemo, useState } from "react";

export type Klappmodus = "normal" | "auf" | "zu";

export const Aufklappen = createContext<{
  modus: (id: string) => Klappmodus;
  umschalten: (id: string) => void;
  setzen: (id: string, m: Klappmodus) => void;
}>({ modus: () => "normal", umschalten: () => {}, setzen: () => {} });

export function useAufklappen() {
  const [alle, setAlle] = useState<Klappmodus>("normal");
  const [einzeln, setEinzeln] = useState<Record<string, Klappmodus>>({});
  const wert = useMemo(() => {
    const modus = (id: string) => einzeln[id] ?? alle;
    return {
      modus,
      umschalten: (id: string) => setEinzeln(e => ({ ...e, [id]: modus(id) === "zu" ? "auf" : "zu" })),
      setzen: (id: string, m: Klappmodus) => setEinzeln(e => ({ ...e, [id]: m })),
    };
  }, [alle, einzeln]);
  /** Alle auf bzw. zu; noch einmal derselbe Knopf → zurück zu »normal«. */
  const alleSetzen = (m: Exclude<Klappmodus, "normal">) => { setEinzeln({}); setAlle(a => (a === m ? "normal" : m)); };
  return { wert, alle, alleSetzen };
}

export function useKlappmodus(id: string): Klappmodus {
  return useContext(Aufklappen).modus(id);
}

// Was in der Karte selbst bedienbar oder zu sehen ist — ein Klick darauf öffnet nicht.
const EIGENES = "button, a, input, textarea, select, label, img, video, iframe, [contenteditable], [data-testid='d2-bild'], [role='dialog']";

/**
 * Klick auf eine freie Stelle der Karte: öffnet sie ganz, ist sie schon ganz offen,
 * zurück zur normalen Ansicht. Klicks auf Bilder, Knöpfe, Felder und markierter
 * Text zählen nicht.
 */
export function useRahmenKlick(id: string) {
  const { modus, setzen } = useContext(Aufklappen);
  return (e: React.MouseEvent) => {
    const ziel = e.target as HTMLElement;
    if (ziel.closest(EIGENES) || window.getSelection()?.toString()) return;
    if (!e.currentTarget.contains(ziel)) return; // z. B. Klick in einem Portal-Dialog
    setzen(id, modus(id) === "auf" ? "normal" : "auf");
  };
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
