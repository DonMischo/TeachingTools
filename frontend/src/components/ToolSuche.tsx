"use client";

/**
 * Suchfeld über den Kachelseiten (Aktivitäten, Simulationen, Tools).
 *
 * Die Listen sind lang geworden; wer weiß, was er sucht, soll nicht scrollen
 * müssen. Gesucht wird in Titel **und** Beschreibung: »bruch« findet auch, was
 * nur in der Beschreibung von Brüchen spricht.
 */

/**
 * Passt die Kachel zur Suche?
 *
 * Mehrere Wörter müssen alle vorkommen, dürfen aber verteilt sein — »rechnen
 * klasse 5« findet auch, was die beiden Angaben an verschiedenen Stellen hat.
 * Gross- und Kleinschreibung spielt keine Rolle.
 */
export function passtZurSuche(karte: { title: string; description: string }, suche: string): boolean {
  const woerter = suche.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (woerter.length === 0) return true;
  const heuhaufen = `${karte.title} ${karte.description}`.toLowerCase();
  return woerter.every((wort) => heuhaufen.includes(wort));
}

export function ToolSuche({ wert, setzen, treffer, gesamt }: {
  wert: string;
  setzen: (w: string) => void;
  /** Wie viele Kacheln nach dem Filtern übrig sind. */
  treffer: number;
  /** Wie viele es ohne Suche wären. */
  gesamt: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden>🔍</span>
        <input
          type="search"
          value={wert}
          onChange={(e) => setzen(e.target.value)}
          placeholder="Suchen …"
          aria-label="Suchen"
          // `.input` bringt ein eigenes px-3 mit und schlaegt die Tailwind-Klasse;
          // der Platz fuer die Lupe muss deshalb inline gesetzt werden.
          style={{ paddingLeft: "2.25rem" }}
          className="input w-full"
        />
      </div>
      {wert.trim() !== "" && (
        <p className="text-xs text-[var(--text-muted)]" aria-live="polite">
          {treffer === 0 ? "Nichts gefunden" : `${treffer} von ${gesamt}`}
        </p>
      )}
    </div>
  );
}
