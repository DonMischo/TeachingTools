/**
 * Reine Zustandslogik für Stufe »Explorer«: ein nachgebauter Windows-11-
 * Datei-Explorer ohne echte Dateien. Alles hier ist pure Funktionen über
 * einen ExplorerStand — die Komponente ruft sie nur auf und rendert das
 * Ergebnis. So lässt sich Markieren, Verschieben und Umbenennen ohne DOM
 * testen.
 */

export type DateiArt = "ordner" | "docx" | "jpg" | "mp3" | "txt";

export type Datei = {
  id: string;
  name: string;
  art: DateiArt;
  /** id des übergeordneten Ordners; "" = Wurzel (Dokumente). */
  parent: string;
};

export type ExplorerStand = {
  dateien: Datei[];
  /** ids der markierten Elemente im aktuellen Ordner, in Klickreihenfolge. */
  auswahl: string[];
  /** letztes einzeln angeklicktes Element — Bezug für Umschalt+Klick. */
  anker: string | null;
  zwischenablage: { ids: string[]; modus: "ausschneiden" | "kopieren" } | null;
  papierkorb: number;
  aktuellerOrdner: string;
  /** Pfad der Ordner-ids von der Wurzel bis zum aktuellen Ordner (ohne Wurzel). */
  pfad: string[];
};

export const WURZEL = "";

let naechsteId = 1;
function neueId(vorsatz: string): string {
  return `${vorsatz}-${naechsteId++}`;
}

export function anfangsStand(): ExplorerStand {
  const dateien: Datei[] = [
    { id: "mathe", name: "Mathe.docx", art: "docx", parent: WURZEL },
    { id: "deutsch", name: "Deutsch.docx", art: "docx", parent: WURZEL },
    { id: "englisch", name: "Englisch.docx", art: "docx", parent: WURZEL },
    { id: "klassenfoto", name: "Klassenfoto.jpg", art: "jpg", parent: WURZEL },
    { id: "schullied", name: "Schullied.mp3", art: "mp3", parent: WURZEL },
    { id: "einkaufsliste", name: "Einkaufsliste.txt", art: "txt", parent: WURZEL },
    { id: "ferien", name: "Ferien.docx", art: "docx", parent: WURZEL },
    { id: "geburtstag", name: "Geburtstag.docx", art: "docx", parent: WURZEL },
    { id: "technik", name: "Technik.docx", art: "docx", parent: WURZEL },
  ];
  return {
    dateien,
    auswahl: [],
    anker: null,
    zwischenablage: null,
    papierkorb: 0,
    aktuellerOrdner: WURZEL,
    pfad: [],
  };
}

/**
 * Reihenfolge, wie sie angezeigt wird: Ordner zuerst, dann alphabetisch — wie
 * im echten Explorer. Dadurch liegen die Fächer verstreut zwischen anderen
 * Dateien, und man sieht, warum es für sie Strg braucht und nicht Umschalt.
 */
export function sichtbareDateien(stand: ExplorerStand): Datei[] {
  const hier = stand.dateien.filter(d => d.parent === stand.aktuellerOrdner);
  const abc = (a: Datei, b: Datei) => a.name.localeCompare(b.name, "de");
  const ordner = hier.filter(d => d.art === "ordner").sort(abc);
  const rest = hier.filter(d => d.art !== "ordner").sort(abc);
  return [...ordner, ...rest];
}

function findeName(stand: ExplorerStand, ordner: string, name: string, ausser?: string): boolean {
  return stand.dateien.some(
    d => d.parent === ordner && d.id !== ausser && d.name.toLowerCase() === name.toLowerCase(),
  );
}

export function klick(stand: ExplorerStand, id: string): ExplorerStand {
  return { ...stand, auswahl: [id], anker: id };
}

export function strgKlick(stand: ExplorerStand, id: string): ExplorerStand {
  const drin = stand.auswahl.includes(id);
  const auswahl = drin ? stand.auswahl.filter(x => x !== id) : [...stand.auswahl, id];
  return { ...stand, auswahl, anker: drin ? stand.anker : id };
}

export function umschaltKlick(stand: ExplorerStand, id: string): ExplorerStand {
  if (!stand.anker) return klick(stand, id);
  const sichtbar = sichtbareDateien(stand).map(d => d.id);
  const von = sichtbar.indexOf(stand.anker);
  const bis = sichtbar.indexOf(id);
  if (von === -1 || bis === -1) return klick(stand, id);
  const [a, b] = von <= bis ? [von, bis] : [bis, von];
  return { ...stand, auswahl: sichtbar.slice(a, b + 1) };
}

export function leeren(stand: ExplorerStand): ExplorerStand {
  return { ...stand, auswahl: [], anker: null };
}

export function neuerOrdner(stand: ExplorerStand): ExplorerStand {
  let name = "Neuer Ordner";
  let n = 2;
  while (findeName(stand, stand.aktuellerOrdner, name)) {
    name = `Neuer Ordner (${n})`;
    n += 1;
  }
  const id = neueId("ordner");
  const ordner: Datei = { id, name, art: "ordner", parent: stand.aktuellerOrdner };
  return { ...stand, dateien: [...stand.dateien, ordner], auswahl: [id], anker: id };
}

export type UmbenennenErgebnis = { stand: ExplorerStand; fehler?: "leer" | "vergeben" };

export function umbenennen(stand: ExplorerStand, id: string, name: string): UmbenennenErgebnis {
  const neu = name.trim();
  const datei = stand.dateien.find(d => d.id === id);
  if (!datei) return { stand, fehler: "leer" };
  if (!neu) return { stand, fehler: "leer" };
  if (findeName(stand, datei.parent, neu, id)) return { stand, fehler: "vergeben" };
  return {
    stand: { ...stand, dateien: stand.dateien.map(d => (d.id === id ? { ...d, name: neu } : d)) },
  };
}

export function ausschneiden(stand: ExplorerStand): ExplorerStand {
  if (stand.auswahl.length === 0) return stand;
  return { ...stand, zwischenablage: { ids: stand.auswahl, modus: "ausschneiden" } };
}

export function kopieren(stand: ExplorerStand): ExplorerStand {
  if (stand.auswahl.length === 0) return stand;
  return { ...stand, zwischenablage: { ids: stand.auswahl, modus: "kopieren" } };
}

/** Fügt die Zwischenablage in den aktuellen Ordner ein. */
export function einfuegen(stand: ExplorerStand): ExplorerStand {
  const ablage = stand.zwischenablage;
  if (!ablage) return stand;
  if (ablage.modus === "ausschneiden") {
    return verschieben(
      { ...stand, zwischenablage: null },
      ablage.ids,
      stand.aktuellerOrdner,
    );
  }
  // Kopieren: neue ids, Namen bei Bedarf mit " - Kopie" versehen.
  let dateien = stand.dateien;
  const neueIds: string[] = [];
  for (const id of ablage.ids) {
    const original = dateien.find(d => d.id === id);
    if (!original) continue;
    let name = original.name;
    if (findeName({ ...stand, dateien }, stand.aktuellerOrdner, name)) {
      const punkt = name.lastIndexOf(".");
      name = punkt > 0
        ? `${name.slice(0, punkt)} - Kopie${name.slice(punkt)}`
        : `${name} - Kopie`;
    }
    const neu: Datei = { id: neueId("kopie"), name, art: original.art, parent: stand.aktuellerOrdner };
    dateien = [...dateien, neu];
    neueIds.push(neu.id);
  }
  return { ...stand, dateien, auswahl: neueIds };
}

export function verschieben(stand: ExplorerStand, ids: string[], zielOrdner: string): ExplorerStand {
  const menge = new Set(ids.filter(id => id !== zielOrdner));
  if (menge.size === 0) return stand;
  return {
    ...stand,
    dateien: stand.dateien.map(d => (menge.has(d.id) ? { ...d, parent: zielOrdner } : d)),
    auswahl: [],
  };
}

export function loeschen(stand: ExplorerStand): ExplorerStand {
  if (stand.auswahl.length === 0) return stand;
  const entfernen = new Set(stand.auswahl);
  return {
    ...stand,
    dateien: stand.dateien.filter(d => !entfernen.has(d.id)),
    auswahl: [],
    anker: null,
    papierkorb: stand.papierkorb + entfernen.size,
  };
}

export function oeffnen(stand: ExplorerStand, ordnerId: string): ExplorerStand {
  const ordner = stand.dateien.find(d => d.id === ordnerId && d.art === "ordner");
  if (!ordner) return stand;
  return {
    ...stand,
    aktuellerOrdner: ordnerId,
    pfad: [...stand.pfad, ordnerId],
    auswahl: [],
    anker: null,
  };
}

export function zurueck(stand: ExplorerStand): ExplorerStand {
  if (stand.pfad.length === 0) return stand;
  const pfad = stand.pfad.slice(0, -1);
  return {
    ...stand,
    pfad,
    aktuellerOrdner: pfad.length === 0 ? WURZEL : pfad[pfad.length - 1],
    auswahl: [],
    anker: null,
  };
}

/** Name des Ordners, wie er im Aufgabentext erscheint. */
export function ordnerName(stand: ExplorerStand, id: string): string | undefined {
  return stand.dateien.find(d => d.id === id)?.name;
}

/** Landet eine Verschiebe-Aktion (Ziehen oder Einfügen) in einem anderen als dem Zielordner? */
export function istFalscherZielordner(zielOrdner: string, schulordner: string | null): boolean {
  return schulordner !== null && zielOrdner !== schulordner;
}
