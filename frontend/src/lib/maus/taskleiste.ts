/**
 * Reine Hilfsfunktionen für Teil 3 · Taskleiste & Start.
 *
 * »Ziel …«-Funktionen wählen ausgehend vom Aussehen zu Beginn der Stufe ein
 * Ziel, das eine echte Änderung verlangt. Die Sortier-Funktionen sind für
 * die Aufgabe »Desktop aufräumen« — Windows sortiert Desktop-Symbole nach
 * dem deutschen Namen der App, nicht nach der internen Id.
 */
import { ALLE_APPS, APPS, type AppId, type Aussehen } from "./windows";

/** Bevorzugte Ziele zum Anheften — auffällige, bekannte Apps zuerst. */
const ANHEFTEN_BEVORZUGT: AppId[] = ["paint", "vlc", "geogebra"];
/** Bevorzugtes Ziel zum Lösen. */
const LOESEN_BEVORZUGT: AppId[] = ["word"];
/** Bleiben immer angeheftet — Lösen ergibt für sie keinen Sinn. */
const LOESEN_AUSGENOMMEN = new Set<AppId>(["explorer", "einstellungen"]);

/** Eine noch nicht angeheftete App — oder `null`, wenn wirklich schon alle angeheftet sind. */
export function zielAnheften(start: Aussehen): AppId | null {
  const gepinnt = new Set(start.taskleiste);
  const bevorzugt = ANHEFTEN_BEVORZUGT.find(id => !gepinnt.has(id));
  if (bevorzugt) return bevorzugt;
  const irgendeine = ALLE_APPS.find(a => !gepinnt.has(a.id));
  return irgendeine ? irgendeine.id : null;
}

/** Eine angeheftete App außer Explorer/Einstellungen — oder `null`, wenn keine übrig ist. */
export function zielLoesen(start: Aussehen): AppId | null {
  const kandidaten = start.taskleiste.filter(id => !LOESEN_AUSGENOMMEN.has(id));
  if (kandidaten.length === 0) return null;
  const bevorzugt = LOESEN_BEVORZUGT.find(id => kandidaten.includes(id));
  return bevorzugt ?? kandidaten[0];
}

/** Immer das Gegenteil der Start-Ausrichtung. */
export function zielAusrichtung(start: Aussehen): "links" | "mitte" {
  return start.ausrichtung === "links" ? "mitte" : "links";
}

/** Wie Windows sortiert: nach dem deutschen Anzeigenamen der App. */
export function nachNameSortiert(liste: AppId[]): AppId[] {
  return [...liste].sort((a, b) => APPS[a].name.localeCompare(APPS[b].name, "de"));
}

export function istNachNameSortiert(liste: AppId[]): boolean {
  const sortiert = nachNameSortiert(liste);
  return liste.every((id, i) => id === sortiert[i]);
}

/**
 * Mischt eine (bereits nach Name sortierte) Liste sichtbar durcheinander —
 * damit Aufgabe 4 zu Beginn der Stufe wirklich etwas zu sortieren vorfindet.
 * Bei einem oder null Einträgen gibt es nichts zu mischen.
 */
export function gemischteReihenfolge(liste: AppId[]): AppId[] {
  if (liste.length < 2) return liste;
  const gemischt = [...liste].reverse();
  if (!istNachNameSortiert(gemischt)) return gemischt;
  // Die Umkehrung ist zufällig wieder sortiert (z. B. bei zwei Einträgen mit
  // vertauschbaren Namen) — dann stattdessen den ersten ans Ende schieben.
  return [...gemischt.slice(1), gemischt[0]];
}

/** Apps im Startmenü unter »Angeheftet« — das Anheften-Ziel steht immer mit drin. */
const START_ANGEHEFTET: AppId[] = ["edge", "word", "excel", "powerpoint", "paint", "rechner", "editor", "vlc", "geogebra", "scratch", "explorer", "einstellungen"];

export function startAngeheftet(ziel: AppId | null): AppId[] {
  return ziel && !START_ANGEHEFTET.includes(ziel) ? [ziel, ...START_ANGEHEFTET] : START_ANGEHEFTET;
}

/** Was sich an der Taskleiste geändert hat. */
export function leistenAenderung(alt: AppId[], neu: AppId[]): { dazu: AppId[]; weg: AppId[] } {
  return { dazu: neu.filter(id => !alt.includes(id)), weg: alt.filter(id => !neu.includes(id)) };
}
