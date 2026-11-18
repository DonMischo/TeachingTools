"use client";
/**
 * Die Aufgabentexte des Maus-Führerscheins sind für Windows geschrieben. Für
 * Ubuntu und macOS ersetzt `useSystemText` die Windows-Begriffe — mit Artikel,
 * damit die Sätze stimmen (»in der Taskleiste« → »im Dock«). Längere Wendungen
 * stehen vor kürzeren, sonst fräße »Taskleiste« die Menüpunkte auf.
 *
 * So bleiben Aufgaben, Hinweise und Vorführungen für alle drei Systeme an
 * einer Stelle; was sich nicht Wort für Wort übertragen lässt (Ausschalten,
 * Tastenkürzel), lösen die Stufen selbst.
 */
import { cloneElement, isValidElement, type ReactNode } from "react";
import type { Betriebssystem } from "@/lib/maus/system";
import { useWindows } from "./windows/WindowsKontext";

/** [Windows, Ubuntu, macOS] */
const PHRASEN: [string, string, string][] = [
  ["USB-Stick (D:)", "USB-Stick", "USB-Stick"],
  ["unter »Dieser PC«", "ganz unten", "unter »Orte«"],
  ["Dieser PC", "Persönlicher Ordner", "Macintosh HD"],
  ["Klicke auf die Suche in der Taskleiste oder auf Start.", "Klicke oben links auf »Aktivitäten« oder drück die Super-Taste.", "Klicke oben rechts auf die Lupe (Spotlight) oder drück ⌘ + Leertaste."],
  ["Zeige auf die Suche.", "Zeige oben links auf »Aktivitäten«.", "Zeige oben rechts auf die Lupe."],
  ["An Taskleiste anheften", "Zu Favoriten hinzufügen", "Im Dock behalten"],
  ["Von Taskleiste lösen", "Aus Favoriten entfernen", "Aus dem Dock entfernen"],
  ["Einstellungen › Taskleiste › Ausrichtung", "Einstellungen › Ubuntu-Desktop › Dock › Position", "Systemeinstellungen › Schreibtisch & Dock › Position"],
  ["Unter »Ausrichtung«", "Unter »Position auf dem Bildschirm«", "Unter »Position auf dem Bildschirm«"],
  ["Einstellungen › Konten › Profilbild", "Einstellungen › System › Benutzer", "Systemeinstellungen › Benutzer & Gruppen"],
  ["Start › auf deinen Namen klicken › Sperren", "»Anwendungen anzeigen« › auf deinen Namen klicken › Sperren", "Launchpad › auf deinen Namen klicken › Sperren"],
  ["unten im Startmenü", "unten in der Anwendungsübersicht", "unten im Launchpad"],
  ["Start öffnen", "»Anwendungen anzeigen« öffnen", "Launchpad öffnen"],
  ["Klicke auf Start.", "Klicke auf »Anwendungen anzeigen«.", "Klicke auf das Launchpad."],
  ["Taskleiste & Start", "Dock & Anwendungen", "Dock & Launchpad"],
  ["in der Taskleiste oder auf dem Desktop", "im Dock oder auf dem Schreibtisch", "im Dock"],
  ["unten in der Taskleiste", "links im Dock", "unten im Dock"],
  ["in der Taskleiste", "im Dock", "im Dock"],
  ["über die Taskleiste", "über das Dock", "über das Dock"],
  ["an die Taskleiste", "ans Dock", "ans Dock"],
  ["von der Taskleiste", "vom Dock", "vom Dock"],
  ["aus der Taskleiste", "aus dem Dock", "aus dem Dock"],
  ["die Taskleiste", "das Dock", "das Dock"],
  ["Taskleiste", "Dock", "Dock"],
  ["Explorer", "Dateimanager", "Finder"],
  ["Editors", "Texteditors", "TextEdit-Fensters"],
  ["Editor", "Texteditor", "TextEdit"],
  ["Oben rechts auf", "Oben rechts auf", "Oben links auf"],
  ["Personalisierung", "Darstellung", "Erscheinungsbild"],
  ["Barrierefreiheit", "Barrierefreiheit", "Bedienungshilfen"],
  ["Konten", "Benutzer", "Benutzer & Gruppen"],
  ["Einstellungen", "Einstellungen", "Systemeinstellungen"],
  ["dein Windows", "dein Ubuntu", "dein Mac"],
  ["Windows", "Ubuntu", "macOS"],
  ["über den Desktop", "über den Schreibtisch", "über den Schreibtisch"],
  ["auf dem Desktop", "auf dem Schreibtisch", "auf dem Schreibtisch"],
  ["Desktop", "Schreibtisch", "Schreibtisch"],
];

export function uebersetzer(system: Betriebssystem): (t: string) => string {
  if (system === "windows") return t => t;
  const spalte = system === "ubuntu" ? 1 : 2;
  return t => {
    // Jede Wendung nur einmal anfassen: was schon ersetzt ist, bleibt stehen.
    const teile: (string | { fertig: string })[] = [t];
    for (const p of PHRASEN) {
      for (let i = teile.length - 1; i >= 0; i--) {
        const teil = teile[i];
        if (typeof teil !== "string" || !teil.includes(p[0])) continue;
        const stuecke = teil.split(p[0]);
        const neu: (string | { fertig: string })[] = [];
        stuecke.forEach((s, j) => { if (j > 0) neu.push({ fertig: p[spalte] }); neu.push(s); });
        teile.splice(i, 1, ...neu);
      }
    }
    return teile.map(x => (typeof x === "string" ? x : x.fertig)).join("");
  };
}

/** Ersetzt die Texte in einem Stück JSX (Kinder einzeln übergeben, damit React keine Schlüssel verlangt). */
export function uebertrage(n: ReactNode, t: (s: string) => string): ReactNode {
  if (typeof n === "string") return t(n);
  if (Array.isArray(n)) return n.map(x => uebertrage(x, t));
  if (isValidElement<{ children?: ReactNode }>(n) && n.props.children !== undefined) {
    const kinder = n.props.children;
    return Array.isArray(kinder)
      ? cloneElement(n, undefined, ...kinder.map(k => uebertrage(k, t)))
      : cloneElement(n, undefined, uebertrage(kinder, t));
  }
  return n;
}

/** `t` für Texte, `tt` für JSX — beide für das gewählte System. */
export function useSystemText() {
  const { system } = useWindows();
  const t = uebersetzer(system);
  return { t, tt: (n: ReactNode) => uebertrage(n, t) };
}

/**
 * Die zwei Lagen der Leiste (Aussehen.ausrichtung) beim Namen: Windows richtet
 * die Taskleiste mittig/links aus, Ubuntu stellt das Dock links/unten, macOS
 * unten/links. »mitte« ist jeweils die Grundeinstellung.
 */
export function ausrichtungName(a: "mitte" | "links", system: Betriebssystem): string {
  if (system === "ubuntu") return a === "mitte" ? "Links" : "Unten";
  if (system === "macos") return a === "mitte" ? "Unten" : "Links";
  return a === "mitte" ? "Mitte" : "Links";
}
