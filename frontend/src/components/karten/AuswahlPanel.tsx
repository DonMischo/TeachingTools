"use client";
/**
 * Seitenleiste im Modus »Auswählen«: Ebene wählen, Objekte per Klick oder
 * Suche hinzufügen, Reihenfolge ändern, »alle« oder »nur Auswahl« zeigen,
 * Nummernschema wählen.
 */
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Feature, FeatureCollection } from "geojson";
import type { Ebene } from "@/lib/karten/stil";
import { NUMMERIERUNGEN, type EbenenAuswahl, type Nummerierung } from "@/lib/karten/nummern";
import { leereAuswahl, schalteObjekt, type SatzInhalt } from "@/lib/karten/satz";

/** Kleiner Zusatz in Listen, damit gleichnamige Objekte unterscheidbar sind (zwei »Ilm«) */
export function zusatz(f?: Feature): string {
  const p = f?.properties ?? {};
  if (p.hoehe) return `${p.hoehe} m`;
  if (p.ew) return `${Number(p.ew).toLocaleString("de-DE")} Einw.`;
  if (p.klasse) return p.land ?? `Klasse ${p.klasse}`;
  return p.land ?? p.kurz ?? "";
}

export default function AuswahlPanel({ ebenen, aktiv, setAktiv, inhalt, setInhalt, daten, nummern }: {
  ebenen: Ebene[];
  aktiv: string;
  setAktiv: (id: string) => void;
  inhalt: SatzInhalt;
  setInhalt: Dispatch<SetStateAction<SatzInhalt>>;
  daten: Record<string, FeatureCollection | undefined>;
  nummern: Record<string, Record<string, string>>;
}) {
  const [suche, setSuche] = useState("");
  const wahl = inhalt.auswahl[aktiv] ?? leereAuswahl();
  const nachId = useMemo(() => new Map((daten[aktiv]?.features ?? []).map((f) => [String(f.properties?.id), f])), [daten, aktiv]);

  const treffer = useMemo(() => {
    const s = suche.trim().toLocaleLowerCase("de");
    if (s.length < 2) return [];
    return (daten[aktiv]?.features ?? [])
      .filter((f) => String(f.properties?.name ?? "").toLocaleLowerCase("de").includes(s))
      .sort((a, b) => Number(!String(a.properties?.name).toLocaleLowerCase("de").startsWith(s))
        - Number(!String(b.properties?.name).toLocaleLowerCase("de").startsWith(s)))
      .slice(0, 8);
  }, [suche, daten, aktiv]);

  const setze = (aenderung: Partial<EbenenAuswahl>) =>
    setInhalt((v) => ({ ...v, auswahl: { ...v.auswahl, [aktiv]: { ...(v.auswahl[aktiv] ?? leereAuswahl()), ...aenderung } } }));
  const schiebe = (i: number, d: -1 | 1) => {
    const o = [...wahl.objekte];
    [o[i], o[i + d]] = [o[i + d], o[i]];
    setze({ objekte: o });
  };

  if (!ebenen.length) return <p className="text-muted">Zuerst unter »Ansehen« eine Ebene einschalten.</p>;
  const aktivDa = ebenen.some((e) => e.id === aktiv);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-black uppercase tracking-wide text-muted">Ebene</span>
        <select value={aktivDa ? aktiv : ""} onChange={(e) => { setAktiv(e.target.value); setSuche(""); }}
          className="px-2 py-1.5 rounded-lg border border-line bg-page">
          {!aktivDa && <option value="">— wählen —</option>}
          {ebenen.map((e) => (
            <option key={e.id} value={e.id}>{e.name}{inhalt.auswahl[e.id]?.objekte.length ? ` (${inhalt.auswahl[e.id].objekte.length})` : ""}</option>
          ))}
        </select>
      </label>

      {aktivDa && <>
        <p className="text-xs text-muted">Klick auf die Karte wählt ein Objekt aus oder wieder ab. Rot umrandet = ausgewählt.</p>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-muted">Auf der Karte</span>
          {([["alle", "alle zeigen"], ["auswahl", "nur Auswahl zeigen"]] as const).map(([w, t]) => (
            <label key={w} className="flex items-center gap-2">
              <input type="radio" name="zeigen" checked={wahl.zeigen === w} onChange={() => setze({ zeigen: w })} /> {t}
            </label>
          ))}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-muted">Nummern</span>
          <select value={wahl.nummerierung} onChange={(e) => setze({ nummerierung: e.target.value as Nummerierung })}
            className="px-2 py-1.5 rounded-lg border border-line bg-page">
            {NUMMERIERUNGEN.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </label>

        <div className="flex flex-col gap-1 relative">
          <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Suchen und hinzufügen …"
            className="px-2 py-1.5 rounded-lg border border-line bg-page" />
          {treffer.length > 0 && (
            <ul className="rounded-lg border border-line bg-page divide-y divide-line">
              {treffer.map((f) => {
                const id = String(f.properties?.id);
                const drin = wahl.objekte.includes(id);
                return (
                  <li key={id}>
                    <button className="w-full text-left px-2 py-1 hover:bg-surface-hover flex justify-between gap-2"
                      onClick={() => { setInhalt((v) => schalteObjekt(v, aktiv, id)); setSuche(""); }}>
                      <span>{drin ? "✓ " : ""}{f.properties?.name}</span>
                      <span className="text-muted text-xs">{zusatz(f)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <ol className="flex flex-col gap-1">
          {wahl.objekte.map((id, i) => (
            <li key={id} className="flex items-center gap-2">
              <span className="w-8 text-right font-black text-bad">{nummern[aktiv]?.[id] ?? "·"}</span>
              <span className="flex-1 truncate" title={zusatz(nachId.get(id))}>{String(nachId.get(id)?.properties?.name ?? id)}</span>
              <button aria-label="nach oben" disabled={i === 0} onClick={() => schiebe(i, -1)} className="px-1 disabled:opacity-30">↑</button>
              <button aria-label="nach unten" disabled={i === wahl.objekte.length - 1} onClick={() => schiebe(i, 1)} className="px-1 disabled:opacity-30">↓</button>
              <button aria-label="entfernen" onClick={() => setze({ objekte: wahl.objekte.filter((o) => o !== id) })} className="px-1">🗑</button>
            </li>
          ))}
        </ol>
        {wahl.objekte.length > 0 && (
          <button className="self-start text-xs text-muted hover:underline" onClick={() => setze({ objekte: [] })}>
            Auswahl dieser Ebene leeren
          </button>
        )}
      </>}
    </div>
  );
}
