"use client";
/**
 * Das Windows eines Kindes: wie es aussieht (Teil 3 verändert es) und wie der
 * Benutzer heißt (C:\Benutzer\<Name>). Die Hülle hält beides und speichert das
 * Aussehen mit dem übrigen Fortschritt — so bleibt der eigene Hintergrund
 * auch in der nächsten Stufe stehen.
 */
import { createContext, useContext } from "react";
import { STANDARD_AUSSEHEN, type Aussehen } from "@/lib/maus/windows";

export type WindowsRahmen = {
  aussehen: Aussehen;
  setAussehen: (neu: Aussehen | ((alt: Aussehen) => Aussehen)) => void;
  /** Windows-Benutzername, z. B. »Mia« */
  benutzer: string;
};

export const WindowsKontext = createContext<WindowsRahmen>({
  aussehen: STANDARD_AUSSEHEN,
  setAussehen: () => {},
  benutzer: "Schüler",
});

export function useWindows(): WindowsRahmen {
  return useContext(WindowsKontext);
}
