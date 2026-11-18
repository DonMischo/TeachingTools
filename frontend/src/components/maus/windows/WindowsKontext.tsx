"use client";
/**
 * Das Windows eines Kindes: wie es aussieht (Teil 3 verändert es) und wie der
 * Benutzer heißt (C:\Benutzer\<Name>). Die Hülle hält beides und speichert das
 * Aussehen mit dem übrigen Fortschritt — so bleibt der eigene Hintergrund
 * auch in der nächsten Stufe stehen.
 */
import { createContext, useContext } from "react";
import { STANDARD_AUSSEHEN, type Aussehen } from "@/lib/maus/windows";
import { SYSTEME, type Betriebssystem, type SystemInfo } from "@/lib/maus/system";

export type WindowsRahmen = {
  aussehen: Aussehen;
  setAussehen: (neu: Aussehen | ((alt: Aussehen) => Aussehen)) => void;
  /** Windows-Benutzername, z. B. »Mia« */
  benutzer: string;
  /** Welches System nachgebildet wird (Auswahl oben im Werkzeug). */
  system: Betriebssystem;
};

export const WindowsKontext = createContext<WindowsRahmen>({
  aussehen: STANDARD_AUSSEHEN,
  setAussehen: () => {},
  benutzer: "Schüler",
  system: "windows",
});

export function useWindows(): WindowsRahmen & { sys: SystemInfo } {
  const k = useContext(WindowsKontext);
  return { ...k, sys: SYSTEME[k.system] };
}
