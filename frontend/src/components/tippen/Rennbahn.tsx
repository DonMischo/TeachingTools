"use client";
/**
 * Die Rennbahn: ein Balken je Mitschreiber, laufend aktualisiert.
 *
 * Host und Spieler sehen dasselbe Bild — der Spieler zusätzlich seinen eigenen
 * Balken hervorgehoben, damit er sich im Feld wiederfindet.
 */
export type Laeufer = {
  id: number;
  name: string;
  pos: number;
  anschlaege: number;
  fehler: number;
  dauer_ms: number | null;
};

function tempo(l: Laeufer): number | null {
  if (l.dauer_ms === null || l.dauer_ms <= 0) return null;
  return Math.round(l.pos / (l.dauer_ms / 60000));
}

export function Rennbahn({
  laeufer,
  laenge,
  ich,
}: {
  laeufer: Laeufer[];
  /** Zeichenzahl des Textes — das Ziel. */
  laenge: number;
  /** Eigene Teilnehmernummer, falls man selbst mitschreibt. */
  ich?: number | null;
}) {
  if (laeufer.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)] text-center py-6">
        Noch niemand da. Der Code oben führt hierher.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {laeufer.map((l, i) => {
        const anteil = laenge === 0 ? 0 : Math.min(1, l.pos / laenge);
        const fertig = l.dauer_ms !== null;
        const selbst = ich != null && l.id === ich;
        return (
          <li key={l.id} data-laeufer={l.id} className="flex items-center gap-3">
            <span className="w-6 text-sm tabular-nums text-[var(--text-muted)] text-right">
              {fertig ? `${i + 1}.` : ""}
            </span>
            <span className={"w-28 sm:w-36 truncate text-sm " + (selbst ? "font-black text-[var(--accent)]" : "")}>
              {l.name}
            </span>
            <div className="flex-1 h-4 rounded-full bg-[var(--border)] overflow-hidden relative">
              <div
                className="h-full transition-[width] duration-200"
                style={{
                  width: `${anteil * 100}%`,
                  background: fertig ? "var(--green)" : selbst ? "var(--accent)" : "var(--text-muted)",
                }}
              />
            </div>
            <span className="w-24 text-xs tabular-nums text-right text-[var(--text-muted)]">
              {fertig ? `${tempo(l)} A/min` : `${Math.round(anteil * 100)} %`}
            </span>
            <span
              className="w-10 text-xs tabular-nums text-right"
              style={{ color: l.fehler > 0 ? "var(--red)" : "var(--text-muted)" }}
              title="Fehler"
            >
              {l.fehler > 0 ? `${l.fehler}✗` : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
