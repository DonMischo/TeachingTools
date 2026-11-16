/**
 * Der D2-Zeichner für die D2-Ansicht der Flussdiagramme. Die Next-Seiten
 * reichen `zeichne` aus `lib/diagramm/d2laufzeit` herein; die Offline-Datei
 * (standalone) tut es nicht — dort fehlt der Schalter, und die 11 MB D2 landen
 * nicht in der Datei (sie bündelt dynamische Importe mit ein).
 */
import { createContext, useContext } from "react";

export type D2Zeichner = (code: string) => Promise<{ svg: string }>;

export const D2Kontext = createContext<D2Zeichner | null>(null);
export const useD2Zeichner = () => useContext(D2Kontext);
