"use client";
/**
 * JSON-Vorlage einlesen: Datei wählen oder hineinziehen, KI-Antwort zur Not als
 * Text einfügen (zugeklappt). Gibt den rohen Text nach oben; das Auswerten
 * (antwortLesen, importOps …) macht, wer den Baustein benutzt.
 */
import { useState } from "react";

export function JsonEingabe({ onText }: { onText: (text: string, dateiname: string) => void }) {
  const [datei, setDatei] = useState("");
  const [eingefuegt, setEingefuegt] = useState("");
  const [drueber, setDrueber] = useState(false);

  const lesen = async (f: File | undefined) => {
    if (!f) return;
    setDatei(f.name);
    setEingefuegt("");
    onText(await f.text(), f.name);
  };

  return (
    <div>
      <label
        onDragOver={e => { e.preventDefault(); setDrueber(true); }}
        onDragLeave={() => setDrueber(false)}
        onDrop={e => { e.preventDefault(); setDrueber(false); lesen(e.dataTransfer.files[0]); }}
        className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-5 cursor-pointer text-sm text-center ${
          drueber ? "border-accent bg-accent/10" : "border-line hover:bg-surface-hover"}`}>
        <input type="file" accept=".json,application/json" className="hidden" onChange={e => { lesen(e.target.files?.[0]); e.target.value = ""; }} />
        <span className="text-2xl" aria-hidden>📄</span>
        {datei
          ? <span><b>{datei}</b><br /><span className="text-muted">andere Datei wählen oder hierher ziehen</span></span>
          : <span><b>JSON-Datei wählen</b><br /><span className="text-muted">oder hierher ziehen</span></span>}
      </label>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted">KI-Antwort als Text einfügen</summary>
        <textarea className="input font-mono text-[11px] h-40 mt-2" value={eingefuegt} placeholder="{ … } oder ```json … ```"
          onChange={e => { setDatei(""); setEingefuegt(e.target.value); onText(e.target.value, ""); }} />
      </details>
    </div>
  );
}
