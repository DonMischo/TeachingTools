"use client";
/**
 * Fragmente nach Klasse und Unterrichtseinheit einordnen — die Kategorien einer
 * Sammlung kommen aus dem Curriculinator (»🗂️ Sammlung anlegen«).
 */
import { createContext, useContext } from "react";
import type { FragmentKategorie, FragmentOrt } from "@/lib/api";

// ── Einordnung nach Klasse / Unterrichtseinheit (Kategorien der Sammlung) ─────
// Die Kategorien kommen aus dem Curriculinator; »vorgabe« ist der aktive Filter,
// den neue Karten und Clippings übernehmen.
export const Einordnung = createContext<{ kategorien: FragmentKategorie[]; vorgabe: FragmentOrt }>(
  { kategorien: [], vorgabe: { klasse: null, einheit: null } });

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
