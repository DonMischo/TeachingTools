"use client";
/**
 * Material an Unterrichtseinheit oder Karte: Simulationen, Werkzeuge
 * (TaskCrawler, Caputh …), Fragmente (Pinnwand, Karte, Clipping) und freie
 * Links — dieselbe Auswahl wie im Stundenplaner (ToolPicker + tool-refs).
 * Werkzeuge mit Klassenbindung fragen beim Öffnen nach der Klasse.
 */
import { createContext, useContext, useEffect, useState } from "react";
import { api, type ClassOut, type ToolLink, type ToolRefs } from "@/lib/api";
import { launchTool } from "@/lib/toolLaunch";
import { ToolPicker } from "@/components/ToolPicker";
import type { Verknuepfung } from "@/lib/curriculum/modell";

let refsLaden: Promise<ToolRefs> | null = null;

/** Fragmente-Sammlung des Plans: »+ Material« bietet dann nur deren Karten und Clippings an. */
export const MaterialSammlung = createContext<number | null>(null);
let klassenLaden: Promise<ClassOut[]> | null = null;

export function Verknuepfungen({ links, onChange, klasse, klein }: {
  links: Verknuepfung[] | undefined;
  /** fehlt → nur öffnen, nicht ändern */
  onChange?: (links: Verknuepfung[]) => void;
  /** Klassenstufe für Werkzeuge mit Klassenbindung (Vorauswahl) */
  klasse?: number;
  klein?: boolean;
}) {
  const liste = links ?? [];
  const sammlung = useContext(MaterialSammlung);
  const [refs, setRefs] = useState<ToolRefs | null>(null);
  const [waehlen, setWaehlen] = useState(false);
  const [klassenFrage, setKlassenFrage] = useState<{ link: Verknuepfung; klassen: ClassOut[] } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  // Bei jedem Öffnen frisch laden (der Picker lädt selbst noch einmal nach).
  useEffect(() => {
    if (!waehlen) return;
    setRefs(null);
    refsLaden = api.stundenplaner.toolRefs();
    refsLaden.then(setRefs, e => { refsLaden = null; setFehler(e.message); setWaehlen(false); });
  }, [waehlen]);

  const starten = async (link: Verknuepfung, code?: string) => {
    setFehler(null);
    // Fenster sofort öffnen (sonst blockt der Browser es nach dem await als Popup)
    const fenster = window.open("about:blank", "_blank");
    try {
      const url = await launchTool(link as ToolLink, code);
      if (fenster) fenster.location.href = url; else window.open(url, "_blank");
    } catch (e: any) {
      fenster?.close();
      setFehler(e.message ?? "Öffnen fehlgeschlagen");
    }
  };

  const oeffnen = async (link: Verknuepfung) => {
    const info = (await (refsLaden ??= api.stundenplaner.toolRefs()).catch(() => null))?.find(t => t.type === link.type);
    if (!info?.uses_class) return starten(link);
    const alle = await (klassenLaden ??= api.classes.list()).catch(() => [] as ClassOut[]);
    const passend = klasse ? alle.filter(c => new RegExp(`^${klasse}\D`).test(c.code)) : [];
    setKlassenFrage({ link, klassen: passend.length ? passend : alle });
  };

  const chip = klein ? "text-[11px] px-1.5 py-0" : "text-xs px-2 py-0.5";
  return (
    <div className="flex flex-wrap items-center gap-1" onClick={e => e.stopPropagation()}>
      {liste.map((l, i) => (
        <span key={i} className={`inline-flex items-center gap-1 rounded-full border border-line bg-page ${chip}`}>
          <button className="hover:text-accent max-w-[14rem] truncate" title={`${l.label} öffnen`} onClick={() => oeffnen(l)}>▶ {l.label}</button>
          {onChange && (
            <button className="text-muted hover:text-bad" title="Verknüpfung entfernen" aria-label={`${l.label} entfernen`}
              onClick={() => onChange(liste.filter((_, j) => j !== i))}>✕</button>
          )}
        </span>
      ))}
      {onChange && (
        <button className={`rounded-full border border-dashed border-line text-muted hover:text-accent hover:border-accent ${chip}`}
          onClick={() => setWaehlen(true)}>+ Material</button>
      )}
      {klassenFrage && (
        <span className={`inline-flex items-center gap-1 ${chip}`}>
          <select className="input py-0.5 text-xs" defaultValue="" aria-label="Klasse wählen"
            onChange={e => { const c = e.target.value; setKlassenFrage(null); if (c) starten(klassenFrage.link, c); }}>
            <option value="" disabled>Klasse für {klassenFrage.link.label}…</option>
            {klassenFrage.klassen.map(c => <option key={c.id} value={c.code}>{c.display_name || c.code}</option>)}
          </select>
          <button className="text-muted" onClick={() => setKlassenFrage(null)} aria-label="Abbrechen">✕</button>
        </span>
      )}
      {fehler && <span className="text-xs text-bad">{fehler}</span>}
      {waehlen && refs && onChange && (
        <ToolPicker refs={refs} sammlung={sammlung} onClose={() => setWaehlen(false)}
          onConfirm={link => { onChange([...liste, { type: link.type, ref_id: link.ref_id, url: link.url ?? null, label: link.label }]); setWaehlen(false); }} />
      )}
    </div>
  );
}
