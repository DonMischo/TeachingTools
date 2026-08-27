/**
 * Wortregen — Spiellogik, rein rechnerisch.
 *
 * Wörter fallen von oben; wer eines fertig tippt, löscht es. Ein Wort, das
 * unten ankommt, kostet ein Leben.
 *
 * Die Höhe `y` läuft von 0 (oben) bis 1 (unten) statt in Pixeln: so hängt die
 * Spiellogik nicht an der Fenstergröße und lässt sich ohne Browser prüfen.
 *
 * Zwei Regeln, die das Spiel fair halten:
 *  • Ein begonnenes Wort bleibt das Ziel, bis es fertig ist. Sonst würde ein
 *    Fehlanschlag den Schüler unbemerkt auf ein anderes Wort umsetzen.
 *  • Ein Fehlanschlag kostet kein Leben, nur die Fehlerquote — Zeitdruck
 *    bestraft ohnehin genug.
 */

export type Fallwort = {
  id: number;
  wort: string;
  /** Wie viele Zeichen davon stehen schon. */
  getippt: number;
  /** Waagerechte Lage, 0…1. */
  spalte: number;
  /** Höhe, 0 = oben, 1 = unten angekommen. */
  y: number;
};

export type Regen = {
  woerter: Fallwort[];
  /** Das Wort, das gerade getippt wird. */
  aktiv: number | null;
  leben: number;
  punkte: number;
  anschlaege: number;
  fehler: number;
  gefangen: number;
  verpasst: number;
  /** Spielzeit in ms — Grundlage für die Steigerung. */
  laufzeit: number;
  naechsteId: number;
};

export const LEBEN_START = 3;

export function starteRegen(): Regen {
  return {
    woerter: [], aktiv: null, leben: LEBEN_START, punkte: 0,
    anschlaege: 0, fehler: 0, gefangen: 0, verpasst: 0,
    laufzeit: 0, naechsteId: 1,
  };
}

export function vorbei(r: Regen): boolean {
  return r.leben <= 0;
}

/** Ein neues Wort oben einsetzen. */
export function spawn(r: Regen, wort: string, spalte: number): Regen {
  if (vorbei(r)) return r;
  return {
    ...r,
    woerter: [...r.woerter, { id: r.naechsteId, wort, getippt: 0, spalte, y: 0 }],
    naechsteId: r.naechsteId + 1,
  };
}

/** Die Zeit weiterdrehen. `tempo` ist der Fallweg pro Sekunde (in 0…1). */
export function schritt(r: Regen, dtMs: number, tempo: number): Regen {
  if (vorbei(r)) return r;

  const bewegt = r.woerter.map(w => ({ ...w, y: w.y + (tempo * dtMs) / 1000 }));
  const unten = bewegt.filter(w => w.y >= 1);
  const oben = bewegt.filter(w => w.y < 1);

  return {
    ...r,
    woerter: oben,
    aktiv: unten.some(w => w.id === r.aktiv) ? null : r.aktiv,
    leben: r.leben - unten.length,
    verpasst: r.verpasst + unten.length,
    laufzeit: r.laufzeit + dtMs,
  };
}

/** Das Wort, auf das der nächste Anschlag geht. */
function ziel(r: Regen, zeichen: string): Fallwort | undefined {
  if (r.aktiv !== null) return r.woerter.find(w => w.id === r.aktiv);
  // Kein Wort begonnen: das dringendste (unterste), das mit diesem Zeichen anfängt.
  return r.woerter
    .filter(w => w.wort[0] === zeichen)
    .sort((a, b) => b.y - a.y)[0];
}

export function tippe(r: Regen, zeichen: string): Regen {
  if (vorbei(r)) return r;

  const treffer = ziel(r, zeichen);
  const anschlaege = r.anschlaege + 1;

  if (!treffer || treffer.wort[treffer.getippt] !== zeichen) {
    return { ...r, anschlaege, fehler: r.fehler + 1 };
  }

  const getippt = treffer.getippt + 1;
  if (getippt >= treffer.wort.length) {
    return {
      ...r,
      anschlaege,
      woerter: r.woerter.filter(w => w.id !== treffer.id),
      aktiv: null,
      punkte: r.punkte + treffer.wort.length,
      gefangen: r.gefangen + 1,
    };
  }

  return {
    ...r,
    anschlaege,
    aktiv: treffer.id,
    woerter: r.woerter.map(w => (w.id === treffer.id ? { ...w, getippt } : w)),
  };
}

/** Das Zeichen, das als nächstes fällig ist — für die Tastaturanzeige. */
export function naechstesZeichen(r: Regen): string | undefined {
  const aktiv = r.aktiv !== null ? r.woerter.find(w => w.id === r.aktiv) : undefined;
  if (aktiv) return aktiv.wort[aktiv.getippt];
  // Noch nichts begonnen: der Anfangsbuchstabe des dringendsten Wortes.
  const dringend = [...r.woerter].sort((a, b) => b.y - a.y)[0];
  return dringend?.wort[0];
}

/** Fallgeschwindigkeit und Nachschub steigen mit der Spielzeit. */
export function stufe(laufzeitMs: number) {
  const minuten = laufzeitMs / 60000;
  return {
    tempo: 0.05 + minuten * 0.05,          // Bahn pro Sekunde
    abstandMs: Math.max(900, 2600 - minuten * 900), // Zeit bis zum nächsten Wort
  };
}
