/**
 * Was im Flug erforscht und gelöst wurde. Lebt nur im Browser (localStorage):
 * die Aufträge sind zum Üben da, nicht für Hauspunkte. Gespeichert wird je
 * Gerät und — über `schluessel` — je Sitzungscode oder Konto.
 */
export interface Fortschritt {
  erforscht: string[];
  erledigt: string[];
}

const LEER: Fortschritt = { erforscht: [], erledigt: [] };

const name = (schluessel: string) => `sonnensystem-forschung-v1:${schluessel}`;

export function ladeFortschritt(schluessel: string): Fortschritt {
  try {
    const roh = localStorage.getItem(name(schluessel));
    if (!roh) return LEER;
    const f = JSON.parse(roh) as Partial<Fortschritt>;
    return {
      erforscht: Array.isArray(f.erforscht) ? f.erforscht : [],
      erledigt: Array.isArray(f.erledigt) ? f.erledigt : [],
    };
  } catch {
    return LEER;
  }
}

export function speichereFortschritt(schluessel: string, f: Fortschritt) {
  try {
    localStorage.setItem(name(schluessel), JSON.stringify(f));
  } catch { /* privater Modus: dann eben nur für diese Sitzung */ }
}
