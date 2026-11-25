"use client";
/**
 * »📊 Auswertung« für Host-Seiten von Aktivitäten mit eigenen Tabellen
 * (TaskCrawler, Lückentext): öffnet die gemeinsame Auswertung als Schublade —
 * jederzeit, auch mitten im Spiel. Die Daten kommen aus der `quelle` (Adapter).
 */
import { useState } from "react";
import type { SitzungQuelle } from "@/lib/sitzung/typen";
import { Schublade } from "./Schublade";
import SitzungAuswertung from "./SitzungAuswertung";

export function AuswertungKnopf({ titel, quelle, className }: { titel: string; quelle: SitzungQuelle; className?: string }) {
  const [offen, setOffen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOffen(true)}
        className={className ?? "text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent"}>
        📊 Auswertung
      </button>
      {offen && (
        <Schublade titel={`📊 ${titel}`} onClose={() => setOffen(false)}>
          <SitzungAuswertung quelle={quelle} titel={titel} />
        </Schublade>
      )}
    </>
  );
}
