/**
 * Sterne und Punkte der Algorithmen-Werkstatt.
 *
 * Code-Abenteuer (Wunsch: Fehlversuche, Bausteine, kleiner Zeitanteil), höchstens 1000:
 *   Bausteine    500 · min(1, Bestzahl / gebraucht)
 *   Fehlversuche 400 − 100 je Fehlversuch (nicht unter 0)
 *   Zeit         100 voll bis zur Richtzeit, linear auf 0 bei dreifacher Richtzeit
 * Automat und Flussdiagramm: 500 fürs Lösen statt der Bausteine, Rest gleich.
 * Hilfsmodus verdoppelt die Richtzeit; wer sich die Lösung vorführen ließ,
 * bekommt die Hälfte der Punkte und höchstens einen Stern.
 */
export interface Wertung { sterne: 1 | 2 | 3; punkte: number }

export interface Messung {
  fehlversuche: number;
  sekunden: number;
  richtzeit: number;
  hilfsmodus?: boolean;
  vorgefuehrt?: boolean;
}

export function zeitPunkte(sekunden: number, richtzeit: number, hilfsmodus = false): number {
  const r = richtzeit * (hilfsmodus ? 2 : 1);
  if (sekunden <= r) return 100;
  return Math.max(0, Math.round(100 * (1 - (sekunden - r) / (2 * r))));
}

function abschluss(punkte: number, sterne: 1 | 2 | 3, m: Messung): Wertung {
  return m.vorgefuehrt ? { sterne: 1, punkte: Math.round(punkte / 2) } : { sterne, punkte };
}

export function levelWertung(m: Messung & { bloecke: number; optimal: number }): Wertung {
  const bau = Math.round(500 * Math.min(1, m.optimal / Math.max(1, m.bloecke)));
  const versuche = Math.max(0, 400 - 100 * m.fehlversuche);
  const punkte = bau + versuche + zeitPunkte(m.sekunden, m.richtzeit, m.hilfsmodus);
  const sterne: 1 | 2 | 3 =
    m.bloecke <= m.optimal && m.fehlversuche <= 1 ? 3
      : m.bloecke <= m.optimal + 2 && m.fehlversuche <= 3 ? 2 : 1;
  return abschluss(punkte, sterne, m);
}

export function aufgabenWertung(m: Messung): Wertung {
  const punkte = 500 + Math.max(0, 400 - 100 * m.fehlversuche) + zeitPunkte(m.sekunden, m.richtzeit, m.hilfsmodus);
  const sterne: 1 | 2 | 3 = m.fehlversuche === 0 ? 3 : m.fehlversuche <= 2 ? 2 : 1;
  return abschluss(punkte, sterne, m);
}

/** Richtzeit eines Levels in Sekunden — grob nach Art und Länge. */
export function richtzeitLevel(art: "direkt" | "vorhersage" | "programm", optimal: number): number {
  if (art === "direkt") return 15 + optimal * 3;
  if (art === "vorhersage") return 45;
  return 30 + optimal * 10;
}
