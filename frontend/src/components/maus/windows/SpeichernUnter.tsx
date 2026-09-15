"use client";
/**
 * Der Dialog »Speichern unter« wie in Windows 11: Ordner wählen, Dateinamen
 * eintippen, »Speichern«. Gespeichert werden darf nur im eigenen
 * Benutzerordner; in Systemordnern erklärt der Dialog, warum nicht.
 */
import { useState } from "react";
import { ExplorerInhalt } from "./ExplorerInhalt";
import { darfSpeichern, mitEndung, namensFehler, type Dateisystem } from "@/lib/maus/dateisystem";

export function SpeichernUnter({
  fs, startOrdner = "dokumente", vorschlag = "Unbenannt", endung = ".txt", dateityp = "Textdokument (*.txt)",
  onSpeichern, onAbbrechen, onFehler, dunkel = false, hilfe = false,
}: {
  fs: Dateisystem;
  startOrdner?: string;
  vorschlag?: string;
  endung?: string;
  dateityp?: string;
  onSpeichern: (ordnerId: string, dateiname: string) => void;
  onAbbrechen: () => void;
  /** Aufgerufen, wenn »Speichern« abgelehnt wird (verbotener Ordner oder ungültiger/doppelter Name). */
  onFehler?: (grund: string) => void;
  dunkel?: boolean;
  hilfe?: boolean;
}) {
  const [ordner, setOrdner] = useState(startOrdner);
  const [name, setName] = useState(vorschlag);
  const [markiert, setMarkiert] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  function speichern() {
    if (!darfSpeichern(fs, ordner)) {
      const grund = "Hier kannst du nicht speichern. Wähle einen deiner eigenen Ordner, zum Beispiel »Dokumente«.";
      setFehler(grund);
      onFehler?.(grund);
      return;
    }
    const endname = mitEndung(name, endung);
    const problem = namensFehler(fs, ordner, endname);
    if (problem) { setFehler(problem); onFehler?.(problem); return; }
    setFehler(null);
    onSpeichern(ordner, endname);
  }

  const farben = dunkel
    ? { grund: "#202020", leiste: "#2b2b2b", text: "#ffffff", linie: "#ffffff1f", feld: "#2b2b2b" }
    : { grund: "#f3f3f3", leiste: "#ffffff", text: "#1a1a1a", linie: "#0000001a", feld: "#ffffff" };

  return (
    <div
      role="dialog"
      aria-label="Speichern unter"
      className="flex flex-col rounded-lg overflow-hidden shadow-2xl border"
      style={{ background: farben.grund, color: farben.text, borderColor: farben.linie, fontFamily: '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif' }}
      data-testid="speichern-unter"
    >
      <div className="flex items-center justify-between px-3 h-9 shrink-0" style={{ background: farben.leiste, borderBottom: `1px solid ${farben.linie}` }}>
        <span className="text-sm">Speichern unter</span>
        <button type="button" aria-label="Schließen" onClick={onAbbrechen} className="w-9 h-9 -mr-3 hover:bg-[#e81123] hover:text-white">✕</button>
      </div>

      <div className="flex-1 min-h-0" style={{ height: hilfe ? 300 : 260 }}>
        <ExplorerInhalt
          fs={fs}
          ordner={ordner}
          onOrdner={id => { setOrdner(id); setMarkiert(null); setFehler(null); }}
          markiert={markiert}
          onMarkieren={k => {
            setMarkiert(k?.id ?? null);
            // Wie in Windows: ein angeklickter Dateiname landet im Namensfeld.
            if (k?.art === "datei") setName(k.name.replace(/\.[^.]+$/, ""));
          }}
          onOeffnen={k => setName(k.name.replace(/\.[^.]+$/, ""))}
          dunkel={dunkel}
          hilfe={hilfe}
        />
      </div>

      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-4 py-3 text-sm" style={{ borderTop: `1px solid ${farben.linie}` }}>
        <label htmlFor="speichern-dateiname">Dateiname:</label>
        <input
          id="speichern-dateiname"
          data-testid="dateiname"
          value={name}
          onChange={e => { setName(e.target.value); setFehler(null); }}
          onFocus={e => e.currentTarget.select()}
          onKeyDown={e => { if (e.key === "Enter") speichern(); if (e.key === "Escape") onAbbrechen(); }}
          className="rounded px-2 py-1 border outline-none focus:border-[#0078d7]"
          style={{ background: farben.feld, color: farben.text, borderColor: farben.linie, fontSize: hilfe ? 16 : undefined }}
        />
        <span>Dateityp:</span>
        <select disabled className="rounded px-2 py-1 border opacity-80" style={{ background: farben.feld, color: farben.text, borderColor: farben.linie }}>
          <option>{dateityp}</option>
        </select>
      </div>

      {fehler && (
        <p role="alert" className="mx-4 -mt-1 mb-2 text-sm text-[#c42b1c]" data-testid="speichern-fehler">{fehler}</p>
      )}

      <div className="flex justify-end gap-2 px-4 pb-3">
        <button type="button" onClick={speichern} data-testid="speichern-knopf" className="rounded px-5 py-1.5 bg-[#0078d7] text-white font-semibold hover:bg-[#006cc1]">
          Speichern
        </button>
        <button type="button" onClick={onAbbrechen} className="rounded px-5 py-1.5 border" style={{ borderColor: farben.linie, background: farben.feld }}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
