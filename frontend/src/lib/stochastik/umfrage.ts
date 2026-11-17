/**
 * Eigene Erhebungen und TT-Umfragen als Datensätze.
 *
 * Eine Umfrage kommt auf zwei Wegen herein:
 *   public-results  freigegebene Ergebnisse, für alle lesbar (Verteilungen,
 *                   Schlüssel = Index der Antwort bzw. Zahlwert)
 *   export          nur für die Lehrkraft der Umfrage (Schlüssel = Antworttext)
 * Freitextfragen werden in beiden Fällen übergangen – Freitext sieht nur die
 * Lehrkraft in der Umfrage selbst, nicht die Klasse in der Sim.
 */
import { urlisteAus, type Zeile } from "./kenngroessen";

export interface Datensatz {
  titel: string;
  /** Kategorien (Säulen, Kreis …) oder Zahlen (Kenngrößen, Boxplot). */
  art: "kategorie" | "zahl";
  zeilen: Zeile[];
  /** Bei Zahldaten die geordnete Urliste. */
  zahlen?: number[];
  einheit?: string;
  /** Bei Mehrfachauswahl: Zahl der Antwortenden (die Summe der Zeilen ist größer). */
  personen?: number;
  hinweis?: string;
}

type Frage = {
  kind: string; text: string; options?: string[] | null;
  scale_min?: number | null; scale_max?: number | null;
  distribution?: Record<string, number>; answers?: unknown[]; count?: number; unit?: string | null;
};

const zahlZeilen = (zahlen: number[]): Zeile[] => {
  const z = new Map<number, number>();
  for (const x of zahlen) z.set(x, (z.get(x) ?? 0) + 1);
  return [...z].sort((a, b) => a[0] - b[0]).map(([x, n]) => ({ wert: String(x).replace(".", ","), anzahl: n }));
};

/** Wandelt eine Umfrage (public-results oder export) in Datensätze um. */
export function ausUmfrage(roh: { format?: string; questions?: Frage[] }): Datensatz[] {
  const export_ = roh.format === "hauspokal-umfrage-ergebnisse";
  const aus: Datensatz[] = [];
  for (const q of roh.questions ?? []) {
    const d = q.distribution ?? {};
    const opts = q.options ?? [];
    if (q.kind === "text") continue;
    if (q.kind === "number") {
      const zahlen = export_
        ? (q.answers ?? []).filter((x): x is number => typeof x === "number").sort((a, b) => a - b)
        : urlisteAus(d);
      aus.push({ titel: q.text, art: "zahl", zahlen, zeilen: zahlZeilen(zahlen), einheit: q.unit ?? undefined });
    } else if (q.kind === "scale") {
      const zahlen = urlisteAus(d);
      const zeilen: Zeile[] = [];
      for (let v = q.scale_min ?? 1; v <= (q.scale_max ?? 5); v++) zeilen.push({ wert: String(v), anzahl: d[String(v)] ?? 0 });
      aus.push({ titel: q.text, art: "zahl", zahlen, zeilen });
    } else if (q.kind === "choice" || q.kind === "multi") {
      const zeilen = opts.map((o, i) => ({ wert: o, anzahl: (export_ ? d[o] : d[String(i)]) ?? 0 }));
      aus.push({
        titel: q.text, art: "kategorie", zeilen,
        ...(q.kind === "multi" ? { personen: q.count, hinweis: "Mehrfachauswahl: Eine Person kann mehrere Antworten geben – die Anzahlen ergeben zusammen mehr als die Zahl der Personen." } : {}),
      });
    }
  }
  return aus;
}

/** Eine selbst geplante Erhebung (Frage + Antwortoptionen + Strichliste). */
export interface Erhebung { frage: string; optionen: string[]; striche: number[]; zahlen: boolean }

export function ausErhebung(e: Erhebung): Datensatz {
  if (e.zahlen) {
    const zahlen: number[] = [];
    e.optionen.forEach((o, i) => {
      const x = Number(o.replace(",", "."));
      if (Number.isFinite(x)) for (let k = 0; k < (e.striche[i] ?? 0); k++) zahlen.push(x);
    });
    zahlen.sort((a, b) => a - b);
    return { titel: e.frage, art: "zahl", zahlen, zeilen: e.optionen.map((o, i) => ({ wert: o, anzahl: e.striche[i] ?? 0 })) };
  }
  return { titel: e.frage, art: "kategorie", zeilen: e.optionen.map((o, i) => ({ wert: o, anzahl: e.striche[i] ?? 0 })) };
}

/** Lassen sich alle Antwortoptionen als Zahl lesen? Dann gibt es Kenngrößen. */
export const alleZahlen = (optionen: string[]) =>
  optionen.length > 0 && optionen.every(o => o.trim() !== "" && Number.isFinite(Number(o.replace(",", "."))));
