"use client";
/**
 * Für die Lehrkraft: die aktuelle Schaltung (und einen Arbeitsauftrag) an die
 * Sitzung hängen. Wer per Code oder QR beitritt, bekommt sie als Startpunkt
 * und arbeitet an einer eigenen Kopie weiter.
 */
import { useState } from "react";
import { AUFGABE_MAX, type Vorgabe } from "@/lib/stromkreis/datei";

/** Fehlertext aus der API: {"detail": "…"} oder roher Text. */
export function fehlertext(e: unknown): string {
  const roh = e instanceof Error ? e.message : String(e);
  try {
    const d = JSON.parse(roh)?.detail;
    if (typeof d === "string") return d;
  } catch { /* kein JSON */ }
  return roh || "Unbekannter Fehler";
}

interface Props {
  vorgabe: Vorgabe | null;
  festlegen: (aufgabe: string) => Promise<void>;
  entfernen: () => Promise<void>;
  laden: () => void;
}

export default function KlassenVorgabe({ vorgabe, festlegen, entfernen, laden }: Props) {
  const [aufgabe, setAufgabe] = useState(vorgabe?.aufgabe ?? "");
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  const tu = async (f: () => Promise<void>, erfolg: string) => {
    setLaeuft(true); setMeldung(null);
    try { await f(); setMeldung({ ok: true, text: erfolg }); }
    catch (e) { setMeldung({ ok: false, text: fehlertext(e) }); }
    finally { setLaeuft(false); }
  };

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="font-bold">👩‍🏫 Für die Klasse</div>
      <p className="text-sm text-muted">
        {vorgabe
          ? `Wer über den Code beitritt, beginnt mit Ihrer Schaltung (${vorgabe.schaltung.bauteile.length} Bauteile) und baut an einer eigenen Kopie weiter.`
          : "Noch keine Vorgabe: Wer beitritt, beginnt mit dem einfachen Stromkreis."}
      </p>
      <label className="flex flex-col gap-1">
        <span className="label">Arbeitsauftrag (optional)</span>
        <textarea
          className="input min-h-20" maxLength={AUFGABE_MAX} value={aufgabe}
          onChange={e => setAufgabe(e.target.value)}
          placeholder="z. B. Baue die Schaltung so um, dass beide Lämpchen unabhängig voneinander schaltbar sind."
        />
      </label>
      <button className="btn btn-primary" disabled={laeuft} onClick={() => tu(() => festlegen(aufgabe), "Die Klasse bekommt jetzt diese Schaltung.")}>
        Diese Schaltung an die Klasse geben
      </button>
      {vorgabe && (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary flex-1" disabled={laeuft} onClick={laden}>Vorgabe in den Editor laden</button>
          <button className="btn btn-danger flex-1" disabled={laeuft} onClick={() => tu(entfernen, "Vorgabe entfernt.")}>Vorgabe entfernen</button>
        </div>
      )}
      {meldung && <div className={`text-sm ${meldung.ok ? "text-ok" : "text-bad"}`}>{meldung.text}</div>}
    </div>
  );
}
