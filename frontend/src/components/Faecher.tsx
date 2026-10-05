"use client";
/**
 * Fächer an Werkzeugkarten: Schilder, Filterleiste und (für Admins) Bearbeiten.
 */
import { useState } from "react";
import { FAECHER, fachFarbe } from "@/lib/faecher";

export function FachSchild({ name, aktiv, onClick, onEntfernen }: {
  name: string;
  aktiv?: boolean;
  onClick?: () => void;
  onEntfernen?: () => void;
}) {
  const farbe = fachFarbe(name);
  return (
    <span
      onClick={onClick ? e => { e.preventDefault(); e.stopPropagation(); onClick(); } : undefined}
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${onClick ? "cursor-pointer" : ""}`}
      style={{
        borderColor: farbe,
        color: aktiv ? "#fff" : farbe,
        background: aktiv ? farbe : "transparent",
      }}
      title={onClick ? `Nur ${name} zeigen` : undefined}
    >
      {name}
      {onEntfernen && (
        <button type="button" aria-label={`${name} entfernen`}
          onClick={e => { e.preventDefault(); e.stopPropagation(); onEntfernen(); }}
          className="ml-0.5 leading-none opacity-70 hover:opacity-100">×</button>
      )}
    </span>
  );
}

/** Filterleiste: mehrere Fächer wählbar (oder-verknüpft), »Alle« setzt zurück. */
export function FachFilter({ faecher, gewaehlt, setzen }: {
  faecher: string[];
  gewaehlt: string[];
  setzen: (f: string[]) => void;
}) {
  if (faecher.length === 0) return null;
  const an = (f: string) => gewaehlt.some(g => g.toLowerCase() === f.toLowerCase());
  const umschalten = (f: string) => setzen(an(f) ? gewaehlt.filter(g => g.toLowerCase() !== f.toLowerCase()) : [...gewaehlt, f]);
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Nach Fach filtern">
      <button type="button" onClick={() => setzen([])}
        className={`text-xs font-bold px-2.5 py-1 rounded-full border ${gewaehlt.length === 0
          ? "bg-accent text-accent-fg border-transparent"
          : "border-line text-muted hover:text-fg"}`}>
        Alle Fächer
      </button>
      {faecher.map(f => <FachSchild key={f} name={f} aktiv={an(f)} onClick={() => umschalten(f)} />)}
    </div>
  );
}

/** Bearbeiten an einer Karte: Schilder mit ×, Feld zum Hinzufügen, zurück zur Voreinstellung. */
export function FachEditor({ faecher, vonHand, vorschlaege, speichern, zuruecksetzen, beschaeftigt }: {
  faecher: string[];
  vonHand: boolean;
  vorschlaege: string[];
  speichern: (f: string[]) => void;
  zuruecksetzen: () => void;
  beschaeftigt?: boolean;
}) {
  const [neu, setNeu] = useState("");
  const listenId = `faecher-vorschlaege`;
  function hinzu() {
    const f = neu.trim().replace(/\s+/g, " ");
    if (!f) return;
    if (!faecher.some(x => x.toLowerCase() === f.toLowerCase())) speichern([...faecher, f]);
    setNeu("");
  }
  const angebot = [...new Set([...FAECHER.map(f => f.name), ...vorschlaege])]
    .filter(v => !faecher.some(f => f.toLowerCase() === v.toLowerCase()));
  return (
    <div className="flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
      <div className="flex flex-wrap gap-1">
        {faecher.length === 0 && <span className="text-xs text-muted">kein Fach</span>}
        {faecher.map(f => (
          <FachSchild key={f} name={f} onEntfernen={() => speichern(faecher.filter(x => x !== f))} />
        ))}
      </div>
      <div className="flex gap-1">
        <input value={neu} onChange={e => setNeu(e.target.value)} list={listenId} maxLength={30}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); hinzu(); } }}
          placeholder="Fach hinzufügen …" aria-label="Fach hinzufügen"
          className="flex-1 min-w-0 text-xs px-2 py-1 rounded-lg border border-line bg-page" />
        <button type="button" onClick={hinzu} disabled={beschaeftigt || !neu.trim()}
          className="btn-primary text-xs px-2 py-1">+</button>
        {vonHand && (
          <button type="button" onClick={zuruecksetzen} disabled={beschaeftigt} title="Zurück zur Voreinstellung"
            className="text-xs px-2 py-1 rounded-lg border border-line disabled:opacity-40">↺</button>
        )}
      </div>
      <datalist id={listenId}>
        {angebot.map(v => <option key={v} value={v} />)}
      </datalist>
    </div>
  );
}
