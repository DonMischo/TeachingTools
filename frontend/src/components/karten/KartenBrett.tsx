"use client";
/**
 * Eingebettete Kartenfrage für Caputh und TaskCrawler: Antworten werden hier nur
 * gesammelt ({antworten: {nr: Name | Token}}) und vom Spiel als Ganzes abgeschickt.
 * Mit `loesung` zeigt das Brett die Auflösung (Namen; »finden«: richtige Objekte rot umrandet).
 */
import { useMemo, useState } from "react";
import { quizStil, type KartenAntwort, type KartenBrettDaten, type KartenLoesung } from "@/lib/karten/quiz";
import KartenAnsicht, { type Treffer } from "./KartenAnsicht";

export function kartenAntwortVollstaendig(brett: KartenBrettDaten, antwort: KartenAntwort): boolean {
  return brett.spiel.aufgaben.every((a) => (antwort.antworten[String(a.nr)] ?? "").trim());
}

export default function KartenBrett({ brett, antwort, onChange, disabled, loesung }: {
  brett: KartenBrettDaten;
  antwort: KartenAntwort;
  onChange?: (a: KartenAntwort) => void;
  disabled?: boolean;
  loesung?: KartenLoesung | null;
}) {
  const aufgaben = brett.spiel.aufgaben;
  const [aktuell, setAktuell] = useState(0);
  const finden = brett.spiel.modus === "finden";
  const setze = (nr: number, wert: string) => onChange?.({ antworten: { ...antwort.antworten, [String(nr)]: wert } });

  // Auflösung: richtige Objekte rot umranden
  const hervor = useMemo(() => {
    const je: Record<string, string[]> = {};
    for (const l of Object.values(loesung ?? {})) (je[l.ebene] ??= []).push(l.token);
    return je;
  }, [loesung]);
  const stil = useMemo(() => quizStil(`/api/karten/quiz/brett/${brett.brett}`, brett, { antworten: {}, richtig: 0, erfolge: [] }, hervor),
    [brett, hervor]);

  const offen = aufgaben.filter((a) => !antwort.antworten[String(a.nr)]);
  const jetzt = finden ? (aufgaben.find((a) => a.nr === aktuell) ?? offen[0]) : undefined;
  const klick = (treffer: Treffer[]) => {
    if (disabled || !jetzt) return;
    const t = treffer.find((x) => x.ebene === jetzt.ebene);
    if (!t) return;
    setze(jetzt.nr, t.id);
    const naechste = aufgaben.find((a) => a.nr !== jetzt.nr && !antwort.antworten[String(a.nr)]);
    setAktuell(naechste?.nr ?? 0);
  };

  const istRichtig = (nr: number) => {
    const l = loesung?.[String(nr)];
    if (!l) return null;
    return finden ? antwort.antworten[String(nr)] === l.token : null; // benennen: tolerant, das entscheidet der Server
  };

  return (
    <div className="flex flex-col gap-3">
      <KartenAnsicht stil={stil} katalog={{ stand: "", ebenen: brett.katalog }} namenZeigen={false} onKlick={klick}
        projektion={brett.karte.projektion ?? "equalearth"}
        ziel={brett.karte.ausschnitt} />
      {finden && jetzt && !disabled && !loesung && (
        <p className="text-lg font-black">Finde: {jetzt.name} <span className="text-xs font-normal opacity-70">({jetzt.kategorie}) — auf der Karte antippen</span></p>
      )}
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-1.5 text-sm">
        {aufgaben.map((a) => {
          const wert = antwort.antworten[String(a.nr)] ?? "";
          const l = loesung?.[String(a.nr)];
          const ok = istRichtig(a.nr);
          return (
            <li key={a.nr} className="flex items-center gap-2">
              <span className="w-8 text-right font-black text-[var(--red)]">{finden ? "•" : a.marke}</span>
              {finden ? (
                <button disabled={disabled || !!loesung} onClick={() => setAktuell(a.nr)}
                  className={`flex-1 text-left px-2 py-1 rounded-lg border ${jetzt?.nr === a.nr ? "border-[var(--accent)]" : "border-[var(--border)]"}`}>
                  {a.name} {wert ? (ok === null ? "✓ gesetzt" : ok ? "✅" : "❌") : ""}
                </button>
              ) : brett.spiel.wortbank ? (
                <select value={wert} disabled={disabled} aria-label={`Name für ${a.marke}`} onChange={(e) => setze(a.nr, e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]">
                  <option value="">— wählen —</option>
                  {brett.spiel.wortbank.map((w) => <option key={w}>{w}</option>)}
                </select>
              ) : (
                <input value={wert} disabled={disabled} placeholder={a.kategorie} aria-label={`Name für ${a.marke}`}
                  onChange={(e) => setze(a.nr, e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]" />
              )}
              {l && !finden && <span className="text-xs font-bold">→ {l.name}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
