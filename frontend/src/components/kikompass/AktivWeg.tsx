"use client";
/**
 * Der AKTIV(ER)-Weg der Lehrkraft: je Phase Ziel, Schulebene, Checkliste
 * (im Browser gemerkt), Vorlagen als Word und der Sprung zum passenden Werkzeug.
 */
import { useEffect, useState } from "react";
import { PHASEN, VORLAGEN, type Phase, type PhaseId } from "@/lib/kikompass/aktiv";
import { baueDocx, herunterladen } from "@/lib/docx";

export type Sprungziel = NonNullable<Phase["werkzeug"]>["ziel"];

export function AktivWeg({ speicherSchluessel, onSprung }: {
  speicherSchluessel: string;
  onSprung: (ziel: Sprungziel) => void;
}) {
  const schluessel = `hp_kikompass_aktiv_${speicherSchluessel}`;
  const [haken, setHaken] = useState<Record<string, boolean>>({});
  const [geladenFuer, setGeladenFuer] = useState<string | null>(null);
  const [offen, setOffen] = useState<PhaseId>("analyse");

  useEffect(() => {
    try { setHaken(JSON.parse(localStorage.getItem(schluessel) ?? "{}") ?? {}); } catch { setHaken({}); }
    setGeladenFuer(schluessel);
  }, [schluessel]);
  useEffect(() => {
    if (geladenFuer !== schluessel) return;
    try { localStorage.setItem(schluessel, JSON.stringify(haken)); } catch { /* privat */ }
  }, [haken, geladenFuer, schluessel]);

  const fortschritt = (p: Phase) => p.checkliste.filter((_, i) => haken[`${p.id}-${i}`]).length;
  const phase = PHASEN.find(p => p.id === offen)!;

  async function vorlage(id: keyof typeof VORLAGEN) {
    herunterladen(await baueDocx(VORLAGEN[id].bloecke()), `${VORLAGEN[id].titel.replace(/[^\wäöüÄÖÜß-]+/g, "_")}.docx`);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted max-w-3xl">
        Dein eigener Weg in acht Schritten, gegliedert nach dem AKTIV(ER)-Framework von Manuel Flick
        (<a className="underline" href="https://www.manuelflick.de/blog/aktiv-framework" target="_blank" rel="noreferrer">Originalbeitrag</a>,
        Texte hier eigene Kurzfassungen). Die Schritte laufen nacheinander, wiederholen sich aber und greifen ineinander.
        Deine Häkchen bleiben in diesem Browser.
      </p>
      <nav className="flex flex-wrap gap-2" aria-label="Phasen">
        {PHASEN.map(p => (
          <button key={p.id} onClick={() => setOffen(p.id)} className={offen === p.id ? "chip chip-on" : "chip"}
            title={p.titel}>
            <strong>{p.buchstabe === "0" ? "Start" : p.buchstabe}</strong>
            <span className="text-xs opacity-75"> {fortschritt(p)}/{p.checkliste.length}</span>
          </button>
        ))}
      </nav>
      <article className="card p-4 flex flex-col gap-3 max-w-3xl">
        <h3 className="text-xl font-semibold">{phase.buchstabe !== "0" && `${phase.buchstabe} · `}{phase.titel}</h3>
        <p>{phase.ziel}</p>
        <p className="text-sm text-muted"><strong>Auf Schulebene:</strong> {phase.schule}</p>
        <ul className="flex flex-col gap-1">
          {phase.checkliste.map((t, i) => {
            const k = `${phase.id}-${i}`;
            return (
              <li key={k}>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={!!haken[k]}
                    onChange={() => setHaken(h => ({ ...h, [k]: !h[k] }))} />
                  <span>{t}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          {phase.werkzeug && (
            <button className="btn-primary" onClick={() => onSprung(phase.werkzeug!.ziel)}>➜ {phase.werkzeug.titel}</button>
          )}
          {phase.vorlagen.map(v => (
            <button key={v} className="btn-secondary" onClick={() => vorlage(v)}>⬇️ {VORLAGEN[v].titel}</button>
          ))}
        </div>
      </article>
    </div>
  );
}
