"use client";
/** Bestenliste der Edelsteine (Top 20 der Sitzung); die eigene Zeile ist hervorgehoben. */
import { useEffect, useState } from "react";
import type { ChallengeBestenlisteZeile } from "@/lib/api";
import type { ChallengeLauf } from "@/lib/challenge/useChallengeLauf";

export default function Bestenliste({ laden, spiel }: { laden: (spiel: string) => Promise<ChallengeBestenlisteZeile[]>; spiel: string }) {
  const [zeilen, setZeilen] = useState<ChallengeBestenlisteZeile[] | null>(null);
  useEffect(() => {
    let aktiv = true;
    laden(spiel).then((z) => { if (aktiv) setZeilen(z); });
    return () => { aktiv = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spiel]);

  if (!zeilen) return <p className="text-muted">Lade…</p>;
  if (!zeilen.length) return <p className="text-muted">Noch keine Edelsteine gesammelt.</p>;
  return (
    <table className="w-full" aria-label="Bestenliste">
      <thead>
        <tr className="text-left text-xs text-muted"><th>Platz</th><th>Name</th><th>💎</th></tr>
      </thead>
      <tbody>
        {zeilen.map((z) => (
          <tr key={z.platz} className={`border-t border-line ${z.ich ? "font-black bg-surface-hover" : ""}`} aria-current={z.ich ? "true" : undefined}>
            <td>{z.platz}</td><td>{z.name}{z.ich ? " (du)" : ""}</td><td>{z.edelsteine}/{z.max}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Knopf »🏆 Bestenliste« mit aufklappbarem Panel darunter; ohne Bestenliste in der Quelle (Boss-Folie) erscheint nichts. */
export function BestenlisteKnopf({ lauf, spiel, hinweis, rechts, onWechsel }: {
  lauf: Pick<ChallengeLauf, "hatBestenliste" | "bestenliste">; spiel: string;
  /** Zeile über der Liste, z. B. woher die Zahlen stammen. */
  hinweis?: string;
  /** Das Panel schließt rechts mit dem Knopf ab (Knopf steht am rechten Rand). */
  rechts?: boolean;
  /** Meldet das Auf- und Zuklappen (Hüpfen hält dabei die Spielschleife an). */
  onWechsel?(offen: boolean): void;
}) {
  const [offen, setOffen] = useState(false);
  if (!lauf.hatBestenliste) return null;
  return (
    <span className="relative inline-block">
      <button className="btn-secondary" aria-expanded={offen} onClick={() => { setOffen(!offen); onWechsel?.(!offen); }}>🏆 Bestenliste</button>
      {offen && (
        <div className={`card p-3 text-left absolute z-20 mt-1 top-full shadow-lg w-[min(92vw,26rem)] max-h-[70vh] overflow-auto ${rechts ? "right-0" : "left-0"}`}
          role="dialog" aria-label="Bestenliste">
          {hinweis && <p className="text-muted text-sm">{hinweis}</p>}
          <Bestenliste laden={lauf.bestenliste} spiel={spiel} />
        </div>
      )}
    </span>
  );
}
