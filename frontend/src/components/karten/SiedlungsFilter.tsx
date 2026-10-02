"use client";
/**
 * Legende mit Filter für Ebenen, die einen Größenklassen-Filter tragen (Siedlungen).
 * Mehrere Dateien teilen sich die Klassen (de-staedte: ab 5 000 Einw., de-orte: der Rest);
 * ein Haken schaltet die passende Datei zu, der letzte entfernte wieder ab.
 */
import type { Ebene } from "@/lib/karten/stil";
import { erlaubteWerte } from "@/lib/karten/stil";
import type { SatzInhalt } from "@/lib/karten/satz";

export default function SiedlungsFilter({ ebenen, inhalt, setInhalt }: {
  ebenen: Ebene[];
  inhalt: SatzInhalt;
  setInhalt: (f: (v: SatzInhalt) => SatzInhalt) => void;
}) {
  const mitFilter = ebenen.filter((e) => e.filter);
  if (!mitFilter.length) return null;
  const werte = mitFilter[0].filter!.werte;
  const an = (wert: string) => mitFilter.some((e) => inhalt.ebenen.includes(e.id) && erlaubteWerte(e, inhalt.filter).includes(wert));

  const schalte = (wert: string) => setInhalt((v) => {
    const jetzt = an(wert);
    const filter = { ...(v.filter ?? {}) };
    let liste = [...v.ebenen];
    for (const e of mitFilter) {
      if (!e.filter!.vorhanden.includes(wert)) continue;
      const alt = inhalt.ebenen.includes(e.id) ? erlaubteWerte(e, v.filter) : [];
      const neu = jetzt ? alt.filter((w) => w !== wert) : [...new Set([...alt, wert])];
      filter[e.id] = neu;
      // Datei zuschalten, wenn eine ihrer Klassen gewählt ist — sonst wieder weg
      liste = neu.length ? (liste.includes(e.id) ? liste : [...liste, e.id]) : liste.filter((x) => x !== e.id);
    }
    return { ...v, filter, ebenen: liste };
  });

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Siedlungen</h3>
      {werte.map((w) => (
        <label key={w.wert} className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={an(w.wert)} onChange={() => schalte(w.wert)} />
          {w.text}
        </label>
      ))}
      <p className="text-[10px] text-[var(--text-muted)]">Kleine Orte erscheinen erst beim Heranzoomen.</p>
    </div>
  );
}
