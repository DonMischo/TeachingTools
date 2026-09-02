/**
 * Der Rechenkern der Schreibübung — reine Funktionen, kein DOM.
 *
 * Zwei Festlegungen, die alles andere prägen:
 *
 * 1. **Fehlersperre.** Ein falsches Zeichen zählt als Fehler, rückt den Cursor
 *    aber NICHT vor. Wer die falsche Taste trifft, muss die richtige finden —
 *    Muskelgedächtnis entsteht sonst auf der falschen Taste. (So macht es auch
 *    TIPP10.) Rücktaste gibt es deshalb nicht: es steht nie etwas Falsches da.
 *
 * 2. **Anschläge pro Minute** statt WPM — die im deutschen Schreibunterricht
 *    übliche Größe. Gezählt werden dabei nur die *richtigen* Anschläge, sonst
 *    ließe sich die Zahl durch wildes Hämmern in die Höhe treiben. Die
 *    Fehlerquote steht daneben und bezieht sich auf alle Anschläge.
 *
 * 3. **Nachschlagfenster.** Ein Vertipper fällt nicht sofort auf — die Hand
 *    tippt noch vier, fünf Zeichen weiter, bevor das Auge es merkt. Wegen der
 *    Fehlersperre landen die alle auf derselben Stelle und wären sonst je ein
 *    eigener Fehler. Was innerhalb von `NACHSCHLAG_MS` nach einem Fehlgriff
 *    noch kommt, zählt deshalb zu demselben Fehler: einmal vertippt ist einmal
 *    vertippt. Das Fenster wandert mit jedem weiteren Fehlanschlag mit, damit
 *    eine ganze Nachschlagserie zusammenbleibt; wer minutenlang durchhämmert,
 *    bekommt dadurch nur einen Fehler angerechnet — er kommt im Text aber auch
 *    keinen Anschlag weiter, und die Anschläge pro Minute zählen nur richtige.
 */

/** Wie lange nach einem Fehlgriff noch alles zu demselben Fehler gehört. */
export const NACHSCHLAG_MS = 300;

export type Stand = {
  text: string;
  /** Wie viele Zeichen stehen schon richtig da. */
  pos: number;
  /**
   * Gezählte Anschläge: alle richtigen plus je Vertipper einer. Was im
   * Nachschlagfenster hinterherkommt, zählt nicht mit — sonst wäre die
   * Fehlerquote von der Reaktionszeit des Schülers abhängig.
   */
  anschlaege: number;
  fehler: number;
  /** Zeitpunkt des ersten Anschlags (ms), null solange nichts getippt wurde. */
  startMs: number | null;
  /** Zeitpunkt des letzten Zeichens (ms), null solange nicht fertig. */
  endeMs: number | null;
  /** Wie oft wurde welches *erwartete* Zeichen verfehlt. */
  fehlerJeZeichen: Record<string, number>;
  /**
   * Zeitpunkt des letzten Fehlgriffs (ms) — null, sobald wieder etwas
   * Richtiges kam. Trägt das Nachschlagfenster und sagt zugleich, ob der
   * Cursor gerade auf einem Fehler steht (rote Markierung).
   */
  letzterFehlerMs: number | null;
};

export function start(text: string): Stand {
  return {
    text, pos: 0, anschlaege: 0, fehler: 0,
    startMs: null, endeMs: null, fehlerJeZeichen: {}, letzterFehlerMs: null,
  };
}

/** Das Zeichen, das als nächstes getippt werden muss (undefined = fertig). */
export function erwartet(s: Stand): string | undefined {
  return s.pos < s.text.length ? s.text[s.pos] : undefined;
}

export function fertig(s: Stand): boolean {
  return s.pos >= s.text.length;
}

/** Steht der Cursor gerade auf einem Fehlgriff? Grundlage der roten Stelle. */
export function stehtAufFehler(s: Stand): boolean {
  return s.letzterFehlerMs !== null;
}

/**
 * Einen Anschlag verarbeiten. `jetzt` kommt von performance.now().
 *
 * `sperre` ist die Fehlersperre: Voreinstellung an. Hochgeladenes Material darf
 * sie abschalten (`lock_on_error: false`) — beim reinen Diktat mit einer
 * geübten Klasse steht der Textfluss im Vordergrund, und ein Tippfehler soll
 * dann nicht den ganzen Satz anhalten. Gezählt wird der Fehler so oder so.
 */
export function feed(s: Stand, zeichen: string, jetzt: number, sperre = true): Stand {
  const soll = erwartet(s);
  if (soll === undefined) return s;

  const startMs = s.startMs ?? jetzt;
  const richtig = zeichen === soll;

  if (!richtig && sperre) {
    // Nachschlag: hängt dieser Fehlgriff noch am vorigen, ist es derselbe
    // Fehler — er zählt weder als eigener Fehler noch als eigener Anschlag,
    // sonst drückte ein einziger Vertipper die Fehlerquote gleich fünffach.
    const nachschlag =
      s.letzterFehlerMs !== null && jetzt - s.letzterFehlerMs <= NACHSCHLAG_MS;
    return {
      ...s,
      startMs,
      letzterFehlerMs: jetzt,
      anschlaege: nachschlag ? s.anschlaege : s.anschlaege + 1,
      fehler: nachschlag ? s.fehler : s.fehler + 1,
      fehlerJeZeichen: nachschlag
        ? s.fehlerJeZeichen
        : { ...s.fehlerJeZeichen, [soll]: (s.fehlerJeZeichen[soll] ?? 0) + 1 },
    };
  }

  // Ohne Fehlersperre rückt auch ein falsches Zeichen vor. Dann steht der
  // nächste Fehlgriff an einer anderen Stelle und ist ein eigener Fehler —
  // das Nachschlagfenster gibt es hier also nicht.
  const pos = s.pos + 1;
  return {
    ...s,
    startMs,
    anschlaege: s.anschlaege + 1,
    pos,
    endeMs: pos >= s.text.length ? jetzt : null,
    letzterFehlerMs: richtig ? null : jetzt,
    fehler: richtig ? s.fehler : s.fehler + 1,
    fehlerJeZeichen: richtig
      ? s.fehlerJeZeichen
      : { ...s.fehlerJeZeichen, [soll]: (s.fehlerJeZeichen[soll] ?? 0) + 1 },
  };
}

export type Werte = {
  /** Verstrichene Zeit in Sekunden. */
  dauer: number;
  anschlaegeProMinute: number;
  /** Anteil der Fehlanschläge an allen Anschlägen, 0…1. */
  fehlerquote: number;
  fortschritt: number;
  fertig: boolean;
};

export function werte(s: Stand, jetzt: number): Werte {
  const dauerMs = s.startMs === null ? 0 : (s.endeMs ?? jetzt) - s.startMs;
  const dauer = dauerMs / 1000;
  return {
    dauer,
    // Unter einer Sekunde ist die Hochrechnung sinnlos — sie ergäbe absurde Werte.
    anschlaegeProMinute: dauerMs >= 1000 ? Math.round(s.pos / (dauerMs / 60000)) : 0,
    fehlerquote: s.anschlaege === 0 ? 0 : s.fehler / s.anschlaege,
    fortschritt: s.text.length === 0 ? 1 : s.pos / s.text.length,
    fertig: fertig(s),
  };
}

/** Die schwächsten Zeichen dieser Übung, häufigster Fehler zuerst. */
export function schwacheZeichen(s: Stand, anzahl = 5): { zeichen: string; fehler: number }[] {
  return Object.entries(s.fehlerJeZeichen)
    .map(([zeichen, fehler]) => ({ zeichen, fehler }))
    .sort((a, b) => b.fehler - a.fehler)
    .slice(0, anzahl);
}
