/**
 * Gemeinsames Gerüst für gewürfelte Geometrie-Aufgaben (Vierecke, Dreiecke,
 * Kreis, Geometrie, Körper): eine Aufgabe hat Text, gesuchte Größen mit
 * Toleranz, Tipps, Lösungsweg und eine Skizze. Das Blatt
 * `components/geometrie/Aufgabenblatt.tsx` zeigt sie an, prüft und exportiert
 * sie als Word-Arbeitsblatt.
 */
import { leseZahl, runde, z } from "@/lib/prozent";
import type { Skizze } from "./skizze";

export type Zufall = () => number;

/** Ganze Zahl von `a` bis `b` (beide eingeschlossen). */
export const ganz = (r: Zufall, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
export const eins = <T,>(r: Zufall, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

/**
 * Eine gesuchte Größe. Mit `optionen` ist sie eine Auswahl: `wert` ist dann
 * der Index der richtigen Option, `einheit` bleibt leer.
 */
export type Gesuchtes = { key: string; label: string; einheit: string; wert: number; tol: number; optionen?: string[]; nk?: number };

export type Sachaufgabe<A extends string = string> = {
  art: A;
  titel: string;
  text: string;
  gesucht: Gesuchtes[];
  hinweise: string[];
  loesung: string[];
  skizze?: Skizze;
};

export type Art<A extends string = string> = { id: A; icon: string; label: string };

/** Gesuchte Zahl; ohne `tol` reicht ein Rundungsfehler von rund 1 %. */
export function gesucht(key: string, label: string, einheit: string, wert: number, tol?: number, nk = 2): Gesuchtes {
  return { key, label, einheit, wert, tol: tol ?? Math.max(0.011, Math.abs(wert) * 0.01), nk };
}

/** Gesuchte Auswahl: `richtig` muss unter `optionen` stehen. */
export function auswahl(key: string, label: string, optionen: string[], richtig: string): Gesuchtes {
  const i = optionen.indexOf(richtig);
  if (i < 0) throw new Error(`»${richtig}« fehlt in den Optionen`);
  return { key, label, einheit: "", wert: i, tol: 0, optionen };
}

/** Passt die Eingabe (Text bzw. Index als Text) zur gesuchten Größe? */
export function stimmt(g: Gesuchtes, eingabe: string | undefined): boolean {
  if (eingabe === undefined || eingabe === "") return false;
  if (g.optionen) return Number(eingabe) === g.wert;
  const x = leseZahl(eingabe);
  return x !== null && Math.abs(x - g.wert) <= g.tol;
}

/** Ergebnis zum Vorlesen: »Fläche ≈ 12,5 m²« bzw. »Form: Raute«. */
export function ergebnis(g: Gesuchtes): string {
  if (g.optionen) return `${g.label}: ${g.optionen[g.wert]}`;
  const nk = g.nk ?? 2;
  const gleich = Math.abs(runde(g.wert, nk) - g.wert) < 1e-9 ? "=" : "≈";
  return `${g.label} ${gleich} ${z(g.wert, nk)}${g.einheit ? " " + g.einheit : ""}`;
}

/** Arten gemischt: jede einmal, bevor sich eine wiederholt. */
export function mischeArten<A extends string>(arten: readonly A[], n: number, r: Zufall = Math.random): A[] {
  const reihe = [...arten].sort(() => r() - 0.5);
  return Array.from({ length: n }, (_, i) => reihe[i % reihe.length]);
}
