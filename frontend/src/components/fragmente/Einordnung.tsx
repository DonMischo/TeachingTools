"use client";
/**
 * Fragmente einordnen: erst die Kategorie (der Tab: Allgemein, Unterrichtsmaterial,
 * Leistungskontrollen …), dann — außer bei Allgemein — Klasse und
 * Unterrichtseinheit. Die Klassen und Einheiten einer Sammlung kommen aus dem
 * Curriculinator (»🗂️ Sammlung anlegen«).
 */
import { createContext, useContext } from "react";
import type { FragmentKategorie, FragmentOrt } from "@/lib/api";

// ── Einordnung nach Klasse / Unterrichtseinheit (Kategorien der Sammlung) ─────
// Die Kategorien kommen aus dem Curriculinator; »vorgabe« ist der aktive Filter,
// den neue Karten und Clippings übernehmen.
export const Einordnung = createContext<{
  kategorien: FragmentKategorie[];
  vorgabe: FragmentOrt;
  /** Tabs der Sammlung = Kategorien zum Einordnen */
  tabs?: string[];
  /** Art der Sammlung (»materialsammlung« nennt den Schnipsel-Tab »Allgemein«) */
  art?: string;
}>({ kategorien: [], vorgabe: { klasse: null, einheit: null } });

/** Der eingebaute Tab ohne Aufteilung nach Klasse und Einheit. */
export const ALLGEMEIN = "snippets";
export const OHNE_ORT: FragmentOrt = { klasse: null, einheit: null };

/** Anzeigename eines Tabs; in Materialsammlungen heißt »snippets« Allgemein. */
export function tabName(t: string, art?: string): string {
  if (t === ALLGEMEIN) return art === "materialsammlung" ? "Allgemein" : "Schnipsel";
  if (t === "archive") return "Archiv";
  return t;
}

export const ortWert = (o: FragmentOrt) => (o.klasse == null ? "" : `${o.klasse}|${o.einheit ?? ""}`);
export const ortAus = (v: string): FragmentOrt => {
  if (!v) return { klasse: null, einheit: null };
  const [k, e] = v.split("|");
  return { klasse: Number(k), einheit: e || null };
};
export function ortText(kategorien: FragmentKategorie[], o: FragmentOrt): string {
  if (o.klasse == null) return "";
  const e = kategorien.find(k => k.klasse === o.klasse)?.einheiten.find(x => x.id === o.einheit);
  return `Kl. ${o.klasse}${o.einheit ? ` · ${e?.titel ?? o.einheit}` : ""}`;
}

/** Ein Auswahlfeld: nicht eingeordnet | Klasse | Klasse · Unterrichtseinheit */
export function OrtWahl({ wert, onChange, className = "" }: { wert: FragmentOrt; onChange: (o: FragmentOrt) => void; className?: string }) {
  const { kategorien } = useContext(Einordnung);
  if (!kategorien.length) return null;
  return (
    <select className={className} value={ortWert(wert)} onChange={e => onChange(ortAus(e.target.value))} aria-label="Klasse und Unterrichtseinheit">
      <option value="">— nicht eingeordnet —</option>
      {kategorien.map(k => (
        <optgroup key={k.klasse} label={`Klasse ${k.klasse}`}>
          <option value={`${k.klasse}|`}>Klasse {k.klasse} (allgemein)</option>
          {k.einheiten.map(e => <option key={e.id} value={`${k.klasse}|${e.id}`}>Kl. {k.klasse} · {e.titel}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

/**
 * Erst die Kategorie (Tab), dann Klasse und Einheit. Allgemein hat keine
 * Aufteilung: wer dorthin wechselt, verliert Klasse und Einheit. Ohne
 * Kategorien (Sammlung nicht aus dem Curriculinator) bleibt das Feld leer.
 */
export function EinordnenWahl({ tab, ort, onChange, className = "" }: {
  tab: string;
  ort: FragmentOrt;
  onChange: (tab: string, ort: FragmentOrt) => void;
  className?: string;
}) {
  const { kategorien, tabs = [], art } = useContext(Einordnung);
  if (!kategorien.length) return null;
  // Ins Archiv verschiebt man anders; nur zeigen, wenn der Eintrag schon dort liegt.
  const wahl = tabs.filter(t => t !== "archive" || t === tab);
  return (
    <span className="flex flex-wrap gap-1 min-w-0">
      <select className={className} value={tab} aria-label="Kategorie"
        onChange={e => onChange(e.target.value, e.target.value === ALLGEMEIN ? OHNE_ORT : ort)}>
        {wahl.map(t => <option key={t} value={t}>{tabName(t, art)}</option>)}
      </select>
      {tab !== ALLGEMEIN && <OrtWahl wert={ort} onChange={o => onChange(tab, o)} className={className} />}
    </span>
  );
}
