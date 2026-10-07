/**
 * Die PSE-Rallye: Aufgaben, die man durch Anklicken eines Feldes beantwortet.
 *
 * Sechs Arten, vom bloßen Ablesen bis zum Verschneiden zweier Angaben:
 *   Ordnungszahl    »Welches Element hat die Ordnungszahl 26?«
 *   Atommasse       »… die Atommasse 55,85 u?«
 *   Name            »Finde Eisen.«
 *   Symbol          »Welches Element hat das Symbol Fe?«
 *   Gruppenname     »Klick ein Halogen an.«       (mehrere Lösungen)
 *   Gruppe+Periode  »4. Periode, II. Hauptgruppe« (eine Lösung)
 *
 * Hier steht nur die Rechnung — gezogen wird mit einem übergebenen Zufall,
 * damit sich eine Runde im Test wiederholen lässt.
 */
import { HAUPTGRUPPEN, PSE, type PseElement } from "./elemente";

export type Aufgabenart =
  | "ordnungszahl" | "masse" | "name" | "symbol" | "gruppenname" | "gruppePeriode";

export type Aufgabe = {
  art: Aufgabenart;
  frage: string;
  /** Alle Ordnungszahlen, die als Antwort zählen. */
  loesung: number[];
  /** Was nach der Antwort erklärt wird. */
  erklaerung: string;
};

/** Welche Elemente drankommen. */
export type Bereich = "schule" | "hauptgruppen" | "alle";

export const BEREICHE: Record<Bereich, { label: string; hinweis: string }> = {
  schule: { label: "Schulelemente", hinweis: "Die ersten 20 plus die bekannten Metalle — für den Anfang." },
  hauptgruppen: { label: "Hauptgruppen", hinweis: "Alle acht Hauptgruppen, ohne Neben-, Lanthanoide und Actinoide." },
  alle: { label: "Alle 118", hinweis: "Das ganze Periodensystem, auch die seltenen Elemente." },
};

/** Über die ersten 20 hinaus die Metalle, die im Unterricht vorkommen. */
const SCHULE_EXTRA = new Set([24, 25, 26, 27, 28, 29, 30, 35, 47, 50, 53, 56, 78, 79, 80, 82]);

export function elementeIm(bereich: Bereich): PseElement[] {
  if (bereich === "alle") return PSE;
  if (bereich === "hauptgruppen") return PSE.filter(e => e.hauptgruppe !== null);
  return PSE.filter(e => e.z <= 20 || SCHULE_EXTRA.has(e.z));
}

/** Zufallsgeber: gibt eine Zahl in [0,1). Math.random passt. */
export type Zufall = () => number;

const zieh = <T>(liste: T[], zufall: Zufall): T => liste[Math.floor(zufall() * liste.length)];

/** Atommasse, wie sie in der Aufgabe steht — gerundet wie im Tafelwerk. */
export const masseText = (e: PseElement): string =>
  e.masse === null ? "—" : e.masse.toFixed(e.masse < 10 ? 3 : 2).replace(".", ",");

const periodeText = (n: number) => `${n}. Periode`;

/**
 * Baut eine Aufgabe. `letzteArt` wird vermieden, damit nicht zweimal
 * hintereinander dieselbe Frage kommt.
 */
export function naechsteAufgabe(bereich: Bereich, zufall: Zufall, letzteArt?: Aufgabenart): Aufgabe {
  const pool = elementeIm(bereich);
  const arten: Aufgabenart[] = ["ordnungszahl", "masse", "name", "symbol"];
  // Gruppenfragen nur, wenn der Bereich überhaupt Hauptgruppen enthält.
  if (pool.some(e => e.hauptgruppe !== null && e.z !== 1)) arten.push("gruppenname", "gruppePeriode");
  const moeglich = arten.filter(a => a !== letzteArt);
  const art = zieh(moeglich.length ? moeglich : arten, zufall);

  if (art === "gruppenname") {
    // Eine Gruppe, die im Bereich mindestens zwei Vertreter hat.
    const gruppen = [...new Set(pool.filter(e => e.hauptgruppe !== null && e.z !== 1).map(e => e.hauptgruppe!))]
      .filter(g => pool.filter(e => e.hauptgruppe === g && e.z !== 1).length >= 2);
    const g = zieh(gruppen, zufall);
    const treffer = pool.filter(e => e.hauptgruppe === g && e.z !== 1);
    const name = HAUPTGRUPPEN[g].name;
    return {
      art,
      frage: `Klick ein Element aus der Gruppe der ${name} an.`,
      loesung: treffer.map(e => e.z),
      erklaerung: `Die ${name} stehen in der ${HAUPTGRUPPEN[g].roemisch}. Hauptgruppe: ${HAUPTGRUPPEN[g].kurz}.`,
    };
  }

  if (art === "gruppePeriode") {
    const ziel = zieh(pool.filter(e => e.hauptgruppe !== null && e.z !== 1), zufall);
    const g = HAUPTGRUPPEN[ziel.hauptgruppe!];
    return {
      art,
      frage: `Welches Element steht in der ${ziel.periode}. Periode und in der ${g.roemisch}. Hauptgruppe (${g.name})?`,
      loesung: [ziel.z],
      erklaerung: `${ziel.name} (${ziel.symbol}) steht in ${periodeText(ziel.periode)}, Gruppe ${g.roemisch} — ${g.name}.`,
    };
  }

  const ziel = zieh(pool, zufall);
  const wo = `${periodeText(ziel.periode)}${ziel.hauptgruppe ? `, ${HAUPTGRUPPEN[ziel.hauptgruppe].roemisch}. Hauptgruppe` : ""}`;
  switch (art) {
    case "ordnungszahl":
      return {
        art,
        frage: `Welches Element hat die Ordnungszahl ${ziel.z}?`,
        loesung: [ziel.z],
        erklaerung: `${ziel.name} (${ziel.symbol}) hat ${ziel.z} Protonen im Kern — das ist die Ordnungszahl. ${wo}.`,
      };
    case "masse":
      return {
        art,
        frage: `Welches Element hat die Atommasse ${masseText(ziel)} u?`,
        loesung: [ziel.z],
        erklaerung: `${ziel.name} (${ziel.symbol}) wiegt ${masseText(ziel)} u. Die Masse steigt im Periodensystem von links nach rechts und von oben nach unten.`,
      };
    case "symbol":
      return {
        art,
        frage: `Welches Element hat das Symbol ${ziel.symbol}?`,
        loesung: [ziel.z],
        erklaerung: `${ziel.symbol} steht für ${ziel.name}, Ordnungszahl ${ziel.z}. ${wo}.`,
      };
    default:
      return {
        art: "name",
        frage: `Finde ${ziel.name}.`,
        loesung: [ziel.z],
        erklaerung: `${ziel.name} hat das Symbol ${ziel.symbol} und die Ordnungszahl ${ziel.z}. ${wo}.`,
      };
  }
}

export const istRichtig = (a: Aufgabe, z: number): boolean => a.loesung.includes(z);

/** Punkte: beim ersten Versuch volle Punktzahl, danach weniger. */
export function punkteFuer(versuche: number): number {
  return versuche <= 1 ? 3 : versuche === 2 ? 2 : 1;
}

export const RUNDE = 10; // Aufgaben je Runde

/** Ein Wort zum Ergebnis — ohne Lob für eine schwache Runde. */
export function urteil(punkte: number, moeglich: number): string {
  const anteil = moeglich ? punkte / moeglich : 0;
  if (anteil >= 0.95) return "Alles auf Anhieb gefunden.";
  if (anteil >= 0.8) return "Sicher im Periodensystem unterwegs.";
  if (anteil >= 0.55) return "Das meiste sitzt, ein paar Felder brauchen noch Übung.";
  if (anteil >= 0.3) return "Die Ordnung des Periodensystems hilft beim Suchen: Perioden sind Zeilen, Hauptgruppen Spalten.";
  return "Schau dir zuerst den Aufbau an: Die Ordnungszahl wächst von links nach rechts, Zeile für Zeile.";
}
