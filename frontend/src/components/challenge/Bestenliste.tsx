"use client";
/** Bestenliste der Edelsteine (Top 20 der Sitzung); die eigene Zeile ist hervorgehoben. */
import { useEffect, useState } from "react";
import type { ChallengeBestenlisteZeile } from "@/lib/api";

export default function Bestenliste({ laden, spiel = "huepfen" }: { laden: (spiel: string) => Promise<ChallengeBestenlisteZeile[]>; spiel?: string }) {
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
